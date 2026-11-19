// Exercise renderers. An exercise = list of sections (KET-style tasks). Objective items are auto-checked;
// writing and speaking are sent to the teacher.
import { esc, letter, matches, wordCount, icons, recorderSupported, startRecording, $, $$, toast } from './ui.js';

const PART_LABEL = { signs:'Reading Part 1', match:'Reading Part 2', mcq:'', cloze:'Reading Part 4', open:'Reading Part 5', write:'Writing Part 6', story:'Writing Part 7', lpics:'Listening Part 1', lgap:'Listening Part 2', lmcq:'Listening', lmatch:'Listening Part 5', quiz:'Words & grammar', speak:'Speaking' };

// ---------- items ----------
export function sectionItems(sec, si){
  const id = j => `${si}_${j}`; const T = sec.type;
  if (T === 'signs') return sec.items.map((it,j)=>({ id:id(j), type:'opts', q: it.q || 'What does it say?', sign: it.s, options: it.o, answer: it.a }));
  if (T === 'mcq' || T === 'lmcq') return sec.items.map((it,j)=>({ id:id(j), type:'opts', q: it.q, options: it.o, answer: it.a }));
  if (T === 'match') return sec.items.map((it,j)=>({ id:id(j), type:'pills', q: it.q, options: sec.texts.map((_,k)=>letter(k)), answer: it.a }));
  if (T === 'cloze') return sec.items.map((it,j)=>({ id:id(j), type:'select', q:`Gap ${j+1}`, options: it.o, answer: it.a }));
  if (T === 'open' || T === 'lgap') return sec.answers.map((a,j)=>({ id:id(j), type:'gap', q:`Gap ${j+1}`, accepted:a }));
  if (T === 'lpics') return sec.items.map((it,j)=>({ id:id(j), type:'pics', q: it.q, options: it.o, answer: it.a }));
  if (T === 'lmatch') return sec.left.map((l,j)=>({ id:id(j), type:'select', q:l, options: sec.options.map((o,k)=>`${letter(k)} · ${o}`), answer: sec.answers[j] }));
  if (T === 'quiz') return sec.items.map((it,j)=> it.g ? { id:id(j), type:'gap', q:it.q, accepted:it.g } : { id:id(j), type:'opts', q:it.q, options:it.o, answer:it.a });
  return [];
}
export const allItems = ex => ex.sections.flatMap((s,i)=>sectionItems(s,i).map(it=>({ ...it, sec:i, secTitle:s.title })));
const correctText = it => it.type === 'gap' ? it.accepted[0] : it.type === 'pics' ? `${letter(it.answer)} · ${it.options[it.answer].t}` : it.options[it.answer];
const givenText = (it, v) => v === undefined || v === '' ? '' : it.type === 'gap' ? v : it.type === 'pics' ? `${letter(v)} · ${it.options[v].t}` : it.options[v];
function gradeItem(it, v){ if (it.type === 'gap') return matches(v, it.accepted); return v !== undefined && v !== '' && Number(v) === it.answer; }

