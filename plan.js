// Builds the weekly plan: 3 exercises per week (Reading & Writing / Listening / Speaking), review every Friday.
import { WEEKS } from './content/index.js';

export const SKILLS = {
  reading:{label:'Reading',color:'var(--c-read)',abbr:'R'},
  listening:{label:'Listening',color:'var(--c-listen)',abbr:'L'},
  writing:{label:'Writing',color:'var(--c-write)',abbr:'W'},
  speaking:{label:'Speaking',color:'var(--c-speak)',abbr:'S'},
};
export const SLOTS = [
  { slot:'a', skill:'reading', skills:['reading','writing'], label:'Reading & Writing' },
  { slot:'b', skill:'listening', skills:['listening'], label:'Listening' },
  { slot:'c', skill:'speaking', skills:['speaking'], label:'Speaking & Words' },
];

export const toISO = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
export const parseISO = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate()+n); return toISO(d); };
export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
export const todayISO = () => toISO(new Date());
// ISO weekday: Monday = 1 … Sunday = 7
export const isoWeekday = s => { const g = parseISO(s).getDay(); return g === 0 ? 7 : g; };
export const mondayOf = s => addDays(s, -(isoWeekday(s) - 1));

// Roadmap for the weeks that don't have exercises written yet (shown in the Plan tab).
export const ROADMAP = [
  [9,'Weekend & past simple (was / were)','A1+'],[10,'Past simple: regular verbs','A1+'],[11,'Past simple: irregular verbs · last holiday','A2'],[12,'Review + mini mock (Listening)','A2'],
  [13,'Future plans (going to)','A2'],[14,'Weather, seasons & clothes','A2'],[15,'Health, body & the doctor','A2'],[16,'Comparatives & superlatives','A2'],
  [17,'Technology & social media','A2'],[18,'Review + mini mock (Reading & Writing)','A2'],[19,'Mock: full Listening','A2 Key'],[20,'Mock: full Reading & Writing','A2 Key'],
  [21,'Mock: Speaking + fix weak points','A2 Key'],[22,'Last polish & exam-day tips','A2 Key'],[23,'Exam week: light review','A2 Key'],
];

// Weeks run Monday–Sunday with the review on Friday. If the plan starts mid-week, week 1 is longer:
// it runs from the start date until the Sunday after the NEXT Friday, so the first review is that Friday.
const week2Start = st => isoWeekday(st.start_date) === 1 ? addDays(st.start_date, 7) : addDays(mondayOf(st.start_date), 14);
export function planInfo(settings){
  const w2 = week2Start(settings);
  const weeks = 1 + Math.max(1, Math.ceil((diffDays(w2, settings.exam_date) + 1) / 7));
  return { w1: settings.start_date, weeks, written: WEEKS.length };
}
export const weekStart = (settings, w) => w <= 1 ? settings.start_date : addDays(week2Start(settings), (w-2)*7);
export const weekEnd = (settings, w) => addDays(weekStart(settings, w + 1), -1);
export const reviewDate = (settings, w) => w <= 1 ? (isoWeekday(settings.start_date) === 1 ? addDays(settings.start_date, 4) : addDays(week2Start(settings), -3)) : addDays(weekStart(settings, w), 4);
export function weekOf(settings, iso){ if (iso < settings.start_date) return 0; const w2 = week2Start(settings); return iso < w2 ? 1 : Math.floor(diffDays(w2, iso) / 7) + 2; }
export function weekMeta(w){
  const c = WEEKS[w-1]; if (c) return { theme:c.theme, level:c.level, focus:c.focus, ready:true };
  const r = ROADMAP.find(x => x[0] === w);
  return r ? { theme:r[1], level:r[2], focus:'', ready:false } : { theme:'Exam practice', level:'A2 Key', focus:'', ready:false };
}
export function exercisesOf(settings, w){
  const c = WEEKS[w-1]; const ws = weekStart(settings, w);
  const days = [...(settings.study_days || [1,3,4])].map(Number).sort((a,b)=>a-b);
  const first = w === 1 && isoWeekday(settings.start_date) !== 1; // long first week: everything opens on the start date
  const we = weekEnd(settings, w);
  const study = []; for (let d = ws; d <= we; d = addDays(d, 1)) if (days.includes(isoWeekday(d))) study.push(d);
  return SLOTS.map((S, i) => {
    const ex = c?.tasks?.[S.slot];
    const sug = first ? [ws, ...study.filter(d => d > ws)][i] : addDays(ws, ((days[i] ?? [1,3,4][i]) - isoWeekday(ws)));
    const date = first ? ws : sug;
    return { id:`w${w}-${S.slot}`, week:w, slot:S.slot, skill:S.skill, skills:S.skills, slotLabel:S.label, date, suggest:first ? sug : null, ready:!!ex, level:c?.level, theme:c?.theme, ...(ex||{ title:S.label, mins:18, sections:[] }) };
  });
}
export function findExercise(settings, taskId){ const m = /^w(\d+)-([abc])$/.exec(taskId||''); if (!m) return null; const w = Number(m[1]); if (w < 1 || w > planInfo(settings).weeks) return null; return exercisesOf(settings, w).find(e => e.slot === m[2]); }
