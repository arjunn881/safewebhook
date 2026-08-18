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
