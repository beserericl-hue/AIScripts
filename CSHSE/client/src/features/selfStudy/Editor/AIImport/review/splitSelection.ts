/**
 * splitSelection — split a card's HTML by a user text selection, so the
 * coordinator can move part of a mis-parsed card into another subspec.
 *
 * The parser sometimes dumps a whole Standard's prose into its first subspec.
 * The Review card renders that HTML; the coordinator selects the paragraph(s)
 * that belong elsewhere and moves them. This helper computes:
 *   - movedHtml      — the selected fragment's HTML (goes to the target spec)
 *   - remainderHtml  — the card's HTML with the selection removed (stays)
 *
 * It operates on a CLONE of the rendered container, so React's live DOM is
 * never mutated. The selection Range (which points at live nodes) is re-mapped
 * onto the clone by node-index path, then cloneContents()/deleteContents()
 * produce the two halves.
 */

/** Child-index path from `root` down to `node`. */
function nodePath(root: Node, node: Node): number[] {
  const path: number[] = [];
  let n: Node | null = node;
  while (n && n !== root) {
    const parent: Node | null = n.parentNode;
    if (!parent) break;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, n));
    n = parent;
  }
  return path;
}

/** Walk `path` (child indices) from `root` to the corresponding node. */
function nodeAtPath(root: Node, path: number[]): Node | null {
  let n: Node = root;
  for (const i of path) {
    const next: Node | undefined = n.childNodes[i];
    if (!next) return null;
    n = next;
  }
  return n;
}

export interface SplitResult {
  movedHtml: string;
  remainderHtml: string;
  movedText: string;
}

/**
 * Returns null when the selection is empty or not fully inside `container`.
 */
export function splitSelection(
  container: HTMLElement,
  range: Range
): SplitResult | null {
  if (range.collapsed) return null;
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) {
    return null;
  }

  const doc = container.ownerDocument || document;
  const startPath = nodePath(container, range.startContainer);
  const endPath = nodePath(container, range.endContainer);

  const clone = container.cloneNode(true) as HTMLElement;
  const startNode = nodeAtPath(clone, startPath);
  const endNode = nodeAtPath(clone, endPath);
  if (!startNode || !endNode) return null;

  const cloneRange = doc.createRange();
  try {
    cloneRange.setStart(startNode, range.startOffset);
    cloneRange.setEnd(endNode, range.endOffset);
  } catch {
    return null;
  }

  const movedText = cloneRange.toString().trim();
  if (!movedText) return null;

  // Snapshot the selected fragment BEFORE deleting it from the clone.
  const frag = cloneRange.cloneContents();
  const holder = doc.createElement('div');
  holder.appendChild(frag);
  const movedHtml = holder.innerHTML;

  cloneRange.deleteContents();
  const remainderHtml = clone.innerHTML;

  return { movedHtml, remainderHtml, movedText };
}

/** Plain-text word count (for refreshing an item's wordCount after a split). */
export function countWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(' ').length : 0;
}
