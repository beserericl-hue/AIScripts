/**
 * Introduction drafts (aiReviewState.introductions: 'document' | 'standard-N'
 * → { items[] }). The official template's Standard ROOT rows carry only
 * CSHSE's standard statement as a heading — with no program text under them
 * the import produced EMPTY intro items that could be approved and then wrote
 * "<p></p>" into the editor's Standard introduction. An item with no visible
 * body (text, table or image) is not a draft.
 */
export function introItemHasBody(it: { snippet?: string | null; htmlSnippet?: string | null } | null | undefined): boolean {
  if (!it) return false;
  const html = String(it.htmlSnippet || '');
  if (/<(img|table)\b/i.test(html)) return true;
  const text = (String(it.snippet || '').trim() || html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')).replace(/\s+/g, ' ').trim();
  if (!text) return false;
  // CSHSE's own lead-in for a standard ("Describe and provide evidence that the
  // following are adequately addressed in the curriculum:") is the template's
  // prompt, not the program's writing — not a draft.
  return !isOfficialPromptOnly(text);
}

/**
 * True when the text is only a CSHSE instruction to the program: one sentence
 * that starts with an instruction verb and ends with a colon (it introduces
 * the specifications that follow), with nothing written after it.
 */
export function isOfficialPromptOnly(text: string): boolean {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 300) return false;
  return /^(describe|provide|identify|explain|document|demonstrate|list|show|discuss)\b[^.:;?!]*:$/i.test(t);
}

/** HTML that renders nothing (e.g. "<p></p>", "<p><br></p>"). */
export function isEmptyHtml(html: string | null | undefined): boolean {
  const h = String(html || '');
  if (/<(img|table)\b/i.test(h)) return false;
  return h.replace(/<[^>]+>|&nbsp;|\s/gi, '').length === 0;
}

/** A copy of an introductions map with empty items (and then-empty buckets) removed. */
export function dropEmptyIntroItems<T extends Record<string, { items?: any[] } & Record<string, any>>>(intros: T | null | undefined): T {
  const out: Record<string, any> = {};
  for (const [k, b] of Object.entries(intros || {})) {
    const items = (b?.items || []).filter(introItemHasBody);
    if (items.length) out[k] = { ...b, items };
  }
  return out as T;
}
