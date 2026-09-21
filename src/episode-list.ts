/**
 * Pure helpers for listing and picking episodes from the Noctua feed.
 * No Obsidian imports — unit-testable in plain Node.
 */
import type { Conversion } from './noctua-client';

/** Episodes whose transcript can be saved: failed ones never produced content. */
export function transcribableEpisodes(episodes: Conversion[] | undefined): Conversion[] {
  return (episodes ?? []).filter((episode) => episode.status !== 'failed');
}

/** Episodes whose title contains every word of the query (case-insensitive). */
export function filterEpisodes(episodes: Conversion[], query: string): Conversion[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return episodes;
  return episodes.filter((episode) => {
    const title = (episode.title ?? '').toLowerCase();
    return words.every((word) => title.includes(word));
  });
}

/** Secondary line shown under an episode title, e.g. "21/09/2026 · processing · saved". */
export function episodeDetails(episode: Conversion, saved: boolean): string {
  return [
    episode.createdAt ? new Date(episode.createdAt).toLocaleDateString() : null,
    episode.status === 'completed' ? null : episode.status,
    saved ? 'transcript saved' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Label for the save button, e.g. "Save 3 transcripts". */
export function saveButtonLabel(count: number): string {
  if (count === 0) return 'Select episodes to save';
  return `Save ${count} transcript${count === 1 ? '' : 's'}`;
}

/** Final notice after saving a batch of transcripts. */
export function batchSummary(
  savedCount: number,
  failures: { title: string; reason: string }[],
  folder: string
): string {
  const parts: string[] = [];
  if (savedCount) {
    parts.push(
      `Saved ${savedCount} transcript${savedCount === 1 ? '' : 's'} to ${folder}. ✓`
    );
  }
  if (failures.length) {
    parts.push(
      `Could not save ${failures.length}:\n` +
        failures.map((f) => `• ${f.title} — ${f.reason}`).join('\n')
    );
  }
  return parts.join('\n\n') || 'No transcripts were saved.';
}
