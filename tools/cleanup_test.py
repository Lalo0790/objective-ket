# Removes test submissions / reviews / recordings created by test_e2e.py (service role; nothing printed except counts)
import json, subprocess, urllib.request
env = dict(l.strip().split('=',1) for l in open('/home/box/private/objective-ielts.env') if '=' in l)
URL, SVC = env['SB_URL'].rstrip('/'), env['SB_SERVICE']
def req(method, path, body=None):
    r = urllib.request.Request(URL+path, data=json.dumps(body).encode() if body is not None else None, method=method, headers={'apikey':SVC,'Authorization':'Bearer '+SVC,'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r))
subs = req('GET', '/rest/v1/ket_submissions?select=id,audio_path')
paths = [s['audio_path'] for s in subs if s.get('audio_path')]
if paths:
    try: req('DELETE', '/storage/v1/object/ket-speaking', {'prefixes': paths})
    except Exception as e: print('storage delete failed', e)
open('/tmp/c.sql','w').write('delete from ket_weekly_reviews; delete from ket_submissions; select (select count(*) from ket_submissions) s, (select count(*) from ket_weekly_reviews) r, (select count(*) from ket_item_feedback) f;')
print(subprocess.run(['./tools/sbq.sh','/tmp/c.sql'],capture_output=True,text=True).stdout, 'recordings removed:', len(paths))
