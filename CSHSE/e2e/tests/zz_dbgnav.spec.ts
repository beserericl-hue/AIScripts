import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso } from '../helpers/seed';
const SEC='sec-dbgnav';
const HTML='<p>Alpha phrase one here. Beta phrase two there.</p>';
test('dbgnav', async ({ page }) => {
  test.setTimeout(120000);
  const seed = await seedFixture('wizard_review_minimal', { user:{email:'dbgnav@x.test',role:'admin',isSuperuser:true,preferences:{tours:{welcome:true}}},
    submission:{assignSeedUserAsReader:true},
    reviewState:{buckets:{'1.a':{standardCode:'1',specCode:'a',standardTitle:'',specPrompt:'',narratives:[{sectionId:SEC,heading:'h',snippet:'t',htmlSnippet:HTML,wordCount:2,confidence:0.9,acceptState:'pending',rationale:''}],evidenceText:[],evidenceFiles:[],matrixCells:[]}},tags:[],cvs:[],evidenceDocs:[],introductions:{},placeholderSections:[],approvedIds:[],discardedIds:[],itemSources:{},mergeLog:[]}});
  await loginAsSeededViaSso(page, seed);
  await page.evaluate(async ({sid,sec})=>{const raw=localStorage.getItem('auth-storage');const t=raw?JSON.parse(raw)?.state?.token:null;await fetch(`/api/submissions/${sid}/review/set-approved`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({approvedIds:[sec]})});}, {sid:seed.submissionId,sec:SEC});
  await page.evaluate(async ({sid})=>{const raw=localStorage.getItem('auth-storage');const t=raw?JSON.parse(raw)?.state?.token:null;for(const x of [{s:'phrase one',a:6,b:16},{s:'phrase two',a:29,b:39}]) await fetch(`/api/submissions/${sid}/comments`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({standardCode:'1',specCode:'a',selectedText:x.s,selectionStart:x.a,selectionEnd:x.b,content:x.s})});}, {sid:seed.submissionId});
  page.on('console', m => { if (m.type()==='error') console.log('>>> err:', m.text().slice(0,120)); });
  await page.goto(`/reader-report/${seed.submissionId}`);
  await expect(page.getByTestId('reader-report-editor')).toBeVisible({timeout:20000});
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="rr-comments-next"]') as HTMLButtonElement | null;
    if (!btn) return { found:false };
    const r1 = btn.getBoundingClientRect();
    const disabled = btn.disabled;
    const cx = r1.x + r1.width/2, cy = r1.y + r1.height/2;
    const top = document.elementFromPoint(cx, cy);
    return { found:true, disabled, rect:{x:Math.round(r1.x),y:Math.round(r1.y),w:Math.round(r1.width),h:Math.round(r1.height)}, inViewport: cy>0 && cy<window.innerHeight, topEl: top ? (top as HTMLElement).outerHTML.slice(0,80) : 'none', isBtnOrChild: top ? btn.contains(top) : false };
  });
  console.log('>>> NEXT btn:', JSON.stringify(info));
  // stability: bbox after 300ms
  const moved = await page.evaluate(async () => {
    const btn = document.querySelector('[data-testid="rr-comments-next"]')!;
    const a = btn.getBoundingClientRect();
    await new Promise(r=>setTimeout(r,400));
    const b = btn.getBoundingClientRect();
    return { ay:Math.round(a.y), by:Math.round(b.y), moved: Math.abs(a.y-b.y)>1 };
  });
  console.log('>>> stability:', JSON.stringify(moved));
  await cleanupSeed(seed);
});
