import { logger } from "../logger";
import {
  getAdmintotalConfig,
  getAdmintotalMaxConcurrency,
  getAdmintotalMinIntervalMs,
  type AdmintotalConfig,
} from "./config";

// Generic Admintotal REST API v2 client:
//  - logs in once and caches the api_key in memory
//  - sends the `Api-key` header on every request
//  - re-authenticates once on 401
//  - follows cursor pagination (`next`) up to the full result set
//  - retries transient failures (429 / 5xx / network) with backoff

export class AdmintotalError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "AdmintotalError";
    this.status = status;
    this.body = body;
  }
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

// The `productos` endpoint is heavily 429-rate-limited, so we retry each page
// persistently (with a capped exponential backoff and honoring Retry-After)
// rather than giving up after a couple of tries — every extra page landed in a
// single tick shortens how long the catalog reads "Consultar". A page that
// still fails after all retries doesn't lose progress: the streaming pull
// records where to resume and the next scheduler tick continues from there.
const MAX_RETRIES = 8;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 15_000;
const PAGE_LIMIT = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exponential backoff with jitter (50–100% of the exponential window) so several
// callers retrying after the same 429 don't reconverge into a thundering herd.
// Capped at MAX_BACKOFF_MS so a high attempt count can't sleep absurdly long.
function backoffWithJitter(attempt: number): number {
  const exp = BASE_BACKOFF_MS * 2 ** attempt;
  const jittered = exp * (0.5 + Math.random() * 0.5);
  return Math.min(jittered, MAX_BACKOFF_MS);
}

// Process-wide limiter shared by EVERY Admintotal request (sync, live stock,
// pedidos). Two knobs: a hard cap on concurrent in-flight requests and a minimum
// spacing between request starts. A 429 anywhere trips a global pause that every
// queued/in-flight request honors, so one rate-limit signal backs the WHOLE
// process off instead of just the unlucky caller.
class RequestLimiter {
  private active = 0;
  private waiters: Array<() => void> = [];
  private nextSlotAt = 0;
  private pausedUntil = 0;

  constructor(
    private readonly maxConcurrency: number,
    private readonly minIntervalMs: number,
  ) {}

  // Back the whole process off for `ms` (used on a 429 Retry-After). Only ever
  // extends an existing pause, never shortens it.
  pauseFor(ms: number): void {
    if (ms <= 0) return;
    const until = Date.now() + ms;
    if (until > this.pausedUntil) this.pausedUntil = until;
  }

  private async acquire(): Promise<void> {
    // Wait for a free concurrency slot. `while` (not `if`) re-checks after a
    // wake-up so a slot freed concurrently can't be double-claimed.
    while (this.active >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active += 1;
    // Reserve a spaced start slot synchronously (no await between read+write) so
    // concurrent acquirers each get their own slot minIntervalMs apart.
    const earliest = Math.max(Date.now(), this.nextSlotAt);
    this.nextSlotAt = earliest + this.minIntervalMs;
    // Wait until our slot, and keep waiting while a global 429 pause is active —
    // re-checked each loop so a pause set AFTER we reserved still delays us.
    for (;;) {
      const now = Date.now();
      const wait = Math.max(earliest - now, this.pausedUntil - now);
      if (wait <= 0) break;
      await sleep(wait);
    }
  }

  private release(): void {
    this.active -= 1;
    const next = this.waiters.shift();
    if (next) next();
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// One limiter for the whole process. Even if a stray `new AdmintotalClient()`
// survives somewhere, every client funnels its network calls through THIS shared
// limiter, so the concurrency cap and 429 pause are truly global.
const limiter = new RequestLimiter(
  getAdmintotalMaxConcurrency(),
  getAdmintotalMinIntervalMs(),
);

export class AdmintotalClient {
  private config: AdmintotalConfig;
  private apiKey: string | null;

  constructor(config?: AdmintotalConfig) {
    this.config = config ?? getAdmintotalConfig();
    this.apiKey = this.config.apiKey ?? null;
  }

  private async login(): Promise<string> {
    const url = `${this.config.baseUrl}/usuarios/login_usuario/`;
    const res = await limiter.run(() =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
      }),
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AdmintotalError(
        `Login a Admintotal falló (${res.status})`,
        res.status,
        body,
      );
    }
    const data = (await res.json()) as { api_key?: string; apiKey?: string };
    const key = data.api_key ?? data.apiKey;
    if (!key) {
      throw new AdmintotalError(
        "Login a Admintotal no devolvió api_key",
        res.status,
        data,
      );
    }
    this.apiKey = key;
    logger.info("Admintotal: autenticado, api_key en caché");
    return key;
  }

  private async ensureKey(): Promise<string> {
    if (this.apiKey) return this.apiKey;
    return this.login();
  }

  private buildUrl(path: string, params?: Record<string, string | number>): string {
    const base = path.startsWith("http")
      ? path
      : `${this.config.baseUrl}/${path.replace(/^\//, "")}`;
    const url = new URL(base);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  // Low-level request with retry/backoff and a single re-auth on 401.
  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    attempt = 0,
    didReauth = false,
  ): Promise<T> {
    const key = await this.ensureKey();
    let res: Response;
    try {
      // The actual network call runs THROUGH the shared limiter, so its slot is
      // held only while in flight and released (even on throw) before any backoff
      // sleep below — sleeping callers never occupy a concurrency slot.
      res = await limiter.run(() =>
        fetch(url, {
          method,
          headers: {
            "Api-key": key,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: body != null ? JSON.stringify(body) : undefined,
        }),
      );
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const wait = backoffWithJitter(attempt);
        logger.warn(
          { err, url, attempt, wait },
          "Admintotal: error de red, reintentando",
        );
        await sleep(wait);
        return this.request<T>(method, url, body, attempt + 1, didReauth);
      }
      throw new AdmintotalError(
        `Error de red al llamar Admintotal: ${(err as Error).message}`,
      );
    }

    if (res.status === 401 && !didReauth) {
      logger.warn("Admintotal: 401, re-autenticando");
      this.apiKey = null;
      await this.login();
      return this.request<T>(method, url, body, attempt, true);
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isNaN(retryAfter)
          ? backoffWithJitter(attempt)
          : retryAfter * 1000;
        // A 429 means the whole account is being throttled, not just this call.
        // Trip the GLOBAL pause so every other in-flight/queued request also
        // holds off for the same window instead of piling on.
        if (res.status === 429) limiter.pauseFor(wait);
        logger.warn(
          { status: res.status, url, attempt, wait },
          "Admintotal: respuesta transitoria, reintentando",
        );
        await sleep(wait);
        return this.request<T>(method, url, body, attempt + 1, didReauth);
      }
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new AdmintotalError(
        `Admintotal respondió ${res.status} en ${url}`,
        res.status,
        errBody,
      );
    }

    return (await res.json()) as T;
  }

