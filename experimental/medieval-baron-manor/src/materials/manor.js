// Project-owned material/UV decisions. No loader or renderer state is authored here.
import {tessellate} from '@automovie/engine';

export const textureTiles = {
 wood:{file:'oak-albedo-v1.png',metres:[.4,1]},
 stone:{file:'limestone-albedo-v1.png',metres:[.6,.6]},
 plaster:{file:'lime-plaster-albedo-v1.png',metres:[.8,.8]},
 tile:{file:'terracotta-albedo-v1.png',metres:[.3,.3]},
 cloth:{file:'linen-albedo-v1.png',metres:[.04,.04]},
 bark:{file:'apple-bark-albedo-v1.png',metres:[.55,.9]},
 soil:{file:'garden-soil-albedo-v1.png',metres:[1.2,1.2]},
};
const families={oak:'wood',oakLight:'wood',oakPale:'wood',oakGrain:'wood',upper:'wood',bark:'bark',soil:'soil',
 stone:'stone',stoneLight:'stone',stoneDark:'stone',floor:'stone',gravel:'stone',plaster:'plaster',
 roof:'tile',roofLight:'tile',roofMuted:'tile',bed:'cloth',linen:'cloth',linenDark:'cloth',quiltRust:'cloth',quiltSage:'cloth'};
// Linear multipliers, deliberately not the old dark sRGB swatches a second time.
const tint={oak:[.14,.19,.25],oakLight:[.22,.28,.34],oakPale:[.31,.37,.44],oakGrain:[.10,.15,.20],upper:[.19,.23,.29],bark:[.78,.78,.76],soil:[.64,.62,.57],
 stone:[.68,.69,.67],stoneLight:[.85,.85,.80],stoneDark:[.35,.37,.35],floor:[.65,.63,.56],gravel:[.72,.69,.60],plaster:[.75,.71,.61],
 roof:[.17,.22,.27],roofLight:[.23,.26,.29],roofMuted:[.20,.24,.28],bed:[.63,.61,.53],linen:[.94,.91,.82],linenDark:[.57,.54,.44],quiltRust:[.54,.24,.17],quiltSage:[.34,.43,.27]};
export function textureBinding(family){
 const tile=textureTiles[family];
 return {asset:'assets/textures/manor/'+tile.file,texCoord:0,coordinateSource:'surface-metres',colorSpace:'srgb',
  transform:{offset:{x:0,y:0},scale:{x:1/tile.metres[0],y:1/tile.metres[1]},rotationDeg:0},
  sampler:{wrapS:'mirror',wrapT:'mirror',minFilter:'linearMipmapLinear',magFilter:'linear'}};
}
export const manorTextureBindings=()=>Object.keys(textureTiles).map(textureBinding);
export function mapManorMaterials(materials){
 return materials.map(m=>{const family=families[m.id];if(!family)return m;const [r,g,b]=tint[m.id];
  return {...m,baseColor:{r,g,b,a:1,hex:null},baseColorTexture:textureBinding(family)};
 });
}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const longest=positions=>{
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<positions.length;i++) {const k=i%3;lo[k]=Math.min(lo[k],positions[i]);hi[k]=Math.max(hi[k],positions[i]);}
 const sizes=hi.map((v,k)=>v-lo[k]),axis=sizes.indexOf(Math.max(...sizes));return [0,1,2].map(k=>k===axis?1:0);
};
export function metricGeometry(geometry,material,{grainAxis,origin,faceFrames,developed=false,projected=false,cylindrical=false}={}){
 const family=families[material];if(!family)return geometry;
 const woodLike=family==='wood'||family==='bark';
 const data=geometry.type==='primitive'?{...tessellate(geometry.shape),uvs:null,skin:null}:geometry.mesh;
 if(developed||!projected&&!woodLike&&data.uvs!==null&&data.uvs!==undefined)return {type:'mesh',mesh:data};
 if(projected||cylindrical){
  const positions=[],normals=[],uvs=[],indices=[];
  const ii=data.indices??Array.from({length:data.positions.length/3},(_,i)=>i);
  for(let t=0;t<ii.length;t+=3){
   const ps=ii.slice(t,t+3).map(i=>data.positions.slice(i*3,i*3+3)),ns=ii.slice(t,t+3).map(i=>data.normals.slice(i*3,i*3+3));
   const n=unit(cross(ps[1].map((v,k)=>v-ps[0][k]),ps[2].map((v,k)=>v-ps[0][k]))),axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
   const angles=ps.map(p=>Math.atan2(p[2],p[0]));if(Math.max(...angles)-Math.min(...angles)>Math.PI)for(let j=0;j<3;j++)if(angles[j]<0)angles[j]+=Math.PI*2;
   for(let j=0;j<3;j++){const p=ps[j];positions.push(...p);normals.push(...ns[j]);indices.push(indices.length);
    if(cylindrical&&Math.abs(n[1])<.94)uvs.push(angles[j]*Math.hypot(p[0],p[2]),p[1]);
    else{const axes=axis===0?[2,1]:axis===1?[0,2]:[0,1];uvs.push(p[axes[0]],p[axes[1]]);}
   }
  }
  return {type:'mesh',mesh:{...data,positions,normals,uvs,indices}};
 }
 const positions=data.positions,normals=data.normals,uvs=[],axis=unit(grainAxis??longest(positions));
 const lo=[Infinity,Infinity,Infinity],hi=lo.map(v=>-v);
 for(let i=0;i<positions.length;i++){lo[i%3]=Math.min(lo[i%3],positions[i]);hi[i%3]=Math.max(hi[i%3],positions[i]);}
 const center=origin??lo.map((v,k)=>(v+hi[k])/2);
 let faceIndex=0,faceEnd=faceFrames?.[0]?.count??Infinity;
 for(let i=0;i<positions.length;i+=3){
  while(i/3>=faceEnd){faceIndex++;faceEnd+=faceFrames[faceIndex].count;}
  const frame=faceFrames?.[faceIndex],base=frame?.origin??center,p=positions.slice(i,i+3).map((v,k)=>v-base[k]),n=unit(normals.slice(i,i+3));
  const preferred=family==='wood'?unit(frame?.grainAxis??axis):[0,1,0];
  // Planar end cuts avoid the atan2 seam interpolating across cap triangles.
  if(family==='wood'&&Math.abs(dot(preferred,n))>.94){
   const tangent=unit(cross(preferred,Math.abs(preferred[2])<.9?[0,0,1]:[1,0,0])),other=cross(preferred,tangent),x=dot(p,tangent),y=dot(p,other);
   uvs.push(x,y);continue;
  }
  let v=preferred.map((q,k)=>q-n[k]*dot(preferred,n));
  if(Math.hypot(...v)<1e-8){const other=Math.abs(n[2])<.9?[0,0,1]:[1,0,0];v=other.map((q,k)=>q-n[k]*dot(other,n));}
  v=unit(v);const u=unit(cross(v,n));uvs.push(dot(p,u),dot(p,v));
 }
 return {type:'mesh',mesh:{...data,uvs}};
}
