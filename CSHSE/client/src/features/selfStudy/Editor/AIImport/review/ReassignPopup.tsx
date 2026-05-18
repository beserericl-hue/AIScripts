/**
 * ReassignPopup — choose a new (std, spec) destination for one or more
 * sections. Shared between the ItemPreview "Reassign to a different
 * (Std, Spec)…" button and the bulk-action "Reassign" button on the
 * ItemTable (UI spec §6.3 bulk-action toolbar).
 *
 * Centered modal; focus-trapped via Headless UI patterns — but kept
 * simple here with a click-outside / Esc to close. Returns the chosen
 * (std, spec) on Confirm; null on Cancel.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { SpecBucket } from '../../../../../store/aiImportStore';

interface ReassignPopupProps {
  open: boolean;
  buckets: Record<string, SpecBucket>;
  sectionIds: string[];
  onClose: () => void;
  onConfirm: (std: string, spec: string) => void;
}

export function ReassignPopup({
  open,
  buckets,
  sectionIds,
  onClose,
  onConfirm
}: ReassignPopupProps): JSX.Element | null {
  const [std, setStd] = useState<string>('');
  const [spec, setSpec] = useState<string>('');

  // Build the standard → spec letters menu.
  const standardOptions = useMemo(() => {
    const map = new Map<string, { title: string; specs: string[] }>();
    for (const b of Object.values(buckets)) {
      if (!map.has(b.standardCode)) {
        map.set(b.standardCode, { title: b.standardTitle, specs: [] });
      }
      map.get(b.standardCode)!.specs.push(b.specCode);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99))
      .map(([code, info]) => ({
        code,
        title: info.title,
        specs: [...new Set(info.specs)].sort()
      }));
  }, [buckets]);

  // Reset selection when popup opens.
  useEffect(() => {
    if (open) {
      setStd('');
      setSpec('');
    }
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const stdInfo = standardOptions.find((s) => s.code === std);
  const canConfirm = std && spec;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reassign-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 id="reassign-title" className="text-base font-semibold text-gray-900">
            Reassign {sectionIds.length === 1 ? 'item' : `${sectionIds.length} items`}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label htmlFor="reassign-std" className="block text-xs font-medium text-gray-700">
              Standard
            </label>
            <select
              id="reassign-std"
              value={std}
              onChange={(e) => {
                setStd(e.target.value);
                setSpec('');
              }}
              className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-cshse-500 focus:ring-1 focus:ring-cshse-500"
            >
              <option value="">— pick a Standard —</option>
              {standardOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  Std {s.code} — {s.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reassign-spec" className="block text-xs font-medium text-gray-700">
              Specification
            </label>
            <select
              id="reassign-spec"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              disabled={!std}
              className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-cshse-500 focus:ring-1 focus:ring-cshse-500 disabled:bg-gray-50"
            >
              <option value="">— pick a Spec —</option>
              {(stdInfo?.specs || []).map((sp) => (
                <option key={sp} value={sp}>
                  {std}.{sp}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(std, spec)}
            disabled={!canConfirm}
            className="rounded bg-cshse-600 px-3 py-1.5 text-sm text-white hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Reassign
          </button>
        </div>
      </div>
    </div>
  );
}
