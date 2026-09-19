import { App, SuggestModal } from 'obsidian';
import type { Conversion } from './noctua-client';

/** Pick one of the user's Noctua episodes by title. */
export class EpisodeSuggestModal extends SuggestModal<Conversion> {
  constructor(
    app: App,
    private readonly episodes: Conversion[],
    private readonly onChoose: (episode: Conversion) => void
  ) {
    super(app);
    this.setPlaceholder('Choose an episode to save its transcript…');
    this.emptyStateText = 'No matching episodes.';
  }

  getSuggestions(query: string): Conversion[] {
    const needle = query.trim().toLowerCase();
    return this.episodes.filter((episode) =>
      (episode.title ?? '').toLowerCase().includes(needle)
    );
  }

  renderSuggestion(episode: Conversion, el: HTMLElement): void {
    el.createDiv({ text: episode.title || 'Untitled episode' });
    const details = [
      episode.createdAt ? new Date(episode.createdAt).toLocaleDateString() : null,
      episode.status === 'completed' ? null : episode.status,
    ].filter(Boolean);
    if (details.length) {
      el.createEl('small', { text: details.join(' · '), cls: 'mod-muted' });
    }
  }

  onChooseSuggestion(episode: Conversion): void {
    this.onChoose(episode);
  }
}
