# End-to-end test against the real Supabase backend (reads passwords from /home/box/private, never prints them).
# Simulates Agustín doing week 1, Eduardo reviewing on Friday, and takes mobile screenshots. Test rows are removed afterwards by tools/cleanup_test.py
import re, sys, time
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8766/'
SHOTS = '/workspace/objective-ket/shots/'
pw = {}
for line in open('/home/box/private/objective-ket.txt'):
    m = re.search(r'user: (\w+)\s+password: (\S+)', line)
    if m: pw[m.group(1)] = m.group(2)
errors = []
def mk(b, when, mobile=True):
    ctx = b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1366,'height':900}, device_scale_factor=2 if mobile else 1, permissions=['microphone'], locale='es-MX')
    ctx.clock.set_fixed_time(when)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('console', lambda m: m.type == 'error' and errors.append(m.text)); return p
def login(p, u):
    p.goto(BASE); p.wait_for_selector('#lf'); p.fill('input[name=u]', u); p.fill('input[name=p]', pw[u]); p.click('button[type=submit]'); p.wait_for_selector('.topbar', timeout=20000); time.sleep(0.8)
def answer_all(p):
    for q in p.query_selector_all('.q'):
        btns = q.query_selector_all('.pill, .opt, .pic')
        if btns: btns[len(btns)//2 if len(btns) > 2 else 0].click(); continue
        sel = q.query_selector('select')
        if sel: sel.select_option(index=2); continue
        inp = q.query_selector('input.input')
        if inp: inp.fill('ten')
    for s in p.query_selector_all('select.gapsel'): s.select_option(index=1)
    for g in p.query_selector_all('input.gap'): g.fill('Ford')
    for t in p.query_selector_all('textarea.writing'): t.fill('Hi Ben, let\'s have lunch on Saturday! Do you want to go to the pizza place near the park? Let\'s meet at one o\'clock. I like pizza and salad. See you! Agustin')
    rb = p.query_selector('#recbtn')
    if rb: rb.click(); time.sleep(3); rb.click(); time.sleep(1)
def do_task(p, tid, shot=None, shot_before=None):
    p.goto(BASE + '#/task/' + tid); p.wait_for_selector('#task'); time.sleep(0.6)
    if shot_before: p.screenshot(path=SHOTS+shot_before)
    if p.query_selector('#submit'):
        answer_all(p); p.click('#submit'); p.wait_for_selector('.scorebanner', timeout=30000); time.sleep(0.6)
    if shot: p.screenshot(path=SHOTS+shot, full_page=True)
with sync_playwright() as pl:
    b = pl.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
    # --- Friday of week 1: Agustín finished week 1 (all 3 exercises)
    st = mk(b, '2026-11-19T07:30:00'); login(st, 'agustin')
    st.wait_for_selector('.daycard'); st.screenshot(path=SHOTS+'00-home-today-thursday.png')
    st.goto(BASE + '#/plan'); st.wait_for_selector('.weekcard'); time.sleep(.5); st.screenshot(path=SHOTS+'00b-plan-today.png'); st.goto(BASE + '#/')
    for t in ['w1-a','w1-b','w1-c']: do_task(st, t)
    # --- Teacher reviews week 1
    te = mk(b, '2026-11-27T18:00:00', mobile=False); login(te, 'eduardo'); te.goto(BASE + '#/t/week/1'); te.wait_for_selector('.sub-card'); time.sleep(0.8)
    cards = te.query_selector_all('.sub-card[data-sub]'); print('teacher sees', len(cards), 'submissions')
    texts = ['Muy bien, Agustín. Tu tarjeta está clara. Solo recuerda la mayúscula en tu nombre: "My name is Agustín".','','Se te entiende bien. Repite "twelve" y "eleven" despacio, la "v" es muy importante.']
    for c, txt in zip(cards, texts):
        if txt: c.query_selector('.fbc').fill(txt)
        sel = c.query_selector('.fbb')
        if sel and txt: sel.select_option('8')
        c.query_selector('.savefb').click(); time.sleep(0.5)
    te.screenshot(path='/tmp/t-teacher-week.png', full_page=True)
    te.fill('input[name=comment_reading]', 'Los letreros ya los entiendes bien.'); te.fill('input[name=comment_speaking]', 'Buen ritmo. Habla un poco más fuerte.')
    for k, v in [('reading','9'),('listening','8'),('writing','7'),('speaking','8')]: te.select_option(f'select[name=grade_{k}]', v)
    te.fill('textarea[name=summary]', 'Gran primera semana, Agustín. Los números y los colores ya los dominas. Para la próxima: escribe tu nombre siempre con mayúscula y practica decir tu edad en voz alta.')
    te.click('#rf button[type=submit]'); time.sleep(1.2)
    te.screenshot(path=SHOTS+'teacher-weekly-review.png', full_page=False)
    # --- Student, Tuesday of week 2: home, an exercise, feedback
    s2 = mk(b, '2026-12-01T17:00:00'); login(s2, 'agustin'); s2.wait_for_selector('.daycard'); time.sleep(0.8)
    s2.screenshot(path=SHOTS+'01-home.png')
    s2.goto(BASE + '#/task/w2-a'); s2.wait_for_selector('#task'); time.sleep(0.8); s2.screenshot(path=SHOTS+'02-exercise-reading.png')
    s2.goto(BASE + '#/task/w1-b'); s2.wait_for_selector('#task'); time.sleep(0.8); s2.evaluate('window.scrollTo(0, 340)'); time.sleep(0.4); s2.screenshot(path=SHOTS+'03-exercise-listening-done.png')
    s2.goto(BASE + '#/feedback'); s2.wait_for_selector('.card'); time.sleep(0.8); s2.screenshot(path=SHOTS+'04-feedback.png')
    s2.goto(BASE + '#/plan'); s2.wait_for_selector('.weekcard'); time.sleep(0.6); s2.screenshot(path=SHOTS+'05-plan.png')
    s2.goto(BASE + '#/progress'); time.sleep(0.8); s2.screenshot(path=SHOTS+'06-progress.png')
    # speaking exercise (before) for a screenshot
    s3 = mk(b, '2026-12-03T17:00:00'); login(s3, 'agustin'); s3.goto(BASE + '#/task/w2-c'); s3.wait_for_selector('#task'); time.sleep(0.6); s3.screenshot(path=SHOTS+'07-exercise-speaking.png')
    b.close()
print('page errors:', errors[:5])
