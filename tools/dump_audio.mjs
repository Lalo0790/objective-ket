import { WEEKS } from '../content/index.js';
const out = [];
WEEKS.forEach((wk, wi) => { for (const slot of ['a','b','c']) wk.tasks[slot].sections.forEach(sec => { if (sec.audio) out.push({ week: wi+1, type: sec.type, audio: sec.audio, speakers: sec.speakers, script: sec.script }); }); });
console.log(JSON.stringify(out));
