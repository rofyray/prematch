"""Exercise the public API and optionally record a reusable product example."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import httpx

parser=argparse.ArgumentParser()
parser.add_argument('--base',required=True)
parser.add_argument('--input',required=True,help='JSON request file')
parser.add_argument('--endpoint',choices=['check','brief','ask'],default='check')
parser.add_argument('--record',help='Product example JSON output')
parser.add_argument('--title',default='Recorded example')
args=parser.parse_args()
payload=json.loads(Path(args.input).read_text())
events=[]
with httpx.Client(timeout=300) as client:
 with client.stream('POST',args.base.rstrip('/')+'/api/py/'+args.endpoint,json=payload) as response:
  response.raise_for_status()
  event_type='message';data=[]
  for line in response.iter_lines():
   if line.startswith('event:'):event_type=line[6:].strip()
   elif line.startswith('data:'):data.append(line[5:].lstrip())
   elif not line and data:
    item={'type':event_type,'data':json.loads('\n'.join(data))};events.append(item);data=[]
    print(item['type'],item['data'].get('t_ms',''),flush=True)
 assert events and events[0]['type']=='run.started'
 assert events[-1]['type']=='run.completed',events[-1] if events else 'No events'
 if not events[-1]['data'].get('needs_clarification') and args.endpoint!='ask':
  run_id=events[-1]['data'].get('brief_id') or events[-1]['data']['run_id']
  stored=client.get(args.base.rstrip('/')+'/api/py/runs/'+run_id)
  stored.raise_for_status()
 if args.record:
  path=Path(args.record)
  path.parent.mkdir(parents=True,exist_ok=True)
  path.write_text(json.dumps({'id':path.stem,'title':args.title,'recorded_at':datetime.now(timezone.utc).isoformat(),'input':payload,'events':events},indent=2))
 print('API workflow passed')
