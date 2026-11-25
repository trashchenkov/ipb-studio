#!/usr/bin/env python3
"""Run matrix preparation and postprocess for IPB FEMM force mesh study.

Fixed research case: AB short-circuit *harmonic section* at 20 kA rms each,
one phase zero, 50 Hz; no short-circuit transient.
Modes: isolated/bonded. Mesh prescriptions: 4, 2, 1 mm.
WST and Lorentz force block integrals compared, not assumed equivalent.
"""
from __future__ import annotations
import argparse,csv,json,math,subprocess,sys
from pathlib import Path

MESHES=(4.0,2.0,1.0)
MODES=('bonded','isolated')
CASE_ID='ab_20ka_ac'
def paths(root):
    for mode in MODES:
        for mesh in MESHES:
            key=f'{CASE_ID}_{mode}_h{int(mesh)}'
            yield key,root/key,mode,mesh
def prep(root:Path):
    base=json.loads(Path('femm/example_job.json').read_text(encoding='utf-8'))
    for key,path,mode,mesh in paths(root):
        path.mkdir(parents=True,exist_ok=True)
        job=json.loads(json.dumps(base))
        job['electrical'].update(
            mode=mode,phase_current_rms_A=20000,
            fault_phasors_rms_A=[dict(re=20000,im=0),dict(re=-20000,im=0),dict(re=0,im=0)])
        job['solver']['mesh_mm']=mesh
        job['fault_case']={
            'type':'harmonic_section','scenario':'test',
            'section':'AB_test','series':CASE_ID,
            'purpose':'mesh convergence and enclosure connectivity comparison',
            'note':'AC steady-state only; no short-circuit transient'}
        source=path/'source.json'
        source.write_text(json.dumps(job,indent=2),encoding='utf-8')
        subprocess.run([sys.executable,'femm/generate.py','--job',str(source),'--outdir',str(path)],check=True)
        print(key,flush=True)
def summary(root:Path):
    results=[]
    for key,path,mode,mesh in paths(root):
        subprocess.run([sys.executable,'femm/process.py','--dir',str(path)],check=True)
        obj=json.loads((path/'ipb_result.json').read_text(encoding='utf-8'))
        reg=obj['result']['regions'];forces=obj['result']['forces']
        if len(forces)!=6:raise ValueError('Unexpected number of FEMM force groups')
        row={'case':key,'mesh_mm':mesh,'mode':mode,
             'loss_conductor_W_per_m':sum(x['P_W_per_m'] for x in reg if x['region']=='main'),
             'loss_shell_W_per_m':sum(x['P_W_per_m'] for x in reg if x['region']=='shell')}
        row['loss_total_W_per_m']=row['loss_conductor_W_per_m']+row['loss_shell_W_per_m']
        def vec(row,prefix):
            return (row[prefix+'x'],row[prefix+'y'])
        for kind in ('main','shell'):
            for phase in 'ABC':
                record=next(x for x in forces if x['region']==kind and x['phase']==phase)
                for method in ('lorentz','wst'):
                    stem='' if method=='lorentz' else '_wst'
                    for axis in ('Fx','Fy'):
                        for c in ('dc','2f_re','2f_im'):
                            col=axis+stem+'_'+c+'_N_per_m'
                            if col not in record:raise ValueError(f'WST unavailable {col} in {key}')
                            row[f'{kind}_{phase}_{method}_{axis}_{c}']=record[col]
        # Check net conductor and net conductor + shell forces for gross errors.
        for method in ('lorentz','wst'):
            for axis in ('Fx','Fy'):
                col=axis+('' if method=='lorentz' else '_wst')+'_dc_N_per_m'
                row[f'{method}_{axis}_sum_all_N_per_m']=sum(f[col] for f in forces)
        results.append(row)
    output=root/'comparison.json'
    # Compare within each shell connectivity, using the finest result as reference.
    for row in results:
        ref=next(x for x in results if x['mode']==row['mode'] and x['mesh_mm']==min(MESHES))
        row['loss_error_percent_vs_finest']=100*(row['loss_total_W_per_m']/ref['loss_total_W_per_m']-1)
        for method in ('lorentz','wst'):
            for group in ('main_A','main_B','main_C','shell_A','shell_B','shell_C'):
                comp=f'{group}_{method}_Fx_dc'
                rr=row[comp]; reference=ref[comp]
                row[f'{comp}_difference_N_per_m_vs_finest']=rr-reference
    summary={'schema':'ipb-femm-convergence-v1','description':'AB 20 kA RMS AC harmonic section; peak transient forces NOT measured','results':results}
    output.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    lines=['# FEMM AC force convergence: AB 20 kA','',
           'Steady-state harmonic AC, not fault transient. Mesh in metal 4/2/1 mm.',
           'Force DC = time-average; 2f is an oscillating complex component. Both Lorentz and WST saved.',
           '',
           '| Shell topology | Mesh, mm | Main loss, W/m | Shell loss, W/m | Total, W/m | Δ total vs h=1 | Main A Fx (Lorentz), N/m | Main A Fx (WST), N/m |',
           '|---|---:|---:|---:|---:|---:|---:|---:|']
    for row in results:
        lines.append('| '+ ' | '.join([
            row['mode'],f"{row['mesh_mm']:.0f}",
            f"{row['loss_conductor_W_per_m']:.4f}",
            f"{row['loss_shell_W_per_m']:.4f}",
            f"{row['loss_total_W_per_m']:.4f}",
            f"{row['loss_error_percent_vs_finest']:+.2f}%",
            f"{row['main_A_lorentz_Fx_dc']:.5g}",
            f"{row['main_A_wst_Fx_dc']:.5g}"
        ])+' |')
    lines+=['','Methodological limitations:','- Need independent validation of conductor and enclosure connection model.',
            '- Magnetic force for real switching fault requires time-domain currents and conductor/structural constraints.',
            '- WST vs Lorentz force differences need inspection before reporting design conclusions.',
            '- Thermal model not included in these harmonic experiments.']
    (root/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    with (root/'summary.csv').open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=results[0].keys());writer.writeheader();writer.writerows(results)
    print(('\n'.join(lines)).encode('ascii','backslashreplace').decode('ascii'),flush=True)
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('task',choices=('prepare','summarize'))
    ap.add_argument('--root',type=Path,default=Path('convergence_out'))
    a=ap.parse_args()
    if a.task=='prepare':prep(a.root)
    else:summary(a.root)
if __name__=='__main__':main()
