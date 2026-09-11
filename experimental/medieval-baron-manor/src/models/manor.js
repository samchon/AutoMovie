// #1902 whole-house frame scratch. No reviewed stage or formal receipt.
import * as THREE from 'three';
import {createManorCraft} from './manor-craft.js';
import {createManorGarden} from './manor-garden.js';
import {mapManorMaterials,metricGeometry} from '../materials/manor.js';
import {buildModel} from '@automovie/viewer';
import {buildAutoMovieWall,buildAutoMoviePolyhedron,triangulateAutoMovieRegion,extrudeAutoMovieRegion,extrudeAutoMovieProfile,revolveAutoMovieProfile} from '@automovie/engine';
export function configureManorRenderer(renderer){renderer.shadowMap.enabled=true;renderer.localClippingEnabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;}
export function createManorScene({shadows=true,resolveTexture,geometryOnly=false,instanceConsumer}={}){
const C=h=>{const c=new THREE.Color(h);return{r:c.r,g:c.g,b:c.b,a:1,hex:null};};
const materials=Object.entries({oak:'#574331',oakLight:'#6b523d',oakPale:'#755d46',oakGrain:'#4b3d2e',plaster:'#d3c2a3',stone:'#929085',stoneLight:'#aaa496',stoneDark:'#68645c',roof:'#74503a',roofLight:'#80563c',roofMuted:'#79543e',floor:'#a4957a',upper:'#896f51',iron:'#363532',ironWarm:'#6b5541',glass:'#a2b3ac',water:'#476f73',soil:'#655e42',herbs:'#657d48',leaves:'#7d854c',leafLight:'#7e874b',leafDark:'#4a6137',flower:'#a96f63',gravel:'#b4a58b',bed:'#8e8876',linen:'#bda986',linenDark:'#87775f',quiltRust:'#795447',quiltSage:'#69765c',appleRed:'#8d4535',clay:'#8d654d',clayLight:'#b89874',charcoal:'#302b25',leather:'#65483b',paper:'#cfbd92',wax:'#d8bc83',flame:'#ffbd46',ember:'#d86b22',proxy:'#a88b61'}).map(([id,h])=>({id,name:id,baseColor:C(h),roughness:['iron','ironWarm'].includes(id)?.46:id==='glass'?.18:id==='water'?.21:.88,metallic:['iron','ironWarm'].includes(id)?.65:0,opacity:id==='glass'?.35:id==='water'?.76:1,emissive:['flame','ember'].includes(id)?C(h):null,baseColorTexture:null,doubleSided:['herbs','leaves','leafLight','leafDark'].includes(id)}));
const V=a=>({x:a[0],y:a[1],z:a[2]});
const Q=(a,t)=>{const s=Math.sin(t/2);return{x:a[0]*s,y:a[1]*s,z:a[2]*s,w:Math.cos(t/2)};};
const T=(p,r={x:0,y:0,z:0,w:1})=>({translation:V(p),rotation:r,scale:{x:1,y:1,z:1}});
let parts=[];const entries=[],boundaries=[],portals=[],rooms=[],mechanisms=[];
const box=(id,size,p,material='oak',rotation,mapping)=>parts.push({id,name:id,geometry:metricGeometry({type:'primitive',shape:{type:'box',width:size[0],height:size[1],depth:size[2]}},material,mapping),material,attachedBone:null,transform:T(p,rotation)});
const mesh=(id,data,p,material='plaster',rotation,mapping)=>parts.push({id,name:id,geometry:metricGeometry({type:'mesh',mesh:data},material,mapping),material,attachedBone:null,transform:T(p,rotation)});
 const localBeam=(id,a,b,w=.06,material='oak')=>{const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),d=bb.clone().sub(aa),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());box(id,[w,d.length(),w],aa.add(bb).multiplyScalar(.5).toArray(),material,{x:q.x,y:q.y,z:q.z,w:q.w});};
 const round=(id,r,h,p,material='clay',segments=16)=>mesh(id,revolveAutoMovieProfile({profile:[{x:0,y:-h/2},{x:r*.82,y:-h/2},{x:r,y:-h*.30},{x:r*.94,y:h*.35},{x:r*.72,y:h/2},{x:0,y:h/2}],segments}),p,material);
const beam=(id,a,b,w=.14,material='oak',cutShaft=true)=>{
 if(cutShaft&&/^(rear-rafter|rear-tie|wing-rafter|wing-tie|valley)/.test(id)){
  let enter=0,leave=1,hit=true;for(const [axis,lo,hi]of [[0,chimneyCut[0]-.15,chimneyCut[1]+.15],[2,chimneyCut[2]-.15,chimneyCut[3]+.15]]){const d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(a[axis]<lo||a[axis]>hi)hit=false;}else{const ts=[(lo-a[axis])/d,(hi-a[axis])/d].sort((a,b)=>a-b);enter=Math.max(enter,ts[0]);leave=Math.min(leave,ts[1]);}}
  if(hit&&enter<leave){const at=t=>a.map((v,i)=>v+(b[i]-v)*t);if(enter>.0001)beam(id+'-before',a,at(enter),w,material,false);if(leave<.9999)beam(id+'-after',at(leave),b,w,material,false);return;}
 }
 if(/rail|guard-top|inner-turn-join|arrival-guard-join/.test(id)){
  const len=Math.hypot(b[0]-a[0],b[2]-a[2]);if(len>1e-6){const nx=-(b[2]-a[2])/len*w/2,nz=(b[0]-a[0])/len*w/2,ring=p=>[[p[0]+nx,p[1]-w/2,p[2]+nz],[p[0]-nx,p[1]-w/2,p[2]-nz],[p[0]-nx,p[1]+w/2,p[2]-nz],[p[0]+nx,p[1]+w/2,p[2]+nz]],aa=ring(a),bb=ring(b),f=[aa.toReversed(),bb];for(let i=0;i<4;i++)f.push([aa[i],aa[(i+1)%4],bb[(i+1)%4],bb[i]]);mesh(id,buildAutoMoviePolyhedron(f.map(f=>f.map(V))),[0,0,0],material);return;}
 }
 const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),d=bb.clone().sub(aa),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());box(id,[w,d.length(),w],aa.add(bb).multiplyScalar(.5).toArray(),material,{x:q.x,y:q.y,z:q.z,w:q.w});};
 materials.push({...materials.find(m=>m.id==='oak'),id:'bark',name:'bark'});
 const texturedMaterials=mapManorMaterials(materials);
