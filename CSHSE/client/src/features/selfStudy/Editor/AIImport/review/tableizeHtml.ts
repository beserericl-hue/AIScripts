/**
 * tableizeIfBareRows — defense-in-depth for displaying partial-table HTML.
 *
 * When a coordinator selects a portion of a table via "+ Add from source",
 * the browser's Range.cloneContents() returns the selected rows / cells
 * but NOT the wrapping <table> element. Bare <tr> or <td> without a
 * <table> ancestor doesn't render — the browser drops the rows and
 * renders only the inline text, which looks like one cell per line.
 *
 * The selection-capture path (ShowInSourceModal) wraps the fragment at
 * capture time. This helper is the render-time twin: any time an
 * htmlSnippet is rendered, run it through this so bare <tr>/<td>
 * markers get wrapped before being handed to dangerouslySetInnerHTML.
 *
 * User direction 2026-05-22: "if it has <tr></tr> rows then you can
 * assume it is a table and format appropriately."
 *
 * Rules:
 *   - Already has a <table> tag → return unchanged.
 *   - Has bare <tr> (no <table>) → wrap as <table><tbody>{html}</tbody></table>.
 *   - Has bare <td>/<th> (no <table>, no <tr>) → wrap as
 *     <table><tbody><tr>{html}</tr></tbody></table>.
 *   - Otherwise → return unchanged.
 *
 * Pure function. No side effects. Safe to call repeatedly (idempotent
 * once a <table> is present).
 */
export function tableizeIfBareRows(html: string): string {
  if (!html) return html;
  // Already contains a <table>? Trust the source.
  if (/<table\b/i.test(html)) return html;
  if (/<tr\b/i.test(html)) {
    return `<table><tbody>${html}</tbody></table>`;
  }
  if (/<t[dh]\b/i.test(html)) {
    return `<table><tbody><tr>${html}</tr></tbody></table>`;
  }
  return html;
}
