// Data layer: Supabase (tables prefixed ket_) with a localStorage fallback (demo / offline).
import { CONFIG } from './config.js?v=2';

let sb = null, mode = 'local';
const LS = 'ket-local-v1';
const local = () => JSON.parse(localStorage.getItem(LS) || '{"settings":null,"subs":[],"fb":{},"reviews":[],"user":null}');
const saveLocal = (s) => localStorage.setItem(LS, JSON.stringify(s));
const defaultSettings = () => ({ id:1, student_id:'local-student', start_date:'2026-11-19', exam_date:'2027-05-01', exam_tentative:true, study_days:[1,3,4], exam_kind:'schools' });
const LOCAL_STUDENTS = [
  { id:'local-student', role:'student', display_name:'Agustín', exercises_per_week:3, start_date:null, study_days:null },
  { id:'local-zamorano', role:'student', display_name:'Eduardo Zamorano', exercises_per_week:5, start_date:'2026-11-26', study_days:[1,2,3,4,5] },
];
const LOCAL_TEACHER = { id:'local-teacher', role:'teacher', display_name:'Eduardo', exercises_per_week:3, start_date:null, study_days:null };

// Overlay a student's plan on the shared (default) settings. Null fields fall back to the global row.
// Never writes back to ket_settings — Agustín's calendar stays on the global row.
export function mergeSettings(global, profile){
  const out = { ...global };
  const epw = Number(profile?.exercises_per_week) || 3;
  out.exercises_per_week = epw;
  if (profile?.start_date) out.start_date = profile.start_date;
  if (Array.isArray(profile?.study_days) && profile.study_days.length) out.study_days = profile.study_days;
  else if (epw === 5) out.study_days = [1,2,3,4,5];
  if (profile?.id) out.student_id = profile.id;
  return out;
}

export async function init(){
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY){
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true, storageKey:'ket-auth' } });
    mode = 'supabase';
  }
  return mode;
}
export const getMode = () => mode;
const chk = ({ data, error }) => { if (error) throw error; return data; };

export async function signIn(username, password){
  const u = username.trim().toLowerCase();
  if (mode === 'local'){
    const s = local();
    if (u === 'eduardo') s.user = { ...LOCAL_TEACHER };
    else if (u === 'eduardo.zamorano' || u === 'zamorano') s.user = { ...LOCAL_STUDENTS[1] };
    else s.user = { ...LOCAL_STUDENTS[0] };
    if (!s.settings) s.settings = defaultSettings(); saveLocal(s); return s.user;
  }
  chk(await sb.auth.signInWithPassword({ email: `${u}@${CONFIG.EMAIL_DOMAIN}`, password }));
  return currentUser();
}
export async function signOut(){ if (mode === 'local'){ const s = local(); s.user = null; saveLocal(s); return; } await sb.auth.signOut(); }
export async function currentUser(){
  if (mode === 'local') return local().user;
  const { data:{ session } } = await sb.auth.getSession();
  if (!session) return null;
  const prof = chk(await sb.from('ket_profiles').select('*').eq('id', session.user.id).maybeSingle());
  return prof ? { id: prof.id, role: prof.role, display_name: prof.display_name, exercises_per_week: prof.exercises_per_week, start_date: prof.start_date, study_days: prof.study_days } : null;
}
export async function listStudents(){
  if (mode === 'local') return LOCAL_STUDENTS.map(s => ({ ...s }));
  return chk(await sb.from('ket_profiles').select('id, display_name, role, exercises_per_week, start_date, study_days').eq('role','student').order('display_name'));
}
export async function getSettings(){
  if (mode === 'local'){ const s = local(); if (!s.settings){ s.settings = defaultSettings(); saveLocal(s); } return s.settings; }
  return chk(await sb.from('ket_settings').select('*').eq('id',1).single());
}
export async function saveSettings(patch){
  if (mode === 'local'){ const s = local(); s.settings = { ...s.settings, ...patch }; saveLocal(s); return s.settings; }
  return chk(await sb.from('ket_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id',1).select().single());
}
export async function listSubmissions({ studentId } = {}){
  if (mode === 'local'){ const rows = local().subs; return studentId ? rows.filter(x => x.student_id === studentId) : rows; }
  let q = sb.from('ket_submissions').select('*').order('week_start').order('created_at');
  if (studentId) q = q.eq('student_id', studentId);
  return chk(await q);
}
export async function upsertSubmission(sub){
  const row = { ...sub, updated_at: new Date().toISOString() };
  if (mode === 'local'){ const s = local(); const i = s.subs.findIndex(x => x.task_id === sub.task_id && (!s.user || x.student_id === s.user.id));
    if (i >= 0) s.subs[i] = { ...s.subs[i], ...row }; else s.subs.push({ ...row, id: Date.now(), student_id: s.user?.id, created_at: row.updated_at }); saveLocal(s); return s.subs.find(x => x.task_id === sub.task_id && x.student_id === s.user?.id); }
  const { data:{ session } } = await sb.auth.getSession();
  return chk(await sb.from('ket_submissions').upsert({ ...row, student_id: session.user.id }, { onConflict:'student_id,task_id' }).select().single());
}
export async function uploadAudio(blob, name){
  if (mode === 'local'){ return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); }
  const { data:{ session } } = await sb.auth.getSession();
  const path = `${session.user.id}/${name}`;
  const type = (blob.type || 'audio/webm').split(';')[0];
  chk(await sb.storage.from('ket-speaking').upload(path, blob, { contentType:type, upsert:true }));
  return path;
}
export async function audioUrl(path){
  if (!path) return null; if (mode === 'local' || path.startsWith('data:')) return path;
  const d = chk(await sb.storage.from('ket-speaking').createSignedUrl(path, 3600)); return d.signedUrl;
}
export async function listItemFeedback(ids){
  if (!ids.length) return [];
  if (mode === 'local'){ const fb = local().fb; return ids.filter(i => fb[i]).map(i => ({ submission_id:i, ...fb[i] })); }
  return chk(await sb.from('ket_item_feedback').select('*').in('submission_id', ids));
}
export async function saveItemFeedback(submission_id, { comment, grade }){
  const row = { submission_id, comment, grade: grade === '' || grade == null ? null : Number(grade), updated_at:new Date().toISOString() };
  if (mode === 'local'){ const s = local(); s.fb[submission_id] = row; saveLocal(s); return row; }
  return chk(await sb.from('ket_item_feedback').upsert(row).select().single());
}
export async function listWeeklyReviews({ studentId } = {}){
  if (mode === 'local'){ const rows = local().reviews; return studentId ? rows.filter(r => r.student_id === studentId) : rows; }
  let q = sb.from('ket_weekly_reviews').select('*').order('week_start');
  if (studentId) q = q.eq('student_id', studentId);
  return chk(await q);
}
export async function saveWeeklyReview(rev){
  const row = { ...rev, updated_at:new Date().toISOString() };
  ['grade_reading','grade_listening','grade_writing','grade_speaking'].forEach(k => { if (row[k] === '' || row[k] == null) row[k] = null; else row[k] = Number(row[k]); });
  if (mode === 'local'){ const s = local(); const i = s.reviews.findIndex(r => r.week_start === rev.week_start && r.student_id === rev.student_id); if (i>=0) s.reviews[i] = row; else s.reviews.push(row); saveLocal(s); return row; }
  return chk(await sb.from('ket_weekly_reviews').upsert(row, { onConflict:'student_id,week_start' }).select().single());
}
