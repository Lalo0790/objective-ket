#!/bin/bash
# usage: sbq.sh file.sql   (runs SQL on the objective-ielts Supabase project via Management API)
python3 -c 'import json,sys;print(json.dumps({"query":open(sys.argv[1]).read()}))' "$1" > /tmp/oiq.json
curl -s -X POST https://api.supabase.com/v1/projects/ustkwaeyanwhdoirrpld/database/query -H "Authorization: Bearer $(cat /workspace/.sb_token)" -H "Content-Type: application/json" --data @/tmp/oiq.json; rm -f /tmp/oiq.json
