import { describe, it, expect } from 'vitest';
import {
  buildSourceUrl,
  deriveTitle,
  MAX_CONTENT_CHARS,
  stripFrontmatter,
  validateContent,
} from '../src/note-content';

describe('stripFrontmatter', () => {
  it('removes a leading YAML frontmatter block', () => {
    const note = '---\ntitle: Hello\ntags: [a, b]\n---\n\n# Body\n\nText.';
    expect(stripFrontmatter(note)).toBe('# Body\n\nText.');
  });

  it('handles CRLF line endings', () => {
    const note = '---\r\ntitle: Hello\r\n---\r\nBody';
    expect(stripFrontmatter(note)).toBe('Body');
  });

  it('leaves notes without frontmatter untouched', () => {
    expect(stripFrontmatter('# Just a note')).toBe('# Just a note');
  });

  it('does not strip a horizontal rule mid-document', () => {
    const note = 'Intro\n\n---\n\nMore text';
    expect(stripFrontmatter(note)).toBe(note);
  });
});

describe('deriveTitle', () => {
  it('prefers the frontmatter title', () => {
    expect(deriveTitle('# Heading\nBody', 'FM Title', 'file')).toBe('FM Title');
  });

  it('ignores a blank frontmatter title', () => {
    expect(deriveTitle('# Heading\nBody', '   ', 'file')).toBe('Heading');
  });

  it('ignores non-string frontmatter titles', () => {
    expect(deriveTitle('# Heading', 42, 'file')).toBe('Heading');
  });

  it('falls back to the first heading at any level', () => {
    expect(deriveTitle('Text\n\n### Deep heading\nMore', null, 'file')).toBe(
      'Deep heading'
    );
  });

  it('falls back to the basename when there is no heading', () => {
    expect(deriveTitle('Just text', null, 'My note')).toBe('My note');
  });
});

describe('buildSourceUrl', () => {
  it('builds an obsidian:// URI with encoded vault and path', () => {
    expect(buildSourceUrl('My Vault', 'Folder/My note.md')).toBe(
      'obsidian://open?vault=My%20Vault&file=Folder%2FMy%20note.md'
    );
  });
});

describe('validateContent', () => {
  it('accepts normal content', () => {
    expect(validateContent('Hello world')).toBeNull();
  });

  it('rejects empty or whitespace-only content', () => {
    expect(validateContent('   \n  ')).toMatch(/empty/i);
  });

  it('rejects content over the backend limit', () => {
    expect(validateContent('x'.repeat(MAX_CONTENT_CHARS + 1))).toMatch(
      /too long/i
    );
  });

  it('accepts content exactly at the limit', () => {
    expect(validateContent('x'.repeat(MAX_CONTENT_CHARS))).toBeNull();
  });
});
