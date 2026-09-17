import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type NoctuaPlugin from './main';
import { NoctuaApiError } from './noctua-client';
import { DEFAULT_SETTINGS } from './main';

export class NoctuaSettingTab extends PluginSettingTab {
  plugin: NoctuaPlugin;

  constructor(app: App, plugin: NoctuaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('API key')
      .setDesc(
        'Create a key in the Noctua web app under Settings → API keys, then paste it here.'
      )
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('nct_…')
          .setValue(this.plugin.getApiKey())
          .onChange(async (value) => {
            await this.plugin.setApiKey(value);
          });
      });

    new Setting(containerEl)
      .setName('API base URL')
      .setDesc('Only change this if you are testing against a non-production Noctua environment.')
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.baseUrl)
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.baseUrl = value.trim() || DEFAULT_SETTINGS.baseUrl;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Mark sent notes')
      .setDesc(
        'After a successful send, add noctua_id and noctua_url to the note frontmatter so it is not sent twice by accident.'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.writeBackFrontmatter)
          .onChange(async (value) => {
            this.plugin.settings.writeBackFrontmatter = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Connection')
      .setDesc('Verify the API key and show your remaining credits.')
      .addButton((button) =>
        button.setButtonText('Test connection').onClick(async () => {
          button.setDisabled(true);
          try {
            const { balance } = await this.plugin.client.getCreditBalance();
            new Notice(`Connected to Noctua ✓ — ${balance} credit${balance === 1 ? '' : 's'} remaining.`);
          } catch (error) {
            new Notice(
              error instanceof NoctuaApiError
                ? error.message
                : 'Could not reach Noctua. Check the API base URL.',
              8_000
            );
          } finally {
            button.setDisabled(false);
          }
        })
      );
  }
}
