// node tests/fault-scenarios.test.js
// DOM-less regression smoke test for source topology and calc output.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('fault.js','utf8');
function run(scenario,subtype){
 const defaults={scScenario:scenario,scTestType:subtype||'ABC',scTestCurrent:'122',scIG:'61',scIT:'40',
 scDuration:'1',scXR:'10',scAngle:'0',mCondD:'951.5',mCondT:'10.9',mPitch:'1727.2',
 freq:'50',rho:'2.826e-8',alphaT:'0.00403',tCond:'105'};
 const elements={};
 const ctx=new Proxy({},{get(o,k){return Object.prototype.hasOwnProperty.call(o,k)?o[k]:(()=>{})},set(o,k,v){o[k]=v;return true}});
 function element(id){
  if(!elements[id])elements[id]={value:defaults[id]||'',textContent:'',innerHTML:'',width:1100,height:370,style:{},
   add(opt){(this.options??=[]).push(opt)},append(){},replaceChildren(){},getContext(){return ctx}};
  return elements[id];
 }
 const document={getElementById:element,createElement:tag=>({tag,style:{},value:'0',append(){},add(){}})};
 function Option(text,value){this.text=text;this.value=value}
 vm.runInNewContext(code,{document,Option,Math,Number,JSON}, {timeout:15000});
 const status=elements.scStatus.textContent,table=elements.scTable.innerHTML,metrics=elements.scMetrics.innerHTML;
 assert(!status.startsWith('Ошибка'),status);
 return {status,table,metrics};
}
let t=run('test');
assert(t.status.includes('1'),t.status);
assert(t.table.includes('122,0'),t.table);
t=run('test','AB');assert(t.table.includes('Испытательный участок'));
t=run('main');
assert(t.status.includes('2'),t.status);
assert(t.table.includes('61,0')&&t.table.includes('40,0'));
assert(!t.table.includes('101,0'), 'Main bus must not carry sum of source fault currents');
t=run('tap');
assert(t.status.includes('2'), 'Only two defined mainline geometries can be stress-calculated');
assert(t.table.includes('101,0'), 'UAT tap current must sum both contributions');
assert(t.table.includes('Не рассчитывается'), 'Missing branch geometry should not produce numerical stress');
console.log('PASS: test ABC/AB, main bus two separate contributions, UAT tap current-only');
