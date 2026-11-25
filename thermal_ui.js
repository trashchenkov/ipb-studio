/* IPB Studio thermal UI. Input losses taken from selected FEMM result. */
(function(){
'use strict';
const byId=id=>document.getElementById(id);
const root=byId('thermalPanel');if(!root)return;
root.innerHTML=[
'<h3>Оценка стационарного нагрева по потерям FEMM</h3>',
'<p class="note"><strong>Односторонняя тепловая модель, не FEMM-теплопередача.</strong> Для каждой фазы отдельно: два узла (алюминиевый проводник и его оболочка), обмен теплом в коаксиальном воздушном зазоре и теплоотдача оболочки в окружающую среду. Потери взяты из выбранного результата FEMM и остаются постоянными; температура не передаётся обратно в электромагнитный расчёт.</p>',
'<div class="grid2"><div>',
'<label class="field">Температура окружающего воздуха, °C<input id="thermalAmbient" type="number" min="-40" max="100" step="1" value="25"></label>',
'<label class="field">Условный эффективный коэффициент теплоотдачи в зазоре, Вт/(м²·К)<input id="thermalGapH" type="number" min="0.1" max="100" step="0.1" value="5"></label>',
'<label class="field">Коэффициент теплоотдачи внешней поверхности оболочки, Вт/(м²·К)<input id="thermalOutH" type="number" min="0.1" max="100" step="0.1" value="10"></label>',
'<div class="twoCol"><label class="field">Излучательная способность проводника, ε<input id="thermalEc" type="number" min="0.01" max="1" step="0.01" value="0.3"></label><label class="field">Внутренней поверхности оболочки, ε<input id="thermalEsi" type="number" min="0.01" max="1" step="0.01" value="0.3"></label></div>',
'<label class="field">Наружной поверхности оболочки, ε<input id="thermalEs" type="number" min="0.01" max="1" step="0.01" value="0.65"></label>',
'<button id="thermalCompute" class="primary" type="button">Вычислить температурную оценку</button>',
'</div><div>',
'<div class="statusline" id="thermalStatus" role="status" aria-live="polite">Выберите расчёт FEMM и задайте условия охлаждения.</div>',
'<p class="note">Для светло-серой наружной поверхности ε = 0,65 использовано как литературное исходное значение по Агравалу; это <strong>не измеренная характеристика нашего изделия</strong>. Коэффициенты теплоотдачи, ε проводника и ε внутренней поверхности оболочки остаются предположениями. Внешнее покрытие не определяет ε внутренней поверхности. Нужно уточнить ориентацию токопровода, конструкцию воздушного зазора, окраску/окисление поверхностей, вентиляцию, температуру окружающей среды и теплоотвод через опоры.</p>',
'</div></div>',
'<div id="thermalTable"></div>',
'<p class="note">Модель игнорирует теплопроводность вдоль токопровода, взаимный теплообмен соседних оболочек, конвекционные течения внутри зазора и локальные термические сопротивления. В случае аварийного тока FEMM даёт гармонические потери при заданной температуре — это <strong>не</strong> температурный процесс во времени. Большие рассчитанные температуры означают выход за область применимости, а не прогноз для промышленного изделия.</p>'
].join('');
const ids=['thermalAmbient','thermalGapH','thermalOutH','thermalEc','thermalEsi','thermalEs'];
for(const id of ids)byId(id).addEventListener('change',recompute);
byId('thermalCompute').onclick=recompute;
document.addEventListener('ipb-result-selected',recompute);
function number(id){const el=byId(id),v=Number(el.value);if(el.value.trim()===''||!Number.isFinite(v))throw Error('Введите число: '+id);return v;}
function fmt(x,n=2){return Number(x).toLocaleString('ru-RU',{minimumFractionDigits:n,maximumFractionDigits:n});}
function recompute(){
 const stat=byId('thermalStatus'),out=byId('thermalTable');
 try{
   const rec=window.IPBActiveResult;
   if(!rec){stat.textContent='Сначала выберите расчёт на вкладке «Результаты».';return;}
   if(rec.job?.fault_case?.type==='harmonic_section'){
     stat.textContent='Выбран аварийный гармонический расчёт. Стационарная двухузловая модель здесь отключена: она не определяет температуру за кратковременное КЗ. Для оценки нагрева при заданном токе и длительности используйте раздел КЗ; для стационарного нагрева выберите расчёт номинального режима.';
     out.replaceChildren();
     return;
   }
   if(!window.IPBThermal)throw Error('Не загрузился thermal.js; обновите страницу');
   const g=rec.job.geometry;
   const common={
     conductor_d_mm:g.conductor_outer_diameter_mm,
     shell_d_mm:g.shell_outer_diameter_mm,
     shell_wall_mm:g.shell_wall_mm,
     ambient_C:number('thermalAmbient'),
     h_gap_W_m2K:number('thermalGapH'),
     h_out_W_m2K:number('thermalOutH'),
     eps_conductor:number('thermalEc'),eps_shell_inner:number('thermalEsi'),eps_shell:number('thermalEs')
   };
   const phases=[];
   for(const ph of 'ABC'){
     const Pmain=rec.regions.find(r=>r.phase===ph&&r.region==='main');
     const Pshell=rec.regions.find(r=>r.phase===ph&&r.region==='shell');
     if(!Pmain||!Pshell)throw Error('В результате отсутствуют потери фазы '+ph);
     const row=window.IPBThermal.solve({...common,P_conductor_W_per_m:Pmain.P_W_per_m,P_shell_W_per_m:Pshell.P_W_per_m});
     phases.push({ph,pc:Pmain.P_W_per_m,ps:Pshell.P_W_per_m,...row});
   }
   const anyHigh=phases.some(r=>r.validity!=='ILLUSTRATIVE');
   stat.textContent='Использованы потери выбранного расчёта '+rec.label+'; коэффициенты охлаждения задаёт пользователь. '+(anyHigh?'Предупреждение: рассчитаны температуры вне рекомендованной области использования этой упрощённой модели.':'Энергетический баланс численно выполнен; это ещё не проверка теплового режима токопровода.');
   const table=document.createElement('table');table.className='table';
   const head=document.createElement('thead');
   head.innerHTML='<tr><th>Фаза</th><th>Проводник, Вт/м</th><th>Оболочка, Вт/м</th><th>Т проводника, °C</th><th>Т оболочки, °C</th><th>Перегрев проводника, K</th></tr>';
   table.append(head);
   const body=document.createElement('tbody');
   for(const p of phases){
     const tr=document.createElement('tr');
     for(const v of [p.ph,fmt(p.pc),fmt(p.ps),fmt(p.T_conductor_C),fmt(p.T_shell_C),fmt(p.conductor_rise_K)]){
       const td=document.createElement('td');td.textContent=v;tr.append(td);
     }
     body.append(tr);
   }
   table.append(body);out.replaceChildren(table);
   const note=document.createElement('p');note.className='note';
   note.textContent='FEMM считал сопротивление при заданных температурах проводника '+fmt(rec.job.materials.conductor_C,1)+' °C и оболочки '+fmt(rec.job.materials.shell_C,1)+' °C. Тепловая модель рассчитала собственные значения, но электромагнитные потери при них заново не вычислялись.';
   out.append(note);
 }catch(e){stat.textContent='Тепловая оценка недоступна: '+e.message;out.replaceChildren();}
}
recompute();
})();