-- Cloudflare D1 SQL Schema for Webhook Tester
-- Table: webhooks

CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY NOT NULL,              -- Unique Webhook UUID (crypto.randomUUID())
    endpoint_id TEXT NOT NULL,                  -- Inbound endpoint identifier
    timestamp TEXT NOT NULL,                    -- ISO-8601 UTC timestamp string (e.g. 2026-08-18T18:25:00.000Z)
    method TEXT NOT NULL,                       -- HTTP Method (GET, POST, PUT, DELETE, PATCH, etc.)
    headers TEXT NOT NULL,                      -- Serialized JSON object of request headers
    body TEXT                                   -- Raw incoming request body payload
);

-- Index for ultra-fast history lookups ordered newest first
CREATE INDEX IF NOT EXISTS idx_webhooks_endpoint_timestamp 
ON webhooks (endpoint_id, timestamp DESC);

-- Index for high-efficiency 24-hour TTL expiration purge
CREATE INDEX IF NOT EXISTS idx_webhooks_timestamp 
ON webhooks (timestamp);
