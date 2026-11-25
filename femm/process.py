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
        out[name]=float(row[name] if name in row else row['area_mm2'] if name=='area_m2' else row[name])
        assert math.isfinite(out[name]),name
    assert out['P_W_per_m']>=0 and out['area_m2']>0
    out['area_mm2']=out.pop('area_m2')*1000000  # Convert FEMM mo_blockintegral(5) m² to mm²
    regions.append(out)
assert {(r['region'],r['phase']) for r in regions}=={(a,b) for a in ('main','shell') for b in 'ABC'}
expected=job['electrical']['phase_current_rms_A']
fault_phasors=job['electrical'].get('fault_phasors_rms_A')
if fault_phasors:
    assert len(fault_phasors)==3 and job.get('fault_case',{}).get('type')=='harmonic_section'
    expected_by_phase=[complex(float(v['re']),float(v['im'])) for v in fault_phasors]
else:
    expected_by_phase=[expected*complex(math.cos(math.radians(a)),math.sin(math.radians(a))) for a in (0,-120,120)]
for r in regions:
    if r['region']=='main':
        ph='ABC'.index(r['phase'])
        observed=complex(r['I_re_peak_A'],r['I_im_peak_A'])/math.sqrt(2)
        target=expected_by_phase[ph]
        assert abs(observed-target)<=max(10,abs(target)*.01), f'Phase {r["phase"]} current phasor mismatch'
expected=max(abs(v) for v in expected_by_phase)
# Sanity check for total shell current in ideal bonded/isolated modes
shells=[r for r in regions if r['region']=='shell']
if mode=='bonded':
    assert abs(sum(r['I_re_peak_A'] for r in shells))<expected*.02
    assert abs(sum(r['I_im_peak_A'] for r in shells))<expected*.02
else:
    for r in shells:
        assert math.hypot(r['I_re_peak_A'],r['I_im_peak_A'])<expected*.02
# Explicit diagnostics for parallel circuit connection; old jobs may lack file.
circ_path=base/f'circuits_{mode}.csv'
circuit_properties=[]
if circ_path.exists():
    with circ_path.open(newline='',encoding='utf-8-sig') as f:
        circuit_properties=list(csv.DictReader(f))
    expected_names=({'bonded_shells'} if mode=='bonded' else {f'isolated_shell_{i}' for i in range(1,4)})
    expected_names.update({f'phase_{i}' for i in range(1,4)})
    assert {r['circuit'] for r in circuit_properties}==expected_names,'Circuit properties missing'
    for r in circuit_properties:
        for key in ('I_re_peak_A','I_im_peak_A','V_re_V','V_im_V','flux_re','flux_im'):
            r[key]=float(r[key])
            assert math.isfinite(r[key]),'Bad FEMM circuit property: '+key
    for r in circuit_properties:
        if r['circuit'].startswith(('bonded_shells','isolated_shell')):
            shell_total=math.hypot(r['I_re_peak_A'],r['I_im_peak_A'])
            assert shell_total < max(1.0,expected)*0.02,'Unexpected nonzero imposed shell circuit current'
elif job.get('fault_case',{}).get('type')=='harmonic_section' and job.get('require_circuit_diagnostics'):
    raise AssertionError('Shell circuit diagnostics missing')
# FEMM force units N/m for 1 metre planar depth.
forces_file=base/f'forces_{mode}.csv'
forces=[]
if forces_file.exists():
    with forces_file.open(newline='',encoding='utf-8-sig') as f:
        ff=list(csv.DictReader(f))
    assert len(ff)==6, 'Expected force rows for six regions'
    for row in ff:
        item={'region':row['region'],'phase':'ABC'[int(row['phase'])-1]}
        assert item['region'] in ('main','shell')
        base_cols=('Fx_dc_N_per_m','Fy_dc_N_per_m','Fx_2f_re_N_per_m','Fx_2f_im_N_per_m','Fy_2f_re_N_per_m','Fy_2f_im_N_per_m')
        wst_cols=('Fx_wst_dc_N_per_m','Fy_wst_dc_N_per_m','Fx_wst_2f_re_N_per_m','Fx_wst_2f_im_N_per_m','Fy_wst_2f_re_N_per_m','Fy_wst_2f_im_N_per_m')
        if job.get('fault_case') and not all(col in row for col in wst_cols):
            raise AssertionError('New fault calculations require FEMM weighted stress tensor outputs')
        for col in base_cols+wst_cols:
            if col not in row: continue  # Historical results can omit WST
            item[col]=float(row[col])
            assert math.isfinite(item[col]),'Invalid force: '+col
        forces.append(item)
    assert {(x['region'],x['phase']) for x in forces}=={(a,b) for a in ('main','shell') for b in 'ABC'}
elif fault_phasors:
    raise AssertionError('Fault phasor case requires FEMM forces output')
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
result['result']['shell_connection_assumption']=(
    'Ideal shared parallel zero-net-current circuit; same longitudinal voltage, perfect end bonding, no external ground return'
    if mode=='bonded' else
    'Three separate zero-net-current parallel circuits; no longitudinal end connection'
)
if circuit_properties:
    result['result']['circuits']=circuit_properties
if forces:
    result['result']['forces']=forces
    result['result']['force_method']='FEMM planar conductor/shell Lorentz block integral; DC and complex 2f, N/m'
if fault_phasors:
    result['result']['interpretation']='Harmonic section response; not short-circuit transient, peak force or thermal withstand'
output=base/'ipb_result.json'
output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
total=sum(r['P_W_per_m'] for r in regions)
report=f'''# FEMM calculation results

Mode: {mode}
Frequency: {job["electrical"]["frequency_hz"]} Hz
Maximum specified phase current: {expected} A RMS\nPer-phase currents: {[round(abs(v),6) for v in expected_by_phase]} A RMS
Mesh: {job["solver"]["mesh_mm"]} mm
Outer boundary radius: {job["solver"]["outer_radius_mm"]} mm
Total Joule losses: {total:.4f} W/m

Output JSON: ipb_result.json (can be imported into IPB Studio).\nFEMM Lorentz force regions: {len(forces)} (mean and complex 2f, N/m).
Note: Results are from an idealized 2D harmonic model; no validation of actual connectors or transient fault response.
'''
(base/'RESULTS.md').write_text(report,encoding='utf-8')
print(report)
