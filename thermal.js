/*
 * Coaxial conductor/enclosure steady thermal balance, 1 metre of busduct.
 * Losses are fixed inputs from a separately performed FEMM harmonic solve.
 * No temperature-resistivity feedback; no axial conduction, supports,
 * gas-flow simulation, interaction between adjacent enclosures or contacts.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.IPBThermal=api;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const SB=5.670374419e-8;
const K0=273.15;
function boundedRoot(fun,low,high){
 let fa=fun(low),fb=fun(high);
 if(!Number.isFinite(fa)||!Number.isFinite(fb)||fa>1e-8||fb<0)throw Error('Не найдено физически допустимое стационарное решение в выбранном температурном диапазоне (до 600 °C)');
 for(let i=0;i<100;i++){
   const mid=(low+high)/2,fm=fun(mid);
   if(!Number.isFinite(fm))throw Error('Невычислимая тепловая мощность');
   if(fm>0)high=mid;else low=mid;
 }
 return (high+low)/2;
}
function solve(x){
 const keys=['P_conductor_W_per_m','P_shell_W_per_m','conductor_d_mm','shell_d_mm','shell_wall_mm',
 'ambient_C','h_gap_W_m2K','h_out_W_m2K','eps_conductor','eps_shell'];
 for(const name of keys){if(!Number.isFinite(x[name]))throw Error('Некорректный тепловой параметр '+name);}
 const Pc=x.P_conductor_W_per_m,Ps=x.P_shell_W_per_m;
 if(Pc<0||Ps<0)throw Error('Потери не могут быть отрицательными');
 const rc=x.conductor_d_mm/2000,rs=x.shell_d_mm/2000,rsi=rs-x.shell_wall_mm/1000;
 if(!(rc>0&&rc<rsi&&rsi<rs))throw Error('Неверная геометрия коаксиального зазора');
 const Tamb=x.ambient_C;
 if(Tamb<=-K0||Tamb>=200)throw Error('Неверная температура окружающей среды');
 if(x.h_gap_W_m2K<=0||x.h_out_W_m2K<=0)throw Error('Коэффициенты теплоотдачи должны быть положительными');
 const ec=x.eps_conductor,es=x.eps_shell;
 if(!(ec>0&&ec<=1&&es>0&&es<=1))throw Error('Излучательная способность должна быть в (0,1]');
 const perimeterC=2*Math.PI*rc,perimeterS=2*Math.PI*rs;
 const radiationDenominator=1/ec+(rc/rsi)*(1/es-1);
 function outward(Ts){
  const ts=Ts+K0,ta=Tamb+K0;
  return perimeterS*(x.h_out_W_m2K*(Ts-Tamb)+es*SB*(ts**4-ta**4));
 }
 const T_shell=boundedRoot(Ts=>outward(Ts)-Pc-Ps,Tamb,600);
 function transfer(Tc){
  return perimeterC*(x.h_gap_W_m2K*(Tc-T_shell)+SB*((Tc+K0)**4-(T_shell+K0)**4)/radiationDenominator);
 }
 const T_conductor=boundedRoot(Tc=>transfer(Tc)-Pc,T_shell,600);
 const q_gap=transfer(T_conductor),q_out=outward(T_shell);
 const limit=Math.max(T_conductor,T_shell);
 return {T_conductor_C:T_conductor,T_shell_C:T_shell,T_ambient_C:Tamb,
  conductor_rise_K:T_conductor-Tamb,shell_rise_K:T_shell-Tamb,
  gap_transfer_W_per_m:q_gap,outer_transfer_W_per_m:q_out,
  conductor_energy_residual_W_per_m:Pc-q_gap,
  shell_energy_residual_W_per_m:Ps+q_gap-q_out,
  validity:limit>200?'HIGH_TEMPERATURE_EXTRAPOLATION':'ILLUSTRATIVE',
  model:'2-node steady coaxial convection+radiation; constant losses; independent phases',
  notes:'The h coefficients, emissivities and FEMM assumed temperatures are not iteratively coupled.'};
}
return {solve};
});
