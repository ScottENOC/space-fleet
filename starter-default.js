import './crew-escalation.js?v=61';
import './mobile-ui.js?v=66';
import './battle-context-ui.js?v=65';
import './pdc-system.js?v=66';
import './mystery-ui.js?v=72';
import './mystery-encounter-hooks.js?v=72';

if(!document.querySelector('link[href*="mystery-ui.css"]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href='mystery-ui.css?v=72';document.head.append(link);
}

// main.js initialises the editor first; then select the intended tiny starter for Player.
// Enemy also defaults to the Sparrow, giving a fair 9-cell vs 9-cell baseline.
document.querySelector('#presetPursuit')?.click();