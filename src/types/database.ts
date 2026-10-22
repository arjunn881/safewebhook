import type { D1Database } from '@cloudflare/workers-types';

/**
 * Raw Webhook record as stored in the Cloudflare D1 database
 */
export interface WebhookRecord {
  id: string;
  endpoint_id: string;
  timestamp: string;
  method: string;
  headers: string; // JSON-serialized string
  body: string | null;
  size_bytes?: number;
}

/**
 * Parsed webhook item returned to consumers/history API
 */
export interface WebhookHistoryItem {
  id: string;
  endpoint_id: string;
  timestamp: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  size_bytes?: number;
  query_params?: Record<string, string>;
  format?: string;
  signature_provider?: string | null;
  client_ip?: string;
  url?: string;
  path?: string;
  is_email?: boolean;
  email?: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{ filename: string; size: number; contentType: string }>;
  } | null;
}

/**
 * Cloudflare Worker Environment bindings
 */
export interface Env {
  DB: D1Database;
  CRON_SECRET?: string;
  [key: string]: unknown;
}

/**
 * Standard API Response envelopes
 */
export interface InboundWebhookResponse {
  success: boolean;
  id?: string;
  endpoint_id?: string;
  method?: string;
  timestamp?: string;
  size_bytes?: number;
  error?: string;
}

export interface WebhookHistoryResponse {
  success: boolean;
  endpoint_id: string;
  count: number;
  webhooks: WebhookHistoryItem[];
  error?: string;
}

export interface CleanupResponse {
  success: boolean;
  deleted_count: number;
  cutoff_timestamp: string;
  execution_time_ms: number;
  error?: string;
}
