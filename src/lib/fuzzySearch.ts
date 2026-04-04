import uFuzzy from "@leeoniya/ufuzzy";

export interface FuzzyResult<T> {
  /** The original item */
  item: T;
  /** Highlighted segments: [text, isHighlight][] */
  highlights: [string, boolean][];
  /** Relevance score (lower = better) */
  score: number;
}

/**
 * Create a reusable fuzzy searcher for a collection.
 *
 * @param items - The items to search through
 * @param fields - Functions that extract searchable strings from each item.
 *                 The first field is the primary (used for highlights).
 */
export function createFuzzySearcher<T>(
  items: T[],
  fields: ((item: T) => string)[]
) {
  const uf = new uFuzzy({
    intraMode: 1,
    intraIns: 1,
  });

  let haystacks: string[][] = fields.map((fn) => items.map(fn));
  let currentItems = items;

  function search(query: string, limit = 50): FuzzyResult<T>[] {
    if (!query.trim()) return [];

    // Track best result per item index
    const bestByIndex = new Map<
      number,
      { score: number; fieldIdx: number; infoIdx: number }
    >();

    for (let fi = 0; fi < haystacks.length; fi++) {
      const haystack = haystacks[fi];
      const result = uf.search(haystack, query);
      const idxs = result[0];
      const info = result[1];
      const order = result[2];

      if (!idxs || !info || !order) continue;

      for (let rank = 0; rank < order.length; rank++) {
        const oi = order[rank];
        // info.idx[oi] IS the haystack index directly (not an index into idxs)
        const itemIdx = info.idx[oi];
        // Use rank position as score (lower = better match)
        // Add field index bias so primary field matches rank higher
        const score = rank + fi * 0.1;

        const existing = bestByIndex.get(itemIdx);
        if (!existing || score < existing.score) {
          bestByIndex.set(itemIdx, { score, fieldIdx: fi, infoIdx: oi });
        }
      }
    }

    // Sort by score (ascending = best first), take top N
    const sorted = Array.from(bestByIndex.entries())
      .sort((a, b) => a[1].score - b[1].score)
      .slice(0, limit);

    return sorted.map(([itemIdx, { score, fieldIdx }]) => {
      const text = haystacks[fieldIdx][itemIdx];

      // Build highlights from uFuzzy's ranges
      const result = uf.search([text], query);
      const info = result[1];
      let highlights: [string, boolean][];

      if (info && info.ranges && info.ranges[0] && info.ranges[0].length > 0) {
        const ranges = info.ranges[0];
        highlights = buildHighlightsFromRanges(text, ranges);
      } else {
        highlights = [[text, false]];
      }

      return { item: currentItems[itemIdx], highlights, score };
    });
  }

  function update(newItems: T[]) {
    currentItems = newItems;
    haystacks = fields.map((fn) => newItems.map(fn));
  }

  return { search, update };
}

/**
 * Build highlight segments from uFuzzy range pairs.
 * Ranges are [start1, end1, start2, end2, ...]
 */
function buildHighlightsFromRanges(
  text: string,
  ranges: number[]
): [string, boolean][] {
  const segments: [string, boolean][] = [];
  let lastEnd = 0;

  for (let i = 0; i < ranges.length; i += 2) {
    const start = ranges[i];
    const end = ranges[i + 1];

    if (start > lastEnd) {
      segments.push([text.slice(lastEnd, start), false]);
    }
    segments.push([text.slice(start, end), true]);
    lastEnd = end;
  }

  if (lastEnd < text.length) {
    segments.push([text.slice(lastEnd), false]);
  }

  return segments;
}