function itemHTML(it, n, raw, done){
  const val = raw?.[it.id]; const ok = done ? gradeItem(it, val) : null;
  const mark = done ? `<div class="res ${ok?'ok':'no'}">${ok ? '✓ Correct' : `✗ Answer: ${esc(correctText(it))}`}</div>` : '';
  const qt = (extra='') => `<div class="qt"><span class="qn">${n}</span>${extra}${esc(it.q||'')}</div>`;
  if (it.type === 'pills') return `<div class="q" data-id="${it.id}">${qt()}<div class="pills">${it.options.map((o,j)=>`<button type="button" class="pill ${val==j?'on':''} ${done&&j===it.answer?'right':''} ${done&&val==j&&j!==it.answer?'wrong':''}" data-v="${j}" ${done?'disabled':''}>${o}</button>`).join('')}</div>${done&&!ok?mark:''}</div>`;
  if (it.type === 'opts') return `<div class="q" data-id="${it.id}">${it.sign ? `<div class="sign">${esc(it.sign).replace(/\n/g,'<br>')}</div>` : ''}${qt()}<div class="opts">${it.options.map((o,j)=>`<button type="button" class="opt ${val==j?'on':''} ${done && j===it.answer ? 'right' : ''} ${done && val==j && j!==it.answer ? 'wrong':''}" data-v="${j}" ${done?'disabled':''}><span class="l">${letter(j)}</span><span>${esc(o)}</span></button>`).join('')}</div>${done && !ok ? mark : ''}</div>`;
  if (it.type === 'pics') return `<div class="q" data-id="${it.id}">${qt()}<div class="picopts">${it.options.map((o,j)=>`<button type="button" class="pic ${val==j?'on':''} ${done && j===it.answer ? 'right' : ''} ${done && val==j && j!==it.answer ? 'wrong':''}" data-v="${j}" ${done?'disabled':''}><span class="em ${emSize(o.e)}">${o.e}</span><span class="cap"><b>${letter(j)}</b> ${esc(o.t)}</span></button>`).join('')}</div>${done && !ok ? mark : ''}</div>`;
  if (it.type === 'select') return `<div class="q" data-id="${it.id}"><div class="qt"><span class="qn">${n}</span><b>${esc(it.q)}</b></div><select class="input" ${done?'disabled':''}><option value="">Choose…</option>${it.options.map((o,j)=>`<option value="${j}" ${val==j?'selected':''}>${esc(o)}</option>`).join('')}</select>${mark}</div>`;
  if (it.type === 'gap') return `<div class="q" data-id="${it.id}"><div class="qt"><span class="qn">${n}</span>${esc(it.q).replace('___','<span class="muted">_____</span>')}</div><input class="input" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(val||'')}" ${done?'disabled':''} placeholder="Type your answer">${mark}</div>`;
  return '';
}
function readRaw(root, items){ const raw = {}; items.forEach(it => { const el = root.querySelector(`[data-id="${it.id}"]`); if (!el) return;
  if (it.type === 'pills' || it.type === 'opts' || it.type === 'pics'){ const on = el.querySelector('.on'); raw[it.id] = on ? Number(on.dataset.v) : undefined; }
  else if (it.type === 'select'){ const v = el.querySelector('select').value; raw[it.id] = v === '' ? undefined : Number(v); }
  else if (it.type === 'gap'){ const inp = el.querySelector('input'); raw[it.id] = inp.value.trim(); } }); return raw; }

// inline gaps inside a passage: [[1]] = text box (open) or drop-down (cloze)
function inlineHTML(text, items, raw, done, mode){
  return esc(text).replace(/\n/g,'<br>').replace(/\[\[(\d+)\]\]/g, (_, n) => { const it = items[Number(n)-1]; const v = raw?.[it.id]; const ok = done ? gradeItem(it, v) : null;
    if (mode === 'cloze') return `<span class="ig" data-id="${it.id}"><b class="qn">${n}</b><select class="gapsel ${done ? (ok?'right':'wrong') : ''}" ${done?'disabled':''}><option value="">…</option>${it.options.map((o,j)=>`<option value="${j}" ${v==j?'selected':''}>${esc(o)}</option>`).join('')}</select>${done && !ok ? ` <small class="res no">(${esc(correctText(it))})</small>` : ''}</span>`;
    return `<span class="ig" data-id="${it.id}"><b class="qn">${n}</b><input class="gap ${done ? (ok?'right':'wrong') : ''}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(v||'')}" ${done?'disabled':''}>${done && !ok ? ` <small class="res no">(${esc(it.accepted[0])})</small>` : ''}</span>`; });
}

const esBox = sec => sec.es ? `<div class="eshint"><span class="flag">ES</span><span>${esc(sec.es)}</span></div>` : '';
function transcriptHTML(sec){ const blocks = sec.script || []; return `<details class="guide" id="tr-${sec._i}" ${sec._reveal ? '' : 'hidden'}><summary>Transcript (lo que dice el audio)</summary><div class="transcript">${blocks.map(b=>b.lines.map(([w,t])=>`<p><b>${esc(w)}:</b> ${esc(t)}</p>`).join('')).join('<hr>')}</div></details>`; }
function playerHTML(sec, plays){ return `<div class="player" data-player="${sec._i}"><button class="play" data-audio="${esc(sec.audio)}" aria-label="Play">${icons.play}</button><div style="flex:1"><b>${esc(sec.audioTitle || 'Listen')}</b><div class="small" style="opacity:.8">Se escucha dos veces · <span class="plays">${plays||0}</span> reproducciones</div><div class="prog"><i></i></div></div></div>`; }

