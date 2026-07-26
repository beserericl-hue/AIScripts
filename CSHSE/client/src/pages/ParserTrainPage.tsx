import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';

/**
 * Parser Train (CR-073) — the superuser human-in-the-loop parser training surface.
 *
 * Flow: create a SANDBOX run → import a document as the sandbox PC → poll the
 * parse → DIAGNOSE (contract-check: every item anchored? correct Standard/spec
 * placement? correct file types?) → open the Review screen to verify + run
 * Compare on every card (add notes/screenshots there) → APPROVE, which activates
 * the parser rules this run proposed. Nothing here touches a real submission or
 * an already-parsed document (MCC/AACC/Kennesaw) — training runs live on a
 * dedicated sandbox institution and are excluded from every normal list.
 */

type Level = 'associate' | 'bachelors' | 'masters';

interface RunRow { _id: string; submissionId: string; programLevel: Level; status: string; createdAt: string; }

interface Contract {
  ok: boolean;
  format: string;
  anchors: { ok: boolean; totalItems: number; anchored: number; missing: Array<{ sectionId: string; where?: string }> };
  coverage: { specsWithContent: number; byStandard: Record<string, string[]>; catalogSpecs: number };
  fileTypes: Record<string, number>;
  findings: Array<{ check: string; severity: string; detail: string }>;
}

const IMPERSONATE = (pcUserId: string) => ({
  'X-Impersonated-User-Id': pcUserId,
  'X-Impersonated-Role': 'program_coordinator',
});

