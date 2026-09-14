// Bounded deterministic botanical/masonry craft. No raster proxies or randomness.
export function createManorGarden({box,mesh,beam,finish,polyhedron,revolve,extrude,V,Q,bevel,registerMechanism}){
 const pond=[-1.70,2.35],tree=[1.65,3.65],groups=[];
 // Independent stones, stems and leaves keep addressable source identities.
 const add=(id,material,faces,grainAxis)=>groups.push({id,material,faces,grainAxis});
 const flush=(id,level,role)=>{for(const g of groups)mesh(g.id,polyhedron(g.faces.map(f=>f.map(V))),[0,0,0],g.material,undefined,{grainAxis:g.grainAxis});groups.length=0;finish(id,level,role);};
 const noise=k=>(Math.sin(k*127.1+73.7)*43758.5453)%1;
 const stone=(id,p,s,seed=1,mat='stone')=>{
  const rings=[[-.45,.78],[0,1],[.43,.78]],rr=rings.map(([h,r],level)=>Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9+seed*.71,v=1+noise(seed+i*13)*.18;return[p[0]+Math.cos(a)*s[0]*r*v/2,p[1]+(h+noise(seed+i*5+level*31)*.06)*s[1],p[2]+Math.sin(a)*s[2]*r*v/2];})),f=[];
  for(let i=1;i<8;i++){f.push([rr[0][0],rr[0][i],rr[0][i+1]],[rr[2][0],rr[2][i+1],rr[2][i]]);}
  for(let k=0;k<2;k++)for(let i=0;i<9;i++){const j=(i+1)%9;f.push([rr[k][i],rr[k+1][i],rr[k+1][j]],[rr[k][i],rr[k+1][j],rr[k][j]]);}add(id,mat,f);
 };
 const twig=(id,a,b,r0,r1,mat='bark')=>{
  const d=b.map((v,i)=>v-a[i]),l=Math.hypot(...d),n=d.map(v=>v/l),u=Math.abs(n[1])<.9?[n[2],0,-n[0]]:[0,n[2],-n[1]],ul=Math.hypot(...u);for(let i=0;i<3;i++)u[i]/=ul;
  const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],ring=(p,r)=>Array.from({length:9},(_,i)=>p.map((c,j)=>c+r*(u[j]*Math.cos(i*Math.PI*2/9)+v[j]*Math.sin(i*Math.PI*2/9)))),aa=ring(a,r0),bb=ring(b,r1),f=[aa.toReversed(),bb];
  for(let i=0;i<9;i++)f.push([aa[i],aa[(i+1)%9],bb[(i+1)%9],bb[i]]);add(id,mat,f,n);
 };
 const leaf=(id,p,angle,len,w,tilt=0,mat='leaves')=>{
  const c=Math.cos(angle),s=Math.sin(angle),q=(u,v,h)=>[p[0]+c*u-s*v,p[1]+h+u*tilt,p[2]+s*u+c*v],edge=[[0,0],[.16,-.30],[.42,-.50],[.70,-.41],[.91,-.19],[1,0],[.91,.19],[.70,.41],[.42,.50],[.16,.30]].map(([u,v])=>q(u*len,v*w,.016*Math.sin(u*Math.PI)-len*.24*u*u)),mid=q(len*.46,0,.018-len*.24*.46**2),f=[];
  // One manifold sheet; the material owns visibility from either side.
  for(let i=0;i<edge.length;i++){const j=(i+1)%edge.length;f.push([edge[i],edge[j],mid]);}add(id,mat,f);
 };
 const circle=(cx,cz,r,n=48)=>Array.from({length:n},(_,i)=>({x:cx+r*Math.cos(i*2*Math.PI/n),y:cz+r*Math.sin(i*2*Math.PI/n)}));
 mesh('site-earth',extrude({outer:[{x:-11.5,y:-8.5},{x:11.5,y:-8.5},{x:11.5,y:10.5},{x:-11.5,y:10.5}],holes:[circle(...pond,1.3952380952380952)],depth:.60}),[0,-.30,0],'soil',Q([1,0,0],Math.PI/2));
 mesh('pond-excavation-bearing',revolve({profile:[{x:0,y:-.60},{x:1.3952380952380952,y:-.60},{x:1.3952380952380952,y:0},{x:1.30,y:-.4},{x:0,y:-.4}],segments:48}),[pond[0],0,pond[1]],'soil');
 // Low ground vegetation only outside the occupied building and central approach.
 for(let k=0;k<850;k++){
  const x=-10.4+20.8*((k*.61803398875)%1),z=-7.4+17*((k*.41421356237)%1);
  if(Math.abs(x)<7.9&&z<6.35||Math.abs(x-.1)<.75&&z>4||Math.hypot(x-pond[0],z-pond[1])<1.65)continue;
  for(let j=0;j<3;j++)leaf('ground-grass-'+k+'-'+j,[x,0,z],k+j*2.1,.12+(k%5)*.02,.017,1.1,'herbs');
 }flush('site',-1,'site');
 const path=[[-.15,-.1],[.95,-.1],[.95,4.275],[3.2,4.275],[3.2,5.125],[.95,5.125],[.65,9.4],[-.45,9.4],[-.15,5.125],[-3.2,5.125],[-3.2,4.275],[-.15,4.275]];
 mesh('garden-path-union',extrude({outer:path.map(([x,y])=>({x,y})),depth:.036}),[0,.018,0],'gravel',Q([1,0,0],Math.PI/2));
 for(let i=0;i<path.length;i++){
  const a=path[i],b=path[(i+1)%path.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  // Leave the step, gallery junctions and gate approach open.
  if(len<1||Math.abs(a[0]-b[0])>.001&&(Math.abs(a[1])<.2||a[1]>9.3))continue;
  for(let k=0;k<Math.floor(len/.28);k++){const t=(k+.5)/Math.floor(len/.28),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;if(z<1.08)continue;stone('path-edge-'+i+'-'+k,[x,.064,z],[.24,.12,.24],i*100+k,k%3?'stone':'stoneLight');}
 }
 for(let k=0;k<1700;k++){
  const x=-3.15+6.3*((k*.61803398875)%1),z=.98+8.35*((k*.41421356237)%1),shift=z<=5.125?.30:.30*(9.4-z)/(9.4-5.125),on=x>-.43+shift&&x<.63+shift||z>4.295&&z<5.105;
  if(!on)continue;stone('gravel-'+k,[x,.038,z],[.028+(k%3)*.009,.012,.024],k,k%4?'gravel':'stoneLight');
 }flush('garden-paths',-1,'garden');
 for(const [i,x,z,w,d]of [[0,1.95,1.9,1.8,1.3],[1,-1.5,5.55,1.3,.65]]){
  bevel('bed-earth-'+i,[w,.09,d],[x,.045,z],'soil',undefined,.035);
  for(let k=0;k<22;k++){
   const px=x+w*((k*.61803398875)%1-.5)*.87,pz=z+d*((k*.41421356237)%1-.5)*.83,h=.20+(k%5)*.052,end=[px+.035,.09+h,pz];twig('herb-'+i+'-'+k,[px,.09,pz],end,.009,.003,'herbs');
   for(let j=1;j<=5;j++)for(const side of [-1,1])leaf('herb-leaf-'+i+'-'+k+'-'+j+'-'+side,[px+j*.006,.09+h*j/6,pz],k*.9+j*.8+side*Math.PI/2,k%3===1?.08:.11,k%3===1?.068:.038,.1,k%3?'herbs':'leafLight');
   if(k%3===0)for(let j=0;j<4;j++){const p=[end[0]+Math.cos(j*1.7)*.024,end[1]+j*.015,end[2]+Math.sin(j*1.7)*.024];twig('flower-pedicel-'+i+'-'+k+'-'+j,end,p,.003,.002,'herbs');stone('herb-flower-'+i+'-'+k+'-'+j,p,[.034,.038,.034],k+j,'flower');}
  }
 }flush('herb-beds',-1,'garden');
 mesh('pond-lined-basin',revolve({profile:[{x:0,y:-.4},{x:1.30,y:-.4},{x:1.40,y:.02},{x:1.30,y:.04},{x:1.20,y:-.06},{x:1.03,y:-.36},{x:0,y:-.36}],segments:64}),[pond[0],0,pond[1]],'stoneDark',undefined,{projected:true});
 for(let i=0;i<29;i++){const a=i*Math.PI*2/29,r=1.30+noise(i)*.025;stone('pond-rim-'+i,[pond[0]+r*Math.cos(a),.063+noise(i+1)*.017,pond[1]+r*Math.sin(a)],[.27+noise(i+2)*.025,.17+noise(i+3)*.055,.27+noise(i+4)*.025],i,i%3?'stone':'stoneLight');}
 mesh('pond-water',revolve({profile:[{x:0,y:-.36},{x:1.03,y:-.36},{x:1.20,y:-.06},{x:1.215,y:-.045},{x:0,y:-.045}],segments:48}),[pond[0],0,pond[1]],'water');
 for(let i=0;i<18;i++){const a=i*.45,r=.85+(i%3)*.08,x=pond[0]+Math.cos(a)*r,z=pond[1]+Math.sin(a)*r;if(i%2===0){
  twig('pond-reed-root-'+i,[x,-.375,z],[x,-.07,z],.018,.012,'herbs');
  for(let j=0;j<4;j++)leaf('pond-reed-'+i+'-'+j,[x,-.07,z],a+j*.5,.32+(j%2)*.13,.026,1.5,'herbs');
 }else{
  twig('pond-lily-stalk-'+i,[x,-.375,z],[x,-.045,z],.005,.004,'herbs');
  const center=[x,-.045,z],edge=Array.from({length:18},(_,j)=>{const t=.25+j*(Math.PI*2-.5)/17;return[x+.069*Math.cos(t),-.044+.001*Math.sin(j),z+.061*Math.sin(t)];}),f=[];for(let j=0;j<17;j++)f.push([center,edge[j+1],edge[j]]);add('pond-lily-'+i,'leafDark',f);
 }}
 for(let i=0;i<36;i++){const a=i*.7,r=.25+(i%9)*.08;stone('submerged-stone-'+i,[pond[0]+Math.cos(a)*r,-.33,pond[1]+Math.sin(a)*r],[.12,.06,.09],i,'stoneDark');}
 flush('pond',-1,'garden');
 const trunk=[[tree[0],-.02,tree[1]],[tree[0]-.06,1.10,tree[1]+.02],[tree[0]-.17,2.25,tree[1]-.08],[tree[0]-.06,3.45,tree[1]+.04]],radii=[.18,.127,.091,.036];
 // Common rings at the bends form one closed trunk; perpendicular segment
 // caps previously left an exposed wedge at each change of direction.
 const trunkRings=trunk.map((p,k)=>Array.from({length:9},(_,j)=>[p[0]+radii[k]*Math.cos(j*Math.PI*2/9),p[1],p[2]+radii[k]*Math.sin(j*Math.PI*2/9)])),trunkFaces=[trunkRings[0].toReversed(),trunkRings.at(-1)];
 for(let k=0;k<3;k++)for(let j=0;j<9;j++){const n=(j+1)%9;trunkFaces.push([trunkRings[k][j],trunkRings[k][n],trunkRings[k+1][n]],[trunkRings[k][j],trunkRings[k+1][n],trunkRings[k+1][j]]);}add('trunk-continuous','bark',trunkFaces.map(f=>f.toReversed()),[0,1,0]);
 const leader=[tree[0]+.19,4.30,tree[1]-.09];twig('trunk-leader',trunk[3],leader,.036,.003);
 for(let k=0;k<10;k++){const t=(k+.5)/10,p=trunk[3].map((v,j)=>v+(leader[j]-v)*t);leaf('leader-leaf-'+k,p,k*2.399963,.12,.065,-.20+(k%4)*.15);}
 for(let i=0;i<5;i++){const a=i*1.27,len=.40+.11*(i%3),mid=[tree[0]+Math.cos(a)*len*.48,.065,tree[1]+Math.sin(a)*len*.48],tip=[tree[0]+Math.cos(a+.12)*len,-.018,tree[1]+Math.sin(a+.12)*len];twig('root-neck-'+i,[tree[0],.15,tree[1]],mid,.075,.038);twig('root-tip-'+i,mid,tip,.038,.010);}
 for(let i=0;i<8;i++){
  const a=i*2.399963,segment=i<3?1:2,t0=i<3?.15+i*.15:(i-3)*.15,fork=trunk[segment].map((v,k)=>v+(trunk[segment+1][k]-v)*t0),end=[tree[0]+Math.cos(a)*(1.26+(i%2)*.10),3.30+(i%3)*.40,tree[1]+Math.sin(a)*(1.26+(i%2)*.10)],elbow=fork.map((v,k)=>v+(end[k]-v)*.48+(k===1?.06:k===2?.06*Math.sin(i):0));
  twig('bough-base-'+i,fork,elbow,.062-.003*i,.034);twig('bough-tip-'+i,elbow,end,.034,.003);
  for(let j=0;j<16;j++){
   const t=(j+.4)/16,start=j<7?fork.map((v,k)=>v+(elbow[k]-v)*(j+.5)/7):elbow.map((v,k)=>v+(end[k]-v)*(j-6.5)/9),ta=a+(j%2?1:-1)*(.7+j*.09),reach=.22+.10*(1-t),tip=[start[0]+Math.cos(ta)*reach,start[1]+.04+(j%3)*.06,start[2]+Math.sin(ta)*reach];twig('twig-'+i+'-'+j,start,tip,.010,.003);
   for(let k=0;k<13;k++){
    const u=(k+.5)/13,p=start.map((v,q)=>v+(tip[q]-v)*u),la=ta+k*2.399963;leaf('apple-leaf-'+i+'-'+j+'-'+k,p,la,.11+(k%3)*.017,.070,-.38+((i*3+j+k)%7)*.12,['leaves','leafLight','leafDark'][(i+j+k)%3]);
   }
   if((i+j)%5===0){const p=[tip[0],tip[1]-.025,tip[2]];twig('fruit-stalk-'+i+'-'+j,tip,[p[0],p[1]-.014,p[2]],.003,.002);mesh('apple-'+i+'-'+j,revolve({profile:[{x:0,y:-.085},{x:.025,y:-.083},{x:.043,y:-.055},{x:.042,y:-.023},{x:.022,y:-.005},{x:0,y:-.012}],segments:20}),p,'appleRed');}
  }
 }flush('apple-tree',-1,'garden');
 const weave=(id,a,b)=>{
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len,nx=-dz,nz=dx,n=Math.ceil(len/.24);
  for(let i=0;i<=n;i++){const u=len*i/n;twig(id+'-stake-'+i,[a[0]+dx*u,-.16,a[1]+dz*u],[a[0]+dx*u,.72+(i%3)*.025,a[1]+dz*u],.026,.017);}
  for(let row=0;row<8;row++)for(let i=0;i<n;i++){
   const u=len*i/n,v=len*(i+1)/n,sa=(i+row)%2?1:-1;
   // Curved withe stations wrap the stakes; row parity already alternates.
   for(let j=0;j<6;j++){
    // Keep the woven row in compressed contact with its tapered stakes.
    // The prior 37mm offset left every row 0.4–6.1mm from the actual stake mesh.
    const at=t=>{const along=u+(v-u)*t,offset=.027*sa*Math.cos(Math.PI*t);return[a[0]+dx*along+nx*offset,.10+row*.073,a[1]+dz*along+nz*offset];};
    twig(id+'-withe-'+row+'-'+i+'-'+j,at(j/6),at((j+1)/6),.013,.012,'bark');
   }
  }
 };
 weave('fence-front-west',[-9,8.25],[-.55,8.25]);weave('fence-front-east',[.75,8.25],[9,8.25]);weave('fence-west',[-9,.15],[-9,8.25]);weave('fence-east',[9,8.25],[9,.15]);
 for(const x of [-.55,.75])bevel('gate-post-'+x,[.11,.90,.11],[x,.45,8.25],'oak',undefined,.015);
 // Open outward to the south; the west-hinged leaf clears the 1.19m passage.
 const pivot=[-.49,0,8.25],point=(x,y,z)=>[pivot[0]+x,y,pivot[2]+z];
 for(let i=0;i<7;i++)beam('gate-leaf-upright-'+i,point(.05+i*.18,.09,0),point(.05+i*.18,.76,0),.037,'oak');
 for(const yy of [.19,.61])beam('gate-leaf-rail-'+yy,point(0,yy,0),point(1.18,yy,0),.055,'oakLight');beam('gate-leaf-brace',point(.025,.18,.03),point(1.16,.62,.03),.039,'oak');
 for(const yy of [.19,.61]){
  mesh('gate-pintle-'+yy,revolve({profile:[{x:0,y:0},{x:.017,y:0},{x:.017,y:.02},{x:.009,y:.02},{x:.009,y:.14},{x:0,y:.14}],segments:20}),point(0,yy-.07,0),'iron');
  beam('gate-fixed-anchor-'+yy,[-.55,yy-.060,8.25],point(0,yy-.060,0),.020,'iron');
  mesh('gate-leaf-knuckle-'+yy,revolve({profile:[{x:.010,y:0},{x:.017,y:0},{x:.017,y:.10},{x:.010,y:.10},{x:.010,y:0}],segments:20}),point(0,yy-.05,0),'iron');
  beam('gate-leaf-hinge-strap-'+yy,point(0,yy,.016),point(.30,yy,.024),.018,'iron');
  for(const xx of [.05,.14,.25])bevel('gate-leaf-rivet-'+yy+'-'+xx,[.013,.013,.030],point(xx,yy,.019),'ironWarm',undefined,.002);
 }
 beam('gate-leaf-latch',point(.99,.60,-.033),point(1.23,.60,-.033),.020,'iron');beam('gate-leaf-latch-grip',point(1.08,.60,-.034),point(1.08,.55,-.045),.016,'iron');box('gate-keeper',[.06,.06,.022],[.75,.60,8.215],'iron');
 flush('garden-fence',-1,'garden-boundary');
 registerMechanism({id:'garden-gate',parent:'garden-fence',prefix:'gate-leaf-',level:-1,pivot,restAngle:0,axis:[0,1,0],travel:-Math.PI*.46,kind:'gate',default:1});
}
