// Shipyard/battle flow guard.
// The shipyard is a setup screen: combat must not advance while it is active.
const pauseButton=document.querySelector('#pause');
const fightButton=document.querySelector('#reset');
const tabs=[...document.querySelectorAll('.tab')];

function isPaused(){return pauseButton?.textContent==='Resume';}
function ensurePaused(){if(pauseButton&&!isPaused())pauseButton.click();}
function ensureRunning(){if(pauseButton&&isPaused())pauseButton.click();}

// main.js currently creates the preview battle on load. Freeze it immediately while
// the player is in the shipyard so T+ remains at zero until they deliberately fight.
if(document.querySelector('#shipyard')?.classList.contains('active'))ensurePaused();

// main.js owns rebuilding the Battle instance and switching to the Battle tab.
// After that handler runs, start the new fight automatically.
if(fightButton){
  fightButton.addEventListener('click',()=>queueMicrotask(()=>ensureRunning()));
}

// Entering Shipyard always freezes the current battle. Returning to Battle leaves
// it paused, so the player can inspect the existing fight and press Resume, or use
// Fight designs to launch a fresh battle with the edited designs.
for(const tab of tabs){
  tab.addEventListener('click',()=>{
    if(tab.dataset.tab==='shipyard')queueMicrotask(()=>ensurePaused());
  });
}