export default function ParserTrainPage() {
  const { user, impersonation } = useAuthStore();
  const isSU = user?.isSuperuser === true && !impersonation.isImpersonating;

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [level, setLevel] = useState<Level>('associate');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  // active run being trained
  const [run, setRun] = useState<{ submissionId: string; pcUserId: string; programLevel: Level } | null>(null);
  const [importId, setImportId] = useState('');
  const [parseStatus, setParseStatus] = useState('');
  const [detectedFormat, setDetectedFormat] = useState('');
  const [contract, setContract] = useState<Contract | null>(null);
  const [proposals, setProposals] = useState<string[]>([]);
  const [activated, setActivated] = useState<number | null>(null);
  const [refine, setRefine] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadRuns = async () => {
    try {
      const { data } = await api.get('/api/parser-train/runs');
      setRuns(data.runs || []);
    } catch (e: any) { /* SU-only; ignore for non-SU */ }
  };
  useEffect(() => { if (isSU) loadRuns(); }, [isSU]);

  if (!isSU) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-900">Parser Train</h1>
        <p className="mt-2 text-gray-600">
          Parser Train is a superuser-only tool. {impersonation.isImpersonating
            ? 'Stop impersonating to use it.'
            : 'You do not have access.'}
        </p>
      </div>
    );
  }

  const createRun = async () => {
    setErr(''); setBusy('Creating run…');
    try {
      const { data } = await api.post('/api/parser-train', { programLevel: level });
      setRun({ submissionId: data.submissionId, pcUserId: data.pcUserId, programLevel: data.programLevel });
      setImportId(''); setParseStatus(''); setDetectedFormat(''); setContract(null); setProposals([]); setActivated(null);
      await loadRuns();
    } catch (e: any) { setErr(e?.response?.data?.error || String(e)); }
    finally { setBusy(''); }
  };

  const importDoc = async (f: File) => {
    if (!run) return;
    setErr(''); setBusy('Uploading…'); setContract(null); setActivated(null);
    try {
      const fd = new FormData();
      fd.append('submissionId', run.submissionId);
      fd.append('file', f);
      const up = await api.post('/api/imports/upload', fd, { headers: IMPERSONATE(run.pcUserId) });
      const impId = up.data.importId;
      setImportId(impId);
      setBusy('Starting parser…');
      await api.post(`/api/imports/${impId}/start-ai`, { programLevel: run.programLevel, forceFormat: null }, { headers: IMPERSONATE(run.pcUserId) });
      setParseStatus('queued');
      pollParse(impId);
    } catch (e: any) { setErr(e?.response?.data?.error || String(e)); setBusy(''); }
  };

  const pollParse = async (impId: string) => {
    setBusy('Parsing…');
    const started = Date.now();
    const tick = async () => {
      try {
        const { data } = await api.get(`/api/imports/${impId}/ai-status`, { headers: run ? IMPERSONATE(run.pcUserId) : undefined });
        const st = data.status || '';
        setParseStatus(st);
        setDetectedFormat((data.detectedFormat || data.format || {}).format || '');
        if (['parsed', 'completed', 'failed'].includes(st)) { setBusy(''); return; }
      } catch { /* transient */ }
      if (Date.now() - started < 600_000) setTimeout(tick, 5000);
      else setBusy('');
    };
    tick();
  };

  const diagnose = async () => {
    if (!importId) return;
    setErr(''); setBusy('Diagnosing…');
    try {
      const { data } = await api.post(`/api/parser-train/${importId}/diagnose`);
      setContract(data.contract);
      setProposals(data.proposals || []);
    } catch (e: any) { setErr(e?.response?.data?.error || String(e)); }
    finally { setBusy(''); }
  };

  const autoRefine = async () => {
    if (!importId) return;
    setErr(''); setBusy('Agent learning (searching parse settings)…'); setRefine({ status: 'running', attempts: [] });
    try {
      await api.post(`/api/parser-train/${importId}/auto-refine`, {});
      const started = Date.now();
      const tick = async () => {
        try {
          const { data } = await api.get(`/api/parser-train/${importId}/refine-status`);
          setRefine(data.state);
          if (data.state && ['done', 'failed'].includes(data.state.status)) { setBusy(''); diagnose(); return; }
        } catch { /* transient */ }
        if (Date.now() - started < 900_000) setTimeout(tick, 5000);
        else setBusy('');
      };
      setTimeout(tick, 5000);
    } catch (e: any) { setErr(e?.response?.data?.error || String(e)); setBusy(''); }
  };

  const approve = async () => {
    if (!importId) return;
    setErr(''); setBusy('Activating rules…');
    try {
      const { data } = await api.post(`/api/parser-train/${importId}/approve-spec`, {});
      setActivated(data.activatedRules ?? 0);
    } catch (e: any) { setErr(e?.response?.data?.error || String(e)); }
    finally { setBusy(''); }
  };

  const parsedOk = ['parsed', 'completed'].includes(parseStatus);

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Parser Train</h1>
        <p className="mt-1 text-sm text-gray-600">
          Train the parser on a new self-study in a sandbox. Verify placement + Compare in the Review screen,
          then approve to activate the parser rules. Proven documents are never affected.
        </p>
      </div>

      {err && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm p-3">{err}</div>}
      {busy && <div className="text-sm text-blue-600">{busy}</div>}

      {/* 1 — create a sandbox run */}
      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="font-medium text-gray-900">1. New training run</h2>
        <div className="mt-3 flex items-center gap-3">
          <select value={level} onChange={(e) => setLevel(e.target.value as Level)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="associate">Associate</option>
            <option value="bachelors">Baccalaureate</option>
            <option value="masters">Master's</option>
          </select>
          <button onClick={createRun} disabled={!!busy}
            className="px-4 py-2 bg-primary text-white rounded-md text-sm disabled:opacity-50">
            Create sandbox run
          </button>
          {run && <span className="text-sm text-green-700">Run ready · {run.programLevel}</span>}
        </div>
      </section>

      {/* 2 — import the document */}
      {run && (
        <section className="rounded-lg border border-gray-200 p-4">
          <h2 className="font-medium text-gray-900">2. Import document</h2>
          <div className="mt-3 flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".docx,.pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importDoc(f); }}
              className="text-sm" />
            {parseStatus && (
              <span className={`text-sm ${parsedOk ? 'text-green-700' : parseStatus === 'failed' ? 'text-red-600' : 'text-gray-600'}`}>
                {parseStatus}{detectedFormat ? ` · ${detectedFormat}` : ''}
              </span>
            )}
          </div>
        </section>
      )}

      {/* 3 — verify + diagnose */}
      {importId && parsedOk && (
        <section className="rounded-lg border border-gray-200 p-4 space-y-4">
          <h2 className="font-medium text-gray-900">3. Verify &amp; diagnose</h2>
          <div className="flex items-center gap-3">
            <Link to={`/self-study/${run?.submissionId}`}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
              Open Review screen (Compare + notes/screenshots) →
            </Link>
            <button onClick={diagnose} disabled={!!busy}
              className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm disabled:opacity-50">
              Run contract diagnose
            </button>
            <button onClick={autoRefine} disabled={!!busy}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm disabled:opacity-50"
              title="Agent tries candidate parse settings, scores each against the contract, and learns the best one">
              Auto-refine (agent learns)
            </button>
          </div>

          {refine && (
            <div className="text-sm rounded-md border border-indigo-200 bg-indigo-50 p-3">
              <div className="font-medium text-indigo-900">
                Learning loop: {refine.status}
                {refine.winner && <span> — learned <strong>{refine.winner.candidate}</strong></span>}
              </div>
              {refine.message && <div className="text-xs text-indigo-800 mt-1">{refine.message}</div>}
              {(refine.attempts || []).length > 0 && (
                <table className="mt-2 w-full text-xs">
                  <thead><tr className="text-left text-indigo-500"><th>Candidate</th><th>Parsed as</th><th>Specs</th><th>Anchors</th><th>Unplaced</th><th>Score</th></tr></thead>
                  <tbody>
                    {refine.attempts.map((a: any, i: number) => (
                      <tr key={i} className={`border-t border-indigo-100 ${refine.winner?.candidate === a.candidate ? 'font-semibold' : ''}`}>
                        <td>{a.candidate}</td><td>{a.format}</td><td>{a.specsWithContent}</td>
                        <td className={a.anchorsOk ? 'text-green-700' : 'text-red-600'}>{a.anchorsOk ? 'OK' : 'MISSING'}</td>
                        <td>{a.unplacedTags}</td><td>{a.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {contract && (
            <div className="text-sm space-y-3">
              <div className={`rounded-md p-3 ${contract.anchors.missing.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="font-medium">
                  Compare anchors: {contract.anchors.anchored}/{contract.anchors.totalItems} located
                  {contract.anchors.missing.length === 0
                    ? ' — every card will Compare ✓'
                    : ` — ${contract.anchors.missing.length} MISSING (will show "section not located")`}
                </div>
                {contract.anchors.missing.length > 0 && (
                  <div className="mt-1 text-xs text-red-700 break-all">{contract.anchors.missing.slice(0, 20).map((m) => `${m.where ? m.where + ':' : ''}${m.sectionId}`).join(', ')}</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="font-medium text-gray-900">Placement <span className="font-normal text-gray-400">· {contract.format || 'format n/a'}</span></div>
                  <div className="text-gray-600">Specs with content: {contract.coverage.specsWithContent} / {contract.coverage.catalogSpecs} catalog</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Standards: {Object.keys(contract.coverage.byStandard).sort((a, b) => +a - +b).join(', ')}
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="font-medium text-gray-900">File types</div>
                  <div className="text-xs text-gray-600">
                    {Object.entries(contract.fileTypes).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </div>
                </div>
              </div>

              {contract.findings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="font-medium text-amber-900">Findings</div>
                  <ul className="mt-1 list-disc pl-5 text-amber-800 text-xs space-y-1">
                    {contract.findings.map((f, i) => (
                      <li key={i}><span className="uppercase font-medium">{f.severity}</span> [{f.check}] {f.detail}</li>
                    ))}
                  </ul>
                </div>
              )}

              {proposals.length > 0 && (
                <div className="text-xs text-gray-600">Proposed rules from this run: {proposals.join(', ')}</div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 4 — approve → activate */}
      {contract && (
        <section className="rounded-lg border border-gray-200 p-4">
          <h2 className="font-medium text-gray-900">4. Approve &amp; activate rules</h2>
          <p className="mt-1 text-sm text-gray-600">
            Approving confirms this parse and activates the parser rules it proposed. Active rules apply to
            <strong> future</strong> imports for this institution only — proven documents are untouched.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={approve} disabled={!!busy || contract.anchors.missing.length > 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm disabled:opacity-50"
              title={contract.anchors.missing.length > 0 ? 'Fix un-anchored items before activating' : ''}>
              Approve &amp; activate
            </button>
            {activated !== null && <span className="text-sm text-green-700">Activated {activated} rule(s) ✓</span>}
          </div>
        </section>
      )}

      {/* recent runs */}
      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="font-medium text-gray-900">Recent training runs</h2>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="py-1">Run</th><th>Level</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r._id} className="border-t border-gray-100">
                <td className="py-1 font-mono text-xs">{r.submissionId}</td>
                <td>{r.programLevel}</td>
                <td>{r.status}</td>
                <td className="text-gray-500">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={4} className="py-2 text-gray-400">No runs yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
