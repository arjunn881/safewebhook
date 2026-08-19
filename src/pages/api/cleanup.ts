import type { APIRoute } from 'astro';
import { safeGetDatabase, purgeOldWebhooks } from '../../lib/db';
import { jsonResponse, errorResponse, CORS_HEADERS } from '../../lib/http';
import type { CleanupResponse, Env } from '../../types/database';

export const prerender = false;

/**
 * OPTIONS Handler for CORS Preflight
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

/**
 * Cleanup Handler for purging webhooks older than 24 hours (or custom duration)
 * Can be triggered via external cron service, webhook, or Cloudflare Scheduled Worker
 */
async function handleCleanup(context: Parameters<APIRoute>[0]): Promise<Response> {
  const { request, url } = context;
  const startTime = Date.now();

  try {
    // 1. Security Check: If CRON_SECRET is configured, enforce token authorization
    const env = (context.locals?.runtime?.env as Env | undefined) ||
      (globalThis as unknown as { env?: Env }).env;
    const cronSecret = env?.CRON_SECRET;

    if (cronSecret) {
      const authHeader = request.headers.get('Authorization');
      const customSecretHeader = request.headers.get('X-Cron-Secret');
      const providedToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : customSecretHeader;

      if (providedToken !== cronSecret) {
        return errorResponse('Unauthorized: Invalid or missing cron secret', 401);
      }
    }

    // 2. Parse optional hours parameter (default: 24 hours)
    const urlObj = new URL(url);
    const hoursParam = urlObj.searchParams.get('hours');
    const maxAgeHours = hoursParam ? Math.max(1, parseInt(hoursParam, 10)) : 24;

    // 3. Execute purge query
    const db = safeGetDatabase(context);
    const { deletedCount, cutoff } = await purgeOldWebhooks(
      db,
      isNaN(maxAgeHours) ? 24 : maxAgeHours
    );

    const executionTimeMs = Date.now() - startTime;

    const response: CleanupResponse = {
      success: true,
      deleted_count: deletedCount,
      cutoff_timestamp: cutoff,
      execution_time_ms: executionTimeMs,
    };

    return jsonResponse(response, 200);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[Cleanup API Error]', error);
    return errorResponse(
      `Failed to purge expired webhooks: ${error.message || 'Internal edge error'}`,
      500
    );
  }
}

export const GET: APIRoute = handleCleanup;
export const POST: APIRoute = handleCleanup;
