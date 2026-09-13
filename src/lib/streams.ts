/**
 * In-Memory Server-Sent Events (SSE) Stream Registry & Response Config Engine
 * Zero-storage, high-throughput edge event router & workflow automation manager
 */

export interface EndpointResponseConfig {
  statusCode: number;
  contentType: string;
  responseBody: string;
  responseHeaders: Record<string, string>;
  delayMs: number;
}

export interface WorkflowRule {
  enabled: boolean;
  autoForwardUrl?: string;
  jsTransformCode?: string;
  filterCondition?: string; // e.g. "method === 'POST'"
  notifyWebhookUrl?: string; // e.g. Discord / Slack webhook
}

// Global scope initialization for Cloudflare Edge & Node runtimes
const globalScope = globalThis as unknown as {
  activeStreams?: Map<string, Set<ReadableStreamDefaultController>>;
  endpointConfigs?: Map<string, EndpointResponseConfig>;
  endpointWorkflows?: Map<string, WorkflowRule>;
};

if (!globalScope.activeStreams) {
  globalScope.activeStreams = new Map<string, Set<ReadableStreamDefaultController>>();
}

if (!globalScope.endpointConfigs) {
  globalScope.endpointConfigs = new Map<string, EndpointResponseConfig>();
}

if (!globalScope.endpointWorkflows) {
  globalScope.endpointWorkflows = new Map<string, WorkflowRule>();
}

/**
 * Global Map object tracking open user SSE connections by endpoint_id
 */
export const activeStreams: Map<string, Set<ReadableStreamDefaultController>> = globalScope.activeStreams;

/**
 * Global Map object tracking custom response configurations per endpoint_id
 */
export const endpointConfigs: Map<string, EndpointResponseConfig> = globalScope.endpointConfigs;

/**
 * Global Map object tracking automated workflows per endpoint_id
 */
export const endpointWorkflows: Map<string, WorkflowRule> = globalScope.endpointWorkflows;

const textEncoder = new TextEncoder();

/**
 * Default fallback response configuration
 */
export const DEFAULT_ENDPOINT_CONFIG: EndpointResponseConfig = {
  statusCode: 200,
  contentType: 'application/json',
  responseBody: JSON.stringify({ success: true, message: 'Webhook received' }),
  responseHeaders: {},
  delayMs: 0,
};

/**
 * Default workflow rule
 */
export const DEFAULT_WORKFLOW_RULE: WorkflowRule = {
  enabled: false,
  autoForwardUrl: '',
  jsTransformCode: '',
  filterCondition: '',
  notifyWebhookUrl: '',
};

/**
 * Registers an active SSE controller for a specific endpoint_id
 */
export function registerStream(
  endpointId: string,
  controller: ReadableStreamDefaultController
): void {
  let listeners = activeStreams.get(endpointId);
  if (!listeners) {
    listeners = new Set<ReadableStreamDefaultController>();
    activeStreams.set(endpointId, listeners);
  }
  listeners.add(controller);
}

/**
 * Unregisters an SSE controller when client disconnects
 */
export function unregisterStream(
  endpointId: string,
  controller: ReadableStreamDefaultController
): void {
  const listeners = activeStreams.get(endpointId);
  if (listeners) {
    listeners.delete(controller);
    if (listeners.size === 0) {
      activeStreams.delete(endpointId);
    }
  }
}

/**
 * Checks whether an endpoint has any currently active listening clients
 */
export function hasActiveListeners(endpointId: string): boolean {
  const listeners = activeStreams.get(endpointId);
  return !!listeners && listeners.size > 0;
}

/**
 * Broadcasts an incoming webhook or email payload to all connected SSE clients for the endpoint
 */
