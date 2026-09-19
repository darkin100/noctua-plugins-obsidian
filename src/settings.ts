import { App, Notice, PluginSettingTab, Setting, SettingDefinitionItem } from 'obsidian';
import type NoctuaPlugin from './main';
import { NoctuaApiError } from './noctua-client';
import { DEFAULT_SETTINGS, NoctuaSettings } from './main';

/** Setting keys routed through getControlValue/setControlValue. */
type ControlKey = keyof NoctuaSettings;

/**
 * Declarative settings (Obsidian 1.13.0+): returning definitions rather than
 * building rows in display() is what gets these settings into the app's
 * settings search. The base class renders them.
 */
export class NoctuaSettingTab extends PluginSettingTab {
  plugin: NoctuaPlugin;

  constructor(app: App, plugin: NoctuaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: 'API key',
        desc: 'Create a key in the Noctua web app under Settings → API keys, then paste it here.',
        aliases: ['token', 'credential', 'noctua'],
        // Rendered by hand: there is no masked variant of the declarative
        // text control, and an API key should not sit on screen in clear
        // text. The name and desc above still feed settings search.
        render: (setting: Setting) => {
          setting.addText((text) => {
            text.inputEl.type = 'password';
            text
              .setPlaceholder('nct_…')
              .setValue(this.plugin.getApiKey())
              .onChange(async (value) => {
                await this.plugin.setApiKey(value);
              });
          });
        },
      },
      {
        name: 'API base URL',
        desc: 'Only change this if you are testing against a non-production Noctua environment.',
        aliases: ['endpoint', 'server'],
        control: {
          type: 'text',
          key: 'baseUrl',
          placeholder: DEFAULT_SETTINGS.baseUrl,
          defaultValue: DEFAULT_SETTINGS.baseUrl,
          validate: (value) => {
            // Empty is allowed: setControlValue restores the default.
            if (!value.trim()) {
              return;
            }
            try {
              new URL(value.trim());
            } catch {
              return `Enter a valid URL, for example ${DEFAULT_SETTINGS.baseUrl}`;
            }
          },
        },
      },
      {
        name: 'Mark sent notes',
        desc: 'After a successful send, add noctua_id and noctua_url to the note frontmatter so it is not sent twice by accident.',
        aliases: ['frontmatter', 'duplicate'],
        control: {
          type: 'toggle',
          key: 'writeBackFrontmatter',
          defaultValue: DEFAULT_SETTINGS.writeBackFrontmatter,
        },
      },
      {
        name: 'Save transcripts',
        desc: 'When an episode is ready, save its transcript as a note in your vault and link to it from the sent note.',
        aliases: ['transcript', 'text'],
        control: {
          type: 'toggle',
          key: 'saveTranscripts',
          defaultValue: DEFAULT_SETTINGS.saveTranscripts,
        },
      },
      {
        name: 'Transcript folder',
        desc: 'Folder that transcript notes are saved in. It is created if it does not exist.',
        aliases: ['transcript', 'location', 'path'],
        control: {
          type: 'text',
          key: 'transcriptFolder',
          placeholder: DEFAULT_SETTINGS.transcriptFolder,
          defaultValue: DEFAULT_SETTINGS.transcriptFolder,
        },
      },
      {
        name: 'Connection',
        desc: 'Verify the API key and show your remaining credits.',
        aliases: ['test', 'credits'],
        // Rendered by hand to keep the button's disabled state across the
        // async request.
        render: (setting: Setting) => {
          setting.addButton((button) =>
            button.setButtonText('Test connection').onClick(async () => {
              button.setDisabled(true);
              try {
                const { balance } = await this.plugin.client.getCreditBalance();
                new Notice(
                  `Connected to Noctua ✓ — ${balance} credit${balance === 1 ? '' : 's'} remaining.`
                );
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
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as ControlKey];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    switch (key as ControlKey) {
      case 'baseUrl':
        this.plugin.settings.baseUrl =
          (typeof value === 'string' ? value.trim() : '') || DEFAULT_SETTINGS.baseUrl;
        break;
      case 'writeBackFrontmatter':
        this.plugin.settings.writeBackFrontmatter = Boolean(value);
        break;
      case 'saveTranscripts':
        this.plugin.settings.saveTranscripts = Boolean(value);
        break;
      case 'transcriptFolder':
        this.plugin.settings.transcriptFolder =
          (typeof value === 'string' ? value.trim() : '') || DEFAULT_SETTINGS.transcriptFolder;
        break;
    }
    await this.plugin.saveSettings();
  }
}
