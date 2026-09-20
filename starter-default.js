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
import './combat-objectives.js?v=78';
import './combat-objective-ui.js?v=78';
import './main-plot.js?v=80';
import './lacuna-transit.js?v=81';
import './lacuna-transit-guard.js?v=82';
import './lacuna-transit-ui.js?v=81';
import './lacuna-survival.js?v=82';
import './lacuna-survival-guard.js?v=82';
import './main-plot-ui.js?v=81';
import './lacuna-survival-ui.js?v=82';
import './lacuna-activity.js?v=83';
import './lacuna-activity-ui.js?v=83';

if(!document.querySelector('link[href*="mystery-ui.css"]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href='mystery-ui.css?v=73';document.head.append(link);
}

document.querySelector('#presetPursuit')?.click();
