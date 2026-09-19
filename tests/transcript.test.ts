import { describe, it, expect } from 'vitest';
import {
  buildTranscriptBody,
  normaliseFolder,
  transcriptBasename,
} from '../src/transcript';

describe('transcriptBasename', () => {
  it('keeps an ordinary title', () => {
    expect(transcriptBasename('Weekly review')).toBe('Weekly review');
  });

  it('replaces characters that are invalid in file names or links', () => {
    expect(transcriptBasename('A/B: "C" #1 [draft]?')).toBe('A B C 1 draft');
  });

  it('strips leading and trailing dots', () => {
    expect(transcriptBasename('...hidden. ')).toBe('hidden');
  });

  it('truncates very long titles', () => {
    expect(transcriptBasename('x'.repeat(500))).toHaveLength(100);
  });

  it('falls back when the title is empty or unusable', () => {
    expect(transcriptBasename(null)).toBe('Untitled transcript');
    expect(transcriptBasename('  ///  ')).toBe('Untitled transcript');
  });
});

describe('normaliseFolder', () => {
  it('trims slashes and whitespace', () => {
    expect(normaliseFolder(' /Audio/Transcripts/ ')).toBe('Audio/Transcripts');
  });

  it('converts backslashes', () => {
    expect(normaliseFolder('Audio\\Transcripts')).toBe('Audio/Transcripts');
  });

  it('treats an empty folder as the vault root', () => {
    expect(normaliseFolder('')).toBe('/');
    expect(normaliseFolder('/')).toBe('/');
  });
});

describe('buildTranscriptBody', () => {
  it('adds the title as a heading and trims the transcript', () => {
    expect(buildTranscriptBody('Title', '\n\nPara one.\n\nPara two.\n\n')).toBe(
      '# Title\n\nPara one.\n\nPara two.\n'
    );
  });
});
