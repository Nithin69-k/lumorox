/**
 * Small retry helper for background DB writes.
 * - Exponential backoff with jitter
 * - Only retries transient failures (network / 5xx / timeouts)
 * - Never retries auth or validation errors (4xx)
 */

export class NonRetryableError extends Error {}

function statusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { status?: number; statusCode?: number; response?: { status?: number } };
  return e.status ?? e.statusCode ?? e.response?.status;
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof NonRetryableError) return false;
  const status = statusOf(err);
  if (status === undefined) return true; // network / unknown → worth a retry
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500;
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  onRetry?: (attempt: number, err: unknown) => void;
}

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 400, maxDelayMs = 5000, signal, onRetry } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new NonRetryableError("aborted");
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryable(err)) break;
      onRetry?.(attempt + 1, err);
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.random() * backoff * 0.3;
      await new Promise((r) => setTimeout(r, backoff + jitter));
    }
  }
  throw lastErr;
}

/**
 * Serializes writes per key so rapid toggles/ratings on the same movie can't
 * land out of order (last intent wins).
 */
const chains = new Map<string, Promise<unknown>>();

export function enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  chains.set(key, next);
  void next.catch(() => undefined).finally(() => {
    if (chains.get(key) === next) chains.delete(key);
  });
  return next;
}
