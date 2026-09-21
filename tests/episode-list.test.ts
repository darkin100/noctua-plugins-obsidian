import { describe, it, expect } from 'vitest';
import {
  batchSummary,
  episodeDetails,
  filterEpisodes,
  saveButtonLabel,
  transcribableEpisodes,
} from '../src/episode-list';
import type { Conversion } from '../src/noctua-client';

function episode(overrides: Partial<Conversion> = {}): Conversion {
  return {
    id: 'c1',
    title: 'Weekly review',
    status: 'completed',
    progressPercentage: 100,
    progressMessage: null,
    errorMessage: null,
    ...overrides,
  };
}

describe('transcribableEpisodes', () => {
  it('drops failed episodes and keeps the rest in order', () => {
    const list = [
      episode({ id: 'a' }),
      episode({ id: 'b', status: 'failed' }),
      episode({ id: 'c', status: 'processing' }),
      episode({ id: 'd', status: 'expired' }),
    ];
    expect(transcribableEpisodes(list).map((e) => e.id)).toEqual(['a', 'c', 'd']);
  });

  it('tolerates a missing list', () => {
    expect(transcribableEpisodes(undefined)).toEqual([]);
  });
});

describe('filterEpisodes', () => {
  const list = [
    episode({ id: 'a', title: 'Weekly review' }),
    episode({ id: 'b', title: 'Review of the quarter' }),
    episode({ id: 'c', title: null }),
  ];

  it('returns everything for an empty query', () => {
    expect(filterEpisodes(list, '  ')).toHaveLength(3);
  });

  it('matches every word case-insensitively, in any order', () => {
    expect(filterEpisodes(list, 'REVIEW').map((e) => e.id)).toEqual(['a', 'b']);
    expect(filterEpisodes(list, 'quarter review').map((e) => e.id)).toEqual(['b']);
  });

  it('never matches untitled episodes on a non-empty query', () => {
    expect(filterEpisodes(list, 'untitled')).toEqual([]);
  });
});

describe('episodeDetails', () => {
  it('omits the status for completed episodes', () => {
    expect(episodeDetails(episode(), false)).toBe('');
  });

  it('shows a non-completed status and the saved marker', () => {
    expect(episodeDetails(episode({ status: 'expired' }), true)).toBe(
      'expired · transcript saved'
    );
  });

  it('includes the creation date', () => {
    const createdAt = '2026-09-21T10:00:00Z';
    expect(episodeDetails(episode({ createdAt }), false)).toBe(
      new Date(createdAt).toLocaleDateString()
    );
  });
});

describe('saveButtonLabel', () => {
  it('pluralises', () => {
    expect(saveButtonLabel(0)).toBe('Select episodes to save');
    expect(saveButtonLabel(1)).toBe('Save 1 transcript');
    expect(saveButtonLabel(4)).toBe('Save 4 transcripts');
  });
});

describe('batchSummary', () => {
  it('reports saved transcripts', () => {
    expect(batchSummary(2, [], 'Noctua transcripts')).toBe(
      'Saved 2 transcripts to Noctua transcripts. ✓'
    );
  });

  it('lists failures with their reasons', () => {
    expect(
      batchSummary(1, [{ title: 'Draft', reason: 'not ready yet' }], 'T')
    ).toBe('Saved 1 transcript to T. ✓\n\nCould not save 1:\n• Draft — not ready yet');
  });

  it('handles nothing saved', () => {
    expect(batchSummary(0, [], 'T')).toBe('No transcripts were saved.');
  });
});
