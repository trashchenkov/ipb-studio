#!/usr/bin/env python3
"""Generate the FEMM 4.2 harmonic three-phase IPB model from an IPB Studio job."""
import argparse, json, math
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument("--job",required=True,type=Path)
p.add_argument("--outdir",required=True,type=Path)
a=p.parse_args()
job=json.loads(a.job.read_text(encoding="utf-8"))
assert job["schema"]=="ipb-femm-job-v1", "Unexpected job schema"
g,e,m,s=(job[k] for k in ("geometry","electrical","materials","solver"))
mode=e["mode"]
assert mode in ("bonded","isolated")
D=float(g["conductor_outer_diameter_mm"]); tc=float(g["conductor_wall_mm"])
Do=float(g["shell_outer_diameter_mm"]); ts=float(g["shell_wall_mm"])
pitch=float(g["phase_pitch_mm"])
r=D/2; ri=r-tc; ro=Do/2; rsi=ro-ts
assert 0<ri<r<rsi<ro and pitch>2*ro, "Invalid geometry"
rho=float(m["rho20_ohm_m"]); alpha=float(m["alpha_per_K"])
assert rho>0 and alpha>=0
temp_c=float(m["conductor_C"]); temp_s=float(m["shell_C"])
sigma_c=1e-6/(rho*(1+alpha*(temp_c-20)))
sigma_s=1e-6/(rho*(1+alpha*(temp_s-20)))
assert sigma_c>0 and sigma_s>0
freq=float(e["frequency_hz"]); rms=float(e["phase_current_rms_A"])
phasors=e.get("fault_phasors_rms_A")
if phasors is not None:
    assert len(phasors)==3 and job.get("fault_case",{}).get("type")=="harmonic_section", "Expected explicit 3 phase fault phasors"
    phase_currents=[]
    for v in phasors:
        assert isinstance(v,dict) and all(math.isfinite(float(v[k])) for k in ("re","im")), "Bad fault phasor"
        phase_currents.append(complex(float(v["re"]),float(v["im"])))
    assert max(abs(i) for i in phase_currents)>0
    assert abs(sum(phase_currents)) < 1e-5*max(abs(i) for i in phase_currents), "Three-wire three-phase current balance required"
else:
    phase_currents=[complex(rms*math.cos(math.radians(ang)),rms*math.sin(math.radians(ang))) for ang in (0,-120,120)]
mesh=float(s["mesh_mm"]); boundary=float(s["outer_radius_mm"])
assert freq>0 and rms>0 and 0<mesh<=10
assert boundary>max(4000,pitch+Do)
def n(x):return format(x,'.12g')
L=[]
def add(x):L.append(x)
add("-- FEMM 4.2: generated from checked IPB Studio job.")
add("-- Currents are PEAK phasors; losses W per metre.")
add("newdocument(0)")
add(f'mi_probdef({n(freq)},"millimeters","planar",1e-8,1000,30)')
add('mi_addmaterial("Air",1,1,0,0,0)')
add(f'mi_addmaterial("Conductor",1,1,0,0,{n(sigma_c)})')
add(f'mi_addmaterial("Shell",1,1,0,0,{n(sigma_s)})')
add('mi_addboundprop("A0",0,0,0,0,0,0,0,0,0)')
for k,cur in enumerate(phase_currents,1):
    peak=cur*math.sqrt(2)
    add(f'mi_addcircprop("phase_{k}",({n(peak.real)}+I*({n(peak.imag)})),1)')
if mode=="bonded":
    add('mi_addcircprop("bonded_shells",0,0)')
else:
    for k in range(1,4):add(f'mi_addcircprop("isolated_shell_{k}",0,0)')
add('function circle(cx,cy,rad,bc)')
add('  local px={cx+rad,cx,cx-rad,cx}; local py={cy,cy+rad,cy,cy-rad}')
add('  for k=1,4 do mi_addnode(px[k],py[k]) end')
add('  for k=1,4 do')
add('    local q=mod(k,4)+1')
add('    mi_addarc(px[k],py[k],px[q],py[q],90,3)')
add('    if bc~="" then')
add('      local angle=(k-0.5)*pi/2')
add('      mi_selectarcsegment(cx+rad*cos(angle),cy+rad*sin(angle))')
add('      mi_setarcsegmentprop(3,bc,0,0)')
add('      mi_clearselected()')
add('    end')
add('  end')
add('end')
add('function label(x,y,material,circuit,group,h)')
add('  mi_addblocklabel(x,y);mi_selectlabel(x,y)')
add('  mi_setblockprop(material,0,h,circuit,0,group,1)')
add('  mi_clearselected()')
add('end')
add(f'circle(0,0,{n(boundary)},"A0")')
air_y=min(3500,boundary-500)
add(f'label(0,{n(air_y)},"Air","<None>",0,250)')
for k,x in enumerate((-pitch,0,pitch),1):
    for radius in (ri,r,rsi,ro):add(f'circle({n(x)},0,{n(radius)},"")')
    add(f'label({n(x)},0,"Air","<None>",0,35)')
    add(f'label({n(x+(ri+r)/2)},0,"Conductor","phase_{k}",{k},{n(mesh)})')
    add(f'label({n(x+(r+rsi)/2)},0,"Air","<None>",0,45)')
    shell_circuit="bonded_shells" if mode=="bonded" else f"isolated_shell_{k}"
    add(f'label({n(x+(rsi+ro)/2)},0,"Shell","{shell_circuit}",{10+k},{n(min(mesh,2))})')
