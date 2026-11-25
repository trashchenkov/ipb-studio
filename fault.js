(function(){
'use strict';
const get=id=>document.getElementById(id),root=get('faultModule');
if(!root)return;
root.innerHTML=[
'<h3>Короткие замыкания: предварительные оценки</h3>',
'<p class="note"><strong>Не FEMM и не проверка стойкости.</strong> Задайте ток повреждения и его длительность. Здесь рассчитываются приближённые силы между тремя прямолинейными проводниками и адиабатический нагрев металла проводников. Токи оболочек и замыкания на землю не моделируются.</p>',
'<div class="grid2"><div>',
'<label class="field">Вид КЗ<select id="scType"><option value="ABC">Трёхфазное ABC</option><option value="AB">Двухфазное AB</option><option value="BC">Двухфазное BC</option><option value="CA">Двухфазное CA</option><option disabled>Однофазное на землю — требуется схема нейтрали</option><option disabled>Двухфазное на землю — требуется схема возврата тока</option><option disabled>Пробой на оболочку — требуется локальная модель</option></select></label>',
'<label class="field">Действующее значение периодической составляющей тока КЗ, кА<input id="scRms" type="number" min="1" max="500" value="120" step="1"></label>',
'<label class="field">X/R эквивалентной цепи<input id="scXR" type="number" min="0.1" max="100" value="10" step="0.1"></label>',
'<label class="field">Начальный угол периодической составляющей, градусы<input id="scAngle" type="number" min="-360" max="360" value="0" step="5"></label>',
'<label class="field">Длительность КЗ, с<input id="scDuration" type="number" min="0.01" max="3" value="0.2" step="0.01"></label>',
'<button class="primary" id="scCalculate">Рассчитать оценочные величины</button></div><div>',
'<div id="scStatus" role="status" aria-live="polite" class="statusline">Выберите вид КЗ и нажмите «Рассчитать».</div>',
'<p class="note">Временная форма тока задаётся как i(t)=√2I[sin(ωt+φ)−sin(φ)exp(−t/τ)], τ=(X/R)/ω. В двухфазном режиме повреждённые фазы несут противоположные токи, третья — нулевой ток. Это заданный токовый сценарий, а не расчёт электрической сети.</p>',
'</div></div>',
'<div class="grid3" id="scMetrics"></div><div id="scTable"></div>',
'<canvas id="scPlot" width="1100" height="360" style="width:100%;background:#102637;border-radius:9px;border:1px solid #38536a;margin-top:12px"></canvas>',
'<p class="note">Fₓ/L=(μ₀/2π)Σⱼ iᵢiⱼ/(xⱼ−xᵢ) при μ₀/(2π)=2·10⁻⁷ Н/А². Нагрев: dT/dt=i²ρ(T)/(ρₘcₚA²), ρₘ=2700 кг/м³, cₚ=900 Дж/(кг·К), A — площадь алюминиевой стенки проводника. Skin/proximity-эффект, токи оболочек, распределённые электродинамические напряжения, нагрев оболочек, теплообмен, затухание переменной составляющей от генератора и нагрузки на опоры не учтены.</p>'
].join('');
function num(id){const v=Number(get(id).value);if(!Number.isFinite(v))throw Error('Некорректное число: '+id);return v;}
function current(t,ang,I,w,tau){return Math.SQRT2*I*(Math.sin(w*t+ang)-Math.sin(ang)*Math.exp(-t/tau));}
function fmt(x,d=2){return x.toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});}
function solve(){
 const typ=get('scType').value,I=num('scRms')*1000,xr=num('scXR'),dur=num('scDuration'),phi=num('scAngle')*Math.PI/180;
 const freq=num('freq'),pitch=num('mPitch')/1000,ro=num('mCondD')/2000,ri=ro-num('mCondT')/1000;
 const rho=num('rho'),alpha=num('alphaT'),T0=num('tCond');
 if(!(I>0&&I<=500000&&xr>0&&xr<=100&&dur>=.01&&dur<=3&&freq>0&&freq<=1000&&pitch>0&&ri>0&&rho>0&&alpha>=0))throw Error('Проверьте введённые параметры и геометрию');
 const area=Math.PI*(ro*ro-ri*ri),w=2*Math.PI*freq,tau=xr/w,xyz=[-pitch,0,pitch];
 const N=Math.ceil(Math.max(dur*freq*250,dur*4000));
 if(N>400000)throw Error('Превышено допустимое число временных шагов');
 const dt=dur/N,temp=[T0,T0,T0],maxF=[0,0,0],maxI=[0,0,0],energy=[0,0,0],samples=[];
 function at(t){
   if(typ==='ABC')return [current(t,phi,I,w,tau),current(t,phi-2*Math.PI/3,I,w,tau),current(t,phi+2*Math.PI/3,I,w,tau)];
   const pair={AB:[0,1],BC:[1,2],CA:[2,0]}[typ],out=[0,0,0],a=current(t,phi,I,w,tau);
   out[pair[0]]=a;out[pair[1]]=-a;return out;
 }
 let prev=at(0);
 for(let n=0;n<=N;n++){
   const t=n*dt,amps=n===0?prev:at(t);
   const force=amps.map((a,k)=>amps.reduce((sum,b,j)=>sum+(k===j?0:2e-7*a*b/(xyz[j]-xyz[k])),0));
   for(let k=0;k<3;k++){
     maxI[k]=Math.max(maxI[k],Math.abs(amps[k]));maxF[k]=Math.max(maxF[k],Math.abs(force[k]));
     if(n>0){
       const i2=(prev[k]*prev[k]+amps[k]*amps[k])/2;
       energy[k]+=i2*dt;
       const rt=rho*(1+alpha*(temp[k]-20));
       if(rt<=0)throw Error('Некорректное сопротивление при текущей температуре');
       temp[k]+=i2*rt*dt/(2700*900*area*area);
     }
   }
   if(n%Math.max(1,Math.ceil(N/450))===0||n===N)samples.push({t,force});
   prev=amps;
 }
 return {typ,I,xr,dur,phi,area,temp,maxF,maxI,energy,samples,tau,T0};
}
function plot(data){
 const cv=get('scPlot'),ctx=cv.getContext('2d'),W=cv.width,H=cv.height;
 ctx.fillStyle='#102637';ctx.fillRect(0,0,W,H);
 const l=68,r=20,t=35,b=43,pw=W-l-r,ph=H-t-b;
 const amp=Math.max(1,...data.maxF),cols=['#e4b55f','#76c09a','#8db5d8'];
 ctx.font='13px system-ui';ctx.textAlign='right';
 for(let tick=-2;tick<=2;tick++){const y=t+ph*(2-tick)/4;ctx.strokeStyle='#3a5770';ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(W-r,y);ctx.stroke();ctx.fillStyle='#c5d8e5';ctx.fillText(fmt(tick*amp/2/1000,1),l-8,y+4);}
 for(let k=0;k<3;k++){ctx.strokeStyle=cols[k];ctx.lineWidth=2;ctx.beginPath();data.samples.forEach((p,n)=>{const x=l+p.t/data.dur*pw,y=t+ph*(.5-p.force[k]/(2*amp));if(n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();}
 ctx.fillStyle='#c5d8e5';ctx.textAlign='left';ctx.fillText('Погонная сила, кН/м',12,20);
 for(let k=0;k<3;k++){ctx.fillStyle=cols[k];ctx.fillText('Фаза '+['A','B','C'][k],W-285+90*k,20);}
 ctx.fillStyle='#c5d8e5';ctx.textAlign='center';ctx.fillText('Время, с',W/2,H-6);
 for(let k=0;k<=5;k++)ctx.fillText(fmt(data.dur*k/5,2),l+pw*k/5,H-22);
}
function render(d){
 const maxForce=Math.max(...d.maxF),maxT=Math.max(...d.temp);
 get('scStatus').textContent='Оценка завершена: '+d.typ+'; '+fmt(d.I/1000,1)+' кА RMS; X/R='+fmt(d.xr,1)+'; τ='+fmt(d.tau*1000,2)+' мс; длительность '+fmt(d.dur,3)+' с. Результаты не получены в FEMM.';
 get('scMetrics').innerHTML=[['Максимальная сила',fmt(maxForce/1000,2)+' кН/м'],['Пиковый модуль тока',fmt(Math.max(...d.maxI)/1000,2)+' кА'],['Максимальный нагрев',fmt(maxT-d.T0,3)+' K']].map(p=>'<div class="metric"><small>'+p[0]+'</small><strong>'+p[1]+'</strong></div>').join('');
 let h='<table class="table"><thead><tr><th>Фаза</th><th>max |i|, кА</th><th>max |Fₓ|, кН/м</th><th>∫i²dt, МА²·с</th><th>T конечная, °C</th></tr></thead><tbody>';
 for(let k=0;k<3;k++)h+='<tr><td>'+['A','B','C'][k]+'</td><td>'+fmt(d.maxI[k]/1000,2)+'</td><td>'+fmt(d.maxF[k]/1000,3)+'</td><td>'+fmt(d.energy[k]/1e12,6)+'</td><td>'+fmt(d.temp[k],3)+'</td></tr>';
 get('scTable').innerHTML=h+'</tbody></table>';plot(d);
}
get('scCalculate').onclick=()=>{try{render(solve());}catch(e){get('scStatus').textContent='Ошибка постановки: '+e.message;}};
get('scCalculate').click();
})();