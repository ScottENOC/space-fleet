// The editor's existing rotation cycle is right, down, left, up. Start it at up so
// the hull bow, selected component arrow and the player's mental model all agree.
const rotate=document.querySelector('#rotate');
if(rotate){rotate.click();rotate.click();rotate.click();}
