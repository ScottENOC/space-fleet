import './crew-escalation.js?v=61';
import './mobile-ui.js?v=66';
import './battle-context-ui.js?v=65';
import './pdc-system.js?v=74';
import './mystery-ui.js?v=73';
import './mystery-encounter-hooks.js?v=73';
import './expedition-battle-hooks.js?v=73';
import './tactical-hazards.js?v=74';
import './tactical-hazard-ui.js?v=74';
import './interdiction-system.js?v=75';
import './interdiction-ui.js?v=75';
import './interdiction-campaign-hooks.js?v=75';
import './tactical-missions.js?v=76';
import './tactical-mission-ui.js?v=76';
import './faction-strategy.js?v=77';

if(!document.querySelector('link[href*="mystery-ui.css"]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href='mystery-ui.css?v=73';document.head.append(link);
}

document.querySelector('#presetPursuit')?.click();
