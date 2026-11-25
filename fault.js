/* IPB Studio: Agrawal-based SHORT CIRCUIT TOPOLOGIES.
   Source: K.C. Agrawal, Industrial Power Engineering and Applications Handbook,
   §32.3.5 short-circuit withstand test and §13.4.1(5), Example 13.3.
   The mechanical/thermal predictions below are expressly an idealized
   line-current and adiabatic-metal estimate, NOT IEC verification or FEMM. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const root=$('faultModule'); if(!root)return;
const NAMES={test:'Испытание участка · §32.3.5',main:'КЗ на главном токопроводе · §13.4.1(5)',tap:'КЗ на ответвлении UAT · пример 13.3'};
root.innerHTML=[
'<h3>Короткое замыкание: где находится повреждение?</h3>',
'<p class="note">Сначала выберите <strong>схему и место КЗ</strong>. Только после этого можно интерпретировать токи и нагрузки на отдельные отрезки токопровода. Постановки основаны на Агравале; оценочные формулы сил и нагрева реализованы отдельно от FEMM.</p>',
'<label class="field">Постановка<select id="scScenario">',
'<option value="test">Испытание: КЗ на конце прямого участка (§32.3.5)</option>',
'<option value="main">Повреждение на главном токопроводе G—GT (§13.4.1(5))</option>',
'<option value="tap">Повреждение на ответвлении к UAT (пример 13.3)</option>',
'</select></label>',
'<svg id="scScheme" viewBox="0 0 760 196" role="img" aria-label="Схема расположения короткого замыкания" style="width:100%;height:auto;display:block;background:#112838;border-radius:10px;border:1px solid #426279;margin:12px 0"></svg>',
'<div id="scExplain" class="note" style="line-height:1.65;margin:10px 0"></div>',
'<div id="scNetworkPanel" class="card" style="margin-top:12px"></div>',
'<div class="grid2"><div>',
'<div id="scCaseFields"></div>',
'<label class="field">Продолжительность воздействия, с<input id="scDuration" type="number" min="0.01" max="3" step="0.01" value="1"></label>',
'<label class="field">Модель X/R для <em>условной</em> временной формы тока<input id="scXR" type="number" min="0.1" max="100" step="0.1" value="10"></label>',
'<label class="field">Угол начального момента, градусы<input id="scAngle" type="number" min="-360" max="360" step="5" value="0"></label>',
'<button id="scCalculate" class="primary" type="button">Рассчитать воздействие для выбранной схемы</button>',
'</div><div><div id="scStatus" class="statusline" role="status" aria-live="polite"></div>',
'<p class="note">Сначала устанавливается ток в <strong>каждом сечении</strong>. Затем условная временная зависимость используется для оценки погонных сил и кратковременного нагрева. Вклад двух источников <strong>нельзя автоматически складывать на главном токопроводе</strong>. Начальный угол и X/R здесь не взяты из книги, а заданы пользователем.</p>',
'</div></div>',
'<div class="grid3" id="scMetrics"></div>',
'<div id="scTable"></div>',
'<canvas id="scPlot" width="1100" height="370" style="width:100%;height:auto;display:block;background:#102637;border:1px solid #41617c;border-radius:9px;margin:14px 0"></canvas>',
'<div class="note" style="line-height:1.7"><strong>Границы достоверности.</strong> Силы: приближение параллельных бесконечных токовых нитей по осям фаз, μ₀/(2π)=2×10⁻⁷ Н/А². Нагрев: адиабатическая модель алюминиевого проводника, dT/dt=i²ρ(T)/(ρₘcₚA²), ρₘ=2700 кг/м³, cₚ=900 Дж/(кг·К). Используются текущие размеры и ρ(T) из параметров IPB Studio. Не учтены распределение токов внутри стенок, токи и силы оболочек, теплообмен, опоры, арматура, длина повреждённого участка, реальное затухание токов генератора и дуга. <strong>Это не проверка стойкости и не расчёт КЗ по IEC 60909.</strong> Для замыканий на землю необходимы нейтраль источника и пути тока через оболочки и заземление.</div>'
].join('');

/* Positive-sequence three-phase short-circuit network (not IEC 60909). */
const netPanel=$('scNetworkPanel');
netPanel.innerHTML=[
 '<h3>Откуда берутся токи КЗ?</h3>',
 '<label class="field">Способ задания тока<select id="scNetworkMode"><option value="manual">По исходным данным примера (61 и 40 кА)</option><option value="network">Вычислить из эквивалентной схемы R + jX</option></select></label>',
 '<div id="scNetworkInputs" style="display:none">',
 '<p class="note">Только симметричное трёхфазное металлическое КЗ. Два источника считаются синфазными с одинаковыми действующими фазными ЭДС Uл/√3. Сопротивления заданы в Омах на фазу, вдоль токопровода — в Ом/км. Это <strong>новая условная модель</strong>, не набор параметров из книги.</p>',
 '<label class="field">Линейное напряжение источников, кВ<input type="number" id="scNetU" value="16.5" min="0.1" max="1000" step="0.1"></label>',
 '<div class="twoCol"><label class="field">Генератор: R, Ом<input id="scNetRg" type="number" value="0.0155" min="0" step="0.0001"></label><label class="field">Генератор: X, Ом<input id="scNetXg" type="number" value="0.155" min="0" step="0.0001"></label></div>',
 '<div class="twoCol"><label class="field">Со стороны сети через GT: R, Ом<input id="scNetRt" type="number" value="0.0238" min="0" step="0.0001"></label><label class="field">Со стороны сети через GT: X, Ом<input id="scNetXt" type="number" value="0.238" min="0" step="0.0001"></label></div>',
 '<div class="twoCol"><label class="field">Длина главного токопровода, м<input id="scNetLength" type="number" value="8" min="0.1" max="10000" step="1"></label><label class="field">Погонное R, Ом/км<input id="scNetRLine" type="number" value="0.03" min="0" step="0.001"></label></div>',
 '<label class="field">Погонное X, Ом/км<input id="scNetXLine" type="number" value="0.08" min="0" step="0.001"></label>',
 '<div id="scNetTapFields"><div class="twoCol"><label class="field">Ответвление UAT: R, Ом<input id="scNetTapR" type="number" value="0.001" min="0" step="0.001"></label><label class="field">Ответвление UAT: X, Ом<input id="scNetTapX" type="number" value="0.003" min="0" step="0.001"></label></div><p class="note">Ответвление описывается только электрическим импедансом. Для сил и нагрева его отдельная геометрия по-прежнему неизвестна.</p></div>',
 '<p class="note">Модель однополярной симметричной схемы: для КЗ на главной линии каждый источник питаёт место повреждения по своему участку; для КЗ на UAT в общей точке присоединения решается узловое уравнение. Фазные сдвиги токов учитываются при суммировании в ответвлении. Сопротивления могут не соответствовать реальному генератору или трансформатору.</p>',
 '</div><div id="scNetworkOutput" class="statusline" role="status" aria-live="polite">Пока используются значения из примера Агравала.</div>'
].join('');
function netFields(){
 const mode=$('scNetworkMode').value,scenario=$('scScenario').value;
 netPanel.style.display=scenario==='test'?'none':'block';
 $('scNetworkInputs').style.display=mode==='network'&&scenario!=='test'?'block':'none';
 $('scNetTapFields').style.display=scenario==='tap'?'block':'none';
 for(const k of ['scIG','scIT']){const el=$(k);if(el)el.disabled=mode==='network';}
 $('scNetworkOutput').textContent=mode==='network'?'Выбрана схема R + jX. Нажмите «Рассчитать воздействие», чтобы получить токи и оценки усилий.':'Токи задаются в полях исходного примера (61 и 40 кА).';
}
$('scNetworkMode').onchange=netFields;
function networkSettings(which){
 const model={
 voltageLL_kV:number('scNetU'),length_m:number('scNetLength'),
 position:which==='main'?number('scPosition')/100:0.5,
 rg:number('scNetRg'),xg:number('scNetXg'),rt:number('scNetRt'),xt:number('scNetXt'),
 r_per_km:number('scNetRLine'),x_per_km:number('scNetXLine'),
 tap_r:number('scNetTapR'),tap_x:number('scNetTapX')
 };
 if(!globalThis.IPBCircuit)throw Error('Не загружен модуль circuit.js; обновите страницу');
 return globalThis.IPBCircuit.network(model,which);
}
function dynamicParameters(base,contribution){
 const z=contribution.impedance;
 const xr=z.re>1e-10?z.im/z.re:100;
 return {...base,xr:Math.max(0.1,Math.min(100,xr)),angle:base.angle+contribution.phase_rad};
}

