import type { ApiError } from "@brian/shared";

export class ServerUnreachableError extends Error {
  constructor(public readonly url: string) {
    super(`server not running at ${url}`);
    this.name = "ServerUnreachableError";
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
}

function buildUrl(base: string, path: string, query?: Record<string, string | undefined>): string {
  const url = new URL(path, base);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export async function apiRequest<T>(base: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(base, path, options.query);
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ServerUnreachableError(base);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message = (json as ApiError | null)?.error ?? `request failed with status ${res.status}`;
    throw new ApiRequestError(message, res.status);
  }

  return json as T;
}
