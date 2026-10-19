import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ROLE_LABEL: Record<string, string> = {
  program_coordinator: 'Program Coordinator',
  reader: 'Reader',
  lead_reader: 'Lead Reader',
};

/**
 * Header role switcher for multi-role users (e.g. Program Coordinator at one
 * college and Reader at another — typical of CSHSE board members). Shows the
 * active "Role · Institution"; choosing another assignment switches the whole
 * portal to that role. Renders nothing for users with a single assignment, so
 * everyone else keeps the plain role badge.
 */
export default function RoleSwitcher() {
  const navigate = useNavigate();
  const assignments = useAuthStore((s) => s.getRoleAssignments());
  const active = useAuthStore((s) => s.getActiveContext());
  const effectiveUser = useAuthStore((s) => s.getEffectiveUser());
  const setActiveContext = useAuthStore((s) => s.setActiveContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (assignments.length < 2) return null;

  // With no explicit choice yet, the current context is the user's primary
  // role + institution (what the server uses when no header is sent).
  const current = active || {
    role: effectiveUser?.role || '',
    institutionId: String(effectiveUser?.institutionId || ''),
    institutionName: effectiveUser?.institutionName,
  };
  const isCurrent = (a: { role: string; institutionId: string }) =>
    a.role === current.role && String(a.institutionId) === String(current.institutionId);
  const currentName =
    current.institutionName || assignments.find((a) => isCurrent(a))?.institutionName || '';

  return (
    <div ref={ref} className="relative" data-testid="role-switcher">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch the role you are working as"
        className="user-role-badge inline-flex items-center gap-1.5 max-w-[22rem] cursor-pointer hover:bg-gray-200"
        data-testid="role-switcher-button"
      >
        <span className="whitespace-nowrap font-semibold">{ROLE_LABEL[current.role] || current.role.replace('_', ' ')}</span>
        {currentName && <span className="min-w-0 truncate text-gray-500">· {currentName}</span>}
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-gray-200 bg-white py-1 shadow-lg" data-testid="role-switcher-menu">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Work as</div>
          {assignments.map((a, i) => {
            const on = isCurrent(a);
            return (
              <button
                key={`${a.role}-${a.institutionId}`}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                data-testid={`role-switcher-option-${i}`}
                onClick={() => {
                  setOpen(false);
                  if (on) return;
                  setActiveContext({ role: a.role, institutionId: String(a.institutionId), institutionName: a.institutionName });
                  navigate('/dashboard');
                }}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${on ? 'bg-primary-50' : ''}`}
              >
                <span className={`mt-0.5 inline-block h-4 w-4 shrink-0 text-primary-600 ${on ? '' : 'invisible'}`} aria-hidden="true">✓</span>
                <span>
                  <span className="block font-medium text-gray-900">{ROLE_LABEL[a.role] || a.role}</span>
                  <span className="block text-gray-500">{a.institutionName || 'Institution'}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
