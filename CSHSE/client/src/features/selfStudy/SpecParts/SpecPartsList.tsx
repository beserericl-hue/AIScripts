import { useSpecParts } from '../../../hooks/useSpecParts';

interface SpecPartsListProps {
  submissionId: string | null | undefined;
  standardCode: string;
  specCode: string;
  /** Where it renders — keeps test ids distinct between the Review rail and the Editor. */
  surface: 'rail' | 'editor-nav' | 'editor';
  /** Read-only (a submitted study, or a viewer without write access). */
  readOnly?: boolean;
  /**
   * When given, the part's number + wording is a link that opens that part's
   * text (Review: its draft card; Editor: its "4.a.2 …" heading). The checkbox
   * alone then approves.
   */
  onOpenPart?: (n: number) => void;
}

/**
 * The numbered parts of one specification (4.a.1, 4.a.2 …), each with its own
 * Approve box. Renders nothing for the many specifications without parts.
 */
export function SpecPartsList({ submissionId, standardCode, specCode, surface, readOnly, onOpenPart }: SpecPartsListProps) {
  const { partsOf, isApproved, setApproved } = useSpecParts(submissionId);
  const parts = partsOf(standardCode, specCode);
  if (!parts.length) return null;
  const id = `${surface}-parts-${standardCode}-${specCode}`;
  const roomy = surface === 'editor';

  return (
    <ul
      data-testid={id}
      aria-label={`Numbered parts of ${standardCode}.${specCode}`}
      className={roomy ? 'mt-2 space-y-1' : 'ml-6 mb-1 space-y-0.5 border-l border-gray-200 pl-2'}
    >
      {parts.map((p) => {
        const label = `${standardCode}.${specCode}.${p.n}`;
        const on = isApproved(standardCode, specCode, p.n);
        return (
          <li key={p.n}>
            <label
              title={`${label} — ${p.text}`}
              className={`flex items-start gap-1.5 rounded px-1 ${roomy ? 'py-1 text-sm' : 'py-0.5 text-xs'} ${
                readOnly ? '' : 'cursor-pointer hover:bg-gray-100'
              } ${on ? 'text-gray-500' : 'text-gray-700'}`}
            >
              <input
                type="checkbox"
                data-testid={`${id}-${p.n}`}
                aria-label={`Approve ${label}`}
                checked={on}
                disabled={readOnly || !submissionId}
                onChange={(e) => setApproved(standardCode, specCode, p.n, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-green-600 focus:ring-cshse-500"
              />
              {onOpenPart ? (
                <button
                  type="button"
                  data-testid={`${id}-${p.n}-open`}
                  title={`Show the text for ${label}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenPart(p.n);
                  }}
                  className={`flex min-w-0 items-start gap-1.5 text-left hover:text-cshse-700 hover:underline`}
                >
                  <span className="font-mono shrink-0">{label}</span>
                  <span className={roomy ? '' : 'truncate'}>{p.text}</span>
                </button>
              ) : (
                <>
                  <span className="font-mono shrink-0">{label}</span>
                  <span className={roomy ? '' : 'truncate'}>{p.text}</span>
                </>
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** "2/4 parts" badge for a spec row; nothing for specs without parts. */
export function SpecPartsBadge({ submissionId, standardCode, specCode }: { submissionId: string | null | undefined; standardCode: string; specCode: string }) {
  const { partsOf, approvedCount } = useSpecParts(submissionId);
  const total = partsOf(standardCode, specCode).length;
  if (!total) return null;
  const done = approvedCount(standardCode, specCode);
  return (
    <span
      data-testid={`parts-badge-${standardCode}-${specCode}`}
      title={`${done} of ${total} numbered parts approved`}
      className={`whitespace-nowrap rounded px-1 text-[10px] font-medium ${done === total ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
    >
      {done}/{total} parts
    </span>
  );
}