export function broadcastWebhook(
  endpointId: string,
  payload: unknown
): { delivered: boolean; recipientCount: number } {
  const listeners = activeStreams.get(endpointId);
  if (!listeners || listeners.size === 0) {
    return { delivered: false, recipientCount: 0 };
  }

  const sseChunk = textEncoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  const deadControllers: ReadableStreamDefaultController[] = [];

  listeners.forEach((controller) => {
    try {
      controller.enqueue(sseChunk);
    } catch {
      deadControllers.push(controller);
    }
  });

  // Clean up any broken controllers
  deadControllers.forEach((dc) => {
    listeners.delete(dc);
    try {
      dc.close();
    } catch {
      // Ignore if already closed or aborted
    }
  });
  if (listeners.size === 0) {
    activeStreams.delete(endpointId);
  }

  return { delivered: true, recipientCount: listeners.size };
}

/**
 * Sends a single keep-alive ping chunk to a controller
 */
export function sendKeepAlive(controller: ReadableStreamDefaultController): boolean {
  try {
    controller.enqueue(textEncoder.encode(': ping\n\n'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a keep-alive comment chunk down all active connections for an endpoint
 */
export function pingStream(endpointId: string): void {
  const listeners = activeStreams.get(endpointId);
  if (!listeners || listeners.size === 0) return;

  const pingChunk = textEncoder.encode(': ping\n\n');
  const deadControllers: ReadableStreamDefaultController[] = [];

  listeners.forEach((controller) => {
    try {
      controller.enqueue(pingChunk);
    } catch {
      deadControllers.push(controller);
    }
  });

  deadControllers.forEach((dc) => {
    listeners.delete(dc);
    try {
      dc.close();
    } catch {
      // Ignore if already closed or aborted
    }
  });
  if (listeners.size === 0) {
    activeStreams.delete(endpointId);
  }
}

/**
 * Gets custom response configuration for an endpoint
 */
export function getEndpointConfig(endpointId: string): EndpointResponseConfig {
  return endpointConfigs.get(endpointId) || { ...DEFAULT_ENDPOINT_CONFIG };
}

/**
 * Updates custom response configuration for an endpoint
 */
export function setEndpointConfig(
  endpointId: string,
  config: Partial<EndpointResponseConfig>
): EndpointResponseConfig {
  const current = getEndpointConfig(endpointId);
  const updated: EndpointResponseConfig = {
    statusCode: typeof config.statusCode === 'number' ? config.statusCode : current.statusCode,
    contentType: config.contentType ? String(config.contentType) : current.contentType,
    responseBody: config.responseBody !== undefined ? String(config.responseBody) : current.responseBody,
    responseHeaders: config.responseHeaders && typeof config.responseHeaders === 'object' ? config.responseHeaders : current.responseHeaders,
    delayMs: typeof config.delayMs === 'number' ? Math.max(0, Math.min(10000, config.delayMs)) : current.delayMs,
  };

  endpointConfigs.set(endpointId, updated);
  return updated;
}

/**
 * Gets workflow rule for an endpoint
 */
export function getEndpointWorkflow(endpointId: string): WorkflowRule {
  return endpointWorkflows.get(endpointId) || { ...DEFAULT_WORKFLOW_RULE };
}

/**
 * Updates workflow rule for an endpoint
 */
export function setEndpointWorkflow(
  endpointId: string,
  rule: Partial<WorkflowRule>
): WorkflowRule {
  const current = getEndpointWorkflow(endpointId);
  const updated: WorkflowRule = {
    enabled: typeof rule.enabled === 'boolean' ? rule.enabled : current.enabled,
    autoForwardUrl: rule.autoForwardUrl !== undefined ? String(rule.autoForwardUrl).trim() : current.autoForwardUrl,
    jsTransformCode: rule.jsTransformCode !== undefined ? String(rule.jsTransformCode) : current.jsTransformCode,
    filterCondition: rule.filterCondition !== undefined ? String(rule.filterCondition) : current.filterCondition,
    notifyWebhookUrl: rule.notifyWebhookUrl !== undefined ? String(rule.notifyWebhookUrl).trim() : current.notifyWebhookUrl,
  };

  endpointWorkflows.set(endpointId, updated);
  return updated;
}
