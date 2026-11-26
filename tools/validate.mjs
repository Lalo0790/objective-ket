import { WEEKS } from '../content/index.js';
import { sectionItems } from '../tasks.js';
let bad = 0; const err = (w, s, m) => { bad++; console.log(`W${w} ${s}: ${m}`); };
let nItems = 0, nEx = 0;
WEEKS.forEach((wk, wi) => { const w = wi+1;
  for (const slot of ['a','b','c','d','e']){ const ex = wk.tasks[slot]; if (!ex){ err(w, slot, 'missing'); continue; } nEx++;
    ex.sections.forEach((sec, si) => { const tag = `${slot}.${si}(${sec.type})`; const its = sectionItems(sec, si); nItems += its.length;
      for (const it of its){ if (it.type === 'gap'){ if (!it.accepted?.length) err(w, tag, 'no accepted'); } else { if (!Array.isArray(it.options) || it.answer == null || it.answer < 0 || it.answer >= it.options.length) err(w, tag, 'bad answer ' + JSON.stringify(it).slice(0,80)); } }
      if (['cloze','open'].includes(sec.type)){ const m = [...sec.text.matchAll(/\[\[(\d+)\]\]/g)].map(x=>+x[1]); if (m.length !== its.length || m.some((n,i)=>n!==i+1)) err(w, tag, 'gap count mismatch'); }
      if (sec.type === 'lgap'){ const m = sec.lines.join(' ').match(/\[\[\d+\]\]/g) || []; if (m.length !== sec.answers.length) err(w, tag, 'gap count mismatch'); }
      if (sec.type.startsWith('l') && sec.type !== 'lmatch' || sec.type === 'lmatch'){ if (!sec.audio || !sec.script) err(w, tag, 'no audio/script'); }
      if (sec.type === 'lpics' && sec.script.length !== sec.items.length) err(w, tag, 'script blocks != items');
      if (sec.type === 'lpics') sec.items.forEach(it => { if (it.o.length !== 3) err(w, tag, 'not 3 pics'); });
      if (sec.type === 'speak' && !(sec.qs || sec.cards)) err(w, tag, 'empty speak');
      if (sec.type === 'write' || sec.type === 'story'){ if (!sec.min || !sec.example) err(w, tag, 'write needs min+example'); }
    });
    const mins = ex.mins; if (mins < 15 || mins > 20) err(w, slot, 'mins out of 15–20: ' + mins);
  } });
console.log(`weeks ${WEEKS.length}, exercises ${nEx}, auto items ${nItems}, problems ${bad}`);
process.exit(bad ? 1 : 0);
