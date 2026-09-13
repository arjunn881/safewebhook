import type { APIRoute } from 'astro';
import { broadcastWebhook } from '../../../lib/streams';
import { saveWebhookPayload } from '../../../lib/kv_store';
import { safeGetDatabase, insertWebhook } from '../../../lib/db';
import { isValidEndpointId, CORS_HEADERS, jsonResponse, errorResponse } from '../../../lib/http';
import { checkRateLimit, rateLimitResponse, rateLimitHeaders } from '../../../lib/rate_limit';
import { env } from 'cloudflare:workers';

export const prerender = false;

interface EmailPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; size: number; contentType: string }>;
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    },
  });
};

/**
 * Inbound Email Webhook Ingestion API
 * Accepts emails from Mailgun, SendGrid, Amazon SES, Postmark, or manual test dispatches
 */
export const POST: APIRoute = async (context) => {
  const { params, request } = context;
  const ctx = (context.locals as { cfContext?: ExecutionContext }).cfContext;
  const endpointId = params.endpoint_id;

  if (!isValidEndpointId(endpointId)) {
    return errorResponse('Invalid endpoint_id parameter', 400);
  }

  // Rate Limiting: 60 emails/min per endpoint
  const kv = (env as unknown as Record<string, KVNamespace | undefined>)?.SESSION ?? null;
  const rlResult = await checkRateLimit(kv, `rl:email:${endpointId}`, 60, 60_000);
  if (!rlResult.allowed) {
    try {
      if (!request.bodyUsed) {
        await request.text();
      }
    } catch {}
    return rateLimitResponse(rlResult);
  }

  try {
    let emailData: EmailPayload = {};
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const rawText = await request.text();
      try {
        emailData = (rawText ? JSON.parse(rawText) : {}) as EmailPayload;
      } catch {
        // Fallback for relaxed or PowerShell unquoted JSON: {from:alice@example.com,subject:Payment Received,text:Invoice paid}
        const extracted: EmailPayload = {};
        const fromMatch = rawText.match(/from\s*:\s*([^,}\n]+)/i);
        const toMatch = rawText.match(/to\s*:\s*([^,}\n]+)/i);
        const subjectMatch = rawText.match(/subject\s*:\s*([^,}\n]+)/i);
        const textMatch = rawText.match(/text\s*:\s*([^,}\n]+)/i);
        const htmlMatch = rawText.match(/html\s*:\s*([^,}\n]+)/i);

        if (fromMatch || subjectMatch || textMatch) {
          if (fromMatch) extracted.from = fromMatch[1].trim().replace(/^['"]|['"]$/g, '');
          if (toMatch) extracted.to = toMatch[1].trim().replace(/^['"]|['"]$/g, '');
          if (subjectMatch) extracted.subject = subjectMatch[1].trim().replace(/^['"]|['"]$/g, '');
          if (textMatch) extracted.text = textMatch[1].trim().replace(/^['"]|['"]$/g, '');
          if (htmlMatch) extracted.html = htmlMatch[1].trim().replace(/^['"]|['"]$/g, '');
          emailData = extracted;
        } else {
          emailData = {
            from: 'sender@example.com',
            to: `${endpointId}@inbound.tester`,
            subject: 'Raw Inbound Message',
            text: rawText,
          };
        }
      }
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      emailData = {
        from: (formData.get('from') || formData.get('sender') || 'sender@example.com') as string,
        to: (formData.get('to') || formData.get('recipient') || `${endpointId}@inbound.tester`) as string,
        subject: (formData.get('subject') || 'No Subject') as string,
        text: (formData.get('text') || formData.get('body-plain') || '') as string,
        html: (formData.get('html') || formData.get('body-html') || '') as string,
      };
    } else {
      const rawText = await request.text();
      emailData = {
        from: 'unknown@example.com',
        to: `${endpointId}@inbound.tester`,
        subject: 'Raw Inbound Message',
        text: rawText,
      };
    }

    const clientIp = request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      '127.0.0.1';

    // Broadcast email as specialized event
    const broadcastEvent = {
      id: 'em_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      method: 'EMAIL',
      url: `/api/email/${endpointId}`,
      path: `/api/email/${endpointId}`,
      timestamp: new Date().toISOString(),
      client_ip: clientIp,
      content_type: contentType || 'application/json',
      content_length: JSON.stringify(emailData).length,
      headers: {
        'from': emailData.from || 'sender@example.com',
        'to': emailData.to || `${endpointId}@inbound.tester`,
        'subject': emailData.subject || 'No Subject',
        'content-type': contentType || 'message/rfc822',
      },
      query_params: {},
      body: JSON.stringify(emailData, null, 2),
      is_email: true,
      email: {
        from: emailData.from || 'sender@example.com',
        to: emailData.to || `${endpointId}@inbound.tester`,
        subject: emailData.subject || 'No Subject',
        text: emailData.text || '',
        html: emailData.html || '',
      },
    };

    const deliveryResult = broadcastWebhook(endpointId!, broadcastEvent);
    const kvWrite = saveWebhookPayload(endpointId!, broadcastEvent as any);
    if (ctx?.waitUntil) {
      ctx.waitUntil(kvWrite);
    }

    // Persist to Cloudflare D1 Database
    const db = safeGetDatabase(context);
    if (db) {
      const d1Promise = insertWebhook(db, {
        id: broadcastEvent.id,
        endpoint_id: endpointId!,
        timestamp: broadcastEvent.timestamp,
        method: 'EMAIL',
        headers: JSON.stringify(broadcastEvent.headers),
        body: broadcastEvent.body,
      }).catch((err) => console.error('[D1 Email Insert Error]', err));

      if (ctx?.waitUntil) {
        ctx.waitUntil(d1Promise);
      }
    }

    return jsonResponse(
      {
        success: true,
        message: 'Email ingested and broadcast to stream',
        delivered: deliveryResult.delivered,
        recipients: deliveryResult.recipientCount,
        event_id: broadcastEvent.id,
      },
      200,
      rateLimitHeaders(rlResult)
    );
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(`Failed to process email webhook: ${error.message}`, 400);
  }
};
