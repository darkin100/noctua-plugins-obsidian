import { App, ButtonComponent, Modal, SearchComponent, Setting } from 'obsidian';
import type { Conversion } from './noctua-client';
import { episodeDetails, filterEpisodes, saveButtonLabel } from './episode-list';

/**
 * List the user's Noctua episodes and pick any number of them to save
 * transcripts for. The selection survives filtering, so the user can
 * search for one episode, tick it, then search for another.
 */
export class EpisodePickerModal extends Modal {
  private readonly selected = new Set<string>();
  private query = '';
  private listEl!: HTMLElement;
  private countEl!: HTMLElement;
  private saveButton!: ButtonComponent;

  constructor(
    app: App,
    private readonly episodes: Conversion[],
    /** Total episodes in the feed — may exceed episodes.length if the list was capped. */
    private readonly total: number,
    private readonly isSaved: (episode: Conversion) => boolean,
    private readonly onSubmit: (episodes: Conversion[]) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    this.setTitle('Save episode transcripts');
    contentEl.addClass('noctua-episode-picker');

    const search = new SearchComponent(contentEl)
      .setPlaceholder('Filter episodes by title…')
      .onChange((value) => {
        this.query = value;
        this.renderList();
      });
    search.inputEl.focus();

    const toolbar = contentEl.createDiv({ cls: 'noctua-episode-toolbar' });
    this.countEl = toolbar.createSpan({ cls: 'noctua-episode-count' });
    const actions = toolbar.createDiv({ cls: 'noctua-episode-toolbar-actions' });
    new ButtonComponent(actions).setButtonText('Select shown').onClick(() => {
      for (const episode of this.visibleEpisodes()) this.selected.add(episode.id);
      this.renderList();
    });
    new ButtonComponent(actions).setButtonText('Select unsaved').onClick(() => {
      for (const episode of this.visibleEpisodes()) {
        if (!this.isSaved(episode)) this.selected.add(episode.id);
      }
      this.renderList();
    });
    new ButtonComponent(actions).setButtonText('Clear').onClick(() => {
      this.selected.clear();
      this.renderList();
    });

    this.listEl = contentEl.createDiv({ cls: 'noctua-episode-list' });

    new Setting(contentEl)
      .setDesc(
        this.total > this.episodes.length
          ? `Showing your ${this.episodes.length} most recent episodes of ${this.total}.`
          : ''
      )
      .addButton((button) => {
        this.saveButton = button.setCta().onClick(() => this.submit());
      });

    this.renderList();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private visibleEpisodes(): Conversion[] {
    return filterEpisodes(this.episodes, this.query);
  }

  private renderList(): void {
    this.listEl.empty();
    const visible = this.visibleEpisodes();
    if (!visible.length) {
      this.listEl.createDiv({ text: 'No matching episodes.', cls: 'noctua-episode-empty' });
    }
    for (const episode of visible) {
      const row = this.listEl.createEl('label', { cls: 'noctua-episode-row' });
      const checkbox = row.createEl('input', { type: 'checkbox' });
      checkbox.checked = this.selected.has(episode.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.selected.add(episode.id);
        else this.selected.delete(episode.id);
        this.updateCount();
      });
      const text = row.createDiv({ cls: 'noctua-episode-text' });
      text.createDiv({ text: episode.title || 'Untitled episode' });
      const details = episodeDetails(episode, this.isSaved(episode));
      if (details) text.createEl('small', { text: details, cls: 'mod-muted' });
    }
    this.updateCount();
  }

  private updateCount(): void {
    const shown = this.visibleEpisodes().length;
    this.countEl.setText(
      `${this.selected.size} selected · ${shown} of ${this.episodes.length} shown`
    );
    this.saveButton
      .setButtonText(saveButtonLabel(this.selected.size))
      .setDisabled(this.selected.size === 0);
  }

  private submit(): void {
    if (!this.selected.size) return;
    // Keep feed order (newest first) rather than click order.
    const chosen = this.episodes.filter((episode) => this.selected.has(episode.id));
    this.close();
    this.onSubmit(chosen);
  }
}