  // Fetch every page of a paginated endpoint, following `next`. Also reports the
  // total `count` advertised by the API and whether pagination ended naturally
  // (the `next` link became null) versus being cut short — callers that prune
  // local data use this to avoid wiping rows on an incomplete pull.
  async fetchAllWithMeta<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<{ results: T[]; expectedCount: number | null; complete: boolean }> {
    const results: T[] = [];
    let expectedCount: number | null = null;
    let complete = false;
    let url: string | null = this.buildUrl(path, {
      limit: PAGE_LIMIT,
      ...(params ?? {}),
    });
    let guard = 0;
    while (url && guard < 10_000) {
      guard += 1;
      const page: PaginatedResponse<T> = await this.request<
        PaginatedResponse<T>
      >("GET", url);
      if (expectedCount === null && typeof page.count === "number") {
        expectedCount = page.count;
      }
      if (Array.isArray(page.results)) {
        results.push(...page.results);
      } else if (Array.isArray(page as unknown as T[])) {
        // Some endpoints may return a bare array.
        results.push(...(page as unknown as T[]));
        complete = true;
        break;
      }
      url = page.next ?? null;
      if (!url) complete = true;
    }
    return { results, expectedCount, complete };
  }

  async fetchAll<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T[]> {
    return (await this.fetchAllWithMeta<T>(path, params)).results;
  }

