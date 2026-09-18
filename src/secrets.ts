import { Plugin } from 'obsidian';

/** Lowercase alphanumeric with dashes, as SecretStorage requires. */
const SECRET_ID = 'noctua-api-key';

type PluginData = Record<string, unknown> & { apiKey?: string };

/**
 * Store and retrieve the Noctua API key in the app's secret storage, which
 * keeps it out of data.json (that file lives in the vault and syncs with it).
 * Requires Obsidian 1.11.4+; manifest.json declares a higher minimum still.
 */
export class ApiKeyStore {
  constructor(private readonly plugin: Plugin) {}

  async get(): Promise<string> {
    const secret = this.plugin.app.secretStorage.getSecret(SECRET_ID);
    if (secret) {
      return secret;
    }

    // Migrate a key written to data.json by a plugin version that predates
    // secret storage, then scrub it from that file.
    const data = ((await this.plugin.loadData()) as PluginData | null) ?? {};
    if (data.apiKey) {
      const key = data.apiKey;
      await this.set(key);
      return key;
    }
    return '';
  }

  async set(value: string): Promise<void> {
    this.plugin.app.secretStorage.setSecret(SECRET_ID, value);

    const data = ((await this.plugin.loadData()) as PluginData | null) ?? {};
    if ('apiKey' in data) {
      delete data.apiKey;
      await this.plugin.saveData(data);
    }
  }
}