function finish(id,level,role='frame',review={}){entries.push({id,level,role,review,model:{id,name:id,origin:'generated',skeleton:null,materials:texturedMaterials,parts,asset:null,body:null}});parts=[];}
function travellingParts(id,parent,level,selected,pivot,restAngle,axis,travel,kind='window'){
 const chosen=parts.filter(selected);if(!chosen.length)throw new Error('Empty moving assembly: '+id);
 parts=parts.filter(p=>!selected(p));
 const rest=T(pivot,Q([0,1,0],restAngle)),matrix=t=>new THREE.Matrix4().compose(new THREE.Vector3(t.translation.x,t.translation.y,t.translation.z),new THREE.Quaternion(t.rotation.x,t.rotation.y,t.rotation.z,t.rotation.w),new THREE.Vector3(t.scale.x,t.scale.y,t.scale.z)),inverse=matrix(rest).invert();
 const local=chosen.map(p=>{const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();inverse.clone().multiply(matrix(p.transform)).decompose(position,rotation,scale);return {...p,transform:{translation:V(position.toArray()),rotation:{x:rotation.x,y:rotation.y,z:rotation.z,w:rotation.w},scale:V(scale.toArray())}};});
 const motion={kind:'revolute',axis:V(axis),pivot:V([0,0,0]),min:Math.min(0,travel),max:Math.max(0,travel)};
 entries.push({id,level,role:kind,parent,review:{frontAngle:restAngle},articulation:{rest,motion,closed:0,open:travel,default:0},model:{id,name:id,origin:'generated',skeleton:null,materials:texturedMaterials,parts:local,asset:null,body:null}});
 return {id,element:id,motion};
}
const {bevel,at:craftAt,cloth,table,bench,hearth,counter,shelf,bed,chest,washBasin,rug,cabinet,wallLamp,latrineUnit,nightStand,serviceTools}=createManorCraft({box,mesh,beam:localBeam,finish,polyhedron:buildAutoMoviePolyhedron,revolve:revolveAutoMovieProfile,extrude:extrudeAutoMovieRegion,V,Q,registerMechanism:m=>mechanisms.push(m)});
const room=(id,label,level,bounds,door)=>rooms.push({id,label,level,bounds,door});
const chimneyCut=[-6.50,-5.60,-1.90,-.70];
room('hall','생활 홀',0,[-7.38,-4.72,-1.2,5.75],[-4.60,3.85]);
room('kitchen','주방',0,[-7.35,-3.4,-5.25,-1.48],[-3.95,-1.36]);
room('pantry','식료실',0,[-3.2,-1.6,-5.25,-1.48],[-2.4,-1.36]);
room('ledger','서재·장부실',0,[3.2,7.35,-5.25,-1.48],[3.95,-1.36]);
room('service','저장·세척실',0,[4.72,7.35,-1.2,5.75],[4.60,3.85]);
room('entrance','현관·계단 하부',0,[-1.4,3,-5.25,-1.48],[.8,-1.36]);
room('gallery-west','서쪽 회랑',0,[-4.48,-3.25,0,5.75],[-3.85,5.75]);
room('gallery-rear','뒤쪽 회랑',0,[-4.48,4.48,-1.24,0],[0,0]);
room('gallery-east','동쪽 회랑',0,[3.25,4.48,0,5.75],[3.85,5.75]);
room('master','주침실',1,[-7.35,-3.35,.15,5.75],[-4.45,.05]);
room('child-west','작은 침실 서쪽',1,[-7.35,-1.45,-5.25,-1.85],[-4.45,-1.75]);
room('child-east','작은 침실 동쪽',1,[3.1,7.35,-5.25,-1.85],[4.45,-1.75]);
room('washroom','공동 세척·측간실',1,[3.35,4.9,.15,5.75],[4.1,.05]);
room('storage','공용 수납',1,[5.1,7.35,.15,5.75],[5.75,.05]);
room('corridor','2층 일자 복도',1,[-5.6,6.4,-1.65,-.15],[2.4,-1.65]);
room('landing','2층 계단참',1,[1.8,3,-5.25,-1.65],[2.4,-1.65]);
for(const r of rooms){const [a,b,c,d]=r.bounds;r.polygon=[[a,c],[b,c],[b,d],[a,d]];}
rooms.find(r=>r.id==='master').polygon=[[-7.35,-1.65],[-6.62,-1.65],[-6.62,-.58],[-5.8,-.58],[-5.8,.15],[-3.35,.15],[-3.35,5.75],[-7.35,5.75]];
rooms.find(r=>r.id==='storage').polygon=[[6.6,-1.65],[7.35,-1.65],[7.35,5.75],[5.1,5.75],[5.1,.15],[6.6,.15]];
rooms.find(r=>r.id==='landing').polygon=[[1.8,-5.25],[3,-5.25],[3,-1.75],[-1.3,-1.75],[-1.3,-2.60],[0,-2.60],[0,-3.94],[1.8,-3.94]];
const levels=[.45,3.33],H=2.66;
// Each wall is one thick boundary with actual holes, not two competing facades.
function wall(id,a,b,level,openings=[],exterior=false){
 const y=levels[level],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx),r=Q([0,1,0],angle);
 const pt=(s,yy,dep=0)=>[a[0]+dx*s/length+Math.sin(angle)*dep,yy,a[1]+dz*s/length+Math.cos(angle)*dep];
 // Full-height opening posts, lintels and continuous wall plates own the load path.
 const gaps=openings.map(o=>[o.at-o.w/2,o.at+o.w/2,o.sill||0,(o.sill||0)+o.h]);
 const studs=[[0,.16],[length-.16,length]];const count=Math.ceil(length/1.5);
 for(let i=1;i<count;i++){const p=length*i/count;if(!openings.some(o=>Math.abs(p-o.at)<o.w/2+.32))studs.push([p-.08,p+.08]);}
 for(const o of openings)studs.push([o.at-o.w/2-.16,o.at-o.w/2],[o.at+o.w/2,o.at+o.w/2+.16]);
 const shaftAlong=Math.abs(dx)>Math.abs(dz)?[chimneyCut[0]-a[0],chimneyCut[1]-a[0]].map(v=>v*Math.sign(dx)).sort((a,b)=>a-b):[chimneyCut[2]-a[1],chimneyCut[3]-a[1]].map(v=>v*Math.sign(dz)).sort((a,b)=>a-b);
 const crossesShaft=Math.abs(dx)>Math.abs(dz)?a[1]>=chimneyCut[2]&&a[1]<=chimneyCut[3]:a[0]>=chimneyCut[0]&&a[0]<=chimneyCut[1];
 const shaftStart=level===0?1.95-y:0;
 const xs=[...new Set([0,length,...gaps.flatMap(g=>g.slice(0,2)),...studs.flat(),...(crossesShaft?[shaftAlong[0]-.12,...shaftAlong,shaftAlong[1]+.12]:[])].filter(v=>v>=0&&v<=length))].sort((a,b)=>a-b);
 const ys=[...new Set([0,.20,H-.28,H,...gaps.flatMap(g=>[g[2],g[3],g[3]+.18,...(g[2]>0?[g[2]-.12]:[])]),...(crossesShaft?[shaftStart]:[])].filter(v=>v>=0&&v<=H))].sort((a,b)=>a-b);
 const cells=xs.slice(0,-1).map((lo,i)=>ys.slice(0,-1).map((low,j)=>{
  const p=(lo+xs[i+1])/2,v=(low+ys[j+1])/2;
  if(gaps.some(g=>p>g[0]&&p<g[1]&&v>g[2]&&v<g[3])||crossesShaft&&p>shaftAlong[0]&&p<shaftAlong[1]&&v>=shaftStart)return null;
  if(crossesShaft&&p>shaftAlong[0]-.12&&p<shaftAlong[1]+.12)return 'stone';
  const narrowInfill=xs[i+1]-lo<.065&&studs.some(t=>Math.abs(t[1]-lo)<1e-7||Math.abs(t[0]-xs[i+1])<1e-7);
  return narrowInfill||v<.20||v>H-.28||studs.some(t=>p>t[0]&&p<t[1])||gaps.some(g=>p>=g[0]&&p<=g[1]&&(v>=g[3]&&v<g[3]+.18||g[2]>0&&v>g[2]-.12&&v<g[2]))?'oak':'plaster';
 }));
 const faces={oak:[],plaster:[],stone:[]},wallFrames=[],depth=m=>m==='plaster'?.10:.12;
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
  const m=cells[i][j];if(!m)continue;const u0=xs[i],u1=xs[i+1],v0=ys[j],v1=ys[j+1],d=depth(m),p=(u,v,z)=>pt(u,y+v,id==='outer-west-0'&&u>=2.93-1e-8&&u<=4.195+1e-8&&Math.abs(z-.10)<1e-8?z-.045:z);
  const along=(u0+u1)/2,vertical=studs.some(t=>along>=t[0]&&along<=t[1])&&v0>=.20&&v1<=H-.28;
  const timberFrame={grainAxis:vertical?[0,1,0]:[dx/length,0,dz/length],origin:pt(vertical?(u0+u1)/2:0,y,0)};
  const push=face=>{faces[m].push(face);if(m==='oak')wallFrames.push({...timberFrame,count:face.length});};
  push([p(u0,v0,d),p(u1,v0,d),p(u1,v1,d),p(u0,v1,d)]);push([p(u1,v0,-d),p(u0,v0,-d),p(u0,v1,-d),p(u1,v1,-d)]);
  for(const [ni,nj,a0,b0]of [[i-1,j,[u0,v0],[u0,v1]],[i+1,j,[u1,v1],[u1,v0]],[i,j-1,[u1,v0],[u0,v0]],[i,j+1,[u0,v1],[u1,v1]]]){
   const n=cells[ni]?.[nj];if(n&&depth(n)>=d)continue;const intervals=n?[[-d,-depth(n)],[depth(n),d]]:[[-d,d]];
   for(const [za,zb]of intervals)push([p(...a0,za),p(...b0,za),p(...b0,zb),p(...a0,zb)].reverse());
  }
 }
 for(const [m,f]of Object.entries(faces))if(f.length)mesh(id+'-'+m,buildAutoMoviePolyhedron(f.map(f=>f.map(V))),[0,0,0],m,undefined,{faceFrames:m==='oak'?wallFrames:undefined});
 // Braces live outside the recessed infill, on both exposed faces of broad solid bays.
 const spans=studs.map(t=>[Math.max(0,t[0]),Math.min(length,t[1])]).sort((a,b)=>a[0]-b[0]);
 if(exterior)for(let i=0;i<spans.length-1;i++){const lo=spans[i][1],hi=spans[i+1][0];if(hi-lo<.65||gaps.some(g=>hi>g[0]&&lo<g[1])||crossesShaft&&hi>shaftAlong[0]-.12&&lo<shaftAlong[1]+.12)continue;
  for(const side of [-1,1]){
   // Ends are horizontal seats in the sill/header, with a recessed infill behind.
   const h0=.19,h1=H-.27,slope=(hi-lo)/(h1-h0),half=.035*Math.sqrt(1+slope*slope),corners=[[lo-half,h0],[lo+half,h0],[hi+half,h1],[hi-half,h1]],f=[];
   const inset=id==='outer-west-0'&&i===3&&side===1?.045:0; if(inset&&Math.abs(lo-2.93)+Math.abs(hi-4.195)>1e-7)throw new Error('Hall flush brace bay changed'); const fa=corners.map(([u,v])=>pt(u,y+v,side*.165-inset)),fb=corners.map(([u,v])=>pt(u,y+v,side*.11-inset));f.push(fa,fb.toReversed());for(let j=0;j<4;j++)f.push([fa[j],fb[j],fb[(j+1)%4],fa[(j+1)%4]]);
   mesh(id+'-brace-'+i+'-'+side,buildAutoMoviePolyhedron(f.map(f=>f.map(V))),[0,0,0],'oak',undefined,{grainAxis:[dx/length*(hi-lo),h1-h0,dz/length*(hi-lo)],origin:pt(lo,y+h0,side*.1375-inset)});
   for(const [u,v]of [[lo,.23],[hi,H-.31]])box(id+'-brace-peg-'+i+'-'+side+'-'+v,[.02,.02,.014],pt(u,y+v,side*.167-inset),'oakLight',r);
  }
 }
 for(const o of openings){
  const bottom=y+(o.sill||0),top=bottom+o.h;
  if(o.sill){
   const flushSill=o.id==='ww-a-0'||o.id==='ww-b-0'; box(o.id+'-sill-lip',[o.w+.28,.06,flushSill?.27:.30],pt(o.at,bottom-.07,flushSill?-.015:0),'oak',r);
   box(o.id+'-jamb-left',[.07,o.h+.18,.08],pt(o.at-o.w/2-.035,(bottom+top)/2),'oak',r);
   box(o.id+'-jamb-right',[.07,o.h+.18,.08],pt(o.at+o.w/2+.035,(bottom+top)/2),'oak',r);
   box(o.id+'-lintel',[o.w+.14,.08,.08],pt(o.at,top+.04),'oak',r);
   box(o.id+'-mullion',[.042,o.h,.045],pt(o.at,(bottom+top)/2),'oak',r);
   const panels=[];
   for(const side of [-1,1]){
    const leaf=o.id+'-casement-'+side,w=o.w/2-.034,hinge=o.at+side*(o.w/2-.006),inner=hinge-side*w,center=(hinge+inner)/2;
    box(leaf+'-glass',[w-.028,o.h-.028,.016],pt(center,(bottom+top)/2),'glass',r);
    for(const pos of [hinge-side*.014,inner+side*.014])box(leaf+'-stile-'+pos,[.028,o.h,.044],pt(pos,(bottom+top)/2,.010),'oak',r);
    for(const yy of [bottom+.015,top-.015])box(leaf+'-rail-'+yy,[w,.030,.044],pt(center,yy,.010),'oak',r);
    box(leaf+'-transom',[w-.028,.025,.03],pt(center,bottom+o.h*.58,.010),'oak',r);
    const low=Math.min(hinge,inner)+.014,high=Math.max(hinge,inner)-.014;
    for(const slope of [-1.6,1.6])for(let k=Math.floor(Math.min(0,-slope*o.w)/.225);k<=Math.ceil(Math.max(o.h,o.h-slope*o.w)/.225);k++){
     const intercept=k*.225,hits=[],left=low-o.at+o.w/2,right=high-o.at+o.w/2;
     for(const xx of [left,right]){const yy=slope*xx+intercept;if(yy>=.014&&yy<=o.h-.014)hits.push([xx,yy]);}
     for(const yy of [.014,o.h-.014]){const xx=(yy-intercept)/slope;if(xx>left&&xx<right)hits.push([xx,yy]);}
     if(hits.length===2){
      const ends=hits.sort((a,b)=>a[1]-b[1]);
      for(const [segment,lo,hi]of [[0,.014,o.h*.58-.0125],[1,o.h*.58+.0125,o.h-.014]]){
       const a=Math.max(lo,ends[0][1]),b=Math.min(hi,ends[1][1]);
       if(b>a)localBeam(leaf+'-lead-'+slope+'-'+k+'-'+segment,pt(o.at-o.w/2+(a-intercept)/slope,bottom+a,.010),pt(o.at-o.w/2+(b-intercept)/slope,bottom+b,.010),.0055,'iron');
      }
     }
    }
    for(const yy of [bottom+.18,top-.18]){
     box(leaf+'-hinge-strap-'+yy,[.028,.027,.009],pt(hinge-side*.011,yy,.0365),'iron',r);
     mesh(leaf+'-hinge-knuckle-'+yy,revolveAutoMovieProfile({profile:[{x:.006,y:0},{x:.011,y:0},{x:.011,y:.042},{x:.006,y:.042},{x:.006,y:0}],segments:20}),pt(hinge,yy-.021,.040),'iron');
     mesh(o.id+'-fixed-hinge-pin-'+side+'-'+yy,revolveAutoMovieProfile({profile:[{x:0,y:0},{x:.011,y:0},{x:.011,y:.006},{x:.0055,y:.006},{x:.0055,y:.057},{x:0,y:.057}],segments:20}),pt(hinge,yy-.027,.040),'iron');
     // The fixed arm is outside the leaf's vertical range. A narrow pintle
     // stem follows the empty hinge axis, never the rotating stile envelope.
     const seat=yy<bottom+o.h/2?bottom-.045:top+.045;
     box(o.id+'-fixed-hinge-strap-'+side+'-'+yy,[.092,.018,.014],pt(hinge+side*.038,seat,.040),'iron',r);
     mesh(o.id+'-fixed-hinge-stem-'+side+'-'+yy,revolveAutoMovieProfile({profile:[{x:0,y:0},{x:.0055,y:0},{x:.0055,y:Math.abs(yy-seat)},{x:0,y:Math.abs(yy-seat)}],segments:20}),pt(hinge,Math.min(yy,seat),.040),'iron');
     for(const xx of [hinge-side*.007,hinge-side*.019])box(leaf+'-hinge-rivet-'+yy+'-'+xx,[.006,.008,.013],pt(xx,yy,.037),'ironWarm',r);
    }
    box(leaf+'-catch-plate',[.022,.070,.010],pt(inner+side*.014,bottom+.46,.037),'iron',r);
    localBeam(leaf+'-catch-handle',pt(inner+side*.014,bottom+.46,.039),pt(inner+side*.014,bottom+.50,.061),.010,'iron');
    const moving=travellingParts(leaf,id,level,p=>p.id.startsWith(leaf+'-'),pt(hinge,bottom,.040),angle+(side===1?Math.PI:0),[0,1,0],side*Math.PI*.42);
    panels.push({...moving,width:w,height:o.h});
   }
   o.operation={panels,states:[{id:'closed',panels:panels.map(p=>({panel:p.id,value:0}))},{id:'vent',panels:panels.map(p=>({panel:p.id,value:(p.motion.min+p.motion.max)/3}))},{id:'open',panels:panels.map(p=>({panel:p.id,value:p.motion.min+p.motion.max}))}],state:'closed',hardware:[{id:o.id+'-fixed-frame',kind:'frame-and-pintles',element:id}]};
  }else{
   // Open leaf, pivot at the opening's left jamb. Observation can also close it.
   const pivot=pt(o.at-o.w/2+.004,bottom+.02,-.031),groupId=o.id+'-leaf';
   const saved=parts;parts=[];
   const leafW=o.w-.035,leafH=o.h-.055;
   for(let k=0;k<6;k++)bevel(groupId+'-plank-'+k,[leafW/6-.0015,leafH,.048],[(k+.5)*leafW/6,leafH/2,0],k%3?'oak':'oakLight',undefined,.003);
   box(groupId+'-tongue-rebates',[leafW-.008,leafH-.008,.014],[leafW/2,leafH/2,0],'oak');
   for(const yy of [.22,leafH-.22])bevel(groupId+'-rail-'+yy,[leafW-.05,.12,.038],[leafW/2,yy,.043],'oakLight',undefined,.006);
   localBeam(groupId+'-rising-brace',[.09,.282,.043],[leafW-.09,leafH-.282,.043],.046,'oakLight');
   const fittings=craftAt(0,0,0);
   for(const yy of [.22,leafH-.22]){
    box(groupId+'-strap-'+yy,[leafW*.70,.055,.010],[leafW*.35,yy,-.030],'iron');
    mesh(groupId+'-hinge-knuckle-'+yy,revolveAutoMovieProfile({profile:[{x:.008,y:0},{x:.022,y:0},{x:.022,y:.13},{x:.008,y:.13},{x:.008,y:0}],segments:24}),[.004,yy-.065,-.031],'iron');
    for(let j=0;j<5;j++)box(groupId+'-strap-rivet-'+yy+'-'+j,[.018,.018,.024],[.09+j*leafW*.12,yy,-.032],'iron');
   }
   const latchY=leafH*.52;
   box(groupId+'-latch-plate',[.07,.16,.012],[leafW-.14,latchY,-.031],'iron');
   box(groupId+'-latch-bar',[.24,.028,.018],[leafW-.095,latchY,-.049],'iron');
   box(groupId+'-latch-pivot',[.018,.018,.020],[leafW-.19,latchY,-.061],'ironWarm');
   fittings.hoop(groupId+'-ring-handle',[leafW-.14,latchY-.064,-.068],.045,.010,'iron');
   fittings.tube(groupId+'-ring-eye',[[leafW-.14,latchY-.019,-.030],[leafW-.14,latchY-.019,-.072]],.012,'iron');
   box(groupId+'-reverse-handle-plate',[.06,.16,.011],[leafW-.14,latchY,.031],'iron');
   localBeam(groupId+'-through-spindle',[leafW-.14,latchY,-.055],[leafW-.14,latchY,.057],.012,'iron');
   fittings.hoop(groupId+'-reverse-ring',[leafW-.14,latchY-.064,.062],.045,.010,'iron');
   fittings.tube(groupId+'-reverse-eye',[[leafW-.14,latchY-.019,.030],[leafW-.14,latchY-.019,.066]],.012,'iron');
   box(groupId+'-thumb-lift',[.065,.016,.047],[leafW-.115,latchY+.037,.049],'iron');
   if(o.id==='wash-door'){
    box(groupId+'-privacy-bolt',[.22,.023,.021],[leafW-.06,latchY+.18,.045],'iron');
    for(const xx of [leafW-.13,leafW-.015]){
     box(groupId+'-bolt-guide-back-'+xx,[.027,.052,.0095],[xx,latchY+.18,.02875],'iron');
     box(groupId+'-bolt-guide-bottom-'+xx,[.027,.012,.044],[xx,latchY+.18-.0175,.046],'iron');
     box(groupId+'-bolt-guide-top-'+xx,[.027,.012,.044],[xx,latchY+.18+.0195,.046],'iron');
     box(groupId+'-bolt-guide-front-'+xx,[.027,.052,.012],[xx,latchY+.18,.068],'iron');
    }
    localBeam(groupId+'-bolt-knob',[leafW-.09,latchY+.18,.06],[leafW-.09,latchY+.21,.084],.012,'iron');
   }
   for(const yy of [latchY-.055,latchY+.055])box(groupId+'-latch-rivet-'+yy,[.013,.013,.024],[leafW-.14,yy,-.033],'iron');
   // The rotating frame's origin is the actual pintle axis, not the plank corner.
   for(const p of parts){p.transform.translation.x-=.004;p.transform.translation.z+=.031;}
   finish(groupId,level,'door');parts=saved;
   // Fixed pintles and keeper belong to the jamb, not to the rotating leaf.
   for(const yy of [.22,leafH-.22]){
    box(o.id+'-jamb-strap-'+yy,[.13,.055,.012],pt(o.at-o.w/2-.085,bottom+.02+yy,-.030),'iron',r);
    localBeam(o.id+'-pintle-drop-'+yy,pt(o.at-o.w/2-.026,bottom+.02+yy,-.031),pt(o.at-o.w/2-.026,bottom+.02+yy-.070,-.031),.012,'iron');
    localBeam(o.id+'-pintle-arm-'+yy,pt(o.at-o.w/2-.026,bottom+.02+yy-.070,-.031),pt(o.at-o.w/2+.004,bottom+.02+yy-.070,-.031),.010,'iron');
    mesh(o.id+'-pintle-'+yy,revolveAutoMovieProfile({profile:[{x:0,y:0},{x:.022,y:0},{x:.022,y:.01},{x:.0075,y:.01},{x:.0075,y:.15},{x:0,y:.15}],segments:24}),pt(o.at-o.w/2+.004,bottom+.02+yy-.075,-.031),'iron');
   }
   box(o.id+'-keeper',[.06,.08,.018],pt(o.at+o.w/2+.02,bottom+.02+latchY,-.040),'iron',r);
   if(o.id==='wash-door')box(o.id+'-privacy-keeper',[.055,.05,.024],pt(o.at+o.w/2+.013,bottom+.02+latchY+.18,.044),'iron',r);
   entries.at(-1).pose={pivot,closedAngle:angle,angle:angle+(['master-door','wash-door','storage-door'].includes(o.id)?-1:1)*Math.PI/2};
   const travel=entries.at(-1).pose.angle-angle;
   o.operation={panels:[{id:groupId,element:groupId,width:leafW,height:leafH,motion:{kind:'revolute',axis:V([0,1,0]),pivot:V([0,0,0]),min:Math.min(0,travel),max:Math.max(0,travel)}}],states:[{id:'closed',panels:[{panel:groupId,value:0}]},{id:'open',panels:[{panel:groupId,value:travel}]}],state:'open',hardware:[{id:o.id+'-fixed-jamb',kind:'pintles-and-keeper',element:id}]};
   portals.push({id:o.id,level,eye:pt(o.at,y+1.6),a,b,width:o.w,height:o.h});
  }
 }
 boundaries.push({id,a,b,level,openings,exterior,owner:id,faces:['inside','outside','top','bottom','ends','opening-reveals']});finish(id,level,'wall',{frontAngle:angle});
}
const win=(id,at,w=.78)=>({id,at,w,h:1.12,sill:.95});const door=(id,at,w=.95)=>({id,at,w,h:2.12});
for(let l=0;l<2;l++){
 wall('outer-north-'+l,[-7.6,-5.4],[7.6,-5.4],l,[win('nw-'+l,2.2),win('nc-'+l,5.1),win('ne-'+l,12.6)],true);
 wall('outer-west-'+l,[-7.5,6],[-7.5,-5.4],l,[win('ww-a-'+l,2.1),win('ww-b-'+l,5.1),win('ww-c-'+l,9.2)],true);
 wall('outer-east-'+l,[7.5,-5.4],[7.5,6],l,[win('ew-a-'+l,2.0),win('ew-b-'+l,6.4),win('ew-c-'+l,9.3)],true);
 wall('gable-west-'+l,[-7.6,5.9],[-3.25,5.9],l,[win('sw-'+l,2.0)],true);
 wall('gable-east-'+l,[3.25,5.9],[7.6,5.9],l,[win('se-'+l,2.1)],true);
 if(l===1){
  wall('court-west-upper',[-3.35,5.9],[-3.35,0],l,[win('cw-a',1.8),win('cw-b',4.5)],true);
  wall('court-east-upper',[3.35,0],[3.35,5.9],l,[win('ce-a',1.5),win('ce-b',4.5)],true);
  wall('court-rear-upper',[-3.25,-.1],[3.25,-.1],l,[win('cr-a',1.25),win('cr-b',5.25)],true);
 }
}
wall('hall-gallery',[-4.60,5.8],[-4.60,-1.36],0,[door('hall-door',1.95,1.05),win('hall-court-window',4.8)]);
wall('service-gallery',[4.60,-1.36],[4.60,5.8],0,[door('service-door',5.21),win('service-court-window',2.16)]);
wall('kitchen-front',[-7.4,-1.36],[-3.3,-1.36],0,[door('kitchen-door',3.45)]);
wall('pantry-front',[-3.3,-1.36],[-1.5,-1.36],0,[door('pantry-door',.9,.90)]);
wall('ledger-front',[3.1,-1.36],[7.4,-1.36],0,[door('ledger-door',.85)]);
wall('kitchen-pantry',[-3.3,-5.3],[-3.3,-1.36],0);
wall('pantry-entrance',[-1.5,-5.3],[-1.5,-1.36],0);
wall('entrance-ledger',[3.1,-5.3],[3.1,-1.36],0);
wall('entrance-front',[-1.5,-1.36],[3.1,-1.36],0,[door('entrance-door',2.3,1.2)]);
wall('child-west-front',[-7.4,-1.75],[-1.4,-1.75],1,[door('child-west-door',2.95)]);
wall('child-west-stair',[-1.4,-5.3],[-1.4,-1.75],1);
wall('child-east-front',[3.1,-1.75],[7.4,-1.75],1,[door('child-east-door',1.35)]);
wall('child-east-stair',[3.1,-5.3],[3.1,-1.75],1);
wall('master-front',[-5.7,.05],[-3.35,.05],1,[door('master-door',1.25)]);
wall('corridor-west-end',[-5.7,-1.65],[-5.7,.05],1);
wall('wash-front',[3.35,.05],[5,.05],1,[door('wash-door',.75,.90)]);
wall('storage-front',[5,.05],[6.5,.05],1,[door('storage-door',.75,.90)]);
wall('corridor-east-end',[6.5,.05],[6.5,-1.65],1);
wall('wash-storage',[5,.05],[5,5.8],1);
// A privacy screen inside the washroom does not create a second circulation room.
wall('wash-screen',[3.45,2.6],[4.1,2.6],1);
const footprint=(x,z)=>x>=-7.6&&x<=7.6&&z>=-5.5&&z<=6&&!(Math.abs(x)<3.25&&z>0);
const holes=[[-1.4,0,-5.35,-2.60],[0,1.8,-5.35,-3.94]];
function slab(id,y,thick,hole=false,mat='upper'){
 const outline=[[-7.6,-5.5],[7.6,-5.5],[7.6,6],[3.25,6],[3.25,0],[-3.25,0],[-3.25,6],[-7.6,6]];
 const voids=[];
 if(hole)voids.push([[-1.4,-5.35],[1.8,-5.35],[1.8,-3.94],[0,-3.94],[0,-2.60],[-1.4,-2.60]]);
 if(y>3){const [a,b,c,d]=chimneyCut;voids.push([[a,c],[b,c],[b,d],[a,d]]);}
 const finishDepth=id==='ground-floor'||id==='upper-floor'?.006:0;
 mesh(id+'-solid',extrudeAutoMovieRegion({outer:outline.map(([x,y])=>({x,y})),holes:voids.map(poly=>poly.map(([x,y])=>({x,y}))),depth:thick-finishDepth}),[0,y-(thick+finishDepth)/2,0],mat,Q([1,0,0],Math.PI/2));
 if(id==='ground-floor'||id==='upper-floor'){
  // A 6 mm finish occupies the slab top; no boards cross court/shaft/stair voids.
  const stoneFloor=id==='ground-floor';
  for(let iz=0,z=-5.49;z<5.999;z+=stoneFloor?.52:.24,iz++){
   const dz=Math.min(stoneFloor?.52:.24,6-z),rowOffset=(iz%3)*.43;
   for(let ix=0,x=-7.6-rowOffset;x<7.6;x+=stoneFloor?.74:1.72,ix++){
    const end=Math.min(7.6,x+(stoneFloor?.74:1.72)),start=Math.max(-7.6,x),cutsX=[start,end],cutsZ=[z,z+dz];
    for(const xx of [-3.25,3.25,...voids.flat().map(p=>p[0])])if(xx>start&&xx<end)cutsX.push(xx);
    for(const zz of [0,...voids.flat().map(p=>p[1])])if(zz>z&&zz<z+dz)cutsZ.push(zz);
    cutsX.sort((a,b)=>a-b);cutsZ.sort((a,b)=>a-b);
    for(let i=0;i<cutsX.length-1;i++)for(let j=0;j<cutsZ.length-1;j++){
     const x0=cutsX[i],x1=cutsX[i+1],z0=cutsZ[j],z1=cutsZ[j+1],cx=(x0+x1)/2,cz=(z0+z1)/2;
     if(!footprint(cx,cz)||voids.some(p=>cx>Math.min(...p.map(q=>q[0]))&&cx<Math.max(...p.map(q=>q[0]))&&cz>Math.min(...p.map(q=>q[1]))&&cz<Math.max(...p.map(q=>q[1]))&&(()=>{let inPoly=false;for(let a=0,b=p.length-1;a<p.length;b=a++)if((p[a][1]>cz)!==(p[b][1]>cz)&&cx<(p[b][0]-p[a][0])*(cz-p[a][1])/(p[b][1]-p[a][1])+p[a][0])inPoly=!inPoly;return inPoly;})()))continue;
     if(x1-x0<.012||z1-z0<.012)continue;
     box(id+'-finish-'+iz+'-'+ix+'-'+i+'-'+j,[x1-x0-.004,.006,z1-z0-.003],[cx,y-.003,cz],stoneFloor?(ix+iz)%3?'floor':'stoneLight':(ix+iz)%4?'upper':'oakPale');
    }
   }
  }
 }
 finish(id,y<1?0:1,'slab');
}
slab('foundation',.38,.38,false,'stone');
// Bonded courses follow all eight edges of the actual U, including the court.
const baseOutline=[[-7.6,-5.5],[7.6,-5.5],[7.6,6],[3.25,6],[3.25,0],[-3.25,0],[-3.25,6],[-7.6,6]];
for(let side=0;side<baseOutline.length;side++){
 const a=baseOutline[side],b=baseOutline[(side+1)%baseOutline.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
 for(let row=0;row<2;row++)for(let k=0,u=-.31*(row%2);u<len;u+=.63,k++){
  const lo=Math.max(.015,u),hi=Math.min(len-.015,u+.618);if(hi-lo<.02)continue;const c=(lo+hi)/2,x=a[0]+(b[0]-a[0])*c/len,z=a[1]+(b[1]-a[1])*c/len;
  bevel('foundation-block-'+side+'-'+row+'-'+k,[hi-lo,.178,.13],[x,row*.19+.094,z],(row+k)%3?'stone':'stoneLight',Q([0,1,0],angle),.016);
 }
}finish('foundation-masonry',0,'masonry');
slab('ground-floor',.45,.07,false,'floor');slab('upper-floor',3.33,.22,true);slab('upper-ceiling',6.12,.13,false,'plaster');
// Continuous gallery supports. The upper storey covers the gallery, not an added building.
for(const x of [-3.29,3.29])for(let i=0;i<5;i++){
 const z=i*1.45;box('pier-'+x+'-'+i,[.18,.60,.18],[x,.30,z],'stone');box('gallery-post-'+x+'-'+i,[.14,2.51,.14],[x,1.855,z]);
 if(i<4)beam('brace-'+x+'-'+i,[x,2.68,z],[x,3.05,z+.38],.10);
}for(const x of [-2.1,-.9,2.1]){
 // Each stone pier reaches ground; a gallery edge must not leave the post unsupported.
 box('rear-pier-'+x,[.18,.60,.18],[x,.30,-.05],'stone');
 box('rear-post-'+x,[.14,2.51,.14],[x,1.855,-.05]);
 beam('rear-brace-'+x,[x,2.65,-.05],[x-.38,3.02,-.05],.10);
}
for(const x of [-3.35,3.35])box('gallery-long-beam-'+x,[.22,.22,5.89],[x,3.11,3.055]);box('gallery-rear-beam',[6.92,.22,.22],[0,3.11,0]);finish('gallery-frame',0);
// Joists avoid the real stair opening. Their undersides are explicit frame surfaces.
for(let l=0;l<2;l++)for(let z=-4.98;z<5.9;z+=.60){
 const segs=z<0?[[-7.4,7.4]]:[[-7.4,-3.35],[3.35,7.4]];
 for(const [a,b]of segs){
  const bearerXs=l?[-4.5,0,5.5]:[-5.3,5.5];const voids=[...(l===0?holes:[]),chimneyCut,...bearerXs.map(x=>[x-.01,x+.01,-5.4,l?-.1:-1.3])];let cuts=[a,b];for(const h of voids)if(z>h[2]-.1&&z<h[3]+.1)cuts.push(Math.max(a,h[0]-.1),Math.min(b,h[1]+.1));cuts=cuts.filter(v=>v>=a&&v<=b).sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){const x=(cuts[i]+cuts[i+1])/2;if(voids.some(h=>x>h[0]-.1&&x<h[1]+.1&&z>h[2]-.1&&z<h[3]+.1))continue;if(cuts[i+1]-cuts[i]>.01)box('joist-'+l+'-'+z+'-'+i,[cuts[i+1]-cuts[i],.19,.14],[x,l?5.895:3.015,z]);}
 }
}
for(const x of [-5.3,5.5])box('rear-floor-bearer-'+x,[.22,.28,4.10],[x,2.97,-3.35]);
for(const x of [-4.5,0,5.5])box('ceiling-bearer-'+x,[.22,.28,5.30],[x,5.85,-2.75]);
for(const y of [3.015,5.895]){for(const x of [chimneyCut[0]-.10,chimneyCut[1]+.10])box('shaft-trimmer-'+y+'-'+x,[.20,.19,1.60],[x,y,-1.3]);for(const z of [chimneyCut[2]-.10,chimneyCut[3]+.10])box('shaft-header-'+y+'-'+z,[.90,.19,.20],[-6.05,y,z]);}
for(const [id,a,b]of [['void-south',[-1.4,3,-2.51],[.09,3,-2.51]],['void-inner',[.09,3,-2.6],[.09,3,-3.85]],['void-upper',[0,3,-3.85],[1.89,3,-3.85]],['void-arrival',[1.89,3,-3.94],[1.89,3,-5.3]]]){const dx=Math.abs(b[0]-a[0]),dz=Math.abs(b[2]-a[2]);box(id,[dx||.18,.22,dz||.18],[(a[0]+b[0])/2,3,(a[2]+b[2])/2]);}
finish('floor-joists',-1);
// One L stair: 8 rises to the turn, then 8 to the upper landing.
for(let i=0;i<7;i++)box('lower-tread-'+i,[1.24,.07,.26],[-.66,.45+.18*(i+1)-.035,-2.17-.26*(i+.5)]);
box('turn-landing',[1.24,.12,1.24],[-.66,1.83,-4.61]);
for(let i=0;i<7;i++){const x=-.04+.26*(i+.5);box('upper-tread-'+i,[i===6?.28:.26,.07,1.24],[x+(i===6?.01:0),.45+.18*(9+i)-.035,-4.61]);}
// The supports bear against the complete tread undersides. Their horizontal
// seats stay below each walking surface; an unnotched inclined top intrudes
// above the back of a tread and removes usable width at foot height.
function stairStringerProfile(upper){
 const outer=[];
 for(let i=0;i<7;i++){const y=(upper?2:.56)+.18*i;outer.push({x:.26*i,y},{x:upper&&i===6?1.84:.26*(i+1),y});}
 if(upper)outer.push({x:1.84,y:2.86},{x:0,y:1.77});
 else outer.push({x:1.82,y:1.77},{x:1.95,y:1.77},{x:1.95,y:1.51},{x:.26,y:.45},{x:0,y:.45});
 return extrudeAutoMovieRegion({outer,holes:[],depth:.14});
}
for(const x of [-1.20,-.12])mesh('lower-stringer-'+x,stairStringerProfile(false),[x,0,-2.17],'oak',Q([0,1,0],Math.PI/2));
for(const z of [-5.15,-4.07])mesh('upper-stringer-'+z,stairStringerProfile(true),[-.04,0,z],'oak');
for(const x of [-1.20,-.12])for(const z of [-5.15,-4.07])box('turn-support-'+x+'-'+z,[.14,1.32,.14],[x,1.11,z]);
// Baluster feet sit on tread centres; their tops meet the actual rail line.
function railPost(id,x,z,bottom,top){box(id,[.045,top-bottom,.045],[x,(bottom+top)/2,z]);}
for(const [side,x]of [['outer',-1.25],['inner',-.07]]){
 for(let i=0;i<7;i++){const z=-2.30-i*.26,bottom=.63+i*.18;railPost('lower-'+side+'-'+i,x,z,bottom,bottom+.92);}
 railPost('lower-'+side+'-turn',x,-4.12,1.89,2.81);
 beam('lower-'+side+'-rail',[x,1.55,-2.30],[x,2.81,-4.12],.065);
}
for(const [side,z]of [['outer',-5.20],['inner',-4.02]]){
 for(let i=0;i<7;i++){const x=-.04+.26*(i+.5)+(i===6?.01:0),bottom=2.07+i*.18,top=2.81+(x+.04)*1.44/1.84;railPost('upper-'+side+'-'+i,x,z,bottom,top);}
 railPost('upper-'+side+'-turn',-.04,z,1.89,2.81);
 railPost('upper-'+side+'-arrival',1.84,z,3.33,4.28);
 beam('upper-'+side+'-rail',[-.04,2.81,z],[1.80,4.25,z],.065);
 beam('upper-'+side+'-arrival-rail',[1.80,4.25,z],[1.84,4.28,z],.065);
}
beam('turn-handrail',[-1.25,2.81,-4.12],[-1.25,2.81,-5.20],.065);beam('turn-back-handrail',[-1.25,2.81,-5.20],[-.04,2.81,-5.20],.065);
for(let i=1;i<=8;i++){railPost('turn-side-infill-'+i,-1.25,-4.12-i*1.08/8,1.89,2.81);railPost('turn-back-infill-'+i,-1.25+i*1.21/8,-5.20,1.89,2.81);}
// Upper opening guards, with an open arrival at the top tread.
for(const [a,b]of [[[-1.35,3.33,-2.56],[.04,3.33,-2.56]],[[.04,3.33,-2.56],[.04,3.33,-3.90]],[[.04,3.33,-3.90],[1.84,3.33,-3.90]]]){beam('guard-foot-'+a,a.map((v,i)=>i===1?v+.04:v),b.map((v,i)=>i===1?v+.04:v),.08);beam('guard-top-'+a,a.map((v,i)=>i===1?v+.95:v),b.map((v,i)=>i===1?v+.95:v),.065);const n=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.13);for(let i=0;i<=n;i++)box('guard-'+a+'-'+i,[.035,.95,.035],[a[0]+(b[0]-a[0])*i/n,3.805,a[2]+(b[2]-a[2])*i/n]);}
// Exposed inner edge guards; arrival remains open.
// Square the inside elbow within the rail envelope, instead of cutting
// diagonally across the first upper tread's clear inside corner.
box('inner-turn-join',[.065,.065,.1325],[-.07,2.81,-4.05375]);
beam('arrival-guard-join',[1.84,4.28,-4.02],[1.84,4.28,-3.90],.065);
finish('central-stair',-1,'stair');
// Plain roof planes of three joined gables. Union roof is the higher surface at overlaps.
const roofHeight=(x,z)=>{
 const r=[];if(z<=.30&&z>=-5.85&&Math.abs(x)<=7.95)r.push(6.20+1.10*Math.min(z+5.85,.30-z));
 if(z>=-2.775&&z<=6.35)for(const sign of [-1,1]){const xx=x*sign;if(xx>=2.90&&xx<=7.95)r.push(6.20+1.10*Math.min(xx-2.90,7.95-xx));}return r.length?Math.max(...r):null;
};
// Exact plane intersections own the valleys, avoiding sampled sawtooth joins.
function trianglePrism(id,tri,thick,mat){const low=tri.map(p=>[p[0],p[1]-thick,p[2]]);const faces=[tri,[...low].reverse()];for(let i=0;i<3;i++){const j=(i+1)%3;faces.push([tri[i],low[i],low[j],tri[j]]);}mesh(id,buildAutoMoviePolyhedron(faces.map(f=>f.map(V))),[0,0,0],mat);}
function clipPlan(poly,axis,value,keepLess){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],aa=keepLess?a[axis]<=value:a[axis]>=value,bb=keepLess?b[axis]<=value:b[axis]>=value;if(aa)result.push(a);if(aa!==bb){const t=(value-a[axis])/(b[axis]-a[axis]);result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return result;}
// Cancel opposing shared faces between clipped pieces of the same solid.
// Quantization matches the engine's positional weld tolerance; no outer face
// or triangle winding is changed and disjoint tile gaps remain disjoint.
function exteriorFaces(faces){
 const points=faces.flat(),expanded=[];
 const close=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]))<1e-9;
 const fractions=(a,b,planar=false)=>{
  const axes=planar?[0,2]:[0,1,2],d=axes.map(k=>b[k]-a[k]),length2=d.reduce((s,v)=>s+v*v,0);
  const ts=[0,1];if(length2<1e-18)return ts;
  for(const p of points){const t=axes.reduce((s,k,i)=>s+(p[k]-a[k])*d[i],0)/length2;
   if(t>1e-9&&t<1-1e-9&&Math.hypot(...axes.map((k,i)=>p[k]-a[k]-t*d[i]))<1e-9)ts.push(t);
  }
  return ts.sort((a,b)=>a-b).filter((t,i,all)=>i===0||t-all[i-1]>1e-9);
 };
 const lerp=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
 for(const face of faces){
  if(face.length===4&&Math.hypot(face[0][0]-face[1][0],face[0][2]-face[1][2])<1e-9&&Math.hypot(face[2][0]-face[3][0],face[2][2]-face[3][2])<1e-9){
   const ts=fractions(face[0],face[3],true);
   for(let i=0;i<ts.length-1;i++)expanded.push([lerp(face[0],face[3],ts[i]),lerp(face[1],face[2],ts[i]),lerp(face[1],face[2],ts[i+1]),lerp(face[0],face[3],ts[i+1])]);
  }else{
   // Conforming cap edges retain every T-junction vertex before triangulation.
   const edge=face.flatMap((a,i)=>{const b=face[(i+1)%face.length];return fractions(a,b).slice(0,-1).map(t=>lerp(a,b,t));});
   const center=[0,1,2].map(k=>face.reduce((s,p)=>s+p[k],0)/face.length);
   for(let i=0;i<edge.length;i++)if(!close(edge[i],edge[(i+1)%edge.length]))expanded.push([center,edge[i],edge[(i+1)%edge.length]]);
  }
 }
 const pending=new Map(),removed=new Set();
 const canonical=keys=>keys.map((_,i)=>keys.slice(i).concat(keys.slice(0,i)).join('|')).sort()[0];
 for(let i=0;i<expanded.length;i++){
  const keys=expanded[i].map(p=>p.map(v=>Math.round(v*1e9)||0).join(','));
  const forward=canonical(keys),reverse=canonical([...keys].reverse()),other=pending.get(reverse);
  if(other!==undefined){removed.add(i);removed.add(other);pending.delete(reverse);}
  else pending.set(forward,i);
 }
 return expanded.filter((_,i)=>!removed.has(i));
}
function roofPanel(id,outline,height){
 const [x0,x1,z0,z1]=chimneyCut;
 const overlaps=Math.max(...outline.map(p=>p[0]))>x0&&Math.min(...outline.map(p=>p[0]))<x1&&Math.max(...outline.map(p=>p[1]))>z0&&Math.min(...outline.map(p=>p[1]))<z1;
 const mid=overlaps?clipPlan(clipPlan(outline,0,x0,false),0,x1,true):[];
 const area=p=>p.reduce((s,a,j)=>{const b=p[(j+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0);
 const regions=(overlaps?[clipPlan(outline,0,x0,true),clipPlan(outline,0,x1,false),clipPlan(mid,1,z0,true),clipPlan(mid,1,z1,false)]:[outline]).filter(p=>p.length>=3&&Math.abs(area(p))>.00001);
 const faces=[],points=regions.flat();
 const onSegment=(p,a,b)=>Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))<1e-7&&(p[0]-a[0])*(p[0]-b[0])+(p[1]-a[1])*(p[1]-b[1])<1e-7;
 for(const region of regions){
  const t=triangulateAutoMovieRegion({outer:region.map(([x,z])=>({x,y:z}))});
  for(let i=0;i<t.triangles.length;i+=3){const tri=t.triangles.slice(i,i+3).reverse().map(k=>{const p=t.points[k];return[p.x,height(p.x,p.y),p.y];});faces.push(tri,tri.map(p=>[p[0],p[1]-.16,p[2]]).reverse());}
  const edge=area(region)>0?[...region].reverse():region;
  for(let i=0;i<edge.length;i++){
   const a=edge[i],b=edge[(i+1)%edge.length],len2=(b[0]-a[0])**2+(b[1]-a[1])**2;if(len2<1e-12)continue;
   const split=[...new Set([0,1,...points.filter(p=>onSegment(p,a,b)).map(p=>((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/len2)])].sort((a,b)=>a-b);
   const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   for(let j=0;j<split.length-1;j++){if(split[j+1]-split[j]<1e-8)continue;const p=at(split[j]),q=at(split[j+1]),m=at((split[j]+split[j+1])/2);
    if(regions.some(other=>other!==region&&other.some((v,k)=>onSegment(m,v,other[(k+1)%other.length]))))continue;
    const u=[p[0],height(...p),p[1]],v=[q[0],height(...q),q[1]];faces.push([u,[u[0],u[1]-.16,u[2]],[v[0],v[1]-.16,v[2]],v]);
   }
  }
 }
 mesh(id,buildAutoMoviePolyhedron(faces.map(f=>f.map(V))),[0,0,0],'roof');
 // Tile fragments are clipped to the exact planar roof triangles and flue void.
 // Each course rises at its weather edge; no decorative bar spans below a pitch.
 const tiled={roof:[],roofLight:[],roofMuted:[]},alongX=id.startsWith('rear'),triangles=[];
 for(const region of regions){const t=triangulateAutoMovieRegion({outer:region.map(([x,y])=>({x,y}))});for(let i=0;i<t.triangles.length;i+=3)triangles.push(t.triangles.slice(i,i+3).map(k=>[t.points[k].x,t.points[k].y]));}
 const minX=Math.min(...outline.map(p=>p[0])),maxX=Math.max(...outline.map(p=>p[0])),minZ=Math.min(...outline.map(p=>p[1])),maxZ=Math.max(...outline.map(p=>p[1])),sx=alongX?.27:.225,sz=alongX?.225:.27;
 for(let iz=0;iz<Math.ceil((maxZ-minZ)/sz)+1;iz++)for(let ix=0;ix<Math.ceil((maxX-minX)/sx)+1;ix++){
  const x=minX+ix*sx-(alongX?(iz%2)*sx/2:0),z=minZ+iz*sz-(alongX?0:(ix%2)*sz/2);
  const material=['roof','roofMuted','roofLight'][Math.floor(Math.abs(Math.sin(ix*12.9898+iz*78.233)*43758.5453)%1*3)],
   uphill=alongX?height(x,z+sz)>height(x,z):height(x+sx,z)>height(x,z),
   h=(px,pz)=>{const t=alongX?(pz-z)/sz:(px-x)/sx;return height(px,pz)+.025+.016*(uphill?1-t:t);};
  const tileFaces=[];
  for(const tri of triangles){let p=clipPlan(clipPlan(clipPlan(clipPlan(tri,0,x+.002,false),0,x+sx-.002,true),1,z+.002,false),1,z+sz-.002,true);
   // Four clip passes can return the same corner twice at floating precision.
   // Remove only consecutive coincident points, not collinear boundary vertices.
   p=p.filter((q,i)=>Math.hypot(q[0]-p[(i+p.length-1)%p.length][0],q[1]-p[(i+p.length-1)%p.length][1])>1e-9);
   if(p.length<3||Math.abs(area(p))<1e-8)continue;if(area(p)>0)p.reverse();
   const top=p.map(q=>[q[0],h(...q),q[1]]),bottom=top.map(q=>[q[0],q[1]-.028,q[2]]),f=tileFaces;f.push(top,bottom.toReversed());for(let k=0;k<p.length;k++)f.push([top[k],bottom[k],bottom[(k+1)%p.length],top[(k+1)%p.length]]);
  }
  tiled[material].push(...exteriorFaces(tileFaces));
 }
 for(const [mat,f]of Object.entries(tiled))if(f.length)mesh(id+'-tiles-'+mat,buildAutoMoviePolyhedron(f.map(f=>f.map(V))),[0,0,0],mat);
}
roofPanel('rear-north',[[-7.95,-5.85],[7.95,-5.85],[7.95,-2.775],[-7.95,-2.775]],(x,z)=>6.2+1.1*(z+5.85));
roofPanel('rear-south',[[-7.95,-2.775],[7.95,-2.775],[7.95,.30],[5.425,-2.225],[2.9,.30],[-2.9,.30],[-5.425,-2.225],[-7.95,.30]],(x,z)=>6.53-1.1*z);
for(const sign of [-1,1]){
 roofPanel('wing-inner-'+sign,[[2.9,.30],[5.425,-2.225],[5.425,6.35],[2.9,6.35]].map(([x,z])=>[x*sign,z]),x=>6.2+1.1*(Math.abs(x)-2.9));
 roofPanel('wing-outer-'+sign,[[5.425,-2.225],[7.95,.30],[7.95,6.35],[5.425,6.35]].map(([x,z])=>[x*sign,z]),x=>6.2+1.1*(7.95-Math.abs(x)));
}
// Ridge saddles meet both slopes, separate from the timber ridge below.
for(let k=0,x=-7.92;x<7.92;x+=.31,k++){
 const lo=x,hi=Math.min(7.95,x+.30),c=-2.775,yy=9.5825,ring=u=>[[u,yy-.12,c-.16],[u,yy+.035,c],[u,yy-.12,c+.16],[u,yy-.155,c+.16],[u,yy-.004,c],[u,yy-.155,c-.16]],a=ring(lo),b=ring(hi),f=[];
 for(const ids of [[0,1,4,5],[1,2,3,4]])f.push(ids.map(i=>a[i]).reverse(),ids.map(i=>b[i]));for(let i=0;i<a.length;i++)f.push([a[i],a[(i+1)%a.length],b[(i+1)%a.length],b[i]]);mesh('rear-ridge-tile-'+k,buildAutoMoviePolyhedron(f.map(f=>f.map(V))),[0,0,0],'roofMuted');
}
for(const sign of [-1,1])for(let k=0,z=-2.18;z<6.35;z+=.31,k++){
 const lo=z,hi=Math.min(6.35,z+.30),c=sign*5.425,yy=8.9775,ring=u=>[[c-.16,yy-.12,u],[c,yy+.035,u],[c+.16,yy-.12,u],[c+.16,yy-.155,u],[c,yy-.004,u],[c-.16,yy-.155,u]],a=ring(lo),b=ring(hi),f=[];
 for(const ids of [[0,1,4,5],[1,2,3,4]])f.push(ids.map(i=>a[i]),ids.map(i=>b[i]).reverse());for(let i=0;i<a.length;i++)f.push([a[i],b[i],b[(i+1)%a.length],a[(i+1)%a.length]]);mesh('wing-ridge-tile-'+sign+'-'+k,buildAutoMoviePolyhedron(f.map(f=>f.map(V))),[0,0,0],'roofMuted');
}
finish('roof-envelope',2,'roof');
// Roof load frame: rafters, ties, ridge and valley members beneath the envelope.
beam('rear-ridge',[-7.5,9.30,-2.775],[7.5,9.30,-2.775],.22);
for(let x=-7.3,i=0;x<=7.31;x+=.73,i++){
 beam('rear-rafter-n-'+i,[x,roofHeight(x,-5.50)-.28,-5.50],[x,9.30,-2.775],.14);
 if(Math.abs(x)<2.85)beam('rear-rafter-s-'+i,[x,9.30,-2.775],[x,roofHeight(x,0)-.28,0],.14);
 else{const xx=Math.abs(x),z=xx<=5.425?3.2-xx:xx-7.65;beam('rear-rafter-s-'+i,[x,9.30,-2.775],[x,roofHeight(x,z)-.28,z],.14);}
 if(i%3===0){beam('rear-tie-'+i,[x,6.03,-5.4],[x,6.03,0],.23);beam('rear-king-'+i,[x,6.03,-2.775],[x,9.30,-2.775],.15);}
}
for(const sign of [-1,1]){
 beam('wing-ridge-'+sign,[sign*5.425,8.6975,-2.225],[sign*5.425,8.6975,6.0],.22);
 for(const x of [2.90,7.95])beam('valley-'+sign+'-'+x,[sign*x,5.92,.30],[sign*5.425,8.6975,-2.225],.22);
 for(let i=0,z=-1.90;z<.3;z+=.55,i++){
  const inset=z+2.225,xa=5.425-inset,xb=5.425+inset;
  beam('wing-rafter-jack-in-'+sign+'-'+i,[sign*xa,roofHeight(sign*xa,z)-.28,z],[sign*5.425,8.6975,z],.14);
  beam('wing-rafter-jack-out-'+sign+'-'+i,[sign*5.425,8.6975,z],[sign*xb,roofHeight(sign*xb,z)-.28,z],.14);
 }
 for(let z=.40,i=0;z<6.01;z+=.70,i++){
  beam('wing-rafter-in-'+sign+'-'+i,[sign*3.25,6.285,z],[sign*5.425,8.6975,z],.14);
  beam('wing-rafter-out-'+sign+'-'+i,[sign*5.425,8.6975,z],[sign*7.6,6.285,z],.14);
  if(i%3===0){beam('wing-tie-'+sign+'-'+i,[sign*3.25,6.03,z],[sign*7.6,6.03,z],.23);beam('wing-king-'+sign+'-'+i,[sign*5.425,6.03,z],[sign*5.425,8.6975,z],.15);}
 }
}
for(const x of [chimneyCut[0]-.15,chimneyCut[1]+.15]){const z0=chimneyCut[2]-.15,z1=chimneyCut[3]+.15;beam('shaft-roof-trimmer-'+x,[x,roofHeight(x,z0)-.28,z0],[x,roofHeight(x,z1)-.28,z1],.18);}
for(const z of [chimneyCut[2]-.15,chimneyCut[3]+.15]){const x0=chimneyCut[0]-.15,x1=chimneyCut[1]+.15;beam('shaft-roof-header-'+z,[x0,roofHeight(x0,z)-.28,z],[x1,roofHeight(x1,z)-.28,z],.18);}
finish('roof-frame',2,'roof-frame');
// A faceted solid per boundary: ridge/valley breakpoints, no overlapping strip ends.
function atticWall(id,a,b,breaks){
 const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len*.10,nz=dx/len*.10;
 const count=Math.ceil(len/1.3),studs=Array.from({length:count+1},(_,i)=>[Math.max(0,i/count-.06/len),Math.min(1,i/count+.06/len)]);
 const cuts=[...new Set([0,1,...breaks,...studs.flat()])].sort((a,b)=>a-b),faces={oak:[],plaster:[]},frames=[];
 const p=(t,side,drop=0)=>{const x=a[0]+dx*t+nx*side,z=a[1]+dz*t+nz*side;return[x,roofHeight(x,z)-.18-drop,z];};
 const bottom=(t,side)=>{const q=p(t,side);q[1]=6.10;return q;};
 const add=(m,f,grainAxis=[0,1,0])=>{const fs=f.length===4?[[f[0],f[1],f[2]],[f[0],f[2],f[3]]]:[f];for(const face of fs){faces[m].push(face);if(m==='oak')frames.push({count:face.length,grainAxis,origin:[a[0],6.10,a[1]]});}};
 for(let i=0;i<cuts.length-1;i++){
  const u=cuts[i],v=cuts[i+1];if(v-u<1e-8)continue;const mid=(u+v)/2,mat=studs.some(([a,b])=>mid>a&&mid<b)?'oak':'plaster';
  for(const side of [-1,1]){
   const lower=[bottom(u,side),bottom(v,side),p(v,side,.16),p(u,side,.16)],band=[p(u,side,.16),p(v,side,.16),p(v,side),p(u,side)];
   add(mat,side===1?lower:lower.toReversed());add('oak',side===1?band:band.toReversed(),p(v,side).map((q,k)=>q-p(u,side)[k]));
  }
  add('oak',[p(u,1),p(v,1),p(v,-1),p(u,-1)],p(v,1).map((q,k)=>q-p(u,1)[k]));
  add(mat,[bottom(v,1),bottom(u,1),bottom(u,-1),bottom(v,-1)]);
 }
 for(const t of [0,1]){const f=[bottom(t,1),p(t,1),p(t,-1),bottom(t,-1)];add('oak',t===0?f:f.toReversed());}
 for(const [m,f]of Object.entries(faces))if(f.length)mesh(id+'-'+m,buildAutoMoviePolyhedron(f.map(f=>f.map(V))),[0,0,0],m,undefined,{faceFrames:m==='oak'?frames:undefined});
}
for(const sign of [-1,1])atticWall('front-gable-'+sign,[sign*3.25,5.90],[sign*7.6,5.90],[0,.5,1]);
finish('gable-fill',2,'roof');
// Remaining attic boundary faces close the union roof to the upper ceiling.
for(const [id,a,b]of [['attic-north',[-7.6,-5.4],[7.6,-5.4]],['attic-west',[-7.5,-5.4],[-7.5,5.8]],['attic-east',[7.5,-5.4],[7.5,5.8]],['attic-court-west',[-3.35,-.1],[-3.35,5.9]],['attic-court-east',[3.35,-.1],[3.35,5.9]],['attic-court-rear',[-3.25,-.1],[3.25,-.1]]]){
 const dx=b[0]-a[0],dz=b[1]-a[1],breaks=[0,1];
 if(Math.abs(dz)>.001)for(const z of [-2.775,3.2-Math.abs(a[0]),Math.abs(a[0])-7.65]){const t=(z-a[1])/dz;if(t>0&&t<1)breaks.push(t);}
 if(Math.abs(dx)>.001)for(const x of [-7.95,-5.425,-2.9,2.9,5.425,7.95]){const t=(x-a[0])/dx;if(t>0&&t<1)breaks.push(t);}
 atticWall(id,a,b,[...new Set(breaks)].sort((a,b)=>a-b));
 finish(id,2,'roof');
}
// Two open flues connect the back-to-back hearth zone through both levels.
for(const [id,x,z,w,d]of [['west',-6.44,-1.30,.12,1.20],['east',-5.66,-1.30,.12,1.20],['north',-6.05,-1.84,.66,.12],['south',-6.05,-.76,.66,.12],['divider',-6.05,-1.30,.66,.12]])box('flue-'+id,[w,7.75,d],[x,5.825,z],'stone');
for(const [id,x,z,w,d]of [['west',-6.44,-1.30,.20,1.36],['east',-5.66,-1.30,.20,1.36],['north',-6.05,-1.88,.58,.20],['south',-6.05,-.72,.58,.20],['divider',-6.05,-1.30,.58,.16]])bevel('flue-cap-'+id,[w,.16,d],[x,9.70,z],'stone',undefined,.012);
for(let row=0,y=1.96;y<9.60;y+=.24,row++)for(const [side,a,b]of [['west',[-6.507,-1.9],[-6.507,-.7]],['east',[-5.593,-.7],[-5.593,-1.9]],['north',[-5.6,-1.907],[-6.5,-1.907]],['south',[-6.5,-.693],[-5.6,-.693]]]){
 const len=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
 for(let k=0,u=-.19*(row%2);u<len;u+=.39,k++){const lo=Math.max(.007,u),hi=Math.min(len-.007,u+.382);if(hi-lo<.02)continue;const c=(lo+hi)/2;bevel('chimney-ashlar-'+side+'-'+row+'-'+k,[hi-lo,Math.min(.23,9.62-y),.020],[a[0]+(b[0]-a[0])*c/len,y+Math.min(.23,9.62-y)/2,a[1]+(b[1]-a[1])*c/len],(k+row)%3?'stone':'stoneLight',Q([0,1,0],angle),.004);}
}
finish('chimney',-1,'service-shaft');
// v19: shared-function corrections and room-specific working furniture.
// Keep the six-place furniture intact while leaving a turn past the open
// hall door to both bench ends. The chest faces that southern working area.
table('hall-table',-6.57,.45,2.35,2.25,.80,0,Math.PI/2);bench('hall-bench-west',-7.22,.45,2.35,2.12,.31,0,Math.PI/2);bench('hall-bench-east',-6.01,.45,2.35,2.12,.31,0,Math.PI/2);
chest('hall-chest',-6.72,.45,5.30,1.0,.45,0,Math.PI);rug('hall-rug',-6.55,.45,2.35,1.66,2.55,0);
hearth('hall-hearth',-6.05,.45,-.78,1.45,1.55,.85);
counter('kitchen-counter',-5.8,.44,-4.65,2.5,.65);
// The kitchen hearth backs onto the hall masonry zone, clear of the west window.
hearth('kitchen-hearth',-6.05,.45,-1.98,1.20,1.35,.85);
shelf('pantry-shelves',-2.93,1.30,-3.6,.42,1.70,2.50);
table('ledger-desk',5.6,.42,-3.6,1.5,.75);bench('ledger-seat',5.6,.40,-2.7,.50,.50,0,Math.PI,true);
cabinet('ledger-bookcase',3.85,.45,-5.00,1.15,1.50,.35,0,0,'books');chest('ledger-lockbox',6.60,.45,-1.90,.85,.45,0);
washBasin('service-washbench',6.85,.45,2.5,0);
bed('master-bed',-5.4,3.33,3.8,2.05,1.60);chest('master-chest',-6.65,3.38,1.5,1.10,.50);
bed('child-west-bed',-5.8,3.33,-4.5,2.05,.95);bed('child-east-bed',5.25,3.33,-4.5,2.05,.95);
chest('child-west-chest',-6.40,3.33,-2.38,.90,.44,1);chest('child-east-chest',3.67,3.33,-3.10,.75,.44,1);
table('child-west-desk',-3.15,3.33,-2.55,1.35,.55,1);bench('child-west-stool',-3.15,3.33,-3.15,.42,.42,1);
table('child-east-desk',6.45,3.33,-2.55,1.35,.55,1);bench('child-east-stool',6.45,3.33,-3.15,.42,.42,1);
cabinet('master-cabinet',-3.73,3.33,2.80,.72,1.45,.38,1,-Math.PI/2,'clothes');
nightStand('master-nightstand',-6.84,4.68,1);bench('master-seat',-3.90,3.33,5.25,.52,.43,1,Math.PI/2,true);
washBasin('wash-basin',3.74,3.33,1.75);latrineUnit('latrine',3.88,3.33,3.1);
shelf('storage-shelves',5.35,3.33,3.25,.40,1.60,3.60,1);
chest('storage-chest',6.65,3.36,4.9,.85,.60);
// Circulation rooms carry modest, usable joinery instead of remaining empty camera voids.
bench('gallery-west-bench',-3.85,0,6.55,1.12,.27,-1);bench('gallery-east-bench',3.85,0,6.55,1.12,.27,-1);
bench('gallery-rear-bench',-2.0,0,6.55,1.05,.25,-1);cabinet('gallery-rear-cabinet',.80,.45,-3.40,.62,1.05,.27,0);
rug('upper-corridor-runner',.38,3.33,-.90,10.35,.64,1);rug('landing-runner',2.40,3.33,-3.48,.64,2.20,1);chest('landing-chest',.80,.45,-4.65,.62,.42,0);
bench('entrance-bench',2.72,.42,-2.55,1.10,.28,0,Math.PI/2);cabinet('entrance-cabinet',2.48,.76,-4.55,.52,.95,.34,0,0,'shoes');cabinet('service-cabinet',6.22,.80,5.32,.70,1.25,.36,0,Math.PI,'linen');
serviceTools('service-drying-rack',5.50,4.80);
// Plate backs touch the actual timber face; centres are posts, not glazing/infill.
for(const [id,x,y,z,l,a]of [['hall-lamp',-7.3725,2.27,1.725,0,Math.PI/2],['kitchen-lamp',-4.93,1.92,-5.2725,0,0],['ledger-lamp',-7.6+15.2*10/11,1.92,-5.2725,0,0],['master-lamp',-3.4775,5.08,2.95,1,-Math.PI/2],['corridor-lamp',-.65,5.08,-.2275,1,Math.PI],['landing-lamp',2.9725,5.08,-5.3+3.55*2/3,1,-Math.PI/2]])wallLamp(id,x,y,z,l,a);
createManorGarden({box,mesh,beam:localBeam,finish,polyhedron:buildAutoMoviePolyhedron,revolve:revolveAutoMovieProfile,extrude:extrudeAutoMovieRegion,V,Q,bevel,registerMechanism:m=>mechanisms.push(m)});
// Outside steps reach the raised gallery at its central entrance.
const stepSide=[[0,0],[1.02,0],[1.02,.15],[.68,.15],[.68,.30],[.34,.30],[.34,.45],[0,.45]];
const stepTri=triangulateAutoMovieRegion({outer:stepSide.map(([x,y])=>({x,y}))}),stepFaces=[];
for(let i=0;i<stepTri.triangles.length;i+=3){const f=stepTri.triangles.slice(i,i+3).map(k=>stepTri.points[k]);stepFaces.push(f.map(p=>[-.6,p.y,p.x]),f.toReversed().map(p=>[.6,p.y,p.x]));}
for(let i=0;i<stepSide.length;i++){const a=stepSide[i],b=stepSide[(i+1)%stepSide.length];stepFaces.push([[-.6,a[1],a[0]],[.6,a[1],a[0]],[.6,b[1],b[0]],[-.6,b[1],b[0]]]);}
for(let row=0;row<3;row++)for(let col=0;col<3;col++){
 const h=.45-row*.15;bevel('entry-step-stone-'+row+'-'+col,[.397,h,.338],[-.4+col*.4,h/2,.17+row*.34],(row+col)%3?'stone':'stoneLight',undefined,.006);
}finish('entry-steps',0,'stair');
for(const m of mechanisms){
 const owner=entries.find(e=>e.id===m.parent);if(!owner)throw new Error('Missing mechanism owner: '+m.parent);
 const saved=parts;parts=owner.model.parts;travellingParts(m.id,m.parent,m.level,p=>p.id.startsWith(m.prefix),m.pivot,m.restAngle,m.axis,m.travel,m.kind);owner.model.parts=parts;parts=saved;
 if(m.default!==undefined)entries.at(-1).articulation.default=m.default;
}
{
 const owner=entries.find(e=>e.id==='wash-door-leaf'),saved=parts;parts=owner.model.parts;
 travellingParts('wash-door-privacy-bolt',owner.id,1,p=>p.id===owner.id+'-privacy-bolt'||p.id===owner.id+'-bolt-knob',[.865-.17-.004,2.065*.52+.18-.0115,.076],0,[1,0,0],-.105,'sliding-bolt');
 owner.model.parts=parts;parts=saved;
 const a=entries.at(-1).articulation;a.motion={kind:'prismatic',axis:V([1,0,0]),min:-.105,max:0};a.relativeToParent=true;a.default=1;
 const operation=boundaries.flatMap(b=>b.openings).find(o=>o.id==='wash-door').operation;
 operation.hardware.push({id:'wash-door-privacy-bolt',kind:'sliding-privacy-bolt',element:'wash-door-privacy-bolt'});
}
if(geometryOnly)return {entries,rooms,boundaries,portals,holes,chimneyCut};
const scene=new THREE.Scene();scene.background=new THREE.Color('#ded9cf');
const camera=new THREE.PerspectiveCamera(46.83,1.5,.025,120);
scene.add(new THREE.HemisphereLight('#edf2f5','#827764',1.10));const sun=new THREE.DirectionalLight('#fff1df',2.6);sun.position.set(-12,18,10);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:.1,far:55});sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;scene.add(sun);scene.add(sun.target);
const inspection=new THREE.DirectionalLight('#fff8ed',.50);scene.add(inspection);scene.add(inspection.target);
const objects=new Map();for(const e of entries){const {object}=instanceConsumer?instanceConsumer.build(e):buildModel(e.model,resolveTexture);object.name=e.id;if(e.pose){object.position.set(...e.pose.pivot);object.rotation.y=e.pose.angle;}object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(e.model.parts.find(p=>p.name===o.name)?.material==='glass'){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.35;o.material.depthWrite=false;o.castShadow=false;}}});scene.add(object);objects.set(e.id,object);}
function setArticulation(entry,fraction){
 const a=entry.articulation,o=objects.get(entry.id),t=a.rest,axis=new THREE.Vector3(a.motion.axis.x,a.motion.axis.y,a.motion.axis.z).normalize();
 const value=a.closed+(a.open-a.closed)*fraction,position=new THREE.Vector3(t.translation.x,t.translation.y,t.translation.z),rotation=new THREE.Quaternion(t.rotation.x,t.rotation.y,t.rotation.z,t.rotation.w),scale=new THREE.Vector3(t.scale.x,t.scale.y,t.scale.z);
 if(a.motion.kind==='revolute')rotation.multiply(new THREE.Quaternion().setFromAxisAngle(axis,value));else position.addScaledVector(axis.applyQuaternion(rotation),value);
 const matrix=new THREE.Matrix4().compose(position,rotation,scale);
 if(a.relativeToParent){const parent=objects.get(entry.parent);parent.updateMatrixWorld(true);matrix.premultiply(parent.matrixWorld);}
 matrix.decompose(o.position,o.quaternion,o.scale);
}
const belongs=(id,parent)=>{if(id===parent)return true;const e=entries.find(e=>e.id===id);return Boolean(e?.parent&&belongs(e.parent,parent));};
const objectBounds=id=>{const box=new THREE.Box3();for(const e of entries)if(belongs(e.id,id))box.union(new THREE.Box3().setFromObject(objects.get(e.id)));return box;};
for(const e of entries)if(e.articulation)setArticulation(e,e.articulation.default);
const views=[
 {id:'01-whole-south-east',eye:[20,13,23],at:[0,3,0]}, {id:'02-whole-south-west',eye:[-20,13,23],at:[0,3,0]},
 {id:'03-whole-north-east',eye:[20,12,-23],at:[0,3,0]}, {id:'04-whole-north-west',eye:[-20,12,-23],at:[0,3,0]},
 {id:'exterior-south',eye:[0,6,27],at:[0,3,0]}, {id:'exterior-north',eye:[0,6,-27],at:[0,3,0]}, {id:'exterior-west',eye:[-27,6,0],at:[0,3,0]}, {id:'exterior-east',eye:[27,6,0],at:[0,3,0]},
 {id:'roof-overhead',eye:[0,27,3],at:[0,0,0]}, {id:'ground-plan',eye:[0,26,0],at:[0,0,0],cut:'ground',plan:true}, {id:'upper-plan',eye:[0,27,0],at:[0,3.33,0],cut:'upper',plan:true},
 {id:'stair-section-west',eye:[-7.5,3.5,-3.7],at:[.4,1.9,-3.7],cut:'stair'}, {id:'stair-section-south',eye:[.3,3.5,4],at:[.3,1.9,-3.7],cut:'stair'},
 {id:'frame-axonometric',eye:[19,19,21],at:[0,2,0],cut:'frame'},
 {id:'reference-exterior',eye:[16,7.5,20],at:[0,4.0,0]},
 {id:'reference-courtyard',eye:[.20,1.75,7.70],at:[0,2.5,-.60]},
 {id:'garden-south',eye:[0,1.6,6.6],at:[0,1.5,.1]}, {id:'garden-reverse',eye:[0,2,-.8],at:[0,1.3,5.5]},
 {id:'stair-start',eye:[-.7,2.05,-1.60],at:[-.7,2.0,-4.8]}, {id:'stair-turn',eye:[-.70,3.49,-4.7],at:[2.5,3.6,-4.7]}, {id:'stair-top-return',eye:[2.35,4.93,-4.7],at:[-.7,2.4,-4.7]},
 {id:'landing-to-corridor',eye:[2.35,4.93,-3.4],at:[-1,4.6,-.9]},
 {id:'gallery-turn-west',eye:[-3.9,2.05,-.65],at:[-3.85,1.6,5.4]}, {id:'gallery-turn-east',eye:[3.9,2.05,-.65],at:[3.85,1.6,5.4]},
 {id:'corridor-west-to-east',eye:[-5.1,4.93,-.9],at:[5.9,4.7,-.9]}, {id:'corridor-east-to-west',eye:[6.0,4.93,-.9],at:[-5.1,4.7,-.9]},
];
for(const r of rooms){const [x0,x1,z0,z1]=r.bounds,y=levels[r.level]+1.6,c=[(x0+x1)/2,y,(z0+z1)/2];for(const [id,dx,dz]of [['north',0,-1],['east',1,0],['south',0,1],['west',-1,0]])views.push({id:r.id+'--'+id,eye:c,at:[c[0]+dx,y,c[2]+dz],room:r.id});for(const [id,x,z]of [['corner-a',x0+.25,z0+.25],['corner-b',x1-.25,z1-.25],['corner-c',x0+.25,z1-.25],['corner-d',x1-.25,z0+.25]])views.push({id:r.id+'--'+id,eye:[x,y,z],at:[c[0],y-.3,c[2]],room:r.id});views.push({id:r.id+'--threshold',eye:[r.door[0],y,r.door[1]],at:[c[0],y-.25,c[2]],room:r.id});}
for(const r of rooms.filter(r=>r.polygon.length>4)){
 const contains=p=>{let inside=false;for(let i=0,j=r.polygon.length-1;i<r.polygon.length;j=i++){const a=r.polygon[i],b=r.polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 for(let i=0;i<r.polygon.length;i++){const p=r.polygon[i],a=r.polygon[(i+r.polygon.length-1)%r.polygon.length],b=r.polygon[(i+1)%r.polygon.length];let dx=(a[0]-p[0])/Math.hypot(a[0]-p[0],a[1]-p[1])+(b[0]-p[0])/Math.hypot(b[0]-p[0],b[1]-p[1]),dz=(a[1]-p[1])/Math.hypot(a[0]-p[0],a[1]-p[1])+(b[1]-p[1])/Math.hypot(b[0]-p[0],b[1]-p[1]);if(!contains([p[0]+dx*.22,p[1]+dz*.22])){dx=-dx;dz=-dz;}const eye=[p[0]+dx*.22,levels[r.level]+1.6,p[1]+dz*.22];views.push({id:r.id+'--polygon-corner-'+i,room:r.id,eye,at:[eye[0]+dx,eye[1]-.2,eye[2]+dz]});}
}
// Additional views retain the original required room views and resolve observed occlusions.
for(const r of rooms){const [x0,x1,z0,z1]=r.bounds,y=levels[r.level]+1.6,c=[(x0+x1)/2,y,(z0+z1)/2];if(!r.id.startsWith('gallery')&&r.id!=='landing'&&r.id!=='corridor'){const dx=c[0]-r.door[0],dz=c[2]-r.door[1],d=Math.hypot(dx,dz);views.push({id:r.id+'--inside-entry',eye:[r.door[0]+dx/d*.65,y,r.door[1]+dz/d*.65],at:[c[0],y-.4,c[2]],room:r.id});}}
views.push(
 {id:'storage--nook-in',eye:[6.92,4.93,-1.15],at:[6.92,4.55,2.5],room:'storage'},
 {id:'storage--nook-return',eye:[6.92,4.93,1.4],at:[6.92,4.5,-1.5],room:'storage'},
 {id:'master--shaft-clear',eye:[-6.98,4.93,-1.1],at:[-6.6,4.45,.7],room:'master'},
 {id:'pantry--aisle-high',eye:[-2.2,2.85,-4.8],at:[-2.7,1.15,-2.0],room:'pantry'},
 {id:'hall--hearth-clear',eye:[-5.1,2.35,1.0],at:[-6.3,1.2,-.5],room:'hall'},
 {id:'kitchen--working-clear',eye:[-4.1,2.35,-2.7],at:[-6.2,1.2,-3.7],room:'kitchen'},
 {id:'washroom--screen-front',eye:[4.55,5.2,.5],at:[3.8,4.0,1.5],room:'washroom'},
 {id:'washroom--screen-back',eye:[4.55,5.2,4.8],at:[3.85,4.0,2.1],room:'washroom'},
 {id:'storage--aisle-high',eye:[5.5,5.65,1],at:[6.5,4.2,4.5],room:'storage'},
 {id:'gallery--entry-approach',eye:[.8,2.05,-.1],at:[.8,1.9,-2.5],room:'gallery-rear'},
 {id:'stair--lower-inner',eye:[1.6,2.2,-2],at:[-.7,1.5,-3.7],room:'entrance'},
 {id:'stair--landing-high',eye:[-.7,4.3,-4.7],at:[2.1,3.2,-4.7],room:'entrance'}
);
// Move a camera past an open leaf instead of treating an occluded entry as reviewed.
for(const v of views){if(v.id==='kitchen--inside-entry'){v.eye=[-4.0,2.05,-2.6];v.at=[-5.8,1.6,-3.8];}if(v.id==='master--inside-entry'){v.eye=[-4.45,4.93,1.3];v.at=[-5.4,4.4,3.8];}}
// v17 recorded invalid occlusions. Reposition only the observer, never hide the
// obstructing authored part or count a wall-only frame as a room observation.
const revisedEyes={
 'ledger--corner-a':[4.80,2.05,-4.85],
 'service--threshold':[4.95,2.05,4.00],
 'gallery-rear--threshold':[.35,2.05,-.35],
 'hall--corner-a':[-6.98,2.05,.15],'hall--corner-d':[-4.94,2.05,.20],
 'pantry--corner-a':[-2.48,2.05,-4.95],'pantry--corner-c':[-2.47,2.05,-1.70],
 'entrance--corner-a':[-1.08,2.05,-1.85],
 'master--corner-d':[-4.08,4.93,.60],'master--threshold':[-4.46,4.93,.85],
 'master--polygon-corner-0':[-6.97,4.93,-.42],'master--polygon-corner-5':[-4.0,4.93,.7],
 'storage--corner-a':[5.90,4.93,.48],'storage--corner-c':[5.90,4.93,5.40],
 'storage--polygon-corner-0':[6.78,4.93,-1.25],'storage--polygon-corner-1':[7.16,4.93,-1.25],
 'storage--polygon-corner-3':[5.90,4.93,5.35],'storage--polygon-corner-4':[5.75,4.93,.65],
 'storage--aisle-high':[6.1,5.65,.65],
 'landing--corner-b':[2.36,4.93,-2.10],'landing--polygon-corner-2':[2.42,4.93,-2.08]
};
for(const v of views){
 if(revisedEyes[v.id]){v.eye=revisedEyes[v.id];const r=rooms.find(r=>r.id===v.room),[x0,x1,z0,z1]=r.bounds;v.at=[(x0+x1)/2,levels[r.level]+.95,(z0+z1)/2];}
 if(v.room?.startsWith('gallery')&&/--(north|east|south|west)$/.test(v.id)){
  const r=rooms.find(r=>r.id===v.room),[x0,x1,z0,z1]=r.bounds,dir=v.id.split('--')[1];
  if(v.room==='gallery-rear'){v.eye=[.32,2.05,-.55];v.at=dir==='east'?[4.0,1.65,-.55]:dir==='west'?[-4.0,1.65,-.55]:dir==='north'?[.80,1.75,-1.3]:[.32,1.4,1.3];}
  else{const x=(x0+x1)/2;v.eye=[x,2.05,2.25];v.at=dir==='north'?[x,1.7,-.5]:dir==='south'?[x,1.7,5.8]:[dir==='east'?x1:x0,1.40,3.90];}
 }
 if(v.room==='washroom'&&/--(north|east|south|west)$/.test(v.id)){
  const d=v.id.split('--')[1];v.eye=[4.48,4.93,d==='north'?1.7:3.85];v.at=d==='north'?[3.8,4.08,.8]:d==='south'?[3.8,3.95,4.8]:d==='east'?[4.85,4.02,3.1]:[3.8,3.85,3.1];
 }
 if(v.id==='corridor--south'){v.eye=[.35,4.93,-1.1];v.at=[2.5,4.05,-.08];}
 if(v.id==='landing--east'){v.eye=[2.30,4.93,-3.30];v.at=[2.8,3.95,-2.02];}
}
// Keep oblique detail evidence separate from the required eye-level cardinal rays.
for(const v of [...views])if(v.room&&/--(north|east|south|west)$/.test(v.id)){
 const r=rooms.find(r=>r.id===v.room),[x0,x1,z0,z1]=r.bounds,y=levels[r.level]+1.6,d=v.id.split('--')[1];
 const expected=[(x0+x1)/2,y,(z0+z1)/2],dir={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]}[d];
 if(v.eye.some((q,i)=>q!==expected[i])||Math.abs(v.at[1]-y)>.0001)views.push({...v,id:v.id+'-working-detail'});
 v.eye=expected;v.at=[expected[0]+dir[0],y,expected[2]+dir[1]];
}
for(const [roomId,doorId]of [['hall','hall-door'],['kitchen','kitchen-door'],['pantry','pantry-door'],['ledger','ledger-door'],['service','service-door'],['entrance','entrance-door'],['master','master-door'],['child-west','child-west-door'],['child-east','child-east-door'],['washroom','wash-door'],['storage','storage-door']]){
 const r=rooms.find(r=>r.id===roomId),p=portals.find(p=>p.id===doorId),v=views.find(v=>v.id===roomId+'--inside-entry'),y=levels[r.level]+1.6;
 const eye=roomId==='washroom'?[4.53,y,2.1]:roomId==='entrance'?[2.24,y,-2.12]:v?.eye||[(r.bounds[0]+r.bounds[1])/2,y,(r.bounds[2]+r.bounds[3])/2];
 const delta=[eye[0]-p.eye[0],eye[2]-p.eye[2]],distance=Math.hypot(...delta),station=distance<3.15?[p.eye[0]+delta[0]*3.15/distance,y,p.eye[2]+delta[1]*3.15/distance]:eye;
 for(const fraction of [0,.5,1])views.push({id:roomId+'--door-sweep-'+fraction,room:roomId,eye:station,at:[p.eye[0],levels[r.level]+1.05,p.eye[2]],doorOpen:fraction});
}
for(const [id,roomId,eye,at]of [
 ['hall--aisle-length','hall',[-5.302,2.05,3.68],[-5.302,1.25,.85]],
 ['hall--west-seat-end','hall',[-7.0,2.05,3.85],[-7.0,1.10,2.35]],
 ['ledger--bookcase-front','ledger',[4.25,2.05,-3.90],[3.85,1.35,-5.0]],
 ['entrance--understair-storage','entrance',[1.72,2.05,-2.90],[.8,1.05,-4.30]],
 ['gallery-west--clear-lane','gallery-west',[-3.91,2.05,5.52],[-3.91,1.20,.10]],
 ['gallery-east--clear-lane','gallery-east',[3.91,2.05,5.52],[3.91,1.20,.10]],
 ['gallery-rear--clear-lane','gallery-rear',[-3.9,2.05,-.69],[3.9,1.30,-.69]],
 ['washroom--basin-workspace','washroom',[4.47,4.93,.65],[3.90,4.10,1.7]],
 ['garden--seating-return',null,[-.1,1.6,9.3],[-2.1,.8,6.55]]])views.push({id,room:roomId,eye,at});
for(const e of entries){
 const basis=(e.pose?.closedAngle??e.review?.frontAngle??0)*180/Math.PI;
 for(const [face,az,el]of [['front',0,0],['right',90,0],['rear',180,0],['left',270,0],['top',0,85],['bottom',0,-85],['oblique-a',40,30],['oblique-b',220,30]])views.push({id:e.id+'--'+face,object:e.id,az:az+basis,el,neutral:true});
 if(e.articulation)for(const fraction of [0,.5,1])for(const [side,az]of [['a',40],['b',220]]){
  views.push({id:e.id+'--operation-'+fraction+'-'+side,object:e.parent,focus:e.id,operation:{element:e.id,fraction},az:(side==='a'?40:140)+basis,el:20,connectionOnly:e.role==='window'});
  // The hall chest stands against the south wall. Its two installed-state
  // observations share reachable indoor stations across every lid state;
  // fitting an orbit to the lid alone can put the observer behind that wall.
  views.push(e.id==='hall-chest-lid'
   ? {id:e.id+'--operation-'+fraction+'-'+side+'-context',room:'hall',eye:side==='a'?[-6.10,2.05,4.30]:[-6.95,2.05,4.30],at:[-6.72,1.05,5.30],operation:{element:e.id,fraction}}
   : e.id==='ww-c-0-casement--1'&&side==='a'
    ? {id:e.id+'--operation-'+fraction+'-'+side+'-context',room:'kitchen',eye:[-5.9,2.05,-3.75],at:[-7.35,1.96,-2.96],operation:{element:e.id,fraction}}
    : {id:e.id+'--operation-'+fraction+'-'+side+'-context',object:e.id,context:true,operation:{element:e.id,fraction},az,el:20});
 }
}
const manifest={purpose:'whole manor scratch frame; not formal compiler topology',rooms,boundaries,portals,entries:entries.map(({model,...e})=>({...e,parts:model.parts.map(p=>p.id)})),area:{footprint:135.8,upperOpening:holes.reduce((s,h)=>s+(h[1]-h[0])*(h[3]-h[2]),0),servicePenetration:(chimneyCut[1]-chimneyCut[0])*(chimneyCut[3]-chimneyCut[2])},holes,chimneyCut};
// Temporary observation switch distinguishes shadow artifacts from authored geometry.
if(shadows===false)sun.castShadow=false;
function applyView(index){
 const v=views[index];for(const e of entries){
  const o=objects.get(e.id);if(e.pose)o.rotation.y=v.neutral||v.room&&v.id.includes('corner')||v.operation&&belongs(v.operation.element,e.id)?e.pose.closedAngle:e.pose.angle;
  if(e.articulation)setArticulation(e,v.operation?.element===e.id?v.operation.fraction:v.neutral?0:e.articulation.default);
  o.visible=v.context||!v.object||belongs(e.id,v.object);
  if(v.connectionOnly&&e.id===v.object)o.visible=false;
  if(v.cut==='ground')o.visible=e.level<=0&&e.id!=='floor-joists';if(v.cut==='upper')o.visible=(e.level===1&&e.id!=='upper-ceiling')||e.id==='central-stair'||e.id==='chimney';if(v.cut==='frame')o.visible=e.id!=='roof-envelope'&&e.id!=='upper-ceiling';if(v.cut==='stair')o.visible=['central-stair','upper-floor','ground-floor','foundation','floor-joists'].includes(e.id);
  o.traverse(n=>{if(n.isMesh){const ms=Array.isArray(n.material)?n.material:[n.material];for(const m of ms){m.clippingPlanes=v.cut==='stair'&&(e.role==='slab'||e.id==='floor-joists')?[v.id.endsWith('west')?new THREE.Plane(new THREE.Vector3(1,0,0),1.4):new THREE.Plane(new THREE.Vector3(0,0,-1),-2.2)]:[];if(e.id==='chimney'&&['ground','upper'].includes(v.cut))m.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),v.cut==='ground'?3.11:6.12),...(v.cut==='upper'?[new THREE.Plane(new THREE.Vector3(0,1,0),-3.33)]:[])];}}});
 }
 if(v.doorOpen!==undefined)for(const e of entries)if(e.pose)objects.get(e.id).rotation.y=e.pose.closedAngle+(e.pose.angle-e.pose.closedAngle)*v.doorOpen;
 if(v.doorOpen!==undefined)for(const e of entries)if(e.articulation?.relativeToParent)setArticulation(e,e.articulation.default);
 camera.up.set(0,1,0);camera.fov=2*Math.atan(Math.tan(Math.PI/6)/camera.aspect)*180/Math.PI;if(v.plan)camera.up.set(0,0,-1);
 if(v.object){
  const b=objectBounds(v.focus??v.object);if(v.focus)b.expandByScalar(.07);
  const c=b.getCenter(new THREE.Vector3()),a=v.az*Math.PI/180,e=v.el*Math.PI/180;
  const n=new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),n).normalize(),up=new THREE.Vector3().crossVectors(n,right).normalize(),tv=Math.tan(camera.fov*Math.PI/360),th=tv*camera.aspect;
  let distance=.1;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const d=new THREE.Vector3(x,y,z).sub(c);distance=Math.max(distance,d.dot(n)+1.12*Math.max(Math.abs(d.dot(right))/th,Math.abs(d.dot(up))/tv));}
  camera.position.copy(c).addScaledVector(n,distance);camera.lookAt(c);
 }else{camera.position.set(...v.eye);camera.lookAt(...v.at);}
 inspection.visible=Boolean(v.object||v.room||v.id.includes('stair')||v.id.includes('corridor')||v.id.includes('landing'));inspection.position.copy(camera.position);inspection.target.position.copy(v.object?objectBounds(v.focus??v.object).getCenter(new THREE.Vector3()):new THREE.Vector3(...v.at));camera.updateProjectionMatrix();
 if(instanceConsumer){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);instanceConsumer.update(camera);}
 return v;
}

const target=new THREE.Vector3(0,3,0);applyView(0);
return {scene,camera,views,objects,entries,inspection,applyView,manifest,target,setArticulation,configureRenderer:configureManorRenderer,update(){inspection.position.copy(camera.position);inspection.target.position.copy(target);}};
}
