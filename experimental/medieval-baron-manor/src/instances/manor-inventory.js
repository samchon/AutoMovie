// In-page derivation of the shared prototype inventory the GPU consumer reads.
// scripts/deriveManor.mjs writes the same inventory through the production
// compiler under Node; a public page cannot load that compiler, so the part of
// its explicit-layout compilation that buildInstancedInstanceSet actually reads
// is restated here: slot bounds and centroid, one chunk per 1,024 slots, and a
// near-tier LOD naming the prototype's runtime model. Digests are not read.
import {productionRuntimeModelId} from '@automovie/engine';
import {manorInstanceDefinitions} from './manor.js';

const CHUNK_SIZE=1024;
const AXES=['x','y','z'];
const summarize=transforms=>{
 const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity},centroid={x:0,y:0,z:0};
 transforms.forEach((t,seen)=>{for(const k of AXES){const v=t.translation[k];min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);centroid[k]=centroid[k]*(seen/(seen+1))+v/(seen+1);}});
 return {bounds:{min,max},centroid};
};
// Half the diagonal of the box that encloses the centred prototype, the same
// `box-v1` measurement the compiler derives from the prototype bounds.
export const prototypeProjectionRadius=bounds=>Math.max(.01,Math.hypot(...AXES.map(k=>Math.max(Math.abs(bounds.min[k]),Math.abs(bounds.max[k])))));
export function compileManorInstanceSet(definition,projectionRadius){
 const {transforms}=definition.layout,chunks=[];
 for(let start=0;start<definition.count;start+=CHUNK_SIZE){const count=Math.min(CHUNK_SIZE,definition.count-start);chunks.push({index:chunks.length,start,count,...summarize(transforms.slice(start,start+count))});}
 const lod=[{tier:'near',maxDistance:null,recipe:definition.modelRecipe,model:productionRuntimeModelId(definition.modelRecipe)}];
 return {version:1,id:definition.id,count:definition.count,modelRecipe:definition.modelRecipe,layout:definition.layout,route:null,anchor:definition.anchor,facingDeg:definition.facingDeg,seed:definition.seed,variation:definition.variation,...summarize(transforms),projectionRadius,chunks,lod};
}
export function deriveManorInstanceInventory(entries){
 const inventory=manorInstanceDefinitions(entries),radii=new Map();
 for(const p of inventory.prototypes){radii.set(p.id,prototypeProjectionRadius(p.bounds));p.model.id=productionRuntimeModelId(p.id);}
 return {...inventory,sets:inventory.sets.map(s=>({...s,compiled:compileManorInstanceSet(s.definition,radii.get(s.definition.modelRecipe))}))};
}
