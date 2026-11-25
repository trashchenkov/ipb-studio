#!/usr/bin/env python3
"""Validate FEMM output and create an importable IPB Studio result JSON."""
import argparse,csv,json,math
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--dir',type=Path,required=True)
args=p.parse_args()
base=args.dir
job=json.loads((base/'job.json').read_text(encoding='utf-8'))
mode=job['electrical']['mode']
regions_file=base/f'results_{mode}.csv'
field_file=base/f'field_{mode}.csv'
if not regions_file.exists() or not field_file.exists():
    raise SystemExit('FEMM output missing: '+str([x.name for x in (regions_file,field_file) if not x.exists()]))
with regions_file.open(newline='',encoding='utf-8-sig') as f:
    raw=list(csv.DictReader(f))
assert len(raw)==6,'Expected six conductor/shell regions'
regions=[]
for row in raw:
    typ=row['region'];ph='ABC'[int(row['phase'])-1]
    out={'region':typ,'phase':ph}
    for name in ('I_re_peak_A','I_im_peak_A','P_W_per_m','area_m2'):
        out[name]=float(row[name] if name in row else row['area_mm2'])
        assert math.isfinite(out[name]),name
    assert out['P_W_per_m']>=0 and out['area_m2']>0
    out['area_mm2']=out.pop('area_m2')*1000000  # Convert FEMM mo_blockintegral(5) m² to mm²
    regions.append(out)
assert {(r['region'],r['phase']) for r in regions}=={(a,b) for a in ('main','shell') for b in 'ABC'}
expected=job['electrical']['phase_current_rms_A']
for r in regions:
    if r['region']=='main':
        observed=math.hypot(r['I_re_peak_A'],r['I_im_peak_A'])/math.sqrt(2)
        assert abs(observed-expected)/expected<0.01, f'Phase {r["phase"]} current mismatch'
# Sanity check for total shell current in ideal bonded/isolated modes
shells=[r for r in regions if r['region']=='shell']
if mode=='bonded':
    assert abs(sum(r['I_re_peak_A'] for r in shells))<expected*.02
    assert abs(sum(r['I_im_peak_A'] for r in shells))<expected*.02
else:
    for r in shells:
        assert math.hypot(r['I_re_peak_A'],r['I_im_peak_A'])<expected*.02
with field_file.open(newline='',encoding='utf-8-sig') as f:
    rows=list(csv.DictReader(f))
xs=sorted({float(r['x_mm']) for r in rows})
ys=sorted({float(r['y_mm']) for r in rows})
assert len(xs)==121 and len(ys)==61 and len(rows)==len(xs)*len(ys),'Unexpected field grid'
values={}
for row in rows:
    x,y=float(row['x_mm']),float(row['y_mm'])
    v=math.sqrt(sum(float(row[k])**2 for k in ('Bx_re_T','Bx_im_T','By_re_T','By_im_T'))/2)
    assert math.isfinite(v)
    values[(x,y)]=v
assert len(values)==len(rows),'Duplicate field sample'
field={'schema':'ipb-field-grid-v1','nx':len(xs),'ny':len(ys),'unit':'T',
       'bounds_m':[xs[0]/1000,ys[0]/1000,xs[-1]/1000,ys[-1]/1000],
       'values':[values[(x,y)] for y in ys for x in xs],
       'metadata':{'quantity':'RMS vector magnitude of magnetic induction','source':'FEMM 4.2 Windows GitHub Actions'}}
result={'schema':'ipb-femm-result-v2','job':job,
        'result':{'mode':mode,'regions':regions},'field':field}
output=base/'ipb_result.json'
output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
total=sum(r['P_W_per_m'] for r in regions)
report=f'''# FEMM calculation results

Mode: {mode}
Frequency: {job["electrical"]["frequency_hz"]} Hz
Phase current: {expected} A RMS
Mesh: {job["solver"]["mesh_mm"]} mm
Outer boundary radius: {job["solver"]["outer_radius_mm"]} mm
Total Joule losses: {total:.4f} W/m

Output JSON: ipb_result.json (can be imported into IPB Studio).
Note: Results are from an idealized 2D harmonic model; no validation of actual connectors or transient fault response.
'''
(base/'RESULTS.md').write_text(report,encoding='utf-8')
print(report)
