// Shared HTTP helpers for edge functions: CORS, JSON responses, safe errors.

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** An error whose message is safe to show to the caller. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

/**
 * Convert any thrown value into a response. HttpError messages are returned to
 * the client; everything else is logged server-side and replaced by a generic
 * message so Stripe/Postgres internals never leak.
 */
export function errorResponse(fn: string, err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  console.error(`[${fn}] unexpected error`, err);
  return json({ error: 'Something went wrong. Please try again.' }, 500);
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object') return body as T;
  } catch {
    // fall through
  }
  return {} as T;
}

/** Constant-time string comparison (for shared-secret headers). */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