const SVG='http://www.w3.org/2000/svg';
const text=(x,y,s,col='#d9eaf5',size=14)=>'<text x="'+x+'" y="'+y+'" fill="'+col+'" font-size="'+size+'" text-anchor="middle">'+s+'</text>';
const line=(x1,y1,x2,y2,c='#7daac5',w=4,dash='')=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+c+'" stroke-width="'+w+'" '+(dash?'stroke-dasharray="'+dash+'"':'')+'/>';
function scheme(which){
 const svg=$('scScheme');
 let shapes='<rect x="0" y="0" width="760" height="196" rx="10" fill="#112838"/>';
 if(which==='test'){
  shapes+=text(117,38,'Испытательный источник')+text(640,38,'КЗ в конце образца');
  for(let k=0;k<3;k++){const y=75+k*36;
    shapes+=line(125,y,642,y,['#e4b55f','#76c09a','#8db5d8'][k],5);
    shapes+=text(105,y+5,'ABC'[k]);
  }
  shapes+=line(642,75,642,147,'#df8c7c',6);
  shapes+=line(70,65,70,159,'#a7b9c8',2);
  shapes+=text(365,185,'Прямой участок — токи протекают к замыкающей перемычке', '#adcbd9',13);
 }else{
  shapes+='<rect x="38" y="64" width="100" height="62" rx="9" fill="#294a60" stroke="#7fa9be"/>'+
          '<rect x="627" y="64" width="108" height="62" rx="9" fill="#294a60" stroke="#7fa9be"/>';
  shapes+=text(88,91,'Генератор G')+text(680,91,'GT / сеть');
  for(let k=0;k<3;k++){
    const y=77+k*17;shapes+=line(139,y,626,y,['#e4b55f','#76c09a','#8db5d8'][k],3.5);
  }
  shapes+=text(286,49,'61 кА со стороны G', '#e4b55f',14);
  shapes+=text(494,49,'40 кА со стороны GT', '#8db5d8',14);
  shapes+=line(386,77,386,153,'#df8c7c',4);
  if(which==='tap'){
    shapes+=line(386,153,386,177,'#df8c7c',4);
    shapes+=text(455,164,'UAT: 101 кА', '#ffbd9b',14);
    shapes+=text(386,184,'×', '#ff8e82',20);
  }else{
    shapes+=text(386,156,'× место КЗ', '#ffab91',14);
    shapes+=text(386,185,'Слева и справа от повреждения токи различны', '#accddd',13);
  }
 }
 svg.innerHTML=shapes;
}
function scenarios(){
 const which=$('scScenario').value;
 scheme(which);
 let explain='',form='';
 if(which==='test'){
  explain='§32.3.5: источник испытательного тока подключают к одному концу участка, а фазные проводники замыкают между собой на другом. В однофазной испытательной цепи ток пропускают по двум соседним фазам; автор обсуждает снижение испытательного тока приблизительно до 93% от трёхфазного значения для сопоставления усилий. Здесь ток задаётся пользователем, автоматического пересчёта на 93% нет. Рейтинг 122 кА на 1 с из примера 31.1 — характеристика кратковременной стойкости, а не рассчитанный ток повреждения.';
  form='<label class="field">Схема испытания<select id="scTestType"><option value="ABC">Трёхфазное испытание ABC</option><option value="AB">Две соседние фазы AB</option><option value="BC">Две соседние фазы BC</option></select></label>'+
       '<label class="field">Ток в повреждённых фазах, кА RMS<input id="scTestCurrent" type="number" min="1" max="500" step="1" value="122"></label>';
 }else{
  explain=which==='tap'?'Пример 13.3: для повреждения на ответвлении UAT к месту КЗ подходят оба источника. В книге: 61 кА от генератора и 40 кА от сети через GT; рейтинг ответвления 101 кА и условный пиковый ток стойкости 252,5 кА по множителю 2,5. Геометрия ответвления неизвестна: силы и нагрев для него здесь не вычисляются. На главном токопроводе по разные стороны ответвления НЕ протекает сумма 101 кА.':'§13.4.1(5): при повреждении на главном токопроводе G—GT к месту КЗ подходят токи от двух сторон, но по разным его отрезкам. Место повреждения по длине здесь схематическое: электрические параметры источников и токи задаются отдельно; их зависимость от расстояния ещё не рассчитывается.';
  form='<label class="field">Вклад генератора в повреждение, кА RMS<input id="scIG" type="number" min="1" max="500" step="1" value="61"></label>'+
       '<label class="field">Вклад сети через GT, кА RMS<input id="scIT" type="number" min="1" max="500" step="1" value="40"></label>';
  if(which==='main')form+='<label class="field">Место КЗ от генератора, % длины<input id="scPosition" type="range" min="5" max="95" step="5" value="50"></label><div class="note" id="scPositionLabel">50% длины; токи в сечениях задаются независимо от координаты</div>';
 }
 $('scExplain').textContent=explain;
 $('scCaseFields').innerHTML=form;
 const pos=$('scPosition');
 if(pos)pos.oninput=()=>{$('scPositionLabel').textContent=pos.value+'% длины; в режиме R+jX доли импеданса ветвей определяются координатой';};
 netFields();
 $('scStatus').textContent='Выбрана постановка «'+NAMES[which]+'». Нажмите «Рассчитать воздействие».';
 $('scMetrics').replaceChildren();$('scTable').replaceChildren();
 const plot=$('scPlot'),ctx=plot.getContext('2d');ctx.clearRect(0,0,plot.width,plot.height);
}
function number(id){const el=$(id),v=Number(el.value);if(!el.value.trim()||!Number.isFinite(v))throw Error('Укажите корректное число: '+id);return v;}
function calculate(I,type,params){
 const {freq,pitch,ro,ri,rho,alpha,T0,dur,xr,angle}=params;
 const area=Math.PI*(ro*ro-ri*ri);
 if(!(area>0))throw Error('Неправильная площадь проводника');
 const tau=xr/(2*Math.PI*freq),w=2*Math.PI*freq;
 const xs=[-pitch,0,pitch];
 const N=Math.ceil(Math.max(4000*dur,300*dur*freq));
 if(N>300000)throw Error('Слишком много временных шагов');
 const dt=dur/N,phaseAngles=[angle,angle-2*Math.PI/3,angle+2*Math.PI/3];
 const temps=[T0,T0,T0],fmax=[0,0,0],imax=[0,0,0],i2dt=[0,0,0],samples=[];
 const amp=(t,a)=>Math.SQRT2*I*(Math.sin(w*t+a)-Math.sin(a)*Math.exp(-t/tau));
 function currents(t){
  if(type==='ABC')return phaseAngles.map(a=>amp(t,a));
  const ids={AB:[0,1],BC:[1,2],CA:[2,0]}[type];
  if(!ids)throw Error('Неподдерживаемая схема фаз');
  const v=[0,0,0],ik=amp(t,angle);v[ids[0]]=ik;v[ids[1]]=-ik;return v;
 }
 let previous=currents(0);
 for(let step=0;step<=N;step++){
  const t=step*dt,amps=currents(t),forces=amps.map((ik,k)=>amps.reduce((s,ij,j)=>s+(j===k?0:2e-7*ik*ij/(xs[j]-xs[k])),0));
  for(let k=0;k<3;k++){
   imax[k]=Math.max(imax[k],Math.abs(amps[k]));
   fmax[k]=Math.max(fmax[k],Math.abs(forces[k]));
   if(step>0){
    const avg2=(previous[k]*previous[k]+amps[k]*amps[k])/2;
    i2dt[k]+=avg2*dt;
    const res=rho*(1+alpha*(temps[k]-20));
    if(res<=0)throw Error('Неположительное удельное сопротивление');
    temps[k]+=avg2*res*dt/(2700*900*area*area);
   }
  }
  if(step%Math.max(1,Math.ceil(N/400))===0||step===N)samples.push({t,force:forces});
  previous=amps;
 }
 return {I,imax,fmax,temps,i2dt,samples,T0,dur,type,area,tau};
}
function inputParams(){
 const d=number('mCondD')/2000,wall=number('mCondT')/1000,pitch=number('mPitch')/1000;
 const freq=number('freq'),rho=number('rho'),alpha=number('alphaT'),T0=number('tCond');
 const dur=number('scDuration'),xr=number('scXR'),angle=number('scAngle')*Math.PI/180;
 if(!(d>0&&wall>0&&wall<d&&pitch>0&&freq>0&&freq<=1000&&rho>0&&alpha>=0&&dur>=.01&&dur<=3&&xr>.0&&xr<=100))throw Error('Проверьте геометрию, время КЗ, X/R и электрические параметры');
 return {ro:d,ri:d-wall,pitch,freq,rho,alpha,T0,dur,xr,angle};
}
function fmt(v,d=2){return Number(v).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});}
function plot(s){
 const cv=$('scPlot'),ctx=cv.getContext('2d'),W=cv.width,H=cv.height;
 ctx.fillStyle='#102637';ctx.fillRect(0,0,W,H);
 const L=64,R=20,T=37,B=47,w=W-L-R,h=H-T-B;
 const top=Math.max(1,...s.fmax),colors=['#e4b55f','#76c09a','#8db5d8'];
 ctx.font='13px system-ui';ctx.textAlign='right';
 for(let tick=-2;tick<=2;tick++){
  const y=T+h*(2-tick)/4;ctx.strokeStyle='#3a5670';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(W-R,y);ctx.stroke();
  ctx.fillStyle='#c5d8e5';ctx.fillText(fmt(tick*top/2000,1),L-8,y+4);
 }
 s.samples.forEach(()=>{});
 for(let k=0;k<3;k++){
  ctx.strokeStyle=colors[k];ctx.lineWidth=2;ctx.beginPath();
  s.samples.forEach((p,n)=>{const x=L+p.t/s.dur*w,y=T+h*(.5-p.force[k]/(2*top));n?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
 }
 ctx.textAlign='left';ctx.fillStyle='#cddfea';ctx.fillText('Fx, кН/м',10,20);
 for(let k=0;k<3;k++){ctx.fillStyle=colors[k];ctx.fillText('Фаза '+['A','B','C'][k],W-300+96*k,21);}
 ctx.fillStyle='#cddfea';ctx.textAlign='center';ctx.fillText('Время, с',W/2,H-5);
 for(let k=0;k<=5;k++)ctx.fillText(fmt(s.dur*k/5,2),L+k*w/5,H-22);
}
function run(){
 try{
  const which=$('scScenario').value,params=inputParams(),segments=[];
  let tapCurrentA=null;
  if(which==='test'){
   const I=number('scTestCurrent')*1000,type=$('scTestType').value;
   if(!(I>0&&I<=500000))throw Error('Недопустимый ток');
   segments.push({label:'Испытательный участок',...calculate(I,type,params)});
  }else{
   const computed=$('scNetworkMode').value==='network'?networkSettings(which):null;
   const ig=computed?computed.generator.rms_A:number('scIG')*1000;
   const it=computed?computed.grid.rms_A:number('scIT')*1000;
   if(!(ig>0&&it>0&&ig<=500000&&it<=500000))throw Error('Токи источников вне диапазона оценки 0–500 кА');
   segments.push({label:'Главный токопровод: со стороны G',...calculate(ig,'ABC',computed?dynamicParameters(params,computed.generator):params)});
   segments.push({label:'Главный токопровод: со стороны GT',...calculate(it,'ABC',computed?dynamicParameters(params,computed.grid):params)});
   if(computed){
    const ph=(x)=>fmt(x*180/Math.PI,1);
    $('scNetworkOutput').textContent='Эквивалентная цепь: генератор '+fmt(ig/1000,3)+' кА ∠'+ph(computed.generator.phase_rad)+'°; сеть через GT '+fmt(it/1000,3)+' кА ∠'+ph(computed.grid.phase_rad)+'°; в точке КЗ |I_G + I_GT| = '+fmt(computed.branch.rms_A/1000,3)+' кА RMS. Баланс токов: '+fmt(computed.balance_A,6)+' А. Силы и нагрев в таблице — только оценка для соответствующих участков.';
   }else $('scNetworkOutput').textContent='Использованы назначенные токи из примера; импедансы и реальные токи источников не определялись.';
   if(which==='tap')tapCurrentA=computed?computed.branch.rms_A:ig+it;
   // UAT tap-off has its own geometry, which is not in the current model: do not calculate its forces/temperatures here.
  }
  const biggest=segments.reduce((a,b)=>Math.max(a,...b.fmax),0);
  const maxRise=segments.reduce((a,b)=>Math.max(a,...b.temps.map(t=>t-b.T0)),0);
  const largestI=(which==='tap' ? tapCurrentA/1000 : Math.max(...segments.map(s=>s.I))/1000);
  const mode=$('scScenario').value;
  $('scStatus').textContent=(mode==='test'?'Испытание участка':'Повреждение в схеме G—GT')+'. Рассчитано сечений: '+segments.length+'. Временная зависимость тока условная, не воспроизведение динамики генератора. Для рисунка ниже выбран первый участок.';
  $('scMetrics').innerHTML=[['Максимальный заданный ток сечения',fmt(largestI,1)+' кА RMS'],['Макс. погонная сила',fmt(biggest/1000,2)+' кН/м'],['Макс. оценочный нагрев',fmt(maxRise,3)+' К']].map(([a,b])=>'<div class="metric"><small>'+a+'</small><strong>'+b+'</strong></div>').join('');
  let body='<table class="table"><thead><tr><th>Сечение</th><th>Ток, кА RMS</th><th>max |Fx|, кН/м</th><th>max ΔT, K</th><th>∫i²dt фазы A, МА²·с</th></tr></thead><tbody>';
  for(const s of segments)body+='<tr><td>'+s.label+'</td><td>'+fmt(s.I/1000,1)+'</td><td>'+fmt(Math.max(...s.fmax)/1000,2)+'</td><td>'+fmt(Math.max(...s.temps.map(t=>t-s.T0)),3)+'</td><td>'+fmt(s.i2dt[0]/1e12,6)+'</td></tr>';
  if(which==='tap')body+='<tr><td>Ответвление UAT (геометрия не задана)</td><td>'+fmt(largestI,3)+'</td><td>Не рассчитывается</td><td>Не рассчитывается</td><td>Не рассчитывается</td></tr>';
  $('scTable').innerHTML=body+'</tbody></table>';
  const choose=document.createElement('select');choose.id='scPlotSelect';
  for(let i=0;i<segments.length;i++)choose.add(new Option(segments[i].label,String(i)));
  const controls=document.createElement('div');controls.className='controls';controls.style.marginTop='10px';
  const label=document.createElement('label');label.className='field';label.textContent='График погонной силы для участка';label.append(choose);controls.append(label);
  $('scTable').append(controls);
  choose.onchange=()=>plot(segments[Number(choose.value)]);
  plot(segments[0]);
 }catch(e){$('scStatus').textContent='Ошибка: '+e.message;$('scMetrics').replaceChildren();$('scTable').replaceChildren();}
}
$('scScenario').onchange=scenarios;
$('scCalculate').onclick=run;
scenarios();run();
})();