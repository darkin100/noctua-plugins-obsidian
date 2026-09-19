/**
 * Pure helpers for turning a Noctua transcript into a vault note.
 * No Obsidian imports — unit-testable in plain Node.
 */

export const DEFAULT_TRANSCRIPT_FOLDER = 'Noctua transcripts';

const MAX_FILENAME_CHARS = 100;

/**
 * Turn an episode title into a safe note basename: drops characters that
 * are invalid in file names on some platform or that break Obsidian links.
 */
export function transcriptBasename(title: string | null | undefined): string {
  const cleaned = (title ?? '')
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    // Control characters are invalid in file names on Windows.
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Leading dots hide files; trailing dots/spaces are stripped by Windows.
    .replace(/^\.+/, '')
    .replace(/[.\s]+$/, '');
  const truncated = cleaned.slice(0, MAX_FILENAME_CHARS).trim();
  return truncated || 'Untitled transcript';
}

/** Normalise the configured folder: no leading/trailing slashes, `/` for root. */
export function normaliseFolder(folder: string): string {
  const trimmed = folder.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return trimmed || '/';
}

/** Body of a transcript note (frontmatter is added separately). */
export function buildTranscriptBody(title: string, transcript: string): string {
  return `# ${title}\n\n${transcript.trim()}\n`;
}
