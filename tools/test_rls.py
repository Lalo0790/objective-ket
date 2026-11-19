# Security checks on the live backend (prints only PASS/FAIL; reads passwords from /home/box/private)
import json, re, urllib.request, urllib.error
env = dict(l.strip().split('=',1) for l in open('/home/box/private/objective-ielts.env') if '=' in l)
URL, ANON = env['SB_URL'].rstrip('/'), env['SB_ANON']
pw = {}
for line in open('/home/box/private/objective-ket.txt'):
    m = re.search(r'user: (\w+)\s+password: (\S+)', line)
    if m: pw[m.group(1)] = m.group(2)
def call(method, path, token=None, body=None, extra=None):
    h = {'apikey':ANON,'Authorization':'Bearer '+(token or ANON),'Content-Type':'application/json','Prefer':'return=representation'}
    r = urllib.request.Request(URL+path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    try: resp = urllib.request.urlopen(r); t = resp.read().decode(); return resp.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e: t = e.read().decode(); return e.code, t
def login(u):
    s, d = call('POST', '/auth/v1/token?grant_type=password', body={'email': f'{u}@objective-ket.app', 'password': pw[u]}); assert s == 200; return d['access_token'], d['user']['id']
ok = lambda name, cond: print(('PASS ' if cond else 'FAIL ') + name)
ta, aid = login('agustin'); tt, tid = login('eduardo')
# anonymous
for t in ['ket_settings','ket_submissions','ket_profiles','ket_weekly_reviews','ket_item_feedback']:
    s, d = call('GET', f'/rest/v1/{t}?select=*'); ok(f'anon cannot read {t}', s in (401,403) or d == [])
# student
s, d = call('GET', '/rest/v1/ket_settings?select=*', ta); ok('student reads settings', s == 200 and len(d) == 1)
s, d = call('PATCH', '/rest/v1/ket_settings?id=eq.1', ta, {'exam_date':'2027-06-01'}); ok('student cannot change settings', s in (401,403) or d == [])
s, d = call('POST', '/rest/v1/ket_weekly_reviews', ta, {'student_id':aid,'week_start':'2026-11-30','summary':'x'}); ok('student cannot write weekly review', s >= 400)
s, d = call('POST', '/rest/v1/ket_submissions', ta, {'student_id':tid,'week_start':'2026-11-30','task_id':'rls-test','skill':'reading'}); ok('student cannot write as another user', s >= 400)
s, d = call('POST', '/rest/v1/ket_submissions', ta, {'student_id':aid,'week_start':'2026-11-30','task_id':'rls-test','skill':'reading'}); ok('student can write own submission', s in (200,201))
sid = d[0]['id'] if s in (200,201) else None
s, d = call('POST', '/rest/v1/ket_item_feedback', ta, {'submission_id':sid,'comment':'x','grade':10}); ok('student cannot grade own work', s >= 400)
s, d = call('GET', '/rest/v1/ket_profiles?select=role', ta); ok('student sees only own profile', s == 200 and len(d) == 1)
# teacher
s, d = call('POST', '/rest/v1/ket_item_feedback', tt, {'submission_id':sid,'comment':'rls','grade':8}); ok('teacher can give feedback', s in (200,201))
s, d = call('GET', '/rest/v1/ket_submissions?select=id', tt); ok('teacher reads submissions', s == 200 and len(d) >= 1)
s, d = call('PATCH', '/rest/v1/ket_settings?id=eq.1', tt, {'exam_tentative':True}); ok('teacher can update settings', s == 200 and len(d) == 1)
# Sofi's tables untouched / not reachable by the new student
s, d = call('GET', '/rest/v1/submissions?select=id', ta); ok("Agustín sees none of Sofi's submissions", s == 200 and d == [])
s, d = call('GET', '/rest/v1/profiles?select=role', ta); ok("Agustín cannot read Sofi-app profiles", s == 200 and d == [])
call('DELETE', f'/rest/v1/ket_submissions?id=eq.{sid}', tt)
