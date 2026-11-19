# Objective KET
Weekly Cambridge A2 Key (KET) training for Agustín: **3 exercises a week (15–20 min each)** and a teacher review every **Friday** (Eduardo García).
- Static app (no build) → GitHub Pages. Modeled on `objective-ielts` (same architecture and security model).
- Backend: the same Supabase project as objective-ielts, with its own tables (`ket_*`), storage bucket (`ket-speaking`) and RLS. See `sql/schema.sql`.
- Passwords: `/home/box/private/objective-ket.txt` (never commit).
- Plan: `content/weekN.js` (one file per week; Mon = Reading & Writing, Wed = Listening, Thu = Speaking + Words). `plan.js` builds the calendar from the settings (start date, exam date, study days).
- Listening audio: `audio/*.mp3`, generated from the scripts inside the content files: `python3 tools/gen_audio.py`.
- Checks: `node tools/validate.mjs` (answer keys, gap counts, timing) · `python3 tools/test_e2e.py` (real backend, then `python3 tools/cleanup_test.py`).
- Local demo mode: empty `SUPABASE_URL` in `config.js` → data in localStorage.
