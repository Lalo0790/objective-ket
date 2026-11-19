import * as db from './db.js';
import { SKILLS, SLOTS, planInfo, weekStart, reviewDate, weekOf, weekMeta, exercisesOf, findExercise, addDays, todayISO, diffDays, ROADMAP } from './plan.js';
import { renderTask, bindTask, allItems } from './tasks.js';
import { $, $$, esc, toast, icons, fmtDate, fmtGrade, wordCount } from './ui.js';

const S = { user:null, settings:null, subs:[], fb:[], reviews:[], cleanup:null };
const app = $('#app');
const GRADES = ['','10','9','8','7','6','5','4','3','2','1'];
const SKILL_KEYS = ['reading','listening','writing','speaking'];
const SKILL_ES = { reading:'Reading', listening:'Listening', writing:'Writing', speaking:'Speaking' };
const PHASES = [[1,4,'Starter','Pre-A1 → A1','🌱'],[5,8,'Builder','A1 → A1+','🧱'],[9,12,'Explorer','A1+ → A2','🧭'],[13,18,'Key Training','A2','🔑'],[19,99,'Mock exams','A2 Key','🏁']];

// ---------- data ----------
async function loadAll(){
  S.settings = await db.getSettings();
  S.subs = await db.listSubmissions(S.user.role === 'teacher' && S.settings.student_id ? { studentId:S.settings.student_id } : {});
  S.fb = await db.listItemFeedback(S.subs.map(s => s.id));
  S.reviews = await db.listWeeklyReviews();
}
const subFor = id => S.subs.find(s => s.task_id === id);
const fbFor = sub => sub && S.fb.find(f => f.submission_id === sub.id);
const isOpen = (ex) => S.user.role === 'teacher' || ex.date <= todayISO();
const curWeek = () => { const { weeks } = planInfo(S.settings); return Math.max(1, Math.min(weeks, weekOf(S.settings, todayISO()))); };
function weekStatus(w){ const exs = exercisesOf(S.settings, w).filter(e => e.ready); const done = exs.filter(e => subFor(e.id)).length; return { exs, done, total:3, ready:exs.length > 0 }; }
function weeksDoneStreak(){ let n = 0; for (let w = curWeek(); w >= 1; w--){ const s = weekStatus(w); if (s.ready && s.done === s.exs.length && s.exs.length) n++; else if (w === curWeek()) continue; else break; } return n; }
const phaseOf = w => PHASES.find(p => w >= p[0] && w <= p[1]) || PHASES[PHASES.length-1];
const examLabel = () => `${fmtDate(S.settings.exam_date, false)} ${S.settings.exam_date.slice(0,4)}${S.settings.exam_tentative ? ' (tentativa)' : ''}`;
const skillChips = ex => ex.skills.map(k => `<span class="chip skill" style="background:${SKILLS[k].color}">${SKILLS[k].label}</span>`).join('');

// ---------- shell ----------
function shell(inner, tab){
  const teacher = S.user.role === 'teacher'; document.body.classList.toggle('teacher', teacher);
  const top = `<header class="topbar"><div class="wrap ${teacher?'wide':''}"><a class="brand" href="#/"><span class="mark"></span><b>Objective <i>KET</i></b></a><span class="spacer"></span>${teacher ? `<span class="chip">Profesor</span><a class="iconbtn" href="#/t/settings" title="Ajustes">${icons.gear}</a>` : ''}<button class="iconbtn" id="logout" title="Salir">${icons.out}</button></div></header>`;
  const tabs = teacher ? '' : `<nav class="tabbar"><div class="wrap">${[['/', 'Hoy', icons.home, 'home'],['/plan','Plan',icons.plan,'plan'],['/progress','Progreso',icons.prog,'prog'],['/feedback','Feedback',icons.fb,'fb']].map(([h,l,i,k])=>`<a href="#${h}" class="${tab===k?'on':''}">${i}<span>${l}</span></a>`).join('')}</div></nav>`;
  app.innerHTML = top + `<main class="fade">${inner}</main>` + tabs;
  $('#logout').onclick = async () => { await db.signOut(); S.user = null; location.hash = '#/'; route(); };
}
window.addEventListener('scroll', () => $('.topbar')?.classList.toggle('scrolled', scrollY > 4), { passive:true });

