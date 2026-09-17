/**
 * Pure helpers for preparing note content for Noctua.
 * No Obsidian imports — unit-testable in plain Node.
 */

/** Mirrors the backend's CreateTextConversionRequest content limit. */
export const MAX_CONTENT_CHARS = 500_000;

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/;

/** Remove a leading YAML frontmatter block, if present. */
export function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER_RE, '').trimStart();
}

/**
 * Derive an episode title, in order of preference:
 * 1. `title` from frontmatter
 * 2. the first `#` heading in the body
 * 3. the note's basename
 */
export function deriveTitle(
  body: string,
  frontmatterTitle: unknown,
  basename: string
): string {
  if (typeof frontmatterTitle === 'string' && frontmatterTitle.trim()) {
    return frontmatterTitle.trim();
  }
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (/^#{1,6}\s+/.test(line)) {
      return line.replace(/^#{1,6}\s+/, '').trim();
    }
  }
  return basename;
}

/**
 * Build the obsidian:// URI used as the episode's source attribution,
 * so the Noctua dashboard can link back to the originating note.
 */
export function buildSourceUrl(vaultName: string, filePath: string): string {
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(
    filePath
  )}`;
}

/** Validate content before spending a credit. Returns an error or null. */
export function validateContent(content: string): string | null {
  if (!content.trim()) {
    return 'This note is empty — nothing to send.';
  }
  if (content.length > MAX_CONTENT_CHARS) {
    return `Note is too long (${content.length.toLocaleString()} characters; the limit is ${MAX_CONTENT_CHARS.toLocaleString()}).`;
  }
  return null;
}
