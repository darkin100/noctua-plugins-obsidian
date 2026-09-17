import { Editor, MarkdownFileInfo, MarkdownView, Menu, Notice, Plugin, TFile } from 'obsidian';
import { NoctuaClient, NoctuaApiError, Conversion } from './noctua-client';
import {
  buildSourceUrl,
  deriveTitle,
  stripFrontmatter,
  validateContent,
} from './note-content';
import { ApiKeyStore } from './secrets';
import { NoctuaSettingTab } from './settings';

export interface NoctuaSettings {
  baseUrl: string;
  /** Write noctua_id / noctua_url into the note's frontmatter on success. */
  writeBackFrontmatter: boolean;
}

export const DEFAULT_SETTINGS: NoctuaSettings = {
  baseUrl: 'https://api.cast.noctua.uno',
  writeBackFrontmatter: true,
};

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 10 * 60_000;
/** Consecutive transient poll failures tolerated before giving up. */
const MAX_POLL_FAILURES = 5;

export default class NoctuaPlugin extends Plugin {
  settings: NoctuaSettings = { ...DEFAULT_SETTINGS };
  apiKeyStore = new ApiKeyStore(this);
  private apiKey = '';
  client = new NoctuaClient(() => ({
    baseUrl: this.settings.baseUrl,
    apiKey: this.apiKey,
  }));

  async onload() {
    await this.loadSettings();
    this.apiKey = await this.apiKeyStore.get();

    this.addSettingTab(new NoctuaSettingTab(this.app, this));

    this.addRibbonIcon('audio-lines', 'Send note to Noctua', () => {
      void this.sendActiveFile();
    });

    this.addCommand({
      id: 'send-note',
      name: 'Send note to your podcast feed',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.sendFile(file);
        return true;
      },
    });

    this.addCommand({
      id: 'send-selection',
      name: 'Send selection to your podcast feed',
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
        const selection = editor.getSelection();
        const file = view.file;
        if (!file) return;
        void this.sendContent(
          selection,
          deriveTitle(selection, null, file.basename),
          file,
          // Selections are partial — never write back frontmatter for them.
          false
        );
      },
    });

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: Menu, file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        menu.addItem((item) =>
          item
            .setTitle('Send to Noctua')
            .setIcon('audio-lines')
            .onClick(() => void this.sendFile(file))
        );
      })
    );
  }

  async setApiKey(value: string): Promise<void> {
    this.apiKey = value.trim();
    await this.apiKeyStore.set(this.apiKey);
  }

  getApiKey(): string {
    return this.apiKey;
  }

  private async sendActiveFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('Open a note first.');
      return;
    }
    await this.sendFile(file);
  }

  async sendFile(file: TFile) {
    const raw = await this.app.vault.cachedRead(file);
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    if (frontmatter?.noctua_id) {
      new Notice(
        'This note was already sent to Noctua (noctua_id is set in its frontmatter). Remove the property to send it again.',
        8_000
      );
      return;
    }

    const body = stripFrontmatter(raw);
    const title = deriveTitle(body, frontmatter?.title, file.basename);
    await this.sendContent(body, title, file, this.settings.writeBackFrontmatter);
  }

  private async sendContent(
    content: string,
    title: string,
    file: TFile,
    writeBack: boolean
  ) {
    const validationError = validateContent(content);
    if (validationError) {
      new Notice(validationError, 8_000);
      return;
    }

    const sourceUrl = buildSourceUrl(this.app.vault.getName(), file.path);
    const notice = new Notice(`Sending “${title}” to Noctua…`, 0);

    try {
      const conversion = await this.client.createTextConversion(
        content,
        title,
        sourceUrl
      );
      notice.setMessage(`Noctua is preparing “${title}”…`);

      const finished = await this.pollUntilDone(conversion.id, notice);
      if (finished.status === 'completed') {
        await this.onCompleted(finished, file, writeBack, notice);
      } else {
        notice.hide();
        new Notice(
          `Noctua could not convert “${title}”: ${finished.errorMessage ?? 'unknown error'}. The credit is refunded automatically.`,
          10_000
        );
      }
    } catch (error) {
      notice.hide();
      const message =
        error instanceof NoctuaApiError
          ? error.message
          : 'Could not reach Noctua. Check your connection and the API base URL in settings.';
      new Notice(message, 10_000);
    }
  }

  private async pollUntilDone(id: string, notice: Notice): Promise<Conversion> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let failures = 0;
    for (;;) {
      await sleep(POLL_INTERVAL_MS);
      try {
        const conversion = await this.client.getConversion(id);
        failures = 0;
        if (conversion.status === 'completed' || conversion.status === 'failed') {
          return conversion;
        }
        notice.setMessage(
          `Noctua: ${conversion.progressMessage ?? conversion.status} (${conversion.progressPercentage}%)`
        );
      } catch (error) {
        // The conversion keeps running server-side, so ride out network
        // blips and 5xx responses; client errors (401/403/404) are final.
        if (!isTransient(error) || ++failures >= MAX_POLL_FAILURES) {
          throw error;
        }
      }
      if (Date.now() > deadline) {
        throw new NoctuaApiError(
          'Timed out waiting for the conversion. Check your feed later — it may still complete.',
          504
        );
      }
    }
  }

  private async onCompleted(
    conversion: Conversion,
    file: TFile,
    writeBack: boolean,
    notice: Notice
  ) {
    let shareUrl: string | null = null;
    try {
      shareUrl = await this.client.getShareLink(conversion.id);
    } catch {
      // Episode is in the feed regardless; the share link is a bonus.
    }

    if (writeBack) {
      try {
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          fm.noctua_id = conversion.id;
          if (shareUrl) fm.noctua_url = shareUrl;
        });
      } catch {
        // Read-only file or parse issue — don't fail the whole send.
      }
    }

    notice.hide();
    new Notice('Episode ready — it is now in your Noctua podcast feed. ✓', 8_000);
  }

  async loadSettings() {
    const data = ((await this.loadData()) as Partial<NoctuaSettings>) ?? {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      baseUrl: data.baseUrl ?? DEFAULT_SETTINGS.baseUrl,
      writeBackFrontmatter:
        data.writeBackFrontmatter ?? DEFAULT_SETTINGS.writeBackFrontmatter,
    };
  }

  async saveSettings() {
    // Merge over loadData so the data.json apiKey fallback (pre-1.11
    // installs) is preserved rather than clobbered.
    const data =
      ((await this.loadData()) as Record<string, unknown> | null) ?? {};
    await this.saveData({ ...data, ...this.settings });
  }
}

function isTransient(error: unknown): boolean {
  return !(error instanceof NoctuaApiError) || error.status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
