/**
 * TagListView — the post-Finish triage view (UI spec §7).
 *
 * Shows every unresolved import tag with filter / sort / search. Each
 * row is clickable → opens TagPopup. URL deep-link support: navigating
 * to `/ai-import/tags/:tagId` opens the popup pre-selected (UI spec
 * §20.8).
 *
 * Pruning model: explicit only. Tags don't auto-clear when the spec is
 * manually filled in the Standards tab — the Coordinator must Apply /
 * Skip / Discard each tag (UI spec §20.2).
 */
import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useAIImportStore, type Tag } from '../../../../../store/aiImportStore';
import { TagPopup } from './TagPopup';

interface TagListViewProps {
  /** Initial tag to open (for deep-link routing). */
  initialTagId?: string | null;
}

export function TagListView({ initialTagId = null }: TagListViewProps): JSX.Element {
  const tags = useAIImportStore((s) => s.tags);
  const buckets = useAIImportStore((s) => s.buckets);
  const setStep = useAIImportStore((s) => s.setStep);

  const [filterStd, setFilterStd] = useState<string>('');
  const [filterConf, setFilterConf] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [sortBy, setSortBy] = useState<'confidence-asc' | 'confidence-desc' | 'std'>('confidence-asc');
  const [search, setSearch] = useState('');
  const [activeTagId, setActiveTagId] = useState<string | null>(initialTagId);

  const stdOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tags) if (t.suggestedStd) set.add(t.suggestedStd);
    return [...set].sort((a, b) => (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99));
  }, [tags]);

  const filtered = useMemo(() => {
    let result = tags;
    if (filterStd) result = result.filter((t) => t.suggestedStd === filterStd);
    if (filterConf !== 'all') {
      result = result.filter((t) => {
        if (filterConf === 'high') return t.confidence >= 0.85;
        if (filterConf === 'mid') return t.confidence >= 0.5 && t.confidence < 0.85;
        return t.confidence < 0.5;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.summary.toLowerCase().includes(q) ||
          t.fullText.toLowerCase().includes(q) ||
          t.sourceHeading.toLowerCase().includes(q)
      );
    }
    const sorted = [...result];
    sorted.sort((a, b) => {
      if (sortBy === 'confidence-asc') return a.confidence - b.confidence;
      if (sortBy === 'confidence-desc') return b.confidence - a.confidence;
      const stdCmp = (parseInt(a.suggestedStd || '99', 10) - parseInt(b.suggestedStd || '99', 10));
      return stdCmp !== 0 ? stdCmp : (a.suggestedSpec || '').localeCompare(b.suggestedSpec || '');
    });
    return sorted;
  }, [tags, filterStd, filterConf, sortBy, search]);

  const activeTag = activeTagId ? filtered.find((t) => t.tagId === activeTagId) || tags.find((t) => t.tagId === activeTagId) : null;
  const activeIndex = activeTag ? filtered.findIndex((t) => t.tagId === activeTag.tagId) : -1;
  const prevTag = activeIndex > 0 ? filtered[activeIndex - 1] : undefined;
  const nextTag = activeIndex >= 0 && activeIndex < filtered.length - 1 ? filtered[activeIndex + 1] : undefined;

  const handleResolve = (tagId: string, _resolution: 'apply' | 'skip' | 'discard') => {
    // Remove the tag from the store regardless of resolution kind; the
    // server has already persisted the change via the single-item Apply
    // path (or, for Skip, we just clear it locally — server cleanup
    // happens at the next batch apply).
    useAIImportStore.setState((s) => ({
      tags: s.tags.filter((t) => t.tagId !== tagId)
    }));
    if (nextTag) setActiveTagId(nextTag.tagId);
    else setActiveTagId(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <h2 className="text-lg font-semibold text-gray-900">
          AI Import — {filtered.length} of {tags.length} tags
        </h2>
        <button
          onClick={() => setStep('upload')}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Start new import
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50 px-6 py-2 text-sm">
        <label className="flex items-center gap-1">
          <span className="text-gray-600">Std:</span>
          <select
            value={filterStd}
            onChange={(e) => setFilterStd(e.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            <option value="">All</option>
            {stdOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-gray-600">Conf:</span>
          <select
            value={filterConf}
            onChange={(e) => setFilterConf(e.target.value as any)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            <option value="all">All</option>
            <option value="high">≥ 0.85</option>
            <option value="mid">0.50–0.84</option>
            <option value="low">&lt; 0.50</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-gray-600">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            <option value="confidence-asc">Conf ↑</option>
            <option value="confidence-desc">Conf ↓</option>
            <option value="std">Std order</option>
          </select>
        </label>
        <label className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="rounded border border-gray-300 bg-white py-1 pl-7 pr-2 text-xs focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
          />
        </label>
      </div>

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {tags.length === 0
              ? 'No tags — start a new AI import to populate the list.'
              : 'No tags match the current filters.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-20 px-3 py-2">Tag ID</th>
                <th className="w-20 px-3 py-2">Suggested</th>
                <th className="w-16 px-3 py-2">Conf</th>
                <th className="px-3 py-2">Source heading</th>
                <th className="px-3 py-2">Excerpt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.tagId}
                  tabIndex={0}
                  onClick={() => setActiveTagId(t.tagId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setActiveTagId(t.tagId);
                  }}
                  className="cursor-pointer border-b border-gray-100 hover:bg-cshse-50 focus:bg-cshse-50 focus:outline-none"
                >
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{t.tagId.slice(0, 12)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">
                    {t.suggestedStd && t.suggestedSpec ? `${t.suggestedStd}.${t.suggestedSpec}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{t.confidence.toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{t.sourceHeading.slice(0, 80)}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{t.fullText.slice(0, 140)}{t.fullText.length > 140 ? '…' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TagPopup
        tag={activeTag || null}
        prevTag={prevTag}
        nextTag={nextTag}
        buckets={buckets}
        onClose={() => setActiveTagId(null)}
        onNavigate={(id) => setActiveTagId(id)}
        onResolve={handleResolve}
      />
    </div>
  );
}
