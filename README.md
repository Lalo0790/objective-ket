# Objective KET
Weekly Cambridge A2 Key (KET) training. Default plan (Agustín): **3 exercises a week (15–20 min each)**. Eduardo Zamorano has **5 exercises a week**. Teacher review every **Friday** (Eduardo García).
- Static app (no build) → GitHub Pages. Modeled on `objective-ielts` (same architecture and security model).
- Backend: the same Supabase project as objective-ielts, with its own tables (`ket_*`), storage bucket (`ket-speaking`) and RLS. See `sql/schema.sql`.
- Per-student plan lives on `ket_profiles` (`exercises_per_week`, optional `start_date` and `study_days`). The shared `ket_settings` row (id=1) stays as Agustín's default calendar and must not be overwritten with another student's dates.
- Passwords: `/home/box/private/objective-ket.txt` (never commit).
- Plan: `content/weekN.js` (one file per week). Slots **a/b/c** are the shared 3-a-week set (Reading & Writing, Listening, Speaking + Words). Slots **d/e** (extra Reading, Writing & Words) are only shown to students with `exercises_per_week = 5`. `plan.js` builds the calendar from the merged settings (start date, exam date, study days, exercises per week).
- Listening audio: `audio/*.mp3`, generated from the scripts inside the content files: `python3 tools/gen_audio.py`.
- Checks: `node tools/validate.mjs` (answer keys, gap counts, timing) · `python3 tools/test_e2e.py` (real backend, then `python3 tools/cleanup_test.py`).
- Local demo mode: empty `SUPABASE_URL` in `config.js` → data in localStorage.
