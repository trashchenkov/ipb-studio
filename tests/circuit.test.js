const test=require('node:test');
const assert=require('node:assert/strict');
const {network,complex}=require('../circuit.js');
const C={voltageLL_kV:Math.sqrt(3)/1000,length_m:8,position:.5,
  rg:1,xg:0,rt:1,xt:0,r_per_km:0,x_per_km:0,tap_r:1,tap_x:0};
function near(actual,expected,tol=1e-9){assert.ok(Math.abs(actual-expected)<tol,actual+' != '+expected)}
test('main bus: source contributions flow on opposite sides; not 2 A everywhere',()=>{
 const p=network(C,'main');
 near(p.generator.rms_A,1);near(p.grid.rms_A,1);
 near(p.branch.rms_A,2);near(p.balance_A,0);
});
test('tap: solve common branch and conserve complex current',()=>{
 const p=network(C,'tap');
 near(p.generator.rms_A,1/3);
 near(p.grid.rms_A,1/3);
 near(p.branch.rms_A,2/3);
 near(p.node_voltage_V.re,2/3);near(p.balance_A,0);
});
test('complex phasors add before magnitude: opposite reactances can cancel',()=>{
 const p=network({...C,rg:1,xg:0,rt:0,xt:1,tap_r:0,tap_x:0},'tap');
 near(p.generator.rms_A,1);
 near(p.grid.rms_A,1);
 near(p.branch.rms_A,Math.sqrt(2));
 assert.ok(p.branch.rms_A< p.generator.rms_A+p.grid.rms_A);
});
test('fault location changes series impedance for each side',()=>{
 const q={...C,r_per_km:1000};
 const nearG=network({...q,position:0.1},'main');
 const farG=network({...q,position:0.9},'main');
 assert.ok(nearG.generator.rms_A>farG.generator.rms_A);
 assert.ok(nearG.grid.rms_A<farG.grid.rms_A);
});
test('the common tap impedance limits branch RMS current',()=>{
 const zero=network({...C,tap_r:0},'tap');
 const limited=network(C,'tap');
 assert.ok(limited.branch.rms_A<zero.branch.rms_A);
 near(zero.branch.rms_A,2);
});
test('invalid source, negative impedances and zero voltage reject',()=>{
 assert.throws(()=>network({...C,rg:0,xg:0},'main'));
 assert.throws(()=>network({...C,tap_r:-0.5},'tap'));
 assert.throws(()=>network({...C,voltageLL_kV:0},'main'));
});
