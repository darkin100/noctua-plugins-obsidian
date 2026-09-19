import {
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Menu,
  normalizePath,
  Notice,
  Plugin,
  TFile,
} from 'obsidian';
import { EpisodeSuggestModal } from './episode-modal';
import { NoctuaClient, NoctuaApiError, Conversion } from './noctua-client';
import {
  buildSourceUrl,
  deriveTitle,
  stripFrontmatter,
  validateContent,
} from './note-content';
import {
  buildTranscriptBody,
  DEFAULT_TRANSCRIPT_FOLDER,
  normaliseFolder,
  transcriptBasename,
} from './transcript';
import { ApiKeyStore } from './secrets';
import { NoctuaSettingTab } from './settings';

export interface NoctuaSettings {
  baseUrl: string;
  /** Write noctua_id / noctua_url into the note's frontmatter on success. */
  writeBackFrontmatter: boolean;
  /** Save the episode transcript as a note once the episode is ready. */
  saveTranscripts: boolean;
  /** Vault folder that transcript notes are created in. */
  transcriptFolder: string;
}

export const DEFAULT_SETTINGS: NoctuaSettings = {
  baseUrl: 'https://api.cast.noctua.uno',
  writeBackFrontmatter: true,
  saveTranscripts: false,
  transcriptFolder: DEFAULT_TRANSCRIPT_FOLDER,
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

    this.addCommand({
      id: 'save-note-transcript',
      name: "Save transcript of this note's episode",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        const fm = file && this.app.metadataCache.getFileCache(file)?.frontmatter;
        const id: unknown = fm?.noctua_id ?? fm?.noctua_transcript_of;
        if (!file || typeof id !== 'string' || !id) return false;
        // A sent note links to its transcript; a transcript note refreshes itself.
        if (!checking) void this.saveTranscriptById(id, fm?.noctua_id ? file : undefined);
        return true;
      },
    });

    this.addCommand({
      id: 'import-transcript',
      name: 'Save an episode transcript from your podcast feed',
      callback: () => void this.pickEpisodeTranscript(),
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

    if (frontmatter?.noctua_transcript_of) {
      new Notice(
        'This note is a Noctua transcript, so it is already in your podcast feed.',
        8_000
      );
      return;
    }

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
        await this.app.fileManager.processFrontMatter(
          file,
          (fm: Record<string, unknown>) => {
            fm.noctua_id = conversion.id;
            if (shareUrl) fm.noctua_url = shareUrl;
          }
        );
      } catch {
        // Read-only file or parse issue — don't fail the whole send.
      }
    }

    if (!this.settings.saveTranscripts) {
      notice.hide();
      new Notice('Episode ready — it is now in your Noctua podcast feed. ✓', 8_000);
      return;
    }

    notice.setMessage('Episode ready — saving the transcript…');
    try {
      const transcript = await this.saveTranscript(conversion, {
        shareUrl,
        sourceFile: file,
        linkFromSource: writeBack,
      });
      notice.hide();
      new Notice(
        `Episode ready — it is now in your Noctua podcast feed. Transcript saved to ${transcript.path}. ✓`,
        8_000
      );
    } catch {
      // Episode is in the feed regardless; the transcript can be fetched later.
      notice.hide();
      new Notice(
        'Episode ready — it is now in your Noctua podcast feed, but the transcript could not be saved. Run "Save transcript of this note\'s episode" to try again.',
        10_000
      );
    }
  }

  /** Command: save (or refresh) the transcript for a known conversion id. */
  private async saveTranscriptById(id: string, sourceFile?: TFile) {
    const notice = new Notice('Fetching the transcript from Noctua…', 0);
    try {
      const conversion = await this.client.getConversion(id);
      const shareUrl =
        conversion.status === 'completed'
          ? await this.client.getShareLink(id).catch(() => null)
          : null;
      const file = await this.saveTranscript(conversion, {
        shareUrl,
        sourceFile,
        linkFromSource: sourceFile !== undefined,
      });
      notice.hide();
      new Notice(`Transcript saved to ${file.path}. ✓`, 6_000);
      await this.app.workspace.getLeaf(false).openFile(file);
    } catch (error) {
      notice.hide();
      new Notice(transcriptErrorMessage(error), 10_000);
    }
  }

  /** Command: pick any episode in the feed and save its transcript. */
  private async pickEpisodeTranscript() {
    const notice = new Notice('Loading your Noctua episodes…', 0);
    let episodes: Conversion[];
    try {
      const list = await this.client.listConversions();
      // Failed conversions never produced content worth transcribing.
      episodes = (list.items ?? []).filter((episode) => episode.status !== 'failed');
    } catch (error) {
      notice.hide();
      new Notice(transcriptErrorMessage(error), 10_000);
      return;
    }
    notice.hide();
    if (!episodes.length) {
      new Notice('There are no episodes in your Noctua podcast feed yet.', 6_000);
      return;
    }
    new EpisodeSuggestModal(this.app, episodes, (episode) => {
      void this.saveTranscriptById(episode.id);
    }).open();
  }

  /**
   * Write the transcript of a conversion to a note. Re-saving the same
   * episode refreshes the existing note (found by its noctua_transcript_of
   * property, wherever it has been moved) instead of creating a duplicate.
   */
  async saveTranscript(
    conversion: Conversion,
    options: { shareUrl?: string | null; sourceFile?: TFile; linkFromSource?: boolean } = {}
  ): Promise<TFile> {
    const text = await this.client.getTranscript(conversion.id);
    const title = conversion.title?.trim() || transcriptBasename(null);
    const body = buildTranscriptBody(title, text);

    let file = this.findTranscriptNote(conversion.id);
    if (file) {
      // Keep the existing frontmatter (and any properties the user added).
      await this.app.vault.process(
        file,
        (data) => data.slice(0, data.length - stripFrontmatter(data).length) + body
      );
    } else {
      const folder = normaliseFolder(this.settings.transcriptFolder);
      await this.ensureFolder(folder);
      file = await this.app.vault.create(
        this.availablePath(folder, transcriptBasename(title)),
        body
      );
    }

    const transcriptFile = file;
    const { sourceFile, shareUrl } = options;
    await this.app.fileManager.processFrontMatter(
      transcriptFile,
      (fm: Record<string, unknown>) => {
        fm.noctua_transcript_of = conversion.id;
        if (shareUrl) fm.noctua_url = shareUrl;
        const source = sourceFile
          ? `[[${this.app.metadataCache.fileToLinktext(sourceFile, transcriptFile.path)}]]`
          : conversion.sourceUrl;
        if (source) fm.source = source;
        if (conversion.createdAt) fm.created = conversion.createdAt.slice(0, 10);
      }
    );

    if (sourceFile && options.linkFromSource) {
      try {
        await this.app.fileManager.processFrontMatter(
          sourceFile,
          (fm: Record<string, unknown>) => {
            fm.noctua_transcript = `[[${this.app.metadataCache.fileToLinktext(
              transcriptFile,
              sourceFile.path
            )}]]`;
          }
        );
      } catch {
        // Read-only file or parse issue — the transcript itself is saved.
      }
    }

    return transcriptFile;
  }

  private findTranscriptNote(conversionId: string): TFile | null {
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (fm?.noctua_transcript_of === conversionId) return file;
    }
    return null;
  }

  private async ensureFolder(folder: string) {
    if (folder === '/') return;
    let path = '';
    for (const part of folder.split('/')) {
      path = path ? `${path}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(path)) {
        await this.app.vault.createFolder(path);
      }
    }
  }

  /** First free "<folder>/<name>.md", appending " 2", " 3"… on collisions. */
  private availablePath(folder: string, basename: string): string {
    const prefix = folder === '/' ? '' : `${folder}/`;
    for (let n = 1; ; n++) {
      const suffix = n === 1 ? '' : ` ${n}`;
      const path = normalizePath(`${prefix}${basename}${suffix}.md`);
      if (!this.app.vault.getAbstractFileByPath(path)) return path;
    }
  }

  async loadSettings() {
    const data = ((await this.loadData()) as Partial<NoctuaSettings>) ?? {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      baseUrl: data.baseUrl ?? DEFAULT_SETTINGS.baseUrl,
      writeBackFrontmatter:
        data.writeBackFrontmatter ?? DEFAULT_SETTINGS.writeBackFrontmatter,
      saveTranscripts: data.saveTranscripts ?? DEFAULT_SETTINGS.saveTranscripts,
      transcriptFolder: data.transcriptFolder ?? DEFAULT_SETTINGS.transcriptFolder,
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

function transcriptErrorMessage(error: unknown): string {
  if (error instanceof NoctuaApiError) {
    return error.status === 404
      ? 'Noctua has no transcript for this episode yet — it is available once the content has been extracted.'
      : error.message;
  }
  return 'Could not save the transcript. Check your connection and the API base URL in settings.';
}

function isTransient(error: unknown): boolean {
  return !(error instanceof NoctuaApiError) || error.status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
