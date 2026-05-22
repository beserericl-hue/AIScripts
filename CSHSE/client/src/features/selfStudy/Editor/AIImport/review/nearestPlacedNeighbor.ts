/**
 * CR-031 — find the nearest placed item ABOVE an unplaced fragment in
 * the source document.
 *
 * The Python splitter assigns a monotonic document-order index to every
 * Section (`byte_offset_start`). The wire format carries it through as
 * `byteOffsetStart` on every BucketItem and Tag. Sorting any list by
 * that field reproduces source-document order.
 *
 * For an Unplaced tag, "nearest above" = the placed bucket item with
 * the largest `byteOffsetStart` value that is still strictly less than
 * the unplaced tag's `byteOffsetStart`, within a configurable window
 * (defaults to 4000 — roughly 3-4 paragraphs for CSHSE documents).
 *
 * If no placed item falls in that window above the unplaced tag, the
 * function returns null and the UI shows a soft "pick a spec manually"
 * fallback.
 */
import type { BucketItem, SpecBucket, Tag } from '../../../../../store/aiImportStore';

export interface NearestPlacedNeighbor {
  std: string;
  spec: string;
  /** "narratives" | "evidenceText" | "evidenceFiles" — which bucket list the neighbor was in. */
  kind: 'text' | 'evidenceText' | 'file';
  /** The placed item that was the nearest above. */
  item: BucketItem;
  /** Source-document-order distance: tag.byteOffsetStart - item.byteOffsetStart. */
  distance: number;
}

export function nearestPlacedNeighborFor(
  unplaced: Tag,
  buckets: Record<string, SpecBucket>,
  windowSize: number = 4000
): NearestPlacedNeighbor | null {
  const tagOrder = unplaced.byteOffsetStart;
  if (tagOrder === undefined || tagOrder === null) return null;

  let best: NearestPlacedNeighbor | null = null;

  for (const bucket of Object.values(buckets)) {
    const lists: Array<{ kind: NearestPlacedNeighbor['kind']; items: BucketItem[] }> = [
      { kind: 'text', items: bucket.narratives },
      { kind: 'evidenceText', items: bucket.evidenceText },
      { kind: 'file', items: bucket.evidenceFiles },
    ];
    for (const { kind, items } of lists) {
      for (const item of items) {
        const order = item.byteOffsetStart;
        if (order === undefined || order === null) continue;
        // Strictly above the unplaced tag.
        if (order >= tagOrder) continue;
        const distance = tagOrder - order;
        if (distance > windowSize) continue;
        if (best === null || distance < best.distance) {
          best = {
            std: bucket.standardCode,
            spec: bucket.specCode,
            kind,
            item,
            distance,
          };
        }
      }
    }
  }

  return best;
}
