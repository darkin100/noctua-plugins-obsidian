import { describe, expect, it } from 'vitest';
import type { Plugin } from 'obsidian';
import { ApiKeyStore } from '../src/secrets';

function fakePlugin(options: { data?: Record<string, unknown> | null; secrets?: boolean }) {
  let data = options.data ?? null;
  const secrets = new Map<string, string>();
  const plugin = {
    app: options.secrets
      ? {
          secretStorage: {
            getSecret: (id: string) => secrets.get(id) ?? null,
            setSecret: (id: string, value: string) => void secrets.set(id, value),
            listSecrets: () => [...secrets.keys()],
          },
        }
      : {},
    loadData: async () => (data === null ? null : { ...data }),
    saveData: async (next: Record<string, unknown>) => {
      data = { ...next };
    },
  };
  return {
    plugin: plugin as unknown as Plugin,
    secrets,
    getData: () => data,
  };
}

describe('ApiKeyStore with SecretStorage', () => {
  it('stores the key in secret storage, not data.json', async () => {
    const { plugin, secrets, getData } = fakePlugin({ secrets: true, data: { baseUrl: 'x' } });
    const store = new ApiKeyStore(plugin);

    await store.set('nct_abc');

    expect(secrets.get('noctua-api-key')).toBe('nct_abc');
    expect(getData()).toEqual({ baseUrl: 'x' });
    expect(await store.get()).toBe('nct_abc');
  });

  it('migrates a key left in data.json into secret storage', async () => {
    const { plugin, secrets, getData } = fakePlugin({
      secrets: true,
      data: { baseUrl: 'x', apiKey: 'nct_old' },
    });
    const store = new ApiKeyStore(plugin);

    expect(await store.get()).toBe('nct_old');
    expect(secrets.get('noctua-api-key')).toBe('nct_old');
    expect(getData()).toEqual({ baseUrl: 'x' });
  });

  it('returns an empty string when no key is stored', async () => {
    const { plugin } = fakePlugin({ secrets: true });
    expect(await new ApiKeyStore(plugin).get()).toBe('');
  });
});

describe('ApiKeyStore without SecretStorage (older Obsidian)', () => {
  it('falls back to data.json, preserving other settings', async () => {
    const { plugin, getData } = fakePlugin({ data: { baseUrl: 'x' } });
    const store = new ApiKeyStore(plugin);

    await store.set('nct_abc');

    expect(getData()).toEqual({ baseUrl: 'x', apiKey: 'nct_abc' });
    expect(await store.get()).toBe('nct_abc');
  });

  it('returns an empty string when data.json is missing', async () => {
    const { plugin } = fakePlugin({ data: null });
    expect(await new ApiKeyStore(plugin).get()).toBe('');
  });
});
