// Actual authored production derivation, not a test or a hand-written output.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {generateAutoMovieDerivedArtifact,materializeCompiledInstanceSet} from '@automovie/production';
import {productionRuntimeModelId} from '@automovie/engine';
import {createManorScene} from '../src/models/manor.js';
import {manorInstanceDefinitions} from '../src/instances/manor.js';
const files=['src/models/manor.js','src/models/manor-craft.js','src/models/manor-garden.js','src/materials/manor.js','src/instances/manor.js','package-lock.json'];
const initial=Object.fromEntries(files.map(f=>[f,readFileSync(f)]));
function deriveInventory(){
const manor=createManorScene({geometryOnly:true}),inventory=manorInstanceDefinitions(manor.entries);
const recipes=new Map(),external=new Map();
for(const p of inventory.prototypes){
 recipes.set(p.id,{id:p.id,role:'prop',archetype:'rigid-manor-source',parameters:{},palette:{base:'#ffffff'},lod:[],capabilities:[],attachments:[]});
 const b=p.bounds;external.set(p.id,{measurement:{recipe:'box-v1',parameters:{width:2*Math.max(Math.abs(b.min.x),Math.abs(b.max.x)),height:2*Math.max(Math.abs(b.min.y),Math.abs(b.max.y)),depth:2*Math.max(Math.abs(b.min.z),Math.abs(b.max.z))}}});
 p.model.id=productionRuntimeModelId(p.id);
}
inventory.sets=inventory.sets.map(s=>({...s,compiled:materializeCompiledInstanceSet(s.definition,{routes:[]},recipes,external)}));
inventory.inputs=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(initial[f]).digest('hex')]));
return inventory;
}
let inventory;
const result=generateAutoMovieDerivedArtifact({root:process.cwd(),generator:'scripts/deriveManor.mjs',inputs:files,output:'automovie/derived/manor/instances-v22.json',encoding:'utf8',generate:inputs=>{
 for(const f of files)if(!Buffer.from(inputs[f]).equals(initial[f]))throw Error('Changed derivation input '+f);
 inventory=deriveInventory();
 return new TextEncoder().encode(JSON.stringify(inventory));
}});
console.log(JSON.stringify({path:result.record.path,prototypes:inventory.prototypes.length,instanceSets:inventory.sets.length,instances:inventory.partBindings.length,singletons:inventory.singletons.length,digest:result.record.outputDigest}));
