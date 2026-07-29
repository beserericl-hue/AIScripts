/**
 * SpecRail — left column of the Review step.
 *
 * Lists every spec for the current program level (UI spec §6.3), with
 * a checkmark + count when items have been auto-placed, a coverage
 * badge (🟢/🟡/🔴) once the second-pass review has set scores, and
 * two synthetic buckets at the bottom:
 *   - "Unplaced": items the matcher couldn't assign to any spec
 *   - "Unwritten": placeholder template sections (template format only)
 */
import React, { useMemo, useState } from 'react';
import { Search, AlertTriangle, FileText, Grid3x3, BookOpen, User, FileBox } from 'lucide-react';
import type {
  SpecBucket,
  PlaceholderSection,
  Tag,
  MatrixData,
  IntroductionBucket,
  CVItem,
  EvidenceDocItem
} from '../../../../../store/aiImportStore';

export const UNPLACED_KEY = '_unplaced';
export const UNWRITTEN_KEY = '_unwritten';
export const MATRICES_KEY = '_matrices';
// CR-033 / CR-040 — synthetic rail keys for detector outputs.
export const CVS_KEY = '_cvs';
export const EVIDENCE_DOCS_KEY = '_evidence-docs';
// CR-040 follow-on (post-release UX feedback) — Supporting Evidence
// rail group has a header + three always-visible sub-tiles so
// coordinators see the section structure even before the detectors
// have surfaced anything for this submission.
export const PAPERS_KEY = '_evidence-docs:paper';
export const SYLLABI_KEY = '_evidence-docs:syllabus';
// CR-040 Phase 3b — synthetic rail key for the coverage_verifier output.
export const MISSING_FRAGMENTS_KEY = '_missing-fragments';
// CR-039 — Introduction bucket keys are namespaced so they never collide
// with synthetic ('_unplaced') or real spec keys ('1.a').
export const INTRO_DOC_KEY = '_intro:document';
export const introStandardKey = (n: string) => `_intro:standard-${n}`;
export const isIntroKey = (k: string | null) => !!k && k.startsWith('_intro:');
export const introBucketKeyFromSpecKey = (k: string): string =>
  k.startsWith('_intro:') ? k.slice('_intro:'.length) : k;

