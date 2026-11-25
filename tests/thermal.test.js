const test=require('node:test');
const assert=require('node:assert/strict');
const {solve}=require('../thermal.js');
const example={P_conductor_W_per_m:500,P_shell_W_per_m:470,
conductor_d_mm:951.5,shell_d_mm:1498.6,shell_wall_mm:6.86,
ambient_C:25,h_gap_W_m2K:5,h_out_W_m2K:10,
eps_conductor:.3,eps_shell:.5};
function approx(a,b,tol=1e-6){assert.ok(Math.abs(a-b)<tol, String(a)+' vs '+String(b));}
test('thermal balances both nodes independently',()=>{
 const r=solve(example);
 approx(r.gap_transfer_W_per_m,example.P_conductor_W_per_m);
 approx(r.outer_transfer_W_per_m,example.P_conductor_W_per_m+example.P_shell_W_per_m);
 approx(r.conductor_energy_residual_W_per_m,0);
 approx(r.shell_energy_residual_W_per_m,0);
 assert.ok(r.T_conductor_C>r.T_shell_C&&r.T_shell_C>example.ambient_C);
});
test('zero losses produce ambient temperatures',()=>{
 const r=solve({...example,P_conductor_W_per_m:0,P_shell_W_per_m:0});
 approx(r.T_conductor_C,25);approx(r.T_shell_C,25);
});
test('higher external convection lowers both temperatures',()=>{
 const lo=solve({...example,h_out_W_m2K:5});
 const hi=solve({...example,h_out_W_m2K:30});
 assert.ok(hi.T_shell_C<lo.T_shell_C);
 assert.ok(hi.T_conductor_C<lo.T_conductor_C);
});
test('higher gap convection lowers conductor but not shell at fixed total loss',()=>{
 const lo=solve({...example,h_gap_W_m2K:2});
 const hi=solve({...example,h_gap_W_m2K:20});
 assert.ok(hi.T_conductor_C<lo.T_conductor_C);
 approx(lo.T_shell_C,hi.T_shell_C);
});
test('higher emissivity on external shell improves cooling',()=>{
 const lo=solve({...example,eps_shell:.15});
 const hi=solve({...example,eps_shell:.8});
 assert.ok(hi.T_shell_C<lo.T_shell_C);
});
test('reject invalid geometry or negative losses',()=>{
 assert.throws(()=>solve({...example,shell_d_mm:950}));
 assert.throws(()=>solve({...example,P_shell_W_per_m:-10}));
 assert.throws(()=>solve({...example,h_out_W_m2K:0}));
});

test('distinct inner and outer shell emissivity affect different heat paths',()=>{
 const base=solve({...example,eps_shell:.65,eps_shell_inner:.2});
 const inner=solve({...example,eps_shell:.65,eps_shell_inner:.9});
 assert.ok(inner.T_conductor_C<base.T_conductor_C);
 approx(inner.T_shell_C,base.T_shell_C);
 const outer=solve({...example,eps_shell:.95,eps_shell_inner:.2});
 assert.ok(outer.T_shell_C<base.T_shell_C);
 assert.ok(outer.T_conductor_C<base.T_conductor_C);
});
test('legacy shell emissivity applies to both faces if inner is omitted',()=>{
 const legacy=solve(example);
 const explicit=solve({...example,eps_shell_inner:example.eps_shell});
 approx(legacy.T_conductor_C,explicit.T_conductor_C);
 approx(legacy.T_shell_C,explicit.T_shell_C);
});
test('reject invalid inner shell emissivity',()=>{
 for(const value of [0,-.2,1.1,NaN,Infinity,'0.7']){
   assert.throws(()=>solve({...example,eps_shell_inner:value}));
 }
});