  // Stream a paginated endpoint page-by-page, invoking `onPage` for each batch
  // as soon as it arrives instead of buffering the whole result set. This lets
  // the caller PERSIST each page immediately, so a long or rate-limited pull
  // still makes durable progress: if the ERP starts returning 429 partway
  // through, we stop gracefully (complete=false) and keep everything fetched so
  // far, rather than throwing away the entire run. `complete` is true only when
  // pagination ended naturally (the `next` link became null).
  //
  // RESUMABILITY: pass `startUrl` (a previously returned `nextUrl`) to continue
  // from where an earlier, rate-limited run stopped instead of restarting at
  // page 0. The returned `nextUrl` is the page to resume from next time: null
  // when pagination finished, or the URL of the page that failed/was pending
  // when a 429 cut the run short. Because the API paginates with stable
  // limit/offset links, a saved `next` URL stays valid across runs.
  async fetchPagesWithCallback<T>(
    path: string,
    params: Record<string, string | number> | undefined,
    onPage: (rows: T[]) => Promise<void>,
    startUrl?: string | null,
  ): Promise<{
    expectedCount: number | null;
    complete: boolean;
    nextUrl: string | null;
  }> {
    let expectedCount: number | null = null;
    let complete = false;
    let url: string | null =
      startUrl ??
      this.buildUrl(path, {
        limit: PAGE_LIMIT,
        ...(params ?? {}),
      });
    let guard = 0;
    while (url && guard < 10_000) {
      guard += 1;
      let page: PaginatedResponse<T>;
      try {
        page = await this.request<PaginatedResponse<T>>("GET", url);
      } catch (err) {
        // The low-level request already retried 429/5xx with backoff. If it
        // still failed with a transient status, stop paginating but KEEP the
        // pages we already processed (complete stays false so callers skip any
        // destructive prune) AND report `url` as the resume point so the next
        // run continues from this exact page. Non-transient errors propagate.
        if (
          err instanceof AdmintotalError &&
          (err.status === 429 || (err.status != null && err.status >= 500))
        ) {
          logger.warn(
            { status: err.status, url },
            "Admintotal: paginación detenida por límite de tasa; se conserva el progreso y se guarda el punto de reanudación",
          );
          return { expectedCount, complete: false, nextUrl: url };
        }
        throw err;
      }
      if (expectedCount === null && typeof page.count === "number") {
        expectedCount = page.count;
      }
      if (Array.isArray(page.results)) {
        await onPage(page.results);
      } else if (Array.isArray(page as unknown as T[])) {
        // Some endpoints may return a bare array (single, final page).
        await onPage(page as unknown as T[]);
        complete = true;
        break;
      }
      url = page.next ?? null;
      if (!url) complete = true;
    }
    return { expectedCount, complete, nextUrl: complete ? null : url };
  }

  async getProductos(): Promise<Record<string, unknown>[]> {
    return this.fetchAll<Record<string, unknown>>("productos/");
  }

  async getProductosWithMeta(): Promise<{
    results: Record<string, unknown>[];
    expectedCount: number | null;
    complete: boolean;
  }> {
    return this.fetchAllWithMeta<Record<string, unknown>>("productos/");
  }

  // Stream every `productos` page, invoking `onPage` per batch so the caller can
  // upsert (and persist stock) incrementally. Pass `startUrl` to resume a pull
  // that an earlier rate-limited run could not finish. See fetchPagesWithCallback.
  async streamProductos(
    onPage: (rows: Record<string, unknown>[]) => Promise<void>,
    startUrl?: string | null,
  ): Promise<{
    expectedCount: number | null;
    complete: boolean;
    nextUrl: string | null;
  }> {
    // `activo=1` is the ONE server-side filter the ERP actually honors on
    // `productos/` (warehouse/existencia filters are silently ignored — they
    // return the full catalog). It drops ~10k inactive/discontinued products
    // (32.5k -> ~22.5k), so each pass fetches ~31% fewer pages and finishes
    // sooner under the heavy rate limit. The resume URL carries this param
    // forward across ticks. Reaching only the in-stock Bodega/Matriz subset is
    // NOT possible here; that narrowing happens in the mapper (parseInventory).
    return this.fetchPagesWithCallback<Record<string, unknown>>(
      "productos/",
      { activo: 1 },
      onPage,
      startUrl,
    );
  }

  /**
   * Fetch a single product by its ERP id via the detail endpoint
   * (`productos/{id}/`). Returns null on 404. NOTE: list-style filters like
   * `?id=`, `?id__in=`, `?clave=` are silently ignored by this API and return
   * the full catalog, so targeted lookups MUST use this detail route (or the
   * exact-match `?codigo=` filter) — never a guessed query param.
   */
  async getProductoById(
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const url = this.buildUrl(`productos/${encodeURIComponent(id)}/`);
    try {
      return await this.request<Record<string, unknown>>("GET", url);
    } catch (err) {
      if (err instanceof AdmintotalError && err.status === 404) return null;
      throw err;
    }
  }

  async getAlmacenes(): Promise<Record<string, unknown>[]> {
    return this.fetchAll<Record<string, unknown>>("almacenes/");
  }

  async getLineas(): Promise<Record<string, unknown>[]> {
    return this.fetchAll<Record<string, unknown>>("lineas/");
  }

  async getSublineas(): Promise<Record<string, unknown>[]> {
    return this.fetchAll<Record<string, unknown>>("sublineas/");
  }

  // Create a pedido in Admintotal from a mapped payload.
  async createPedido(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = this.buildUrl("movimientos/pedidos/");
    return this.request<Record<string, unknown>>("POST", url, payload);
  }
}

// Lazy process-wide singleton. Sharing ONE client means the api_key is logged in
// once for the whole process (no re-login per checkout) and every caller funnels
// through the same global RequestLimiter above. Prefer this over
// `new AdmintotalClient()` everywhere outside tests.
let sharedClient: AdmintotalClient | null = null;
export function getAdmintotalClient(): AdmintotalClient {
  if (!sharedClient) sharedClient = new AdmintotalClient();
  return sharedClient;
}