interface SpecRailProps {
  buckets: Record<string, SpecBucket>;
  tags: Tag[];
  placeholders: PlaceholderSection[];
  matrices: MatrixData[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  // CR-039 — Introduction buckets keyed by 'document' / 'standard-{N}'.
  // Pass-through optional; when absent the rail behaves as before.
  introductions?: Record<string, IntroductionBucket>;
  // CR-033 / CR-040 — detector outputs surfaced as new rail entries.
  cvs?: CVItem[];
  evidenceDocs?: EvidenceDocItem[];
  // CR-040 Phase 3b — count of unresolved missing fragments so the rail
  // can surface "Missing from import (N)" alongside Unplaced when the
  // coverage_verifier finds gaps.
  missingFragmentCount?: number;
  // CR-039 Phase 2c part 2 — "+ Add from source" affordance on every
  // Introduction row. Opens ShowInSourceModal in selection mode
  // targeting that intro bucket key ('document' or 'standard-{N}').
  onAddFromSourceForIntro?: (introBucketKey: string) => void;
}

type CoverageState = 'covered' | 'partial' | 'gap' | 'unassessed' | 'none';

/**
 * The dot's meaning. A spec is only RED ("gap") when the AI actually ASSESSED
 * it and found it lacking. A spec with content but NO assessment yet is
 * 'unassessed' (gray) — NOT red — so the red dot never lies about a gap the AI
 * never evaluated (the MCC bug: every spec showed red because coverage never
 * ran). Empty specs show no dot.
 */
export function coverageState(b: SpecBucket): CoverageState {
  const hasContent = !!(b.narratives.length || b.evidenceText.length || b.evidenceFiles.length);
  const assessed = b.coverageCovered !== null || b.coverageScore !== null;
  if (!assessed) return hasContent ? 'unassessed' : 'none';
  if (b.coverageCovered === true) return 'covered';
  if (b.coverageScore !== null && b.coverageScore >= 0.5) return 'partial';
  return 'gap';
}

function coverageIcon(b: SpecBucket): string {
  switch (coverageState(b)) {
    case 'covered': return '🟢';
    case 'partial': return '🟡';
    case 'gap': return '🔴';
    case 'unassessed': return '⚪';
    default: return '';
  }
}

/** Trim one gap/strength sentence so a hover tooltip stays a sane height. */
function clip(s: string, n = 180): string {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/**
 * Human explanation of WHY a spec shows its green/yellow/red coverage dot —
 * the color's meaning + the AI coverage_verifier's actual gaps (what still
 * needs work) and strengths (what's working). Surfaced as the dot's hover
 * tooltip so a coordinator sees the reason instead of guessing.
 */
export function coverageReason(b: SpecBucket): string {
  const state = coverageState(b);
  const score = b.coverageScore;
  const pct = score !== null ? `${Math.round(score * 100)}%` : null;

  if (state === 'none') {
    return 'No content placed here yet — nothing has been routed to this specification. Add or move a narrative/evidence item to it.';
  }
  // Content exists but the AI coverage review never ran (e.g. an MCC import that
  // predates coverage). The dot is gray, NOT red — the AI hasn't judged a gap.
  if (state === 'unassessed') {
    return 'Not yet assessed — the AI coverage review hasn’t run for this spec, so there’s no verdict yet. Click “Check coverage” above to review every filled spec (score, gaps, and strengths). No re-reading of the document is needed.';
  }

  const gaps = (b.coverageGaps || []).filter(Boolean);
  const strengths = (b.coverageStrengths || []).filter(Boolean);
  // Never surface a raw model error (e.g. "LLM returned non-JSON response").
  const looksLikeError =
    gaps.length > 0 && gaps.every((g) => /non-json|llm returned|failed|error|timed out|no response|parse/i.test(g));

  const lines: string[] = [];
  if (state === 'covered') {
    lines.push(`🟢 Covered${pct ? ` — the AI review found ${pct} of the specification's criteria addressed` : ''}.`);
  } else if (state === 'partial') {
    lines.push(`🟡 Partial — ${pct ?? 'some'} of the criteria are addressed, but gaps remain.`);
  } else {
    lines.push(`🔴 Gap — the AI review found this spec is not adequately addressed${pct ? ` (only ${pct} of the criteria met)` : ''}.`);
  }

  if (looksLikeError) {
    lines.push('');
    lines.push('The AI coverage review errored on this spec — click “Check coverage” above to re-run it.');
    return lines.join('\n');
  }
  if (!gaps.length && !strengths.length) {
    // Assessed but no detail returned — rare; still honest.
    lines.push('');
    lines.push('The review returned a verdict but no detail. Click “Check coverage” to re-run it for specifics.');
    return lines.join('\n');
  }

  if (gaps.length) {
    lines.push('');
    lines.push(state === 'covered' ? 'To strengthen it further:' : 'What still needs work:');
    for (const g of gaps.slice(0, state === 'covered' ? 3 : 5)) lines.push(`•  ${clip(g)}`);
  }
  if (strengths.length) {
    lines.push('');
    lines.push('What’s working:');
    for (const s of strengths.slice(0, 3)) lines.push(`•  ${clip(s)}`);
  }
  return lines.join('\n');
}

function bucketCount(b: SpecBucket): number {
  const mc = (b as any).matrixCells?.length || 0;
  return b.narratives.length + b.evidenceText.length + b.evidenceFiles.length + mc;
}

export function SpecRail({
  buckets,
  tags,
  placeholders,
  matrices,
  selectedKey,
  onSelect,
  introductions,
  cvs,
  evidenceDocs,
  missingFragmentCount = 0,
  onAddFromSourceForIntro
}: SpecRailProps): JSX.Element {
  const [filter, setFilter] = useState('');

  // CR-040 follow-on — split evidenceDocs by sub-kind so the rail can
  // render Syllabi and Papers/Projects as separate sub-tiles. Papers
  // captures both 'paper' (research papers in the appendix) and any
  // future sub-kind that isn't 'syllabus' so we don't drop items.
  const syllabusCount = useMemo(
    () => (evidenceDocs || []).filter((d) => d.docSubKind === 'syllabus').length,
    [evidenceDocs]
  );
  const paperCount = useMemo(
    () => (evidenceDocs || []).filter((d) => d.docSubKind !== 'syllabus').length,
    [evidenceDocs]
  );

  // Group buckets by standard for the rail's accordion structure.
  const byStandard = useMemo(() => {
    const map = new Map<string, SpecBucket[]>();
    for (const b of Object.values(buckets)) {
      if (!map.has(b.standardCode)) map.set(b.standardCode, []);
      map.get(b.standardCode)!.push(b);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.specCode.localeCompare(b.specCode));
    }
    return [...map.entries()].sort(
      ([a], [b]) => (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99)
    );
  }, [buckets]);

  const filterMatches = (text: string): boolean => {
    if (!filter) return true;
    return text.toLowerCase().includes(filter.toLowerCase());
  };

  // Synthetic "Unplaced" items come from tags whose suggestedStd is null
  // (matcher couldn't classify them). Tags with confidence below 0.50
  // are also tag-list-only — those show on the Apply screen, not here.
  const unplaced = tags.filter((t) => !t.suggestedStd || !t.suggestedSpec);

  return (
    <aside
      className="flex h-full w-72 flex-col border-r border-gray-200 bg-gray-50"
      aria-label="Specifications"
    >
      <div className="border-b border-gray-200 p-3">
        <label className="relative block">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter specs…"
            aria-label="Filter specifications"
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
          />
        </label>
        {/* CR-069 — legend: the rail dot is the AI's COVERAGE/compliance read on
            the spec (does the response satisfy the standard), NOT the per-card
            match confidence. They were being confused (a 0.92-confidence card
            under a red spec). */}
        <div
          className="mt-2 flex items-center gap-2 text-[10px] text-gray-500"
          title="Spec coverage status from the AI review — distinct from a card's match-confidence score."
        >
          <span className="font-medium uppercase tracking-wide">Coverage:</span>
          <span>🟢 covered</span>
          <span>🟡 partial</span>
          <span>🔴 gap</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-gray-400 bg-gray-200" /> not assessed
          </span>
          <span className="italic text-gray-400">— hover a dot for why</span>
        </div>
      </div>

      <nav role="tablist" aria-orientation="vertical" data-tour="review-rail" className="flex-1 overflow-auto p-2 text-sm">
        {/* CR-039 — Document-level Introduction sits at the very top so
            coordinators routing intro material always have a target with
            zero scrolling. Only render if the bucket exists; ItemCardList
            handles the empty state. */}
        {introductions?.document && (
          <div className="mb-2 flex items-center gap-1" data-tour="review-doc-intro">
            <button
              role="tab"
              aria-selected={selectedKey === INTRO_DOC_KEY}
              onClick={() => onSelect(INTRO_DOC_KEY)}
              title="Document Introduction — school-wide narrative that introduces the institution before any standard. Use Reassign on a misplaced spec card to move text here."
              className={`flex flex-1 items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                selectedKey === INTRO_DOC_KEY
                  ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-cshse-700" aria-hidden />
                <span className="font-medium">Document Introduction</span>
              </span>
              {introductions.document.items.length > 0 && (
                <span className="rounded bg-cshse-200 px-1.5 text-xs text-cshse-800">
                  {introductions.document.items.length}
                </span>
              )}
            </button>
            {onAddFromSourceForIntro && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddFromSourceForIntro('document');
                }}
                title="Add from source — open the source document, select a passage, drop it into the Document Introduction"
                className="rounded border border-cshse-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-cshse-700 hover:bg-cshse-50"
              >
                + Add
              </button>
            )}
          </div>
        )}

        {/* CR-033 / CR-040 follow-on (post-release UX feedback 2026-05-26)
            — Supporting Evidence rail group. ALWAYS rendered with three
            sub-tiles (CVs / Syllabi / Papers) even when the count is 0,
            so coordinators see the section structure regardless of
            whether the detectors surfaced anything for this submission.
            Empty tiles render with a gray "0" badge; populated tiles
            use the cshse accent. Clicking any sub-tile opens its filtered
            list in the middle pane. */}
        <div className="mb-3" data-tour="review-supporting-evidence">
          <div className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Supporting Evidence
          </div>
          <ul className="space-y-0.5">
            {/* CVs sub-tile */}
            <li>
              <button
                role="tab"
                data-tour="review-cvs"
                data-testid="rail-cvs"
                aria-selected={selectedKey === CVS_KEY}
                onClick={() => onSelect(CVS_KEY)}
                title={
                  cvs && cvs.length > 0
                    ? `${cvs.length} faculty CV(s) detected — review + reassign to spec or Discard`
                    : 'Faculty CVs detected by the cv_detector during parse. No CVs detected in this import yet.'
                }
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                  selectedKey === CVS_KEY
                    ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-cshse-700" aria-hidden />
                  <span className="font-medium">CVs</span>
                </span>
                <span
                  className={`rounded px-1.5 text-xs ${
                    cvs && cvs.length > 0
                      ? 'bg-cshse-200 text-cshse-800'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {(cvs && cvs.length) || 0}
                </span>
              </button>
            </li>
            {/* Syllabi sub-tile */}
            <li>
              <button
                role="tab"
                data-tour="review-syllabi"
                data-testid="rail-syllabi"
                aria-selected={selectedKey === SYLLABI_KEY}
                onClick={() => onSelect(SYLLABI_KEY)}
                title={
                  syllabusCount > 0
                    ? `${syllabusCount} course syllab${syllabusCount === 1 ? 'us' : 'i'} detected`
                    : 'Course syllabi detected by appendix_paper_detector during parse. None detected in this import yet.'
                }
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                  selectedKey === SYLLABI_KEY
                    ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <FileBox className="h-3.5 w-3.5 text-cshse-700" aria-hidden />
                  <span className="font-medium">Syllabi</span>
                </span>
                <span
                  className={`rounded px-1.5 text-xs ${
                    syllabusCount > 0
                      ? 'bg-cshse-200 text-cshse-800'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {syllabusCount}
                </span>
              </button>
            </li>
            {/* Papers / Projects sub-tile */}
            <li>
              <button
                role="tab"
                data-tour="review-papers"
                data-testid="rail-papers"
                aria-selected={selectedKey === PAPERS_KEY}
                onClick={() => onSelect(PAPERS_KEY)}
                title={
                  paperCount > 0
                    ? `${paperCount} appendix paper(s) / student work sample(s) detected`
                    : 'Appendix papers + student work samples detected by appendix_paper_detector. None detected in this import yet.'
                }
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                  selectedKey === PAPERS_KEY
                    ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <FileBox className="h-3.5 w-3.5 text-cshse-700" aria-hidden />
                  <span className="font-medium">Papers / Projects / Appendices</span>
                </span>
                <span
                  className={`rounded px-1.5 text-xs ${
                    paperCount > 0
                      ? 'bg-cshse-200 text-cshse-800'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {paperCount}
                </span>
              </button>
            </li>
            {/* Matrices sub-tile — ALWAYS visible like the other file
                types (post-release feedback 2026-06-13: coordinators expect
                "CV, Syllabi, Projects, Matrices" listed together). The count
                comes from aiMatrixState.matrices, which the server rebuilds
                from the durable CurriculumMatrix / SelfStudyImport sources so
                imported matrices never silently drop off this list. */}
            <li>
              <button
                role="tab"
                data-tour="review-matrices"
                data-testid="rail-matrices"
                aria-selected={selectedKey === MATRICES_KEY}
                onClick={() => onSelect(MATRICES_KEY)}
                title={
                  matrices.length > 0
                    ? `${matrices.length} curriculum matrix(es): ${matrices.map((m) => m.name).join(', ')}`
                    : 'Curriculum matrices detected at import. None surfaced for this submission yet.'
                }
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                  selectedKey === MATRICES_KEY
                    ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Grid3x3 className="h-3.5 w-3.5 text-cshse-700" aria-hidden />
                  <span className="font-medium">Matrices</span>
                </span>
                <span
                  className={`rounded px-1.5 text-xs ${
                    matrices.length > 0
                      ? 'bg-cshse-200 text-cshse-800'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {matrices.length}
                </span>
              </button>
            </li>
          </ul>
        </div>

        {byStandard.map(([std, list]) => {
          const visible = list.filter((b) =>
            filterMatches(`${std}.${b.specCode} ${b.standardTitle} ${b.specPrompt}`)
          );
          if (visible.length === 0) return null;
          // CR-039 — per-Standard Introduction sibling above the spec list.
          // Only render when the IntroductionBucket exists for this
          // standard. Empty buckets get a faint count badge ("0") to
          // signal the row is intentionally there but has no items yet —
          // coordinators can still click to land on the bucket and
          // Reassign material in.
          const intro = introductions?.[`standard-${std}`];
          return (
            <div key={std} className="mb-2" data-tour="review-standards">
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Standard {std}
              </div>
              <ul>
                {intro && (
                  <li className="flex items-center gap-1">
                    <button
                      role="tab"
                      aria-selected={selectedKey === introStandardKey(std)}
                      onClick={() => onSelect(introStandardKey(std))}
                      title={`Standard ${std} Introduction — narrative that introduces the standard before any specific subspec. Use Reassign on a misplaced spec card to move text here.`}
                      className={`flex flex-1 items-center justify-between rounded px-2 py-1.5 text-left ${
                        selectedKey === introStandardKey(std)
                          ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <BookOpen className="h-3.5 w-3.5 text-cshse-700" aria-hidden />
                        <span className="text-xs italic">Introduction</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        {intro.items.length > 0 && (
                          <span className="rounded bg-cshse-200 px-1.5 text-cshse-800">
                            {intro.items.length}
                          </span>
                        )}
                      </span>
                    </button>
                    {onAddFromSourceForIntro && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddFromSourceForIntro(`standard-${std}`);
                        }}
                        title={`Add from source for Standard ${std} Introduction — select a passage in the source document`}
                        className="rounded border border-cshse-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-cshse-700 hover:bg-cshse-50"
                      >
                        + Add
                      </button>
                    )}
                  </li>
                )}
                {visible.map((b) => {
                  const key = `${b.standardCode}.${b.specCode}`;
                  const count = bucketCount(b);
                  const icon = coverageIcon(b);
                  const covState = coverageState(b);
                  const isActive = selectedKey === key;
                  // Truncated titles in the rail; native title attribute provides
                  // a hover tooltip showing the full standard title + spec prompt.
                  const fullTitle = b.specPrompt
                    ? `${b.standardCode}.${b.specCode} — ${b.standardTitle}\n\n${b.specPrompt}`
                    : `${b.standardCode}.${b.specCode} — ${b.standardTitle}`;
                  return (
                    <li key={key}>
                      <button
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onSelect(key)}
                        title={fullTitle}
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left ${
                          isActive
                            ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-xs">{b.standardCode}.{b.specCode}</span>
                          <span className="truncate text-xs text-gray-500">{b.standardTitle}</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          {count > 0 && (
                            <span className="rounded bg-cshse-200 px-1.5 text-cshse-800">{count}</span>
                          )}
                          {covState !== 'none' && (
                            // Hovering the dot explains WHY this color — the
                            // coverage status + the AI's specific gaps/strengths.
                            // Its own `title` overrides the row's spec-title tip.
                            <span
                              className="cursor-help"
                              data-testid={`coverage-dot-${key}`}
                              data-coverage-state={covState}
                              title={coverageReason(b)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {covState === 'unassessed' ? (
                                // Gray hollow dot — visibly distinct from the
                                // status emoji so "not assessed" never reads as
                                // a red gap.
                                <span
                                  aria-hidden
                                  className="inline-block h-2.5 w-2.5 rounded-full border border-gray-400 bg-gray-200 align-middle"
                                />
                              ) : (
                                <span aria-hidden>{icon}</span>
                              )}
                              <span className="sr-only">
                                {covState === 'covered'
                                  ? 'covered'
                                  : covState === 'partial'
                                  ? 'partial coverage'
                                  : covState === 'gap'
                                  ? 'gap'
                                  : 'not yet assessed'}
                                . {coverageReason(b)}
                              </span>
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="mt-4 border-t border-gray-200 pt-3">
          <button
            role="tab"
            aria-selected={selectedKey === UNPLACED_KEY}
            onClick={() => onSelect(UNPLACED_KEY)}
            className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
              selectedKey === UNPLACED_KEY
                ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              <span>Unplaced</span>
            </span>
            <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-700">{unplaced.length}</span>
          </button>

          {placeholders.length > 0 && (
            <button
              role="tab"
              aria-selected={selectedKey === UNWRITTEN_KEY}
              onClick={() => onSelect(UNWRITTEN_KEY)}
              className={`mt-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                selectedKey === UNWRITTEN_KEY
                  ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                <span>Unwritten</span>
              </span>
              <span className="rounded bg-gray-200 px-1.5 text-xs text-gray-700">{placeholders.length}</span>
            </button>
          )}

          {/* CR-040 Phase 3b — Missing from import. Visible only when the
              coverage_verifier flagged unaccounted-for sections. Different
              icon (warning triangle in red) from Unplaced (amber) so
              coordinators see "the system thought this was lost" vs
              "the AI didn't know where to put it". */}
          {missingFragmentCount > 0 && (
            <button
              role="tab"
              aria-selected={selectedKey === MISSING_FRAGMENTS_KEY}
              onClick={() => onSelect(MISSING_FRAGMENTS_KEY)}
              className={`mt-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                selectedKey === MISSING_FRAGMENTS_KEY
                  ? 'bg-red-50 text-red-900 ring-1 ring-red-500'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              title="Sections the parser flagged as unaccounted for. Place them in a spec or explicitly discard before Apply."
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden />
                <span>Missing from import</span>
              </span>
              <span className="rounded bg-red-100 px-1.5 text-xs text-red-700">{missingFragmentCount}</span>
            </button>
          )}
        </div>
      </nav>
    </aside>
  );
}
