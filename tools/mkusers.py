# Creates the two auth users for the KET app (Supabase admin API) + profiles; writes credentials to /home/box/private/objective-ket.txt (never printed)
import json, os, secrets, urllib.request, subprocess
env = dict(l.strip().split('=',1) for l in open('/home/box/private/objective-ielts.env') if '=' in l)
URL, SVC = env['SB_URL'].rstrip('/'), env['SB_SERVICE']
words = ['luna','tigre','pizza','nube','gato','rayo','mango','cohete','koala','delfin','robot','fuego','pato','sol']
pw_student = f"{secrets.choice(words)}-{secrets.choice(words)}-{secrets.randbelow(900)+100}"
pw_teacher = secrets.token_urlsafe(18)
def api(path, body):
    req = urllib.request.Request(URL+path, data=json.dumps(body).encode(), headers={'apikey':SVC,'Authorization':'Bearer '+SVC,'Content-Type':'application/json'})
    try: return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e: raise SystemExit(e.read().decode())
users = {}
for u, pw, role, name in [('agustin', pw_student, 'student', 'Agustín'), ('eduardo', pw_teacher, 'teacher', 'Eduardo')]:
    r = api('/auth/v1/admin/users', {'email': f'{u}@objective-ket.app', 'password': pw, 'email_confirm': True})
    users[u] = (r['id'], role, name)
sql = "insert into ket_profiles(id,role,display_name) values " + ",".join(f"('{i}','{r}','{n}')" for i,r,n in users.values()) + f" on conflict do nothing; update ket_settings set student_id='{users['agustin'][0]}' where id=1;"
open('/tmp/mk.sql','w').write(sql); print(subprocess.run(['./tools/sbq.sh','/tmp/mk.sql'],capture_output=True,text=True).stdout)
os.makedirs('/home/box/private', exist_ok=True)
with open('/home/box/private/objective-ket.txt','w') as f:
    f.write(f"Objective KET - app logins\nApp: https://lalo0790.github.io/objective-ket/\nStudent login  -> user: agustin     password: {pw_student}\nTeacher login  -> user: eduardo     password: {pw_teacher}\n(Usernames map to <user>@objective-ket.app in Supabase Auth, same project as objective-ielts; tables prefixed ket_; signups disabled.)\n")
os.chmod('/home/box/private/objective-ket.txt', 0o600); os.remove('/tmp/mk.sql')
print('ok')
