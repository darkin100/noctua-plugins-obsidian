import { Plugin, SecretStorage } from 'obsidian';

/** Lowercase alphanumeric with dashes, as SecretStorage requires. */
const SECRET_ID = 'noctua-api-key';

/**
 * Obsidian 1.11.4+ exposes app.secretStorage, which keeps secrets out of
 * data.json (which syncs with the vault). Older apps don't have it, so
 * treat it as optional at runtime even though the typings declare it.
 */
function secretStorage(plugin: Plugin): SecretStorage | null {
  const storage = (plugin.app as { secretStorage?: SecretStorage }).secretStorage;
  return storage && typeof storage.getSecret === 'function' ? storage : null;
}

type PluginData = Record<string, unknown> & { apiKey?: string };

/**
 * Store and retrieve the Noctua API key: native SecretStorage when the
 * app supports it, otherwise the plugin's data.json via loadData/saveData
 * (with the trade-off documented in the README).
 */
export class ApiKeyStore {
  constructor(private readonly plugin: Plugin) {}

  async get(): Promise<string> {
    const storage = secretStorage(this.plugin);
    const data = ((await this.plugin.loadData()) as PluginData | null) ?? {};
    if (!storage) {
      return data.apiKey ?? '';
    }

    const secret = storage.getSecret(SECRET_ID);
    if (secret) {
      return secret;
    }
    // Migrate a key saved by a fallback install (or an earlier plugin
    // version) into secret storage and scrub it from data.json.
    if (data.apiKey) {
      await this.set(data.apiKey);
      return data.apiKey;
    }
    return '';
  }

  async set(value: string): Promise<void> {
    const storage = secretStorage(this.plugin);
    const data = ((await this.plugin.loadData()) as PluginData | null) ?? {};
    if (storage) {
      storage.setSecret(SECRET_ID, value);
      if ('apiKey' in data) {
        delete data.apiKey;
        await this.plugin.saveData(data);
      }
      return;
    }
    data.apiKey = value;
    await this.plugin.saveData(data);
  }
}
