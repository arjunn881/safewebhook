/**
 * CORS and Security Headers for Edge API Endpoints
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

/**
 * Validates endpoint_id to prevent injection, malformed URLs, or path traversal
 */
export function isValidEndpointId(endpointId: string | undefined): boolean {
  if (!endpointId) return false;
  // Allow alphanumeric, dashes, and underscores between 1 and 64 characters
  return /^[a-zA-Z0-9_-]{1,64}$/.test(endpointId);
}

/**
 * Safely extracts all incoming request headers into a plain key-value map
 */
export function extractHeaders(request: Request): Record<string, string> {
  const headersObj: Record<string, string> = {};
  
  for (const [key, value] of request.headers.entries()) {
    headersObj[key.toLowerCase()] = value;
  }

  return headersObj;
}

/**
 * Creates a JSON response with standard CORS and no-cache headers
 */
export function jsonResponse(
  data: unknown,
  status: number = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

/**
 * Creates an error response with standard JSON formatting
 */
export function errorResponse(
  message: string,
  status: number = 400
): Response {
  return jsonResponse({ success: false, error: message }, status);
}

/**
 * Safe body reader that limits the maximum allowed payload size (default: 2MB)
 * Prevents memory exhaustion attacks on edge worker runtimes
 */
export async function readRequestBody(
  request: Request,
  maxSizeBytes: number = 2 * 1024 * 1024
): Promise<{ bodyText: string | null; byteSize: number }> {
  // Methods that typically don't have bodies
  if (['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    return { bodyText: null, byteSize: 0 };
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
    throw new Error(`Payload too large: Maximum allowed size is ${maxSizeBytes / (1024 * 1024)}MB`);
  }

  try {
    const text = await request.text();
    if (!text || text.length === 0) {
      return { bodyText: null, byteSize: 0 };
    }

    const byteSize = new TextEncoder().encode(text).length;
    if (byteSize > maxSizeBytes) {
      throw new Error(`Payload too large: Body exceeds ${maxSizeBytes / (1024 * 1024)}MB`);
    }

    return { bodyText: text, byteSize };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Payload too large')) {
      throw err;
    }
    // Return null if request body cannot be read or is empty
    return { bodyText: null, byteSize: 0 };
  }
}
