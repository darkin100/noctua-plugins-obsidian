import { requestUrl } from 'obsidian';

export interface NoctuaClientConfig {
  baseUrl: string;
  apiKey: string;
}

export interface Conversion {
  id: string;
  title: string | null;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progressPercentage: number;
  progressMessage: string | null;
  errorMessage: string | null;
}

export interface CreditBalance {
  balance: number;
}

export class NoctuaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'NoctuaApiError';
  }
}

function friendlyMessage(status: number, detail: string | undefined): string {
  switch (status) {
    case 401:
      return 'Noctua rejected the API key. Check it in the plugin settings (Noctua web app → Settings → API keys).';
    case 402:
      return 'You are out of Noctua credits. Buy more at https://cast.noctua.uno/credits.';
    case 422:
      return detail || 'Noctua rejected the request content.';
    default:
      return detail || `Noctua request failed (HTTP ${status}).`;
  }
}

/**
 * Minimal typed client for the Noctua REST API, built on Obsidian's
 * requestUrl (no CORS restrictions, works on desktop and mobile).
 */
export class NoctuaClient {
  constructor(private readonly getConfig: () => NoctuaClientConfig) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const { baseUrl, apiKey } = this.getConfig();
    if (!apiKey) {
      throw new NoctuaApiError(
        'No API key configured. Create one in the Noctua web app (Settings → API keys) and paste it into the plugin settings.',
        401
      );
    }

    const response = await requestUrl({
      url: `${baseUrl.replace(/\/+$/, '')}/api/v1${path}`,
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      throw: false,
    });

    if (response.status >= 400) {
      let detail: string | undefined;
      try {
        const parsed: unknown = response.json;
        if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
          const value = (parsed as { detail?: unknown }).detail;
          detail = typeof value === 'string' ? value : undefined;
        }
      } catch {
        // non-JSON error body — fall through to the generic message
      }
      throw new NoctuaApiError(friendlyMessage(response.status, detail), response.status);
    }

    return response.json as T;
  }

  /** Submit text for conversion. Costs one credit. */
  createTextConversion(
    content: string,
    title: string,
    sourceUrl: string
  ): Promise<Conversion> {
    return this.request<Conversion>('POST', '/conversions/text', {
      content,
      title,
      sourceUrl,
    });
  }

  /** Fetch a conversion (used to poll progress). */
  getConversion(id: string): Promise<Conversion> {
    return this.request<Conversion>('GET', `/conversions/${id}`);
  }

  /** Public share URL for a completed conversion. */
  async getShareLink(id: string): Promise<string> {
    const data = await this.request<{ shareUrl: string }>(
      'GET',
      `/conversions/${id}/share`
    );
    return data.shareUrl;
  }

  /** Credit balance — also doubles as a connection/key test. */
  getCreditBalance(): Promise<CreditBalance> {
    return this.request<CreditBalance>('GET', '/credits/balance');
  }
}
