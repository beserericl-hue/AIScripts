/**
 * Production authenticated E2E smoke — drives the REAL production API as the
 * superuser, exercising the full pipeline, then cleans up everything it created
 * so production stays pristine for the beta.
 *
 * Credentials come from env (never hard-coded / never logged):
 *   BASE      default https://cshse.courseworx.media
 *   SU_EMAIL  superuser email
 *   SU_PW     superuser password
 *
 * Run:  BASE=... SU_EMAIL=... SU_PW=... node scripts/prod-e2e-smoke.mjs
 */
const BASE = (process.env.BASE || 'https://cshse.courseworx.media').replace(/\/+$/, '');
const EMAIL = process.env.SU_EMAIL;
const PW = process.env.SU_PW;
if (!EMAIL || !PW) { console.error('SU_EMAIL and SU_PW required'); process.exit(1); }

let TOKEN = null;
const created = { institutions: [], users: [], submissions: [] };
const results = [];
function ok(name, cond, detail) { results.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); }

async function api(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN && !opts.noAuth) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

(async () => {
  // 1) LOGIN
  const login = await api('POST', '/api/auth/login', { email: EMAIL, password: PW }, { noAuth: true });
  TOKEN = login.data?.token || login.data?.accessToken || login.data?.data?.token;
  const user = login.data?.user || login.data?.data?.user || {};
  ok('login as superuser', login.status === 200 && !!TOKEN, `status=${login.status}`);
  if (!TOKEN) { console.error('cannot continue without token; body=', JSON.stringify(login.data).slice(0, 300)); process.exit(1); }

  // 2) IDENTITY
  const me = await api('GET', '/api/auth/me');
  const meu = me.data?.user || me.data || {};
  ok('GET /auth/me is superuser', me.status === 200 && (meu.isSuperuser || meu.role === 'admin'),
     `role=${meu.role} su=${meu.isSuperuser}`);

  // 3) CLEAN-STATE BASELINE (before we create anything)
  const inst0 = await api('GET', '/api/institutions');
  const instList0 = Array.isArray(inst0.data) ? inst0.data : (inst0.data?.institutions || []);
  ok('institutions baseline = 0', inst0.status === 200 && instList0.length === 0, `count=${instList0.length}`);
  const users0 = await api('GET', '/api/users');
  const userList0 = Array.isArray(users0.data) ? users0.data : (users0.data?.users || []);
  ok('users baseline = 1 (bootstrap)', users0.status === 200 && userList0.length === 1, `count=${userList0.length}`);

  // 4) REFERENCE DATA present
  const specs = await api('GET', '/api/specs');
  const specList = Array.isArray(specs.data) ? specs.data : (specs.data?.specs || []);
  ok('specs reference present', specs.status === 200 && specList.length >= 1, `count=${specList.length}`);
  const standards = await api('GET', '/api/standards');
  const stdList = Array.isArray(standards.data) ? standards.data : (standards.data?.standards || []);
  ok('standards reference present', standards.status === 200 && stdList.length >= 1, `count=${stdList.length}`);

  console.log('\n--- baseline complete; pipeline steps next (added incrementally) ---');
  // pipeline + cleanup steps appended after endpoint discovery
  console.log('\nSUMMARY: ' + results.filter(r => r.pass).length + '/' + results.length + ' passed');
})().catch(e => { console.error('E2E error:', e.message); process.exit(1); });
