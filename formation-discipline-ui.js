import {DOCTRINES} from './doctrine-system.js';

const KEY='spaceFleet.shipDoctrines.v1';
function install(){
  const ram=document.querySelector('#editRam')?.closest('label');if(!ram||document.querySelector('#editFormationDiscipline'))return;
  const label=document.createElement('label');label.innerHTML=`Formation discipline<select id="editFormationDiscipline"><option value="strict">Strict — regain station aggressively</option><option value="normal">Normal — balance station and combat</option><option value="independent">Independent — formation is only a reference</option></select>`;ram.after(label);
  const sel=label.querySelector('select');
  const sync=()=>{const id=document.querySelector('#editShipLoad')?.value||'balanced';sel.value=DOCTRINES[id]?.formationDiscipline||'normal';};
  document.querySelector('#editShipLoad')?.addEventListener('change',()=>queueMicrotask(sync));
  document.querySelector('#newShipDoctrine')?.addEventListener('click',()=>queueMicrotask(()=>sel.value='normal'));
  document.querySelector('#saveShipDoctrine')?.addEventListener('click',()=>queueMicrotask(()=>{
    const id=document.querySelector('#editShipLoad')?.value;const d=DOCTRINES[id];if(!d)return;d.formationDiscipline=sel.value;
    const custom=Object.values(DOCTRINES).filter(x=>!['balanced','codeRed'].includes(x.id));localStorage.setItem(KEY,JSON.stringify(custom));
  }));
  sync();
}
install();
