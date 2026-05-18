/**
 * CourseCatalogCombo — searchable combobox for picking a course code
 * from the program's per-institution catalog (UI spec §6.4 + §20.4).
 *
 * Allows the Coordinator to type-to-search existing courses or create
 * a new one inline. Keyboard nav: ↑/↓ to move, Enter to select, Esc to
 * close. Aria-compliant combobox role.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { api } from '../../../../../services/api';

export interface ProgramCourse {
  _id?: string;
  courseCode: string;
  courseName: string;
  source?: string;
}

interface CourseCatalogComboProps {
  submissionId: string;
  value: string | null;
  onChange: (course: ProgramCourse | null) => void;
  placeholder?: string;
}

export function CourseCatalogCombo({
  submissionId,
  value,
  onChange,
  placeholder = 'Pick a course…'
}: CourseCatalogComboProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<ProgramCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get(`/api/program-courses/${submissionId}/courses`)
      .then((res) => setCourses(res.data?.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [open, submissionId]);

  const filtered = query
    ? courses.filter(
        (c) =>
          c.courseCode.toLowerCase().includes(query.toLowerCase()) ||
          c.courseName.toLowerCase().includes(query.toLowerCase())
      )
    : courses;

  const select = (course: ProgramCourse) => {
    onChange(course);
    setQuery(course.courseCode);
    setOpen(false);
    setHighlight(0);
  };

  const startCreate = () => {
    setCreating(true);
    setNewName('');
  };

  const submitCreate = async () => {
    const code = query.trim();
    if (!code || !newName.trim()) return;
    try {
      const res = await api.post(`/api/program-courses/${submissionId}/courses`, {
        courseCode: code,
        courseName: newName.trim()
      });
      const course = res.data?.course as ProgramCourse;
      if (course) {
        setCourses((prev) => [...prev, course]);
        select(course);
      }
    } catch {
      // ignore — UI shows the existing dropdown empty
    } finally {
      setCreating(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) select(filtered[highlight]);
      else if (query.trim().length > 0) startCreate();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={open ? query : value || ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded border border-gray-200 bg-white shadow-lg"
        >
          {loading && (
            <li className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Loading…
            </li>
          )}
          {!loading && filtered.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-gray-500">No courses yet — type a code and press Enter.</li>
          )}
          {filtered.map((c, idx) => (
            <li
              key={c.courseCode}
              role="option"
              aria-selected={idx === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                select(c);
              }}
              className={`flex cursor-pointer items-center justify-between px-2 py-1.5 text-sm ${
                idx === highlight ? 'bg-cshse-100 text-cshse-900' : 'hover:bg-gray-50'
              }`}
            >
              <span>
                <span className="font-mono text-xs">{c.courseCode}</span>{' '}
                <span className="text-gray-500">{c.courseName}</span>
              </span>
            </li>
          ))}
          {!loading && query.trim().length > 0 && !filtered.some((c) => c.courseCode === query.trim().toUpperCase()) && (
            <li
              onMouseDown={(e) => {
                e.preventDefault();
                startCreate();
              }}
              className="flex cursor-pointer items-center gap-1.5 border-t border-gray-100 bg-gray-50 px-2 py-1.5 text-xs text-cshse-700 hover:bg-gray-100"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Create &ldquo;{query.trim()}&rdquo;
            </li>
          )}
        </ul>
      )}

      {creating && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded border border-cshse-200 bg-white p-3 shadow-lg">
          <div className="text-xs font-medium text-gray-700">
            Create new course &ldquo;{query.trim()}&rdquo;
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Course name (e.g. Family Systems Theory)"
            className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setCreating(false)}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={submitCreate}
              disabled={!newName.trim()}
              className="rounded bg-cshse-600 px-2 py-1 text-xs text-white hover:bg-cshse-700 disabled:bg-gray-300"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
