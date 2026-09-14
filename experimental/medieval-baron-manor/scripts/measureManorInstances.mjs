// Measures the actual v22 source and its compiled placements, not a unit test.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Matrix4,Vector3,Quaternion,Color} from 'three';
import {createManorScene} from '../src/models/manor.js';
const out='.wiki/manor-frame/instance-equivalence-v22-002.json';
if(existsSync(out))throw Error('Preserved observation already exists');
const inventory=JSON.parse(readFileSync('automovie/derived/manor/instances-v22.json','utf8'));
const manor=createManorScene({geometryOnly:true});
const prototypes=new Map(inventory.prototypes.map(p=>[p.id,p]));
const entries=new Map(manor.entries.map(e=>[e.id,e]));
const matrix=t=>new Matrix4().compose(new Vector3(t.translation.x,t.translation.y,t.translation.z),new Quaternion(t.rotation.x,t.rotation.y,t.rotation.z,t.rotation.w),new Vector3(t.scale.x,t.scale.y,t.scale.z));
const digest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const findings=[],seen=new Set();let maxPositionError=0,vertices=0,attributeDifferences=0,maxLinearColorError=0;
for(const binding of inventory.partBindings){
 const entry=entries.get(binding.entry),part=entry.model.parts[binding.partIndex],prototype=prototypes.get(binding.prototype),source=part.geometry.mesh,local=prototype.model.parts[0].geometry.mesh;
 const key=binding.entry+'/'+binding.part+'@'+binding.partIndex;if(seen.has(key))findings.push({key,reason:'duplicate-placement'});seen.add(key);
 const a=matrix(part.transform),b=matrix(binding.transform);let error=0;
 for(let i=0;i<source.positions.length;i+=3){const p=new Vector3(...source.positions.slice(i,i+3)).applyMatrix4(a),q=new Vector3(...local.positions.slice(i,i+3)).applyMatrix4(b);error=Math.max(error,p.distanceTo(q));vertices++;}
 maxPositionError=Math.max(maxPositionError,error);
 for(const field of ['normals','uvs','indices'])if(digest(source[field])!==digest(local[field])){attributeDifferences++;findings.push({key,field});}
 const material=entry.model.materials.find(m=>m.id===part.material);if(digest(material)!==digest(prototype.model.materials[0]))findings.push({key,reason:'prototype-material-changed'});
 const set=inventory.sets.find(s=>s.entry===binding.entry&&s.definition.modelRecipe===binding.prototype),c=new Color(set.definition.variation.palette[0]);
 maxLinearColorError=Math.max(maxLinearColorError,...['r','g','b'].map(k=>Math.abs(c[k]-material.baseColor[k])));
 if(error>1e-12)findings.push({key,reason:'position-delta',metres:error});
}
for(const s of inventory.singletons){const key=s.entry+'/'+s.part+'@'+s.partIndex;if(seen.has(key))findings.push({key,reason:'duplicate-singleton'});seen.add(key);}
const total=manor.entries.reduce((n,e)=>n+e.model.parts.length,0);
const missing=manor.entries.flatMap(e=>e.model.parts.flatMap((p,i)=>seen.has(e.id+'/'+p.id+'@'+i)?[]:[e.id+'/'+p.id+'@'+i]));
const report={purpose:'exact source member to shared-prototype placement measurement; not support/admission PASS',sourceDigest:digest(manor.entries),inventoryDigest:digest(readFileSync('automovie/derived/manor/instances-v22.json','utf8')),entries:manor.entries.length,totalParts:total,prototypes:inventory.prototypes.length,instances:inventory.partBindings.length,singletons:inventory.singletons.length,vertices,maxPositionError,attributeDifferences,maxLinearColorError,missing,findings,articulationBasis:'Entry parent/group transforms remain in the original createManorScene/setArticulation path. Local member equivalence composes with every unchanged entry transform; simultaneous collision is not certified.'};
writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
