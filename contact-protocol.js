import {registerBattleHook} from './battle-hooks.js';

export function ensureContactProtocol(battle,opts={}){
 if(!battle)return null;
 battle.contactProtocol??={disposition:opts.disposition||'neutral',roe:opts.roe||'hold',hailed:false,compliance:null,messages:[],escalated:false};
 return battle.contactProtocol;
}
export function contactMessage(battle,text){const s=ensureContactProtocol(battle);if(!s)return;s.messages.push({t:battle.t||0,text});s.messages=s.messages.slice(-12);battle.log?.(text)}
export function hailContact(battle,text='Fleet command hails the contact and requests identification and intentions.'){
 const s=ensureContactProtocol(battle);if(!s)return{ok:false,reason:'No contact protocol is active.'};if(s.hailed)return{ok:false,reason:'The contact has already been hailed.'};s.hailed=true;contactMessage(battle,text);return{ok:true}
}
export function setContactDisposition(battle,disposition){const s=ensureContactProtocol(battle);if(!s)return null;s.disposition=disposition;return s}
export function setContactROE(battle,roe){const s=ensureContactProtocol(battle);if(!s)return null;s.roe=roe;if(roe==='weaponsFree'){s.escalated=true;s.disposition='hostile'}return s}
export function contactProtocolSummary(battle){const s=battle?.contactProtocol;if(!s)return null;return{...s,messages:[...(s.messages||[])]}}
registerBattleHook('beforeFireWeapons','contact-protocol-roe',ctx=>{
 const s=ctx.battle?.contactProtocol;if(!s||s.roe==='weaponsFree')return;
 if(ctx.ship?.contactParticipant||ctx.target?.contactParticipant)ctx.handled=true;
},500);
if(typeof window!=='undefined')window.__contactProtocol={ensureContactProtocol,hailContact,setContactDisposition,setContactROE,contactProtocolSummary};