function emSize(e){ return emSizeImpl(e); }
const emSizeImpl = e => { const n = [...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(e)].length; return n >= 4 ? 'e4' : n === 3 ? 'e3' : n === 2 ? 'e2' : ''; };
function picsStrip(pics, withNum){ return `<div class="story">${pics.map((p,i)=>`<figure><div class="em ${emSize(p.e)}">${p.e}</div><figcaption>${withNum ? `<b>${i+1}</b> ` : ''}${esc(p.cap||'')}</figcaption></figure>`).join('')}</div>`; }
function writeBox(sec, ex, sub, done, si, ph){
  if (done) return `<div class="answer">${esc(sub.text_answer ? extractWrite(sub.text_answer, sec, ex) : '')}</div><div class="wc"><span>${wordCount(extractWrite(sub.text_answer||'', sec, ex))} words</span></div>${sec.example ? `<div class="model"><b>Example:</b> ${esc(sec.example)}</div>` : ''}`;
  const draft = localStorage.getItem(`ketdraft-${ex.id}-${si}`) || '';
  return `<textarea class="input writing" data-w="${si}" data-min="${sec.min||0}" placeholder="${esc(ph||'Write here…')}" spellcheck="false" autocapitalize="sentences">${esc(draft)}</textarea><div class="wc"><span><b class="wcount" data-for="${si}">${wordCount(draft)}</b> / ${sec.min||0}+ words</span><span>Borrador guardado en este aparato</span></div>`;
}
function extractWrite(text, sec, ex){ const parts = text.split(/\n\n(?=\[[^\]]+\]\n)/); const mine = parts.find(p => p.startsWith(`[${sec.title}]`)); return mine ? mine.replace(/^\[[^\]]+\]\n/, '') : text; }
function speakBox(ex, sub, done){
  if (done) return `${sub.audio_path ? `<div class="rec"><audio controls preload="none" data-audio="${esc(sub.audio_path)}"></audio></div>` : ''}${sub.text_answer && !/^\[/.test(sub.text_answer) ? `<div class="answer">${esc(sub.text_answer)}</div>` : ''}`;
  return `<div class="rec mt">${recorderSupported() ? `<button class="recbtn" id="recbtn" aria-label="Record">${icons.mic}</button><div><div class="timer" id="rtimer">0:00</div><div class="small muted" id="rstate">Toca el micrófono para grabar</div></div><audio id="recaudio" controls hidden></audio>` : `<div class="small">Este navegador no puede grabar. Escribe tus respuestas abajo.</div>`}</div>
  <label class="field"><span>Notas (opcional)</span><textarea class="input" id="notes" style="min-height:70px" placeholder="Si quieres, escribe aquí lo que dijiste"></textarea></label>`;
}