// ---------- login ----------
function loginView(){
  document.body.classList.remove('teacher');
  app.innerHTML = `<div class="login fade"><div class="box"><span class="mark big"></span><h1>Objective <i>KET</i></h1><p class="sub">Tu camino al examen Cambridge A2 Key: 3 ejercicios por semana y revisión de tu profe cada viernes.</p>
  <form id="lf" class="mt2"><label class="field"><span>Usuario</span><input class="input" name="u" autocomplete="username" autocapitalize="off" required placeholder="agustin"></label>
  <label class="field"><span>Contraseña</span><input class="input" type="password" name="p" autocomplete="current-password" required></label>
  <div class="err" id="lerr"></div><button class="btn block coral mt" type="submit">Entrar</button></form>
  ${db.getMode()==='local' ? '<p class="small muted mt">Modo demo local: los datos se guardan solo en este dispositivo.</p>' : ''}
  <p class="small muted center mt2">Eduardo García · English Coach</p></div></div>`;
  $('#lf').onsubmit = async (e) => { e.preventDefault(); const f = new FormData(e.target); $('#lerr').textContent = '';
    try { S.user = await db.signIn(f.get('u'), f.get('p')); if (!S.user) throw new Error('no profile'); await loadAll(); location.hash = S.user.role === 'teacher' ? '#/t' : '#/'; route(); }
    catch(err){ console.error(err); $('#lerr').textContent = 'Usuario o contraseña incorrectos.'; } };
}