add(f'mi_saveas("case_{mode}.fem")')
add('mi_analyze(1)')
add('mi_loadsolution()')
add(f'local out=openfile("results_{mode}.csv","w")')
add('write(out,"region,phase,I_re_peak_A,I_im_peak_A,P_W_per_m,area_m2\\n")')
add('for k=1,3 do')
add('  mo_clearblock();mo_groupselectblock(k)')
add('  local cur=mo_blockintegral(7);local loss=mo_blockintegral(4);local area=mo_blockintegral(5)')
add('  write(out,format("main,%d,%.10g,%.10g,%.10g,%.10g\\n",k,re(cur),im(cur),re(loss),re(area)))')
add('  mo_clearblock();mo_groupselectblock(k+10)')
add('  cur=mo_blockintegral(7);loss=mo_blockintegral(4);area=mo_blockintegral(5)')
add('  write(out,format("shell,%d,%.10g,%.10g,%.10g,%.10g\\n",k,re(cur),im(cur),re(loss),re(area)))')
add('end')
add('closefile(out)')
# Lorentz force integrals from FEMM 4.2: 11/12 = steady (time average);
# 13/14 = complex 2*f component. 2D depth=1000 mm, so N/m.
add(f'local force=openfile("forces_{mode}.csv","w")')
add('write(force,"region,phase,Fx_dc_N_per_m,Fy_dc_N_per_m,Fx_2f_re_N_per_m,Fx_2f_im_N_per_m,Fy_2f_re_N_per_m,Fy_2f_im_N_per_m,Fx_wst_dc_N_per_m,Fy_wst_dc_N_per_m,Fx_wst_2f_re_N_per_m,Fx_wst_2f_im_N_per_m,Fy_wst_2f_re_N_per_m,Fy_wst_2f_im_N_per_m\\n")')
add('for typ=1,2 do')
add('  for k=1,3 do')
add('    local group=k;if typ==2 then group=k+10 end')
add('    mo_clearblock();mo_groupselectblock(group)')
add('    local fx=mo_blockintegral(11);local fy=mo_blockintegral(12)')
add('    local fx2=mo_blockintegral(13);local fy2=mo_blockintegral(14)')
add('    local wfx=mo_blockintegral(18);local wfy=mo_blockintegral(19)')
add('    local wfx2=mo_blockintegral(20);local wfy2=mo_blockintegral(21)')
add('    local region="main";if typ==2 then region="shell" end')
add('    write(force,format("%s,%d,%.10g,%.10g,%.10g,%.10g,%.10g,%.10g,%.10g,%.10g,%.10g,%.10g,%.10g,%.10g\\n",region,k,re(fx),re(fy),re(fx2),im(fx2),re(fy2),im(fy2),re(wfx),re(wfy),re(wfx2),im(wfx2),re(wfy2),im(wfy2)))')
add('  end')
add('end')
add('closefile(force)')
half_x=max(3500,pitch+ro+250);half_y=max(1750,ro+800)
add(f'local fld=openfile("field_{mode}.csv","w")')
add('write(fld,"x_mm,y_mm,Bx_re_T,Bx_im_T,By_re_T,By_im_T\\n")')
add('for iy=0,60 do')
add('  for ix=0,120 do')
add(f'    local xx=-{n(half_x)}+ix*{n(2*half_x)}/120')
add(f'    local yy=-{n(half_y)}+iy*{n(2*half_y)}/60')
add('    local A,Bx,By=mo_getpointvalues(xx,yy)')
add('    write(fld,format("%.8g,%.8g,%.10g,%.10g,%.10g,%.10g\\n",xx,yy,re(Bx),im(Bx),re(By),im(By)))')
add('  end')
add('end')
add('closefile(fld)')
add('mo_close()')
add('quit()')
a.outdir.mkdir(parents=True,exist_ok=True)
(a.outdir/f"case_{mode}.lua").write_text("\n".join(L)+"\n",encoding="utf-8")
(a.outdir/"job.json").write_text(json.dumps(job,ensure_ascii=False,indent=2),encoding="utf-8")
print(f"Prepared {a.outdir / ('case_'+mode+'.lua')}")
