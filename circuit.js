/*
 * IPB Studio: idealized positive-sequence, three-phase bolted faults.
 * Mathematical circuit engine. No neutral/ground-fault model, no source
 * subtransient dynamics, no direct IEC 60909 compliance.
 * Units: volts (phase RMS phasors), ohms, meters, amperes (RMS).
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root)root.IPBCircuit=api;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function c(re,im=0){return {re,im};}
function add(a,b){return c(a.re+b.re,a.im+b.im);}
function sub(a,b){return c(a.re-b.re,a.im-b.im);}
function mul(a,b){return c(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re);}
function div(a,b){const d=b.re*b.re+b.im*b.im;if(!(d>0))throw Error('Нулевое сопротивление источника или ветви');return c((a.re*b.re+a.im*b.im)/d,(a.im*b.re-a.re*b.im)/d);}
function mag(z){return Math.hypot(z.re,z.im);}
function phase(z){return Math.atan2(z.im,z.re);}
function z(r,x){if(!Number.isFinite(r)||!Number.isFinite(x)||r<0||x<0)throw Error('R и X должны быть конечными неотрицательными величинами');return c(r,x);}
function config(x){
 for(const key of ['voltageLL_kV','length_m','position','rg','xg','rt','xt','r_per_km','x_per_km','tap_r','tap_x']){
   if(!Number.isFinite(x[key]))throw Error('Недопустимый параметр эквивалентной сети: '+key);
 }
 if(x.voltageLL_kV<=0||x.voltageLL_kV>1000)throw Error('Проверьте напряжение источников');
 if(x.length_m<=0||x.length_m>10000||x.position<0||x.position>1)throw Error('Проверьте длину и место повреждения');
 for(const key of ['rg','xg','rt','xt','r_per_km','x_per_km','tap_r','tap_x'])
   if(x[key]<0)throw Error('Отрицательные R или X недопустимы');
 if(mag(z(x.rg,x.xg))===0||mag(z(x.rt,x.xt))===0)throw Error('У источников должны быть ненулевые импедансы');
 return x;
}
function network(x,where){
 config(x);
 if(where!=='main'&&where!=='tap')throw Error('Неизвестная точка повреждения');
 // Symmetric phase voltages. Source phase angles assumed equal; busduct
 // series impedance is included in each contribution to the fault.
 const E=c(x.voltageLL_kV*1000/Math.sqrt(3));
 const pathG=where==='main'?x.position:0.5;
 const pathT=where==='main'?1-x.position:0.5;
 const seriesG=c(x.r_per_km*x.length_m/1000*pathG,x.x_per_km*x.length_m/1000*pathG);
 const seriesT=c(x.r_per_km*x.length_m/1000*pathT,x.x_per_km*x.length_m/1000*pathT);
 const Zg=add(z(x.rg,x.xg),seriesG),Zt=add(z(x.rt,x.xt),seriesT);
 let Ig,It,Ib,V;
 if(where==='main'){
   V=c(0);Ig=div(E,Zg);It=div(E,Zt);Ib=add(Ig,It);
 }else{
   const Ztap=z(x.tap_r,x.tap_x);
   if(mag(Ztap)===0){
     V=c(0);Ig=div(E,Zg);It=div(E,Zt);Ib=add(Ig,It);
   }else{
     const Yg=div(c(1),Zg),Yt=div(c(1),Zt),Yb=div(c(1),Ztap);
     V=div(add(mul(E,Yg),mul(E,Yt)),add(add(Yg,Yt),Yb));
     Ig=div(sub(E,V),Zg);It=div(sub(E,V),Zt);Ib=div(V,Ztap);
   }
 }
 const balance=sub(add(Ig,It),Ib);
 if(mag(balance)>1e-7*Math.max(1,mag(Ib)))throw Error('Невязка баланса токов в узле');
 return {
  where,
  generator:{phasor:Ig,rms_A:mag(Ig),phase_rad:phase(Ig),impedance:Zg},
  grid:{phasor:It,rms_A:mag(It),phase_rad:phase(It),impedance:Zt},
  branch:{phasor:Ib,rms_A:mag(Ib),phase_rad:phase(Ib)},
  node_voltage_V:V,balance_A:mag(balance),
  assumptions:['Трёхфазное металлическое КЗ','Источники симметричны и синфазны','Частота и внутренние ЭДС фиксированы','Комплексные импедансы постоянны']
 };
}
return {network,complex:{add,sub,mul,div,mag,phase}};
});