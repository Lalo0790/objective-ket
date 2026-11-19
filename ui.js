// Small UI helpers and recorder.
export const $ = (s, el=document) => el.querySelector(s);
export const $$ = (s, el=document) => [...el.querySelectorAll(s)];
export const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }
export const norm = s => String(s||'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9:.\- ']/g,' ').replace(/\s+/g,' ').trim().replace(/\.$/,'');
export const matches = (given, accepted) => { const g = norm(given); return !!g && accepted.some(a => norm(a) === g || norm(a).replace(/[-\s]/g,'') === g.replace(/[-\s]/g,'')); };
export const wordCount = s => (String(s||'').trim().match(/[A-Za-zÀ-ÿ0-9'’-]+/g) || []).length;
export const letter = i => 'ABCDEFGH'[i];
export const fmtGrade = x => x == null || isNaN(x) ? '—' : (Number.isInteger(Number(x)) ? String(Number(x)) : Number(x).toFixed(1));
export function seededShuffle(arr, seed){ const a = arr.slice(); let s = 0; for (const c of String(seed)) s = (s*31 + c.charCodeAt(0)) >>> 0;
  for (let i = a.length-1; i > 0; i--){ s = (s*1103515245 + 12345) >>> 0; const j = s % (i+1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIA = ['dom','lun','mar','mié','jue','vie','sáb'];
export function fmtDate(iso, withDay=true){ const [y,m,d] = iso.split('-').map(Number); const dt = new Date(y,m-1,d); return `${withDay ? DIA[dt.getDay()]+' ' : ''}${d} ${MES[m-1]}`; }
export const icons = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/></svg>',
  plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
  prog:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V10M10 19V5M16 19v-6M22 19H2"/></svg>',
  fb:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  stop:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  mic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  out:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  gear:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  left:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
};
// ---------- recorder ----------
export function recorderSupported(){ return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder); }
export async function startRecording(){
  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  const type = ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
  const mr = new MediaRecorder(stream, type ? { mimeType:type } : undefined); const chunks = [];
  mr.ondataavailable = e => e.data.size && chunks.push(e.data); mr.start(1000);
  return { stop: () => new Promise(r => { mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); r(new Blob(chunks, { type: mr.mimeType || type || 'audio/webm' })); }; mr.stop(); }) };
}
