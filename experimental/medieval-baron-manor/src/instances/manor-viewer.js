import {Group} from 'three';
import {buildModel,buildInstancedInstanceSet} from '@automovie/viewer';
// Consumes the package materializer's compiled sets through its GPU path.
export function createManorInstanceConsumer(inventory,resolveTexture){
 const models=new Map(inventory.prototypes.map(p=>[p.model.id,p.model]));
 const loaded=new Map(inventory.prototypes.map(p=>[p.model.id,buildModel(p.model,resolveTexture)]));
 const byEntry=new Map();for(const set of inventory.sets){if(!byEntry.has(set.entry))byEntry.set(set.entry,[]);byEntry.get(set.entry).push(set);}
 const live=[];let drawnInstances=0;
 return {build(entry){
  const object=new Group();object.name=entry.id;
  for(const set of byEntry.get(entry.id)??[]){const view=buildInstancedInstanceSet({instanceSet:set.compiled,models,prototypeObjects:loaded});object.add(view.object);live.push(view);drawnInstances+=set.compiled.count;}
  const ids=new Set(inventory.singletons.filter(p=>p.entry===entry.id).map(p=>p.partIndex));
  if(ids.size)object.add(buildModel({...entry.model,parts:entry.model.parts.filter((p,i)=>ids.has(i))},resolveTexture).object);
  return {object};
 },update(camera,height=1024){for(const v of live)v.update(camera,height);},stats(){return {prototypes:models.size,instanceSets:live.length,drawnInstances,gpuInstancedMeshes:live.reduce((n,v)=>{v.object.traverse(o=>{if(o.isInstancedMesh)n++;});return n;},0)};}};
}