// ---------- main renderer ----------
export function renderTask(ex, sub, { preview } = {}){
  const done = !!sub; const raw = sub?.answers?.raw || {}; let html = '';
  const items = allItems(ex);
  if (done && sub.auto_max){ const p = sub.auto_score/sub.auto_max;
    html += `<div class="scorebanner"><div class="big">${sub.auto_score}<small>/${sub.auto_max}</small></div><div><b>${p >= .8 ? '¡Excelente! 🌟' : p >= .6 ? '¡Muy bien! 👏' : '¡Sigue así! Mira las correcciones 💪'}</b><div class="small" style="opacity:.85">Guardado · Eduardo lo ve en la revisión del viernes</div></div></div>`; }
  else if (done) html += `<div class="scorebanner"><div class="big">✓</div><div><b>Enviado a Eduardo</b><div class="small" style="opacity:.85">Verás sus comentarios en la pestaña Feedback el viernes.</div></div></div>`;
  ex.sections.forEach((sec, si) => {
    sec._i = si; const its = sectionItems(sec, si); let body = ''; const T = sec.type;
    if (T === 'signs') body = its.map((it,i)=>itemHTML(it,i+1,raw,done)).join('');
    else if (T === 'mcq' || T === 'quiz'){
      body = (sec.text ? `<div class="passage">${sec.textTitle ? `<h2>${esc(sec.textTitle)}</h2>` : ''}${esc(sec.text).split('\n').map(p=>`<p>${p}</p>`).join('')}</div>` : '') + its.map((it,i)=>itemHTML(it,i+1,raw,done)).join(''); }
    else if (T === 'match'){
      body = `<div class="texts">${sec.texts.map((t,k)=>`<div class="mtext"><b class="ml">${letter(k)}</b><div>${t.h ? `<div class="mh">${esc(t.h)}</div>` : ''}${esc(t.t)}</div></div>`).join('')}</div>` + its.map((it,i)=>itemHTML(it,i+1,raw,done)).join(''); }
    else if (T === 'cloze' || T === 'open'){
      body = `<div class="passage cl">${sec.textTitle ? `<h2>${esc(sec.textTitle)}</h2>` : ''}<p>${inlineHTML(sec.text, its, raw, done, T)}</p></div>${sec.bank ? `<div class="instr"><b>Words:</b> ${sec.bank.map(esc).join(' · ')}</div>` : ''}`; }
    else if (T === 'write'){
      body = `<div class="prompt">${esc(sec.prompt)}${sec.points ? `<ul>${sec.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>` : ''}</div>${sec.starter ? `<div class="model"><b>Starts like this:</b> ${esc(sec.starter)}</div>` : ''}${sec.tips ? `<details class="guide"><summary>Ayuda / Help</summary><ul>${sec.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}${writeBox(sec, ex, sub, done, si, sec.ph)}`; }
    else if (T === 'story'){
      body = `<div class="instr">${esc(sec.prompt || 'Look at the three pictures. Write the story.')}</div>${picsStrip(sec.pics, true)}${sec.tips ? `<details class="guide"><summary>Ayuda / Help</summary><ul>${sec.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}${writeBox(sec, ex, sub, done, si, 'Write your story here…')}`; }
    else if (T === 'lpics' || T === 'lmcq' || T === 'lgap' || T === 'lmatch'){
      sec._reveal = done || preview;
      body = playerHTML(sec, sub?.meta?.plays) + transcriptHTML(sec);
      if (T === 'lgap') body += `<div class="formsheet">${sec.heading ? `<div class="fh">${esc(sec.heading)}</div>` : ''}${sec.lines.map(l=>`<div class="fl gapline">${inlineHTML(l, its, raw, done, 'open')}</div>`).join('')}</div>`;
      else if (T === 'lmatch') body += `<div class="optlist">${sec.options.map((o,k)=>`<span><b>${letter(k)}</b> ${esc(o)}</span>`).join('')}</div>` + its.map((it,i)=>itemHTML(it,i+1,raw,done)).join('');
      else body += its.map((it,i)=>itemHTML(it,i+1,raw,done)).join('');
    }
    else if (T === 'speak'){
      if (sec.part === 2) body += `<div class="instr">${esc(sec.intro || 'Look at the pictures. Say what you like and what you don\'t like. Say why.')}</div>${picsStrip(sec.cards, false)}`;
      if (sec.qs) body += `<div class="qs">${sec.qs.map((q,i)=>`<div class="q"><div class="qt"><span class="qn">${i+1}</span>${esc(q)}</div></div>`).join('')}</div>`;
      if (sec.useful) body += `<details class="guide" open><summary>Frases útiles</summary><ul>${sec.useful.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`;
      body += speakBox(ex, sub, done);
    }
    const part = sec.part_label ?? PART_LABEL[T];
    html += `<section class="qblock" data-sec="${si}"><div class="sechead">${part ? `<span class="partchip">${esc(part)}</span>` : ''}<h3>${esc(sec.title)}</h3></div>${esBox(sec)}${body}</section>`;
  });
  if (!preview && !done) html += `<div class="sticky-submit"><button class="btn coral block" id="submit">${items.length ? 'Enviar y ver mi resultado' : 'Enviar a Eduardo'}</button></div>`;
  return html;
}

// ---------- binding & collecting ----------
export function bindTask(root, ex, { onSubmit }){
  const started = Date.now(); let plays = 0, rec = null, blob = null, rtimer = null; const audios = [];
  $$('.pill, .opt, .pic', root).forEach(b => b.addEventListener('click', () => { const q = b.closest('.q'); $$('.pill, .opt, .pic', q).forEach(x => x.classList.remove('on')); b.classList.add('on'); }));
  $$('textarea.writing', root).forEach(w => w.addEventListener('input', () => { const c = $(`.wcount[data-for="${w.dataset.w}"]`, root); c.textContent = wordCount(w.value); c.classList.toggle('ok', wordCount(w.value) >= Number(w.dataset.min||0)); localStorage.setItem(`ketdraft-${ex.id}-${w.dataset.w}`, w.value); }));
  $$('.player .play', root).forEach(pb => { const box = pb.closest('.player'); const bar = $('.prog i', box); const au = new Audio(pb.dataset.audio); au.preload = 'none'; audios.push(au);
    au.addEventListener('timeupdate', () => { if (au.duration) bar.style.width = (au.currentTime/au.duration*100)+'%'; });
    au.addEventListener('ended', () => { box.classList.remove('playing'); pb.innerHTML = icons.play; bar.style.width = '0'; });
    au.addEventListener('error', () => { toast('No se pudo cargar el audio. Abre el transcript.'); $$('details.guide[hidden]', root).forEach(d => d.removeAttribute('hidden')); });
    pb.addEventListener('click', () => {
      if (!au.paused){ au.pause(); box.classList.remove('playing'); pb.innerHTML = icons.play; return; }
      audios.forEach(o => { if (o !== au){ o.pause(); } }); $$('.player', root).forEach(p => { if (p !== box){ p.classList.remove('playing'); $('.play', p).innerHTML = icons.play; } });
      if (au.currentTime === 0 || au.ended){ plays++; $('.plays', box).textContent = Number($('.plays', box).textContent||0) + 1; }
      au.play().catch(() => toast('Toca otra vez para reproducir')); box.classList.add('playing'); pb.innerHTML = icons.stop; }); });
  const rb = $('#recbtn', root);
  if (rb){ rb.addEventListener('click', async () => {
    if (!rec){ try { rec = await startRecording(); } catch(e){ toast('Necesito permiso para usar el micrófono'); return; }
      rb.classList.add('on'); rb.innerHTML = icons.stop; $('#rstate',root).textContent = 'Grabando… toca para parar'; const t0 = Date.now();
      rtimer = setInterval(() => { const s = Math.floor((Date.now()-t0)/1000); $('#rtimer',root).textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }, 500);
    } else { clearInterval(rtimer); blob = await rec.stop(); rec = null; rb.classList.remove('on'); rb.innerHTML = icons.mic; $('#rstate',root).textContent = 'Grabado ✓ — toca el micrófono para grabar de nuevo';
      const a = $('#recaudio', root); a.src = URL.createObjectURL(blob); a.hidden = false; } }); }
  $('#submit', root)?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget; if (rec){ toast('Primero para la grabación'); return; }
    const payload = collect(root, ex); if (payload.error){ toast(payload.error); return; }
    payload.meta = { ...(payload.meta||{}), secs: Math.round((Date.now()-started)/1000), plays: plays || undefined };
    btn.disabled = true; btn.textContent = 'Guardando…';
    try { await onSubmit(payload, blob); $$('textarea.writing', root).forEach(w => localStorage.removeItem(`ketdraft-${ex.id}-${w.dataset.w}`)); }
    catch(e){ console.error(e); toast('No se pudo guardar. Revisa tu internet e inténtalo otra vez'); btn.disabled = false; btn.textContent = 'Enviar y ver mi resultado'; }
  });
  return () => { audios.forEach(a => a.pause()); clearInterval(rtimer); };
}
function collect(root, ex){
  const items = allItems(ex); let out = {};
  if (items.length){ const raw = readRaw(root, items); const answered = Object.values(raw).filter(v => v !== undefined && v !== '').length;
    if (answered < Math.ceil(items.length/2)) return { error:'Contesta al menos la mitad de las preguntas' };
    const graded = items.map(it => ({ sec: it.secTitle, q: it.q, given: givenText(it, raw[it.id]), correct: correctText(it), ok: gradeItem(it, raw[it.id]) }));
    out = { answers:{ raw, items: graded }, auto_score: graded.filter(g=>g.ok).length, auto_max: graded.length }; }
  const texts = [];
  for (const sec of ex.sections){ if (sec.type === 'write' || sec.type === 'story'){
      const w = $(`textarea.writing[data-w="${ex.sections.indexOf(sec)}"]`, root); const v = w?.value.trim() || '';
      if (wordCount(v) < Math.min(sec.min || 0, 8)) return { error:`Escribe al menos ${Math.min(sec.min||0, 8)} palabras en "${sec.title}"` };
      texts.push(`[${sec.title}]\n${v}`); } }
  const hasSpeak = ex.sections.some(s => s.type === 'speak');
  if (hasSpeak){ const notes = $('#notes', root)?.value.trim() || ''; const hasAudio = !!$('#recaudio', root)?.src;
    if (!hasAudio && !notes) return { error: recorderSupported() ? 'Graba tus respuestas (o escribe notas)' : 'Escribe notas de lo que dirías' };
    out.meta = { needsAudio: hasAudio }; if (notes) texts.push(notes); }
  if (texts.length) out.text_answer = texts.join('\n\n');
  return out;
}
