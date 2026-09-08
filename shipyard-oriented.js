import * as base from './shipyard-v2.js?v=20';

export const CELL_METRES=base.CELL_METRES;
export const DEFAULT_TARGET_PRIORITY=base.DEFAULT_TARGET_PRIORITY;
export const HULLS=base.HULLS;
export const MODULES=base.MODULES;
export const emptyBlueprint=base.emptyBlueprint;
export const cloneBlueprint=base.cloneBlueprint;
export const footprint=base.footprint;
export const clearanceCells=base.clearanceCells;
export const canPlace=base.canPlace;
export const placeModule=base.placeModule;
export const removeAt=base.removeAt;
export const designStats=base.designStats;

// Shipyard convention: the top of the grid is the bow. The simulation convention
// remains +X = ship forward. Rotate the complete editor-local geometry clockwise
// when converting a blueprint so visual "up" becomes physical "forward".
export function blueprintToShip(bp,team='A'){
  const s=base.blueprintToShip(bp,team);
  if(!s.grid)return s;
  const oldW=s.grid.width,oldH=s.grid.height;
  const rotateCell=([x,y])=>[oldH-1-y,x];
  s.grid={...s.grid,width:oldH,height:oldW,validCells:s.grid.validCells.map(rotateCell)};
  for(const m of s.modules){
    const ox=m.x,oy=m.y;
    m.x=-oy;m.y=ox;
    if(m.gridCells)m.gridCells=m.gridCells.map(rotateCell);
    if(Number.isFinite(m.dir))m.dir=(m.dir+Math.PI/2)%(Math.PI*2);
    if(Number.isFinite(m.mountDir))m.mountDir=(m.mountDir+Math.PI/2)%(Math.PI*2);
  }
  const oldLength=s.length;s.length=s.width;s.width=oldLength;
  s.radius=Math.hypot(s.length/2,s.width/2);
  return s;
}
