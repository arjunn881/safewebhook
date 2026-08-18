-- Migration: 0001_initial.sql
-- Description: Create webhooks table and indexes for endpoint querying and TTL cleanup

CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY NOT NULL,
    endpoint_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    method TEXT NOT NULL,
    headers TEXT NOT NULL,
    body TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhooks_endpoint_timestamp 
ON webhooks (endpoint_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_webhooks_timestamp 
ON webhooks (timestamp);
