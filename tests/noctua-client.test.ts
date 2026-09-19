import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequestUrl = vi.hoisted(() => vi.fn());

vi.mock('obsidian', () => ({
  requestUrl: mockRequestUrl,
}));

import { NoctuaClient, NoctuaApiError } from '../src/noctua-client';

function makeClient(apiKey = 'nct_test-key', baseUrl = 'https://api.cast.noctua.uno') {
  return new NoctuaClient(() => ({ baseUrl, apiKey }));
}

function okResponse(json: unknown) {
  return { status: 200, json };
}

describe('NoctuaClient', () => {
  beforeEach(() => {
    mockRequestUrl.mockReset();
  });

  it('sends the API key as a bearer token', async () => {
    mockRequestUrl.mockResolvedValue(okResponse({ id: 'c-1' }));

    await makeClient().createTextConversion('Hello', 'Title', 'obsidian://x');

    expect(mockRequestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.cast.noctua.uno/api/v1/conversions/text',
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer nct_test-key',
        }),
        body: JSON.stringify({
          content: 'Hello',
          title: 'Title',
          sourceUrl: 'obsidian://x',
        }),
      })
    );
  });

  it('strips trailing slashes from the base URL', async () => {
    mockRequestUrl.mockResolvedValue(okResponse({ balance: 3 }));

    await makeClient('nct_k', 'https://test.api.cast.noctua.uno///').getCreditBalance();

    expect(mockRequestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://test.api.cast.noctua.uno/api/v1/credits/balance',
      })
    );
  });

  it('fails fast with a helpful message when no API key is set', async () => {
    await expect(makeClient('').getCreditBalance()).rejects.toThrow(
      /no api key configured/i
    );
    expect(mockRequestUrl).not.toHaveBeenCalled();
  });

  it('maps 401 to an invalid-key message', async () => {
    mockRequestUrl.mockResolvedValue({ status: 401, json: { detail: 'Invalid API key' } });

    await expect(makeClient().getCreditBalance()).rejects.toThrow(
      /rejected the api key/i
    );
  });

  it('maps 402 to an out-of-credits message', async () => {
    mockRequestUrl.mockResolvedValue({ status: 402, json: { detail: 'Insufficient credits' } });

    const error = await makeClient()
      .createTextConversion('x', 't', 's')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NoctuaApiError);
    expect((error as NoctuaApiError).status).toBe(402);
    expect((error as NoctuaApiError).message).toMatch(/out of noctua credits/i);
  });

  it('surfaces the backend detail for 422 errors', async () => {
    mockRequestUrl.mockResolvedValue({
      status: 422,
      json: { detail: 'Content exceeds limit' },
    });

    await expect(
      makeClient().createTextConversion('x', 't', 's')
    ).rejects.toThrow('Content exceeds limit');
  });

  it('falls back to a generic message for other failures', async () => {
    mockRequestUrl.mockResolvedValue({
      status: 500,
      get json(): unknown {
        throw new Error('not json');
      },
    });

    await expect(makeClient().getCreditBalance()).rejects.toThrow(/HTTP 500/);
  });

  it('unwraps the share URL', async () => {
    mockRequestUrl.mockResolvedValue(
      okResponse({ shareUrl: 'https://api.cast.noctua.uno/p/abc' })
    );

    const url = await makeClient().getShareLink('c-1');

    expect(url).toBe('https://api.cast.noctua.uno/p/abc');
    expect(mockRequestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.cast.noctua.uno/api/v1/conversions/c-1/share',
        method: 'GET',
      })
    );
  });

  it('polls a conversion by id', async () => {
    mockRequestUrl.mockResolvedValue(
      okResponse({ id: 'c-1', status: 'processing', progressPercentage: 40 })
    );

    const conversion = await makeClient().getConversion('c-1');

    expect(conversion.status).toBe('processing');
    expect(mockRequestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.cast.noctua.uno/api/v1/conversions/c-1',
      })
    );
  });

  it('downloads the plain-text transcript', async () => {
    mockRequestUrl.mockResolvedValue({
      status: 200,
      text: 'First paragraph.\n\nSecond paragraph.',
      get json(): unknown {
        throw new Error('not json');
      },
    });

    const transcript = await makeClient().getTranscript('c-1');

    expect(transcript).toBe('First paragraph.\n\nSecond paragraph.');
    expect(mockRequestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.cast.noctua.uno/api/v1/conversions/c-1/transcript?format=text',
        method: 'GET',
      })
    );
  });

  it('surfaces a missing transcript as a 404', async () => {
    mockRequestUrl.mockResolvedValue({
      status: 404,
      json: { detail: 'Transcript not available' },
    });

    const error = await makeClient()
      .getTranscript('c-1')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NoctuaApiError);
    expect((error as NoctuaApiError).status).toBe(404);
    expect((error as NoctuaApiError).message).toBe('Transcript not available');
  });

  it('lists recent conversions', async () => {
    mockRequestUrl.mockResolvedValue(
      okResponse({ items: [{ id: 'c-1', status: 'completed' }], total: 1 })
    );

    const list = await makeClient().listConversions(50);

    expect(list.items).toHaveLength(1);
    expect(mockRequestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.cast.noctua.uno/api/v1/conversions/?limit=50',
        method: 'GET',
      })
    );
  });
});
