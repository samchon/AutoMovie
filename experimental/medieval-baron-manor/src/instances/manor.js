// Local rigid prototypes and explicit placements; no renderer objects here.
import {Matrix4,Vector3,Quaternion,Color} from 'three';
const identity=()=>({translation:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1}});
const xyz=v=>({x:v.x,y:v.y,z:v.z});
export function manorInstanceDefinitions(entries){
 const prototypes=[],sets=[],singletons=[],pool=new Map(),partBindings=[];
 for(const entry of entries){
  const groups=new Map();
  for(const [partIndex,part] of entry.model.parts.entries()){
   const data=part.geometry.type==='mesh'?part.geometry.mesh:null;
   if(!data||data.skin||part.attachedBone!==null){singletons.push({entry:entry.id,part:part.id,partIndex});continue;}
   const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<data.positions.length;i++){lo[i%3]=Math.min(lo[i%3],data.positions[i]);hi[i%3]=Math.max(hi[i%3],data.positions[i]);}
   const center=lo.map((v,k)=>(v+hi[k])/2),local={...data,positions:data.positions.map((v,k)=>v-center[k%3])};
   const material=entry.model.materials.find(m=>m.id===part.material);
   // Exact authored shape/material bytes, not rounded dimensions or class names.
   const key=JSON.stringify([local,material]);let prototype=pool.get(key);
   if(!prototype){const id='manor-prototype-'+String(prototypes.length).padStart(5,'0');prototype={id,bounds:{min:xyz(new Vector3(...lo.map((v,k)=>v-center[k]))),max:xyz(new Vector3(...hi.map((v,k)=>v-center[k])))},model:{id,name:id,origin:'generated',skeleton:null,materials:[material],parts:[{...part,id:'member',name:'member',geometry:{type:'mesh',mesh:local},transform:identity()}],asset:null,body:null}};pool.set(key,prototype);prototypes.push(prototype);}
   const t=part.transform??identity(),m=new Matrix4().compose(new Vector3(t.translation.x,t.translation.y,t.translation.z),new Quaternion(t.rotation.x,t.rotation.y,t.rotation.z,t.rotation.w),new Vector3(t.scale.x,t.scale.y,t.scale.z)).multiply(new Matrix4().makeTranslation(...center)),p=new Vector3(),q=new Quaternion(),s=new Vector3();m.decompose(p,q,s);
   const placement={id:part.id+'@'+partIndex,translation:xyz(p),rotation:{x:q.x,y:q.y,z:q.z,w:q.w},scale:xyz(s)};
   if(!groups.has(prototype.id))groups.set(prototype.id,[]);groups.get(prototype.id).push(placement);
   partBindings.push({entry:entry.id,part:part.id,partIndex,prototype:prototype.id,transform:placement});
  }
  for(const [prototype,transforms]of groups){
   const mat=prototypes.find(p=>p.id===prototype).model.materials[0],c=mat.baseColor;
   sets.push({entry:entry.id,definition:{id:entry.id+'--'+prototype,modelRecipe:prototype,count:transforms.length,layout:{kind:'explicit',transforms},anchor:{x:0,y:0,z:0},facingDeg:0,seed:1902,variation:{scale:{min:1,max:1},palette:['#'+new Color(c.r,c.g,c.b).getHexString()],traits:[]}}});
  }
 }
 const counts=new Map();for(const b of partBindings)counts.set(b.prototype,(counts.get(b.prototype)??0)+1);
 const repeated=new Set([...counts].filter(([,n])=>n>1).map(([id])=>id));
 for(const b of partBindings)if(!repeated.has(b.prototype))singletons.push({entry:b.entry,part:b.part,partIndex:b.partIndex});
 return {prototypes:prototypes.filter(p=>repeated.has(p.id)),sets:sets.filter(s=>repeated.has(s.definition.modelRecipe)),singletons,partBindings:partBindings.filter(b=>repeated.has(b.prototype))};
}