// ---------- student ----------
function exRow(ex){
  const s = subFor(ex.id); const open = isOpen(ex); const col = SKILLS[ex.skill].color;
  const st = s ? (s.auto_max ? `${s.auto_score}/${s.auto_max}` : 'Enviado') : open ? `${ex.mins} min` : '🔒';
  const sub = s ? `${ex.slotLabel}` : open ? `${fmtDate(ex.date)} · ${ex.slotLabel}` : `Se abre el ${fmtDate(ex.date)}`;
  const inner = `<span class="dot" style="background:${col}">${SKILLS[ex.skill].abbr}</span><span class="meta"><div class="t">${esc(ex.title)}</div><div class="s">${esc(sub)}</div></span><span class="st ${s?'done':''}">${s ? '✓ ' : ''}${st}</span>`;
  return `<li>${open ? `<a class="task" href="#/task/${ex.id}">${inner}</a>` : `<div class="task locked">${inner}</div>`}</li>`;
}
function homeView(){
  const t = todayISO(); const st = S.settings; const { weeks } = planInfo(st); const name = S.user.display_name;
  const daysLeft = diffDays(t, st.exam_date); const w = weekOf(st, t);
  const h = new Date().getHours(); const greet = h < 12 ? '¡Buenos días' : h < 19 ? '¡Buenas tardes' : '¡Buenas noches';
  let main = '';
  if (w < 1){
    main = `<div class="card"><span class="eyebrow">Tu plan empieza el ${fmtDate(st.start_date)}</span><h2 class="mt">¡Casi listo! 🚀</h2><p class="sub">Cada semana tendrás 3 ejercicios cortos (15–20 minutos). El primero se abre el lunes. Mientras tanto puedes ver el plan.</p><a class="btn coral mt" href="#/plan">Ver el plan</a></div>`;
  } else if (w > weeks){
    main = `<div class="card center"><h2>¡Día del examen! 🎯</h2><p class="sub">Ya entrenaste para esto, ${esc(name)}. ¡Mucha suerte!</p></div>`;
  } else {
    const meta = weekMeta(w); const ws = weekStatus(w); const exs = exercisesOf(st, w);
    if (!meta.ready) main = `<div class="card"><span class="eyebrow">Semana ${w} · ${esc(meta.level)}</span><h2 class="mt">${esc(meta.theme)}</h2><p class="sub">Eduardo todavía está preparando los ejercicios de esta semana. ¡Pronto aparecen aquí!</p></div>`;
    else main = `<div class="card daycard"><div class="head"><span class="eyebrow">Semana ${w} de ${weeks} · ${esc(meta.level)}</span><h2>${esc(meta.theme)}</h2><div class="small" style="opacity:.8;margin-top:4px">${ws.done}/3 ejercicios · 15–20 min cada uno</div><div class="progressbar"><span style="width:${ws.done/3*100}%"></span></div></div><ul class="tasklist">${exs.map(exRow).join('')}</ul></div>`;
    const rv = S.reviews.find(r => r.week_start === weekStart(st, w)); const rd = reviewDate(st, w);
    main += rv ? `<a class="card flat review-note" href="#/feedback"><span class="em">💬</span><span><b>¡Eduardo ya revisó esta semana!</b><div class="small muted">Toca para ver tu nota y sus comentarios.</div></span></a>`
      : `<div class="card flat review-note"><span class="em">📅</span><span><b>Revisión: ${fmtDate(rd)}</b><div class="small muted">Haz tus ejercicios antes. Ese día Eduardo te deja comentarios y una nota por habilidad.</div></span></div>`;
    const missed = []; for (let i = 1; i < w; i++){ const s = weekStatus(i); s.exs.filter(e => !subFor(e.id)).forEach(e => missed.push(e)); }
    if (missed.length) main += `<div class="card flat"><h3>Pendientes de semanas anteriores</h3><p class="sub small">Cuando puedas, ponte al corriente.</p><ul class="tasklist">${missed.slice(-6).map(e => `<li><a class="task" href="#/task/${e.id}"><span class="dot" style="background:${SKILLS[e.skill].color}">${SKILLS[e.skill].abbr}</span><span class="meta"><div class="t">Sem ${e.week} · ${esc(e.title)}</div><div class="s">${esc(e.slotLabel)}</div></span><span class="st">Abrir</span></a></li>`).join('')}</ul></div>`;
  }
  const doneAll = S.subs.length; const streak = weeksDoneStreak();
  shell(`<div class="wrap"><section class="hero"><span class="eyebrow">${fmtDate(t)}</span><div class="hello">${greet}, <em>${esc(name)}</em>!</div><p class="sub">Meta: Cambridge A2 Key (KET) · ${esc(examLabel())}</p></section>
  <div class="stats"><div class="stat flame"><div class="k">Semanas</div><div class="v">${streak}<small> seguidas</small></div></div><div class="stat"><div class="k">Hechos</div><div class="v">${doneAll}</div></div><div class="stat"><div class="k">Examen</div><div class="v">${daysLeft > 0 ? daysLeft : 0}<small> días</small></div></div></div>
  ${main}</div>`, 'home');
}
async function taskView(taskId){
  const ex = findExercise(S.settings, taskId); if (!ex) return homeView();
  const teacher = S.user.role === 'teacher';
  if (!teacher && !isOpen(ex)){ toast('Este ejercicio aún no está disponible'); location.hash = '#/'; return; }
  if (!ex.ready){ toast('Este ejercicio todavía se está preparando'); location.hash = teacher ? '#/t' : '#/'; return; }
  const sub = subFor(ex.id); const fb = fbFor(sub);
  const backHref = teacher ? `#/t/week/${ex.week}` : '#/';
  shell(`<div class="wrap"><div class="taskhead"><a class="back" href="${backHref}">${icons.left} ${teacher ? 'Semana' : 'Hoy'}</a><div class="row mt">${skillChips(ex)}<span class="chip">${ex.mins} min</span><span class="chip">Sem ${ex.week} · ${esc(ex.level)}</span></div><h1>${esc(ex.title)}</h1><p class="sub">${esc(ex.theme)}${ex.intro ? ' · ' + esc(ex.intro) : ''}</p></div>
  ${fb && (fb.comment || fb.grade) ? `<div class="feedback"><div class="who">Feedback de Eduardo${fb.grade ? ` · Nota ${fmtGrade(fb.grade)}` : ''}</div><div style="white-space:pre-wrap">${esc(fb.comment||'')}</div></div>` : ''}
  <div id="task">${renderTask(ex, sub, { preview: teacher })}</div></div>`, teacher ? '' : 'home');
  const root = $('#task');
  $$('audio[data-audio]', root).forEach(async a => { a.src = await db.audioUrl(a.dataset.audio); });
  S.cleanup = bindTask(root, ex, { onSubmit: async (payload, blob) => {
    let audio_path = null;
    if (blob){ const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'; audio_path = await db.uploadAudio(blob, `${ex.id}-${Date.now()}.${ext}`); }
    const row = { week_start: weekStart(S.settings, ex.week), task_id: ex.id, skill: ex.skill, title: ex.title, kind: ex.slot, answers: payload.answers ?? null, auto_score: payload.auto_score ?? null, auto_max: payload.auto_max ?? null, text_answer: payload.text_answer ?? null, audio_path, meta: payload.meta ?? null };
    const saved = await db.upsertSubmission(row);
    const i = S.subs.findIndex(s => s.task_id === ex.id); if (i >= 0) S.subs[i] = saved; else S.subs.push(saved);
    toast(payload.auto_max ? `Guardado · ${payload.auto_score}/${payload.auto_max}` : 'Enviado a Eduardo ✓');
    window.scrollTo({ top:0, behavior:'smooth' }); taskView(ex.id);
  }});
}
function weekView(w){
  const st = S.settings; const { weeks } = planInfo(st); if (!(w >= 1 && w <= weeks)) return planView();
  const meta = weekMeta(w); const exs = exercisesOf(st, w);
  shell(`<div class="wrap"><div class="taskhead"><a class="back" href="#/plan">${icons.left} Plan</a><h1>Semana ${w} · ${esc(meta.theme)}</h1><p class="sub">${fmtDate(weekStart(st,w), false)} – ${fmtDate(addDays(weekStart(st,w),6), false)} · ${esc(meta.level)} · revisión el ${fmtDate(reviewDate(st,w))}</p></div>
  ${meta.ready ? `${meta.focus ? `<div class="instr">${esc(meta.focus)}</div>` : ''}<div class="card daycard"><ul class="tasklist">${exs.map(exRow).join('')}</ul></div>` : '<div class="card empty">Esta semana todavía se está preparando. ✏️</div>'}</div>`, 'plan');
}
function planView(){
  const st = S.settings; const { weeks } = planInfo(st); const cw = weekOf(st, todayISO());
  let html = ''; let lastPhase = null;
  for (let w = 1; w <= weeks; w++){
    const ph = phaseOf(w); if (ph !== lastPhase){ html += `<h3 class="phase mt2">${ph[4]} ${esc(ph[2])} <span class="muted small">· ${esc(ph[3])}</span></h3>`; lastPhase = ph; }
    const meta = weekMeta(w); const ws = weekStatus(w); const exs = exercisesOf(st, w);
    const rv = S.reviews.find(r => r.week_start === weekStart(st, w));
    const dots = exs.map(e => `<i class="${subFor(e.id) ? 'f' : ''}" style="--c:${SKILLS[e.skill].color}" title="${esc(e.slotLabel)}">${SKILLS[e.skill].abbr}</i>`).join('');
    const inner = `<span class="wn">${w}</span><span class="meta"><div class="t">${esc(meta.theme)}</div><div class="s">${fmtDate(weekStart(st,w), false)} · ${esc(meta.level)}${meta.ready ? '' : ' · en preparación'}</div></span><span class="dots">${dots}</span>${rv ? '<span class="rvd" title="Revisión lista">💬</span>' : ''}`;
    html += meta.ready ? `<a class="card weekcard ${w===cw?'cur':''}" href="#/week/${w}">${inner}</a>` : `<div class="card weekcard soon ${w===cw?'cur':''}">${inner}</div>`;
  }
  html += `<div class="card weekcard exam"><span class="wn">🎯</span><span class="meta"><div class="t">Examen Cambridge A2 Key</div><div class="s">${esc(examLabel())}</div></span></div>`;
  shell(`<div class="wrap"><section class="hero"><span class="eyebrow">${fmtDate(planInfo(st).w1,false)} → ${fmtDate(st.exam_date,false)}</span><h1 class="mt">Tu plan</h1><p class="sub">Cada semana: 1 de Reading & Writing, 1 de Listening y 1 de Speaking. Eduardo revisa los viernes.</p></section>${html}</div>`, 'plan');
}
function progressView(){
  const st = S.settings; const { weeks } = planInfo(st); const cw = curWeek();
  const acc = sk => { const xs = S.subs.filter(s => s.skill === sk && s.auto_max); const a = xs.reduce((x,s)=>x+s.auto_score,0), b = xs.reduce((x,s)=>x+s.auto_max,0); return b ? Math.round(a/b*100) : null; };
  const rev = [...S.reviews].sort((a,b)=>a.week_start < b.week_start ? -1 : 1);
  const lastGrade = sk => { const r = rev.filter(x => x['grade_'+sk] != null).pop(); return r ? Number(r['grade_'+sk]) : null; };
  const writtenWeeks = Array.from({length:weeks},(_,i)=>i+1).filter(w => weekMeta(w).ready);
  const dueEx = writtenWeeks.filter(w => w <= cw).flatMap(w => exercisesOf(st, w).filter(e => e.ready && e.date <= todayISO()));
  const doneDue = dueEx.filter(e => subFor(e.id)).length;
  const mins = Math.round(S.subs.reduce((a,s)=>a+(s.meta?.secs||0),0)/60);
  const words = S.subs.filter(s => s.text_answer && s.skill === 'reading').reduce((a,s)=>a+wordCount(s.text_answer),0);
  const R = 56, C = 2*Math.PI*R, frac = dueEx.length ? doneDue/dueEx.length : 0;
  const ph = phaseOf(Math.max(1, cw));
  shell(`<div class="wrap"><section class="hero"><span class="eyebrow">Progreso</span><h1 class="mt">¿Cómo vas?</h1><p class="sub">Reading y Listening se calculan con tus respuestas. Writing y Speaking, con las notas de Eduardo.</p></section>
  <div class="card overall"><svg class="ring" viewBox="0 0 132 132"><circle cx="66" cy="66" r="${R}" fill="none" stroke="var(--paper-2)" stroke-width="12"/><circle cx="66" cy="66" r="${R}" fill="none" stroke="var(--coral)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-frac)}" transform="rotate(-90 66 66)"/><text x="66" y="64" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="30" fill="var(--ink)">${doneDue}/${dueEx.length}</text><text x="66" y="86" text-anchor="middle" font-size="11" fill="var(--muted)">ejercicios</text></svg>
  <div><div class="small muted">Etapa actual</div><b>${ph[4]} ${esc(ph[2])}</b><div class="small muted">${esc(ph[3])}</div><div class="small muted mt">Semana</div><b>${Math.min(cw, weeks)} de ${weeks}</b></div></div>
  <div class="card"><h3>Por habilidad</h3><div class="bands mt">${SKILL_KEYS.map(k => { const a = acc(k), g = lastGrade(k); return `<div class="band"><div class="top"><span class="name" style="color:${SKILLS[k].color}">${SKILL_ES[k]}</span><span class="val">${g != null ? fmtGrade(g)+'<small>/10</small>' : '—'}</span></div><div class="track"><div class="fill" style="width:${g != null ? g*10 : 0}%;background:${SKILLS[k].color}"></div></div><div class="small muted">${g != null ? 'Nota de Eduardo' : 'Aún sin nota de Eduardo'}${a != null ? ` · ${a}% de aciertos` : ''}</div></div>`; }).join('')}</div></div>
  <div class="stats"><div class="stat"><div class="k">Ejercicios</div><div class="v">${S.subs.length}</div></div><div class="stat"><div class="k">Minutos</div><div class="v">${mins}</div></div><div class="stat"><div class="k">Semanas</div><div class="v">${weeksDoneStreak()}</div></div></div>
  <div class="card"><h3>El camino</h3><ul class="roadmap mt">${PHASES.map(p => `<li class="${cw >= p[0] && cw <= p[1] ? 'on' : cw > p[1] ? 'past' : ''}"><span class="em">${p[4]}</span><span><b>${esc(p[2])}</b> <span class="muted small">· ${esc(p[3])}</span><div class="small muted">Semanas ${p[0]}–${Math.min(p[1], weeks)}</div></span></li>`).join('')}</ul></div></div>`, 'prog');
}
function feedbackView(){
  const revs = [...S.reviews].sort((a,b)=>a.week_start < b.week_start ? 1 : -1);
  const items = S.fb.filter(f => f.comment || f.grade).map(f => ({ f, s: S.subs.find(s => s.id === f.submission_id) })).filter(x => x.s).sort((a,b)=>a.s.week_start < b.s.week_start ? 1 : -1);
  const revHTML = revs.map(r => `<div class="card"><span class="eyebrow">Semana ${weekOf(S.settings, r.week_start)} · ${fmtDate(r.week_start,false)}</span><div class="bandsel mt">${SKILL_KEYS.map(k=>`<div class="stat"><div class="k" style="color:${SKILLS[k].color}">${SKILL_ES[k]}</div><div class="v">${fmtGrade(r['grade_'+k])}</div>${r['comment_'+k] ? `<div class="small">${esc(r['comment_'+k])}</div>` : ''}</div>`).join('')}</div>${r.summary ? `<div class="feedback"><div class="who">Comentario de Eduardo</div><div style="white-space:pre-wrap">${esc(r.summary)}</div></div>` : ''}</div>`).join('');
  shell(`<div class="wrap"><section class="hero"><span class="eyebrow">Feedback</span><h1 class="mt">Notas de Eduardo</h1><p class="sub">Cada viernes Eduardo revisa tu semana y te deja comentarios y una nota del 1 al 10 por habilidad.</p></section>
  ${revHTML || '<div class="card empty">Todavía no hay revisión. Llega el viernes. ✍️</div>'}
  ${items.length ? `<h2 class="mt2">Comentarios por ejercicio</h2>${items.map(({f,s})=>`<a class="card task" style="display:flex" href="#/task/${s.task_id}"><span class="dot" style="background:${SKILLS[s.skill]?.color}">${f.grade ? fmtGrade(f.grade) : '✎'}</span><span class="meta"><div class="t">${esc(s.title)}</div><div class="s">${esc(f.comment||'')}</div></span></a>`).join('')}` : ''}</div>`, 'fb');
}

// ---------- teacher ----------
function weekStats(w){ const ws = weekStatus(w); return { planned: ws.exs.length, done: ws.done }; }
async function teacherWeekView(w){
  const st = S.settings; const { weeks } = planInfo(st); w = Math.max(1, Math.min(weeks, w || curWeek()));
  const ws = weekStart(st, w); const rev = S.reviews.find(r => r.week_start === ws) || {}; const meta = weekMeta(w);
  const exs = exercisesOf(st, w).filter(e => e.ready);
  const autoBy = {}; for (const e of exs){ const s = subFor(e.id); if (s?.auto_max){ const a = autoBy[s.skill] ||= [0,0]; a[0]+=s.auto_score; a[1]+=s.auto_max; } }
  let days = '';
  for (const e of exs){ const s = subFor(e.id);
    days += `<section class="daysec"><h3>${fmtDate(e.date)} <span class="chip">${esc(e.slotLabel)}</span></h3>`;
    if (!s){ days += `<div class="sub-card" style="opacity:.75"><div class="row between"><span>${skillChips(e)} <b>${esc(e.title)}</b></span><a class="btn small ghost" href="#/task/${e.id}">Ver ejercicio</a></div><div class="missing mt">${e.date <= todayISO() ? 'No entregado' : 'Pendiente'}</div></div></section>`; continue; }
    const f = fbFor(s) || {};
    const wrong = (s.answers?.items || []).filter(it => !it.ok);
    const items = s.answers?.items ? `<details class="mt"><summary class="small"><b>${s.auto_score}/${s.auto_max}</b> correctas · ver ${wrong.length} errores</summary><table class="items">${wrong.map(it => `<tr><td>✗</td><td>${esc(it.q)}</td><td class="noc">${esc(it.given || '—')}</td><td class="muted">${esc(it.correct)}</td></tr>`).join('') || '<tr><td>🎉 Sin errores</td></tr>'}</table></details>` : '';
    const text = s.text_answer ? `<div class="answer">${esc(s.text_answer)}</div><div class="wc"><span>${wordCount(s.text_answer)} palabras</span><span>${s.meta?.secs ? Math.round(s.meta.secs/60)+' min' : ''}</span></div>` : '';
    const audio = s.audio_path ? `<audio controls preload="none" data-audio="${esc(s.audio_path)}" style="width:100%;margin-top:8px"></audio>` : '';
    const open = e.slot !== 'b';
    days += `<div class="sub-card" data-sub="${s.id}"><div class="row between"><span>${skillChips(e)} <b>${esc(e.title)}</b></span>${s.auto_max ? `<span class="chip" style="background:${s.auto_score/s.auto_max>=.6?'var(--teal-2)':'var(--coral-2)'}">${s.auto_score}/${s.auto_max}</span>` : ''}</div>
    <div class="small muted">Entregado ${new Date(s.updated_at || s.created_at).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}${s.meta?.plays ? ` · audio ${s.meta.plays}×` : ''} · <a href="#/task/${e.id}">ver ejercicio</a></div>
    ${items}${text}${audio}
    <div class="row mt" style="align-items:flex-start"><textarea class="input fbc" style="min-height:${open?90:56}px;flex:1" placeholder="Comentario para Agustín…">${esc(f.comment||'')}</textarea>${open ? `<select class="input fbb" style="width:86px">${GRADES.map(b=>`<option ${Number(f.grade)===Number(b)&&b?'selected':''} value="${b}">${b||'Nota'}</option>`).join('')}</select>` : ''}</div>
    <div class="row mt"><button class="btn small savefb">Guardar comentario</button><span class="small muted saved">${f.updated_at ? 'Guardado' : ''}</span></div></div></section>`; }
  const stt = weekStats(w);
  const side = `<div class="card side"><h2>Revisión semana ${w}</h2><p class="sub small">Viernes ${fmtDate(reviewDate(st,w), false)} · ${stt.done}/${stt.planned} ejercicios entregados</p>
    <div class="small mt">${Object.entries(autoBy).map(([k,[a,b]])=>`<span class="chip" style="margin:2px">${SKILL_ES[k]}: ${Math.round(a/b*100)}%</span>`).join('') || '<span class="muted">Sin respuestas automáticas aún</span>'}</div>
    <p class="small muted mt">Notas del 1 al 10 · 10 excelente · 8 muy bien · 6 va bien · 5 o menos: reforzar.</p>
    <form id="rf" class="mt">${SKILL_KEYS.map(k=>`<div class="row" style="margin:10px 0;align-items:flex-start"><label style="width:88px;font-weight:700;color:${SKILLS[k].color};padding-top:12px">${SKILL_ES[k]}</label><select class="input" name="grade_${k}" style="width:84px">${GRADES.map(b=>`<option value="${b}" ${rev['grade_'+k]!=null && Number(rev['grade_'+k])===Number(b) && b ? 'selected':''}>${b||'—'}</option>`).join('')}</select><input class="input" name="comment_${k}" style="flex:1;min-width:140px" placeholder="Comentario breve" value="${esc(rev['comment_'+k]||'')}"></div>`).join('')}
    <label class="field"><span>Comentario general para Agustín</span><textarea class="input" name="summary" style="min-height:120px">${esc(rev.summary||'')}</textarea></label>
    <label class="row small"><input type="checkbox" name="published" ${rev.published === false ? '' : 'checked'}> Visible para Agustín</label>
    <button class="btn coral block mt" type="submit">Guardar revisión semanal</button><div class="small muted center mt">${rev.updated_at ? 'Última vez: '+new Date(rev.updated_at).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}) : ''}</div></form></div>`;
  shell(`<div class="wrap wide"><section class="hero"><span class="eyebrow">Panel del profesor</span><h1 class="mt">Semana ${w} de ${weeks} · ${esc(meta.theme)}</h1><p class="sub">Alumno: Agustín · A2 Key ${S.settings.exam_kind === 'schools' ? 'for Schools' : ''} · examen ${esc(examLabel())}</p></section>
    <nav class="weekpick">${Array.from({length:weeks},(_,i)=>i+1).map(i=>{ const s = weekStats(i); const r = S.reviews.find(x=>x.week_start===weekStart(st,i)); return `<a href="#/t/week/${i}" class="${i===w?'on':''}">S${i} <span style="opacity:.6;font-weight:500">${s.done}/${s.planned}</span>${r?'<span class="rv"></span>':''}</a>`; }).join('')}</nav>
    ${meta.ready ? `<div class="tgrid two"><div>${days}</div>${side}</div>` : '<div class="card empty">Los ejercicios de esta semana todavía no están escritos.</div>'}</div>`, '');
  $$('audio[data-audio]').forEach(async a => { a.src = await db.audioUrl(a.dataset.audio); });
  $$('.savefb').forEach(b => b.onclick = async () => { const card = b.closest('.sub-card'); const id = Number(card.dataset.sub) || card.dataset.sub;
    b.disabled = true; try { const saved = await db.saveItemFeedback(id, { comment: $('.fbc', card).value.trim(), grade: $('.fbb', card)?.value ?? null });
      const i = S.fb.findIndex(f => f.submission_id == id); if (i>=0) S.fb[i] = saved; else S.fb.push(saved); $('.saved', card).textContent = 'Guardado ✓'; toast('Comentario guardado'); }
    catch(e){ console.error(e); toast('No se pudo guardar'); } b.disabled = false; });
  if (meta.ready) $('#rf').onsubmit = async (e) => { e.preventDefault(); const f = new FormData(e.target); const row = { student_id: st.student_id, week_start: ws, published: !!f.get('published'), summary: f.get('summary') };
    SKILL_KEYS.forEach(k => { row['grade_'+k] = f.get('grade_'+k); row['comment_'+k] = f.get('comment_'+k); });
    try { const saved = await db.saveWeeklyReview(row); const i = S.reviews.findIndex(r => r.week_start === ws); if (i>=0) S.reviews[i] = saved; else S.reviews.push(saved); toast('Revisión semanal guardada ✓'); teacherWeekView(w); }
    catch(err){ console.error(err); toast('No se pudo guardar la revisión'); } };
}
function teacherSettingsView(){
  const st = S.settings; const days = (st.study_days || [1,3,4]).map(Number); const NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  shell(`<div class="wrap"><div class="taskhead"><a class="back" href="#/t">${icons.left} Panel</a><h1>Ajustes del plan</h1><p class="sub">Las semanas van de lunes a domingo. La revisión es el viernes. Si cambias fechas, las semanas se reacomodan.</p></div>
  <form class="card" id="sf"><label class="field"><span>Fecha de inicio (se usa el lunes de esa semana)</span><input class="input" type="date" name="start_date" value="${st.start_date}" required></label>
  <label class="field"><span>Fecha del examen</span><input class="input" type="date" name="exam_date" value="${st.exam_date}" required></label>
  <label class="row small" style="margin-bottom:10px"><input type="checkbox" name="exam_tentative" ${st.exam_tentative ? 'checked' : ''}> La fecha del examen es tentativa</label>
  <div class="field"><span>Días de estudio (elige 3: Reading & Writing · Listening · Speaking)</span><div class="row">${NAMES.map((n,i)=>`<label class="pill ${days.includes(i+1)?'on':''}" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="d${i+1}" ${days.includes(i+1)?'checked':''}> ${n}</label>`).join('')}</div></div>
  <label class="field"><span>Examen</span><select class="input" name="exam_kind"><option value="schools" ${st.exam_kind!=='standard'?'selected':''}>A2 Key for Schools</option><option value="standard" ${st.exam_kind==='standard'?'selected':''}>A2 Key</option></select></label>
  <button class="btn coral block mt" type="submit">Guardar ajustes</button></form></div>`, '');
  $$('#sf input[type=checkbox][name^=d]').forEach(c => c.addEventListener('change', () => c.closest('.pill').classList.toggle('on', c.checked)));
  $('#sf').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.target); const f = Object.fromEntries(fd);
    const sd = [1,2,3,4,5,6,7].filter(i => fd.get('d'+i)); if (sd.length !== 3){ toast('Elige exactamente 3 días de estudio'); return; }
    if (f.exam_date <= f.start_date){ toast('El examen debe ser después del inicio'); return; }
    try { S.settings = await db.saveSettings({ start_date:f.start_date, exam_date:f.exam_date, exam_tentative: !!fd.get('exam_tentative'), study_days: sd, exam_kind:f.exam_kind }); toast('Ajustes guardados ✓'); }
    catch(err){ console.error(err); toast('No se pudieron guardar'); } };
}

// ---------- router ----------
async function route(){
  S.cleanup?.(); S.cleanup = null;
  if (!S.user) return loginView();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  window.scrollTo(0,0);
  if (S.user.role === 'teacher'){
    if (parts[0] === 'task') return taskView(parts[1]);
    if (parts[0] === 't' && parts[1] === 'settings') return teacherSettingsView();
    if (parts[0] === 't' && parts[1] === 'week') return teacherWeekView(Number(parts[2]));
    return teacherWeekView();
  }
  switch(parts[0]){
    case 'task': return taskView(parts[1]);
    case 'week': return weekView(Number(parts[1]));
    case 'plan': return planView();
    case 'progress': return progressView();
    case 'feedback': return feedbackView();
    default: return homeView();
  }
}
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && S.user && !location.hash.startsWith('#/task')){ try { await loadAll(); } catch{} } });
(async () => {
  await db.init();
  try { S.user = await db.currentUser(); if (S.user) await loadAll(); } catch(e){ console.error(e); S.user = null; }
  route();
})();
