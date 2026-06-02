import { logger } from "../logger";
import {
  getAdmintotalConfig,
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

const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 800;
const PAGE_LIMIT = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AdmintotalClient {
  private config: AdmintotalConfig;
  private apiKey: string | null;

  constructor(config?: AdmintotalConfig) {
    this.config = config ?? getAdmintotalConfig();
    this.apiKey = this.config.apiKey ?? null;
  }

  private async login(): Promise<string> {
    const url = `${this.config.baseUrl}/usuarios/login_usuario/`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
    });
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
      res = await fetch(url, {
        method,
        headers: {
          "Api-key": key,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body != null ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const wait = BASE_BACKOFF_MS * 2 ** attempt;
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
          ? BASE_BACKOFF_MS * 2 ** attempt
          : retryAfter * 1000;
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

  // Fetch every page of a paginated endpoint, following `next`.
  async fetchAll<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T[]> {
    const results: T[] = [];
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
      if (Array.isArray(page.results)) {
        results.push(...page.results);
      } else if (Array.isArray(page as unknown as T[])) {
        // Some endpoints may return a bare array.
        results.push(...(page as unknown as T[]));
        break;
      }
      url = page.next ?? null;
    }
    return results;
  }

  async getProductos(): Promise<Record<string, unknown>[]> {
    return this.fetchAll<Record<string, unknown>>("productos/");
  }

  async getAlmacenes(): Promise<Record<string, unknown>[]> {
    return this.fetchAll<Record<string, unknown>>("almacenes/");
  }

  async getLineas(): Promise<Record<string, unknown>[]> {
    return this.fetchAll<Record<string, unknown>>("lineas/");
  }

  // Create a pedido in Admintotal from a mapped payload.
  async createPedido(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = this.buildUrl("movimientos/pedidos/");
    return this.request<Record<string, unknown>>("POST", url, payload);
  }
}
