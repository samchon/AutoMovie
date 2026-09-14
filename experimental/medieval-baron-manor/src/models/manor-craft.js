// Deterministic scratch joinery. Local coordinates: floor origin, +Z usable face.
// Passed geometry functions keep this craft independent of THREE and the viewer.
export function createManorCraft({box,mesh,beam,finish,polyhedron,revolve,extrude,V,Q,registerMechanism}) {
 const floor=l=>l<0?0:l===1?3.33:.45;
 const solid=(id,faces,p,mat,r,mapping={})=>{
  const data=polyhedron(faces.map(f=>f.map(V)));let index=0,developed=false;
  for(const f of faces){
   if(f.every(q=>q.uv)){
    const [a,b,c]=f.map(q=>q.uv),area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    if(Math.abs(area)>1e-12){for(let j=0;j<f.length;j++){data.uvs[(index+j)*2]=f[j].uv[0];data.uvs[(index+j)*2+1]=f[j].uv[1];}developed=true;}
   }
   index+=f.length;
  }
  mesh(id,data,p,mat,r,{...mapping,developed});
 };
 function bevel(id,size,p,mat='oakLight',r,edge=.003,mapping){
  const [w,h,d]=size,e=Math.min(edge,w/5,h/3,d/5),ring=(inset,y)=>{
   const a=w/2-inset,b=d/2-inset,c=Math.min(e,a/3,b/3);
   return [[-a+c,y,-b],[a-c,y,-b],[a,y,-b+c],[a,y,b-c],[a-c,y,b],[-a+c,y,b],[-a,y,b-c],[-a,y,-b+c]];
  },rings=[ring(e,-h/2),ring(0,-h/2+e),ring(0,h/2-e),ring(e,h/2)],faces=[rings[0].toReversed(),rings[3]];
  for(let k=0;k<3;k++)for(let j=0;j<8;j++)faces.push([rings[k][j],rings[k][(j+1)%8],rings[k+1][(j+1)%8],rings[k+1][j]]);
  // Rings are counter-clockwise in plan, hence their Y-up top is reversed.
  solid(id,faces.map(f=>f.toReversed()),p,mat,r,mapping);
  // Grain belongs to the albedo and metric UV, not separate decal solids.
 }
 function at(x,y,z,angle=0){
  const c=Math.cos(angle),s=Math.sin(angle),point=p=>[x+c*p[0]+s*p[2],y+p[1],z-s*p[0]+c*p[2]],r=Q([0,1,0],angle);
  const b=(id,size,p,mat='oak',chamfer=false,mapping)=>chamfer?bevel(id,size,point(p),mat,r,.003,mapping):box(id,size,point(p),mat,r,mapping);
  const m=(id,g,p,mat,mapping)=>mesh(id,g,point(p),mat,r,mapping);
  const line=(id,a,b,w=.035,mat='oak')=>beam(id,point(a),point(b),w,mat);
  const cyl=(id,radius,h,p,mat='iron',n=24)=>mesh(id,revolve({profile:[{x:0,y:0},{x:radius,y:0},{x:radius,y:h},{x:0,y:h}],segments:n}),point(p),mat,r,{grainAxis:[0,1,0],cylindrical:true});
  const tube=(id,path,thickness,mat='iron',closed=false)=>{
   const n=path.length,rad=thickness/2;
   const d0=path[1].map((v,j)=>v-path[0][j]),d1=path[Math.min(2,n-1)].map((v,j)=>v-path[1][j]);
   const normal=[d0[1]*d1[2]-d0[2]*d1[1],d0[2]*d1[0]-d0[0]*d1[2],d0[0]*d1[1]-d0[1]*d1[0]],nl=Math.hypot(...normal);
   const planar=nl>1e-10&&path.every(p=>Math.abs(p.reduce((s,v,j)=>s+(v-path[0][j])*normal[j]/nl,0))<1e-8);
   const rings=path.map((p,i)=>{
    const a=path[closed?(i+n-1)%n:Math.max(0,i-1)],b=path[closed?(i+1)%n:Math.min(n-1,i+1)],t=b.map((v,j)=>v-a[j]),l=Math.hypot(...t);for(let j=0;j<3;j++)t[j]/=l;
    const u=planar?[normal[1]*t[2]-normal[2]*t[1],normal[2]*t[0]-normal[0]*t[2],normal[0]*t[1]-normal[1]*t[0]]:Math.abs(t[2])<.9?[-t[1],t[0],0]:[0,-t[2],t[1]],ul=Math.hypot(...u);for(let j=0;j<3;j++)u[j]/=ul;
    const v=[t[1]*u[2]-t[2]*u[1],t[2]*u[0]-t[0]*u[2],t[0]*u[1]-t[1]*u[0]];
    return Array.from({length:8},(_,k)=>p.map((q,j)=>q+rad*(u[j]*Math.cos(k*Math.PI/4)+v[j]*Math.sin(k*Math.PI/4))));
   }),f=[];
   for(let i=0;i<(closed?n:n-1);i++)for(let j=0;j<8;j++){const a=rings[i][j],b=rings[i][(j+1)%8],c=rings[(i+1)%n][(j+1)%8],d=rings[(i+1)%n][j];f.push([a,b,c],[a,c,d]);}
   if(!closed)f.push(rings[0].toReversed(),rings[n-1]);solid(id,f,[x,y,z],mat,r);
  };
  const vessel=(id,radius,h,p,mat='clay',handle=false,form='jar')=>{
   if(form==='jar'&&h<radius*.9)form='bowl';if(form==='jar'&&handle&&h<.15)form='cup';
   const t=Math.min(.014,radius*.12),pr=form==='bowl'?[[0,0],[radius*.40,0],[radius*.66,.20*h],[radius,.88*h],[radius,h],[radius-t,h],[radius*.63,.27*h],[radius*.38,t],[0,t]]:form==='cup'||form==='pail'?[[0,0],[radius*.77,0],[radius,h],[radius-t,h],[radius*.77-t,t],[0,t]]:[[0,0],[radius*.68,0],[radius,.25*h],[radius*.92,.70*h],[radius*.72,h],[radius*.72-t,h],[radius*.92-t,.70*h],[radius-t,.25*h],[radius*.65,t],[0,t]];
   m(id,revolve({profile:pr.map(([x,y])=>({x,y})),segments:24}),p,mat,{grainAxis:[0,1,0],cylindrical:true});
   if(handle){const path=Array.from({length:25},(_,i)=>{const a=-Math.PI/2+i*Math.PI/24;return[p[0]+radius*.86+Math.cos(a)*radius*.65,p[1]+h*.55+Math.sin(a)*h*.30,p[2]];});tube(id+'-handle',path,Math.min(.022,radius*.27),mat);}
  };
  const hoop=(id,center,radius,thickness,mat='iron',plane='xy',start=0,end=Math.PI*2)=>{
   const closed=Math.abs(end-start-Math.PI*2)<1e-8,path=Array.from({length:closed?32:25},(_,i)=>{const a=start+(end-start)*i/(closed?32:24);return plane==='xy'?[center[0]+radius*Math.cos(a),center[1]+radius*Math.sin(a),center[2]]:[center[0]+radius*Math.cos(a),center[1],center[2]+radius*Math.sin(a)];});tube(id,path,thickness,mat,closed);
  };
  return {b,m,line,cyl,vessel,hoop,tube,point,r};
 }
 // Closed textile skins use explicit triangles, not planar-quad assumptions.
 function textile(id,x,y,z,nx,nz,surface,mat='linen',angle=0,thickness=.003,underside){
  const top=Array.from({length:nx+1},(_,i)=>Array.from({length:nz+1},(_,j)=>surface(i/nx,j/nz)));
  const us=Array.from({length:nx+1},()=>Array(nz+1).fill(0)),vs=Array.from({length:nx+1},()=>Array(nz+1).fill(0));
  const distance=(a,b)=>Math.hypot(...a.map((q,k)=>q-b[k]));
  for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){if(i)us[i][j]=us[i-1][j]+distance(top[i][j],top[i-1][j]);if(j)vs[i][j]=vs[i][j-1]+distance(top[i][j],top[i][j-1]);}
  const p=(i,j,under=false)=>{const u=i/nx,v=j/nz,q=top[i][j],uv=[us[i][j],vs[i][j]],mapped=p=>Object.assign(p,{uv});if(!under)return mapped(q);
   if(underside)return mapped(underside(u,v));
   const ua=surface(Math.max(0,u-.0001),v),ub=surface(Math.min(1,u+.0001),v),va=surface(u,Math.max(0,v-.0001)),vb=surface(u,Math.min(1,v+.0001)),du=ub.map((x,k)=>x-ua[k]),dv=vb.map((x,k)=>x-va[k]),n=[dv[1]*du[2]-dv[2]*du[1],dv[2]*du[0]-dv[0]*du[2],dv[0]*du[1]-dv[1]*du[0]],len=Math.hypot(...n);return mapped(q.map((x,k)=>x-thickness*n[k]/len));
  },f=[],quad=(a,b,c,d)=>f.push([a,b,c],[a,c,d]);
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){quad(p(i,j),p(i,j+1),p(i+1,j+1),p(i+1,j));quad(p(i,j,true),p(i+1,j,true),p(i+1,j+1,true),p(i,j+1,true));}
  for(let i=0;i<nx;i++){quad(p(i,0),p(i+1,0),p(i+1,0,true),p(i,0,true));quad(p(i,nz),p(i,nz,true),p(i+1,nz,true),p(i+1,nz));}
  for(let j=0;j<nz;j++){quad(p(0,j),p(0,j,true),p(0,j+1,true),p(0,j+1));quad(p(nx,j),p(nx,j+1),p(nx,j+1,true),p(nx,j,true));}
  solid(id,f,[x,y,z],mat,Q([0,1,0],angle));
 }
 function folded(id,x,y,z,w,d,mat='linen',angle=0){
  for(let k=0;k<3;k++)textile(id+'-layer-'+k,x,y+k*.020,z,16,12,(u,v)=>[(u-.5)*w,.020+.004*Math.sin(Math.PI*u)*Math.sin(Math.PI*v),(v-.5)*d],k===1?'linen':mat,angle,.020,(u,v)=>[(u-.5)*w,k===0?0:.004*Math.sin(Math.PI*u)*Math.sin(Math.PI*v),(v-.5)*d]);
 }
 function towel(id,x,y,z,w,mat='linen',angle=0,radius=.015){
  // Inner crest seats on the actual rail; wrinkles grow away from the bearing.
  textile(id,x,y,z,16,36,(u,v)=>{const t=v*3;let yy,zz;if(t<1){yy=-.17*(1-t);zz=-radius;}else if(t<2){const a=(t-1)*Math.PI;yy=radius*Math.sin(a);zz=-radius*Math.cos(a);}else{yy=-.28*(t-2);zz=radius;}return[(u-.5)*w,yy,zz+.002*Math.sin(u*31)*Math.max(0,-yy)];},mat,angle);
 }
 function cloth(id,x,y,z,w,d,mat='linen',angle=0,drop=.04,puff=.015){
  const a=at(x,y,z,angle),nx=20,nz=12,faces=[],p=(i,j,under=false)=>{
   const u=i/nx,v=j/nz,edge=Math.min(u,1-u,v,1-v),fold=.006*Math.sin(u*43+v*7)+.004*Math.sin(v*35);
   return [(u-.5)*w,puff*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)+fold-drop*Math.max(0,1-edge/.12)-(under?.008:0),(v-.5)*d];
  };
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){faces.push([p(i,j),p(i,j+1),p(i+1,j+1),p(i+1,j)],[p(i,j,true),p(i+1,j,true),p(i+1,j+1,true),p(i,j+1,true)]);}
  for(let i=0;i<nx;i++)for(const j of [0,nz])faces.push([p(i,j),p(i+1,j),p(i+1,j,true),p(i,j,true)]);
  for(let j=0;j<nz;j++)for(const i of [0,nx])faces.push([p(i,j),p(i,j,true),p(i,j+1,true),p(i,j+1)]);
  // A folded cloth grid is not a planar quad surface; author its triangles.
  solid(id,faces.flatMap(f=>[[f[0],f[1],f[2]],[f[0],f[2],f[3]]]),[x,y,z],mat,a.r);
 }
 function table(id,x,y,z,length,width,level=0,angle=0){
  // The hall consumes the seated free volume in spaces/001-manor.md. Keep its
  // tabletop and service objects at their existing height and clear the knees
  // below it; the other authored tables retain their original dimensions.
  const hall=id==='hall-table',leg=hall?.10:.12,apronHeight=hall?.11:.13,apronY=hall?.655:.645,stretcherY=hall?.645:.22;
  y=floor(level)+(hall?.006:0);const a=at(x,y,z,angle),lx=length/2-(hall?.06:.14),lz=width/2-.12;
  // Original coordinate-derived suffixes remain stable when a member moves.
  const rowId=dx=>hall?Math.sign(dx)*(length/2-.14):dx;
  for(const dx of [-lx,lx])for(const dz of [-lz,lz])a.b(id+'-leg-'+rowId(dx)+'-'+dz,[leg,.71,leg],[dx,.355,dz],'oak',true);
  for(const dz of [-lz,lz])a.b(id+'-apron-long-'+dz,[2*lx-leg,apronHeight,.065],[0,apronY,dz],'oak');
  // At the hall's raised joint, one end apron receives the central stretcher.
  // A second end stretcher at this height would duplicate almost its entire
  // volume. Its 75 mm thickness instead belongs to the single receiving apron.
  for(const dx of [-lx,lx]){a.b(id+'-apron-end-'+rowId(dx),[hall?.075:.065,apronHeight,2*lz-leg],[dx,apronY,0],'oak');if(!hall)a.b(id+'-end-stretcher-'+rowId(dx),[.075,.075,2*lz-leg],[dx,stretcherY,0],'oak');}
  a.b(id+'-long-stretcher',[2*lx-.075,.085,.085],[0,stretcherY,0],'oak');
  const n=Math.ceil(width/.22);for(let i=0;i<n;i++)a.b(id+'-top-plank-'+i,[length,.055,width/n-.003],[0,.7375,-width/2+(i+.5)*width/n],i%2?'oak':'oakLight',true);
  for(const dx of [-lx,lx])for(const dz of [-lz,lz]){a.b(id+'-joint-peg-'+rowId(dx)+'-'+dz,[.025,.025,hall?leg+.012:.132],[dx,.66,dz],'oakLight');}
  if(id==='hall-table'){
   a.vessel(id+'-pitcher',.115,.27,[-.65,.765,0],'clay',true);
   for(const dx of [-.65,0,.65])for(const dz of [-width*.30,width*.30]){a.vessel(id+'-dish-'+dx+'-'+dz,.105,.032,[dx,.765,dz],'oakLight');a.vessel(id+'-cup-'+dx+'-'+dz,.045,.095,[dx+.16,.765,dz],'clay',true);}
   a.vessel(id+'-serving-bowl',.16,.09,[.15,.765,0],'clay');
  }else{
   // A bound register has separate boards, leaf block, spine and brass clasp.
   const bx=-length*.20,bz=0;
   if(id!=='ledger-desk'){
   for(const yy of [.7715,.8205])a.b(id+'-book-board-'+yy,[.27,.013,.34],[bx,yy,bz],'leather',true);
   a.b(id+'-book-pages',[.247,.036,.315],[bx+.004,.796,bz],'paper');a.b(id+'-book-spine',[.017,.062,.34],[bx-.126,.796,bz],'leather');
   for(let i=0;i<5;i++)a.b(id+'-page-edge-'+i,[.24,.001,.001],[bx+.004,.781+i*.007,bz+.1575],'linenDark');
   a.b(id+'-book-clasp',[.025,.007,.06],[bx+.04,.8305,bz+.14],'iron');
   }
   a.vessel(id+'-inkpot',.037,.07,[length*.28,.765,-width*.25],'charcoal');a.line(id+'-quill',[length*.28,.80,-width*.25],[length*.19,1.01,-width*.27],.007,'paper');
   const qs=[length*.28,.80],qe=[length*.19,1.01],delta=qe.map((v,i)=>v-qs[i]),ql=Math.hypot(...delta),fp=(t,w)=>({x:qs[0]+delta[0]*t+delta[1]/ql*w,y:qs[1]+delta[1]*t-delta[0]/ql*w});
   const qz=yy=>-width*.25+(yy-.80)/.21*(-width*.02),vf=[fp(.34,0),fp(.60,.028),fp(1,0),fp(.62,-.032)].map(p=>[p.x,p.y,qz(p.y)+.001]),vb=vf.map(p=>[p[0],p[1],p[2]-.002]),faces=[vf,vb.toReversed()];for(let i=0;i<4;i++)faces.push([vf[i],vb[i],vb[(i+1)%4],vf[(i+1)%4]]);solid(id+'-quill-vane',faces.map(f=>f.map(a.point)),[0,0,0],'paper');
   for(let k=0;k<7;k++){const p=fp(.42+k*.065,0),q=fp(.50+k*.061,k%2?.022:-.023);a.line(id+'-quill-barb-'+k,[p.x,p.y,qz(p.y)+.002],[q.x,q.y,qz(q.y)+.002],.0018,'linenDark');}
   a.b(id+'-loose-parchment',[.22,.002,.25],[length*.12,.766,.06],'paper');
   for(let i=0;i<7;i++)a.b(id+'-ink-line-'+i,[.14-(i%3)*.023,.0002,.002],[length*.12,.7671,-.025+i*.022],'charcoal');
   if(id==='ledger-desk'){
    for(const s of [-1,1]){
     a.b(id+'-open-register-cover-'+s,[.19,.008,.29],[bx+s*.1,.769,0],'leather');
     const xx=bx+s*.096,w=.178;a.b(id+'-open-register-leaves-'+s,[w,.020,.27],[xx,.783,0],'paper');
     for(let j=0;j<9;j++)a.b(id+'-register-entry-'+s+'-'+j,[w-.045-(j%3)*.012,.001,.002],[xx,.7935,-.105+j*.025],'charcoal');
    }
   }
  }
  finish(id,level,'furnishing',{frontAngle:angle});
 }
 function bench(id,x,y,z,length,width,level=0,angle=0,backrest=false){
  y=floor(level)+(/^hall-bench/.test(id)?.006:0);const a=at(x,y,z,angle),lx=Math.max(.09,length/2-.10),lz=Math.max(.065,width/2-(id==='hall-bench-west'?.075:.055)),leg=.075,railId=dz=>id==='hall-bench-west'?Math.sign(dz)*Math.max(.065,width/2-.055):dz;
  for(const dx of [-lx,lx])for(const dz of [-lz,lz])a.b(id+'-leg-'+dx+'-'+railId(dz),[leg,.405,leg],[dx,.2025,dz],'oak',true);
  for(const dx of [-lx,lx]){a.b(id+'-end-rail-'+dx,[.06,.07,2*lz],[dx,.37,0],'oak');a.b(id+'-end-tie-'+dx,[.055,.055,2*lz],[dx,.15,0],'oak');}
  a.b(id+'-stretcher',[2*lx,.065,.055],[0,.15,0],'oak');
  for(const dz of [-lz,lz])a.b(id+'-seat-rail-'+railId(dz),[2*lx,.07,.05],[0,.37,dz],'oak');
  for(let i=0;i<2;i++)a.b(id+'-seat-board-'+i,[length,.045,width/2-.002],[0,.4275,(i-.5)*width/2],'oakLight',true);
  if(backrest){for(const dx of [-lx,lx])a.b(id+'-back-post-'+dx,[.065,.48,.065],[dx,.665,-lz],'oak',true);for(const yy of [.64,.85])a.b(id+'-back-rail-'+yy,[2*lx,.075,.04],[0,yy,-lz],'oakLight',true);for(let i=0;i<3;i++)a.b(id+'-back-splat-'+i,[.045,.20,.025],[(i-1)*length*.22,.745,-lz],'oak');}
  finish(id,level,'furnishing',{frontAngle:angle});
 }
 function bed(id,x,y,z,length,width,level=1){
  y=floor(level);const a=at(x,y,z),lx=length/2-.065,lz=width/2-.065;
  for(const dx of [-lx,lx])for(const dz of [-lz,lz]){const h=dx<0?1.06:.70;a.b(id+'-post-'+dx+'-'+dz,[.11,h,.11],[dx,h/2,dz],'oak',true);mesh(id+'-finial-'+dx+'-'+dz,revolve({profile:[{x:0,y:0},{x:.046,y:0},{x:.047,y:.015},{x:.033,y:.030},{x:.047,y:.055},{x:.042,y:.083},{x:.021,y:.103},{x:0,y:.106}],segments:32}),a.point([dx,h,dz]),'oakLight',a.r,{grainAxis:[0,1,0]});}
  for(const dz of [-lz,lz])a.b(id+'-side-rail-'+dz,[length-.13,.16,.075],[0,.36,dz],'oak');
  for(const dx of [-lx,lx])a.b(id+'-end-rail-'+dx,[.075,.16,width-.13],[dx,.36,0],'oak');
  const n=14;for(let i=0;i<n;i++)a.b(id+'-slat-'+i,[.09,.035,width-.14],[-length/2+.14+i*(length-.28)/(n-1),.4375,0],'oakLight');
  for(let i=0;i<5;i++)a.b(id+'-head-panel-'+i,[.04,.58,(width-.22)/5-.003],[-lx,.715,-(width-.22)/2+(i+.5)*(width-.22)/5],'oakLight',true);
  a.b(id+'-head-top',[.08,.075,width-.11],[-lx,1.02,0],'oak',true);
  for(let i=0;i<3;i++)a.b(id+'-foot-panel-'+i,[.04,.20,(width-.22)/3-.003],[lx,.53,-(width-.22)/2+(i+.5)*(width-.22)/3],'oakLight',true);
  a.b(id+'-mattress',[length-.23,.17,width-.23],[0,.54,0],'bed',true);
  const section=(v,outer=0)=>{
   const t=(v-.5)*2,e=Math.abs(t),s=Math.sign(t),half=(width-.23)/2;
   if(e<=.7)return[.628+outer+.007*Math.sin(e/.7*Math.PI)**2,s*(half-.004)*e/.7];
   if(e<=.8){const a=(e-.7)/.1*Math.PI/2;return[.616+(.012+outer)*Math.cos(a),s*(half-.004+(.012+outer)*Math.sin(a))];}
   return[.616-.10*(e-.8)/.2,s*(half+.008+outer)];
  };
  // Both layers follow the same rounded shoulder. Their distinct normal offset
  // continues down the sides; a steeper quilt never cuts through the sheet.
  for(const [name,cx,len,outer,thickness,mat]of [
   [id+'-sheet',x,length-.24,0,.003,'linen'],
   [id+'-quilt',x+length*.17,length*.56,.009,.009,id==='master-bed'?'quiltRust':id==='child-west-bed'?'quiltSage':'linenDark']]){
   const fold=(u,v)=>.0025*Math.sin(((cx-x+(u-.5)*len)/(length-.24)+.5)*Math.PI*6)*Math.sin(v*Math.PI)**2;
   textile(name,cx,y,z,32,40,(u,v)=>{const [yy,zz]=section(v,outer);return[(u-.5)*len,yy+fold(u,v),zz];},mat,0,thickness,(u,v)=>{const [yy,zz]=section(v,outer-thickness);return[(u-.5)*len,yy+fold(u,v),zz];});
  }
  const pillows=width>1.2?2:1;for(let i=0;i<pillows;i++){
   const pw=width>1.2?.57:width*.68,pz=z+(i-(pillows-1)/2)*.68;
   const contact=(u,v)=>{const zz=pz-z+(v-.5)*pw,vv=.5+zz*.7/(width-.238),uu=(-length/2+.42+(u-.5)*.43)/(length-.24)+.5;return section(vv,0)[0]+.0025*Math.sin(uu*Math.PI*6)*Math.sin(vv*Math.PI)**2;};
   textile(id+'-pillow-'+i,x-length/2+.42,y,pz,20,16,(u,v)=>[(u-.5)*.43,contact(u,v)+.011+.11*Math.sin(Math.PI*u)*Math.sin(Math.PI*v),(v-.5)*pw],'linen',0,.011,(u,v)=>[(u-.5)*.43,contact(u,v),(v-.5)*pw]);
  }
  finish(id,level,'furnishing');
 }
 function chest(id,x,y,z,length,depth,level=1,angle=0){
  y=floor(level);const a=at(x,y,z,angle);
  for(const dx of [-length/2+.065,length/2-.065])for(const dz of [-depth/2+.065,depth/2-.065])a.b(id+'-foot-'+dx+'-'+dz,[.085,.12,.085],[dx,.06,dz],'oak');
  a.b(id+'-bottom',[length-.09,.045,depth-.09],[0,.12,0],'oak');
  for(const dz of [-depth/2+.025,depth/2-.025]){
   // Rebated backing closes the plank joints without a second exposed face.
   a.b(id+'-rebate-backing-'+dz,[length-.06,.34,.012],[0,.305,dz-Math.sign(dz)*.024],'oak',false,{grainAxis:[0,1,0]});
   for(let i=0;i<4;i++)a.b(id+'-panel-'+dz+'-'+i,[length/4-.001,.35,.05],[-length/2+(i+.5)*length/4,.305,dz],i%3?'oak':'oakLight',true);
  }
  for(const dx of [-length/2+.025,length/2-.025])a.b(id+'-end-'+dx,[.05,.35,depth-.10],[dx,.305,0],'oak',true,{grainAxis:[0,1,0]});
  for(let i=0;i<3;i++)a.b(id+'-lid-board-'+i,[length+.035,.045,depth/3-.002],[0,.5025,-depth/2+(i+.5)*depth/3],'oakLight',true);
  a.b(id+'-lid-rebate',[length+.027,.012,depth-.006],[0,.481,0],'oak');
  for(const dx of [-length*.30,length*.30]){a.b(id+'-lid-strap-'+dx,[.035,.008,depth+.03],[dx,.529,0],'iron');a.b(id+'-front-strap-'+dx,[.035,.33,.008],[dx,.315,depth/2+.004],'iron');
   a.b(id+'-lid-hinge-leaf-'+dx,[.040,.008,.045],[dx,.505,-depth/2+.010],'iron');
   const axis=Q([-Math.sin(angle),0,-Math.cos(angle)],Math.PI/2),hingeProfile=[{x:.008,y:-.021},{x:.014,y:-.021},{x:.014,y:.021},{x:.008,y:.021},{x:.008,y:-.021}];
   mesh(id+'-lid-knuckle-'+dx,revolve({profile:hingeProfile,segments:28}),a.point([dx,.489,-depth/2-.012]),'iron',axis);
   mesh(id+'-hinge-pin-'+dx,revolve({profile:[{x:0,y:-.044},{x:.015,y:-.044},{x:.015,y:-.023},{x:.007,y:-.023},{x:.007,y:.023},{x:.015,y:.023},{x:.015,y:.044},{x:0,y:.044}],segments:28}),a.point([dx,.489,-depth/2-.012]),'iron',axis);
   a.b(id+'-hinge-leaf-'+dx,[.088,.14,.009],[dx,.42,-depth/2-.0045],'iron');
   for(const zz of [-depth*.32,0,depth*.32])a.b(id+'-lid-rivet-'+dx+'-'+zz,[.014,.020,.014],[dx,.528,zz],'ironWarm',true);
   for(const yy of [.17,.30,.45])a.b(id+'-rivet-'+dx+'-'+yy,[.013,.013,.018],[dx,yy,depth/2+.005],'iron');}
  a.b(id+'-lock',[.07,.105,.022],[0,.422,depth/2+.011],'iron');a.b(id+'-keyhole',[.008,.020,.003],[0,.415,depth/2+.0235],'charcoal');
  // An open-ended fork hasp lifts clear of the staple with the lid.
  for(const xx of [-.023,.023])a.b(id+'-lid-hasp-side-'+xx,[.014,.080,.009],[xx,.471,depth/2+.030],'iron');
  // The fork crosspiece overlaps both side legs and the lid return: the prior
  // 0.504 centre left a measured 6.5mm air gap below the return.
  for(const yy of [.5175])a.b(id+'-lid-hasp-end-'+yy,[.060,.014,.009],[0,yy,depth/2+.030],'iron');
  a.b(id+'-lid-hasp-return',[.060,.009,.044],[0,.522,depth/2+.012],'iron');
  a.tube(id+'-lock-staple',[[-.012,.459,depth/2+.019],[-.012,.459,depth/2+.046],[.012,.459,depth/2+.046],[.012,.459,depth/2+.019]],.008,'iron');
  registerMechanism({id:id+'-lid',parent:id,prefix:id+'-lid-',level,pivot:a.point([0,.489,-depth/2-.012]),restAngle:angle,axis:[1,0,0],travel:-Math.PI*.48,kind:'furnishing-lid'});
  finish(id,level,'furnishing',{frontAngle:angle});
 }
 function shelf(id,x,y,z,depth,height,length,level=0){
  y=floor(level);const a=at(x,y,z),dx=depth/2-.04,dz=length/2-.055;
  for(const xx of [-dx,dx])for(const zz of [-dz,0,dz])a.b(id+'-upright-'+xx+'-'+zz,[.07,height,.085],[xx,height/2,zz],'oak',true);
  const top=[];for(let i=0;i<4;i++){const yy=.13+i*(height-.16)/3;top.push(yy+.023);a.b(id+'-board-'+i,[depth,.046,length],[0,yy,0],'oakLight',true);for(const zz of [-dz,dz])a.b(id+'-cleat-'+i+'-'+zz,[depth-.05,.045,.05],[0,yy-.045,zz],'oak');}
  a.line(id+'-rear-brace',[-dx,.12,-dz],[-dx,height-.07,dz],.04,'oak');
  for(let s=0;s<3;s++)for(let i=0;i<Math.floor(length/.31);i++){
   const zz=-length/2+.18+i*.31;
   if(level===0){
    if((i+s)%3===1){
     const sack=id+'-grain-sack-'+s+'-'+i,profile=[[.075,0],[.10,.025],[.112,.085],[.098,.175],[.0295,.232],[.0295,.240],[.038,.263],[.008,.272]],n=24;
     const rings=profile.map(([radius,yy],k)=>Array.from({length:n},(_,j)=>{const theta=j*2*Math.PI/n,pleat=1+(k>3?.055:.022)*Math.sin(theta*7+i);return[radius*Math.cos(theta)*pleat,yy,k>3?radius*Math.sin(theta)*pleat:radius*.82*Math.sin(theta)*pleat];})),faces=[];
     // Pleated ends are star-shaped, not convex polygons. Preserve every rim
     // vertex and triangulate from their interior centre, with explicit winding.
     for(let j=0;j<n;j++){const b=(j+1)%n;faces.push([[0,profile[0][1],0],rings[0][j],rings[0][b]],[[0,profile.at(-1)[1],0],rings.at(-1)[b],rings.at(-1)[j]]);}
     for(let k=0;k<rings.length-1;k++)for(let j=0;j<n;j++){const b=(j+1)%n;faces.push([rings[k][j],rings[k+1][j],rings[k+1][b]],[rings[k][j],rings[k+1][b],rings[k][b]]);}
     solid(sack,faces,a.point([.015,top[s],zz]),'linenDark',a.r);
     a.hoop(id+'-sack-tie-'+s+'-'+i,[.015,top[s]+.235,zz],.031,.006,'linen','xz');
     a.tube(sack+'-tie-ends',[[.045,top[s]+.235,zz],[.063,top[s]+.233,zz+.009],[.073,top[s]+.211,zz+.012]],.005,'linen');
    }
    else{a.vessel(id+'-crock-'+s+'-'+i,Math.min(.115,depth*.29),.21+s*.028,[.015,top[s],zz],i%3?'clay':'clayLight');a.cyl(id+'-jar-lid-'+s+'-'+i,.084,.017,[.015,top[s]+.21+s*.028,zz],'oakLight');}
   }
   else folded(id+'-folded-cloth-'+s+'-'+i,x,y+top[s],z+zz,depth-.16,.24,i%2?'linen':'linenDark');
  }
  finish(id,level,'furnishing',{frontAngle:Math.PI/2});
 }
 function cabinet(id,x,y,z,width,height,depth,level=0,angle=0,contents='vessels'){
  y=floor(level);const a=at(x,y,z,angle);
  for(const dx of [-width/2+.055,width/2-.055])for(const dz of [-depth/2+.055,depth/2-.055])a.b(id+'-leg-'+dx+'-'+dz,[.07,height,.07],[dx,height/2,dz],'oak',true);
  a.b(id+'-back',[width-.10,height-.15,.035],[0,(height+.15)/2,-depth/2+.023],'oak');
  for(const dx of [-width/2+.025,width/2-.025])a.b(id+'-side-'+dx,[.04,height-.15,depth-.09],[dx,(height+.15)/2,0],'oak');
  a.b(id+'-top',[width+.045,.06,depth+.035],[0,height+.03,0],'oakLight',true);
  for(let s=0;s<3;s++){
   const yy=.15+s*(height-.22)/3;a.b(id+'-shelf-'+s,[width-.08,.045,depth-.065],[0,yy,0],'oakLight');
   if(contents==='clothes'||contents==='linen'){
    const p=a.point([0,yy+.0225,.01]);folded(id+'-linen-stack-'+s,...p,width-.17,depth-.12,s===1?'quiltSage':'linen',angle);
   }else if(contents==='books'){
    const n=Math.floor((width-.18)/.09);for(let i=0;i<n;i++){const xx=-width/2+.11+i*.09,h=.215+.055*((i*7+s*3)%11)/10;
     a.b(id+'-pages-'+s+'-'+i,[.056,h,depth-.107],[xx,yy+.0225+h/2,.01],'paper');
     for(const dx of [-.033,.033])a.b(id+'-cover-'+s+'-'+i+'-'+dx,[.010,h,depth-.105],[xx+dx,yy+.0225+h/2,.01],'leather',true);
     a.b(id+'-spine-'+s+'-'+i,[.071,h,.017],[xx,yy+.0225+h/2,depth/2-.035],'leather');
     for(const by of [.05,h-.05])a.b(id+'-binding-band-'+s+'-'+i+'-'+by,[.073,.012,.019],[xx,yy+.0225+by,depth/2-.032],'linenDark');
    }
   }else if(contents==='shoes'){
    for(const xx of [-.09,.09]){
     const shoe=id+'-shoe-'+s+'-'+xx,base=yy+.0225;
     a.b(shoe+'-sole',[.10,.018,.20],[xx,base+.009,.005],'leather',true);
     a.m(shoe+'-heel-upper',revolve({profile:[{x:0,y:0},{x:.044,y:0},{x:.043,y:.068},{x:.035,y:.074},{x:.030,y:.074},{x:.036,y:.018},{x:0,y:.018}],segments:24}),[xx,base+.018,-.035],'leather');
     const toeRings=Array.from({length:7},(_,k)=>{const t=k/6,z0=-.012+t*.108,r=.045*(1-.72*t**3);return Array.from({length:12},(_,j)=>{const theta=j*Math.PI*2/12;return[xx+r*Math.cos(theta),base+.035+.019*Math.sin(theta)*(1-.65*t),z0];});}),toeFaces=[toeRings[0].toReversed(),toeRings.at(-1)];
     for(let k=0;k<6;k++)for(let j=0;j<12;j++){const next=(j+1)%12;toeFaces.push([toeRings[k][j],toeRings[k][next],toeRings[k+1][next]],[toeRings[k][j],toeRings[k+1][next],toeRings[k+1][j]]);}solid(shoe+'-toe-box',toeFaces,a.point([0,0,0]),'leather',a.r);
     for(const side of [-1,1])a.line(shoe+'-lace-'+side,[xx+side*.027,base+.067,-.015],[xx-side*.021,base+.061,.027],.003,'linenDark');
    }
   }else{const n=Math.max(1,Math.floor((width-.12)/.22));for(let i=0;i<n;i++)a.vessel(id+'-vessel-'+s+'-'+i,Math.min(.075,(depth-.09)/2),.15+s*.025,[(i-(n-1)/2)*.22,yy+.0225,.015],i%2?'clayLight':'clay');}
  }
  if(contents==='clothes'||contents==='linen')for(const side of [-1,1]){
   const door=id+'-door-'+side,w=width/2-.010,h=height-.16,hinge=side*(width/2-.004),inner=hinge-side*w,c=(hinge+inner)/2;
   for(const xx of [hinge-side*.021,inner+side*.021])a.b(door+'-stile-'+xx,[.042,h,.028],[xx,.155+h/2,depth/2+.018],'oak',true);
   for(const yy of [.155+.032,height-.005-.032])a.b(door+'-rail-'+yy,[w-.042,.064,.028],[c,yy,depth/2+.018],'oakLight',true);
   a.b(door+'-recessed-panel',[w-.076,h-.112,.015],[c,.155+h/2,depth/2+.015],'oakLight');
   for(const yy of [.25,height-.10]){
    a.b(door+'-hinge-strap-'+yy,[.09,.026,.008],[hinge-side*.034,yy,depth/2+.036],'iron');
    a.m(door+'-hinge-knuckle-'+yy,revolve({profile:[{x:.008,y:0},{x:.013,y:0},{x:.013,y:.056},{x:.008,y:.056},{x:.008,y:0}],segments:28}),[hinge,yy-.028,depth/2+.047],'iron');
    a.m(id+'-fixed-door-pin-'+side+'-'+yy,revolve({profile:[{x:0,y:0},{x:.013,y:0},{x:.013,y:.009},{x:.007,y:.009},{x:.007,y:.074},{x:0,y:.074}],segments:28}),[hinge,yy-.037,depth/2+.047],'iron');
    const seat=yy<height/2?.13:height+.024;
    a.cyl(id+'-fixed-door-stem-'+side+'-'+yy,.007,Math.abs(yy-seat),[hinge,Math.min(yy,seat),depth/2+.047],'iron');
    a.line(id+'-fixed-door-anchor-'+side+'-'+yy,[hinge-side*.035,seat,depth/2-.04],[hinge,seat,depth/2+.047],.014,'iron');
    for(const xx of [hinge-side*.027,hinge-side*.060])a.b(door+'-hinge-rivet-'+yy+'-'+xx,[.011,.011,.018],[xx,yy,depth/2+.039],'ironWarm',true);
   }
   a.line(door+'-pull-eye',[inner+side*.028,.155+h*.55,depth/2+.015],[inner+side*.028,.155+h*.55,depth/2+.057],.009,'iron');
   a.hoop(door+'-pull',[inner+side*.028,.155+h*.55-.024,depth/2+.053],.026,.007,'iron');
   registerMechanism({id:door,parent:id,prefix:door+'-',level,pivot:a.point([hinge,.155,depth/2+.047]),restAngle:angle,axis:[0,1,0],travel:side*Math.PI*.48,kind:'furnishing-door'});
  }
  finish(id,level,'furnishing',{frontAngle:angle});
 }
 function counter(id,x,y,z,length,depth){
  y=floor(0);const a=at(x,y,z),lx=length/2-.085,lz=depth/2-.07;
  for(const dx of [-lx,lx])for(const dz of [-lz,lz])a.b(id+'-leg-'+dx+'-'+dz,[.10,.83,.10],[dx,.415,dz],'oak',true);
  for(const yy of [.16,.47])a.b(id+'-shelf-'+yy,[length-.08,.045,depth-.06],[0,yy,0],'oakLight');
  for(const dz of [-lz,lz])a.b(id+'-apron-'+dz,[length-.10,.14,.05],[0,.76,dz],'oak');
  for(let i=0;i<3;i++)a.b(id+'-worktop-'+i,[length,.06,depth/3-.003],[0,.86,(i-1)*depth/3],'oakLight',true);
  for(let i=0;i<4;i++)a.vessel(id+'-lower-pot-'+i,.13,.24,[-length*.32+i*length*.21,.1825,0],'clay');
  a.vessel(id+'-mixing-bowl',.18,.12,[-.65,.89,0],'clayLight');a.vessel(id+'-pitcher',.10,.26,[.62,.89,-.02],'clay',true);
  a.cyl(id+'-water-jug-cover-plug',.059,.016,[.62,1.134,-.02],'oakLight');
  a.cyl(id+'-water-jug-cover-cap',.076,.015,[.62,1.15,-.02],'oakLight');
  a.cyl(id+'-water-jug-cover-knob',.012,.025,[.62,1.165,-.02],'oak');
  a.b(id+'-cutting-board',[.40,.025,.25],[0,.9025,.06],'oak',true);a.b(id+'-knife-blade',[.16,.008,.032],[.02,.921,.06],'iron');a.b(id+'-knife-grip',[.085,.017,.030],[.142,.923,.06],'oak');
  for(const dx of [-length*.32,length*.32])a.b(id+'-rack-post-'+dx,[.045,.43,.045],[dx,1.055,-depth/2+.045],'oak');
  a.b(id+'-rack',[length*.74,.06,.04],[0,1.24,-depth/2+.045],'oak');
  for(let i=0;i<5;i++){
   const xx=-length*.28+i*length*.14,zz=-depth/2+.115,mat=i===2?'iron':'oakLight';
   a.line(id+'-peg-'+i,[xx,1.24,-depth/2+.045],[xx,1.24,-depth/2+.13],.010,'oak');a.hoop(id+'-tool-eye-'+i,[xx,1.231,zz],.017,.006,mat);
   a.line(id+'-tool-handle-'+i,[xx,1.221,zz],[xx,1.009,zz],.012,mat);
   if(i===3){for(const dx of [-.02,0,.02])a.line(id+'-fork-tine-'+dx,[xx+dx,1.019,zz],[xx+dx,.964,zz],.009,mat);a.line(id+'-fork-crosspiece',[xx-.02,1.014,zz],[xx+.02,1.014,zz],.012,mat);}
   else{const r=i===2?.038:.027,pr=[[0,0],[r*.6,0],[r,.009],[r,.014],[r-.005,.014],[r*.52,.004],[0,.004]];mesh(id+'-spoon-bowl-'+i,revolve({profile:pr.map(([x,y])=>({x,y})),segments:20}),a.point([xx,.995,zz]),mat,Q([1,0,0],Math.PI/2));}
  }
  finish(id,0,'furnishing');
 }
 function washBasin(id,x,y,z,level=1){
  y=floor(level);const angle=level===1?Math.PI/2:0,a=at(x,y,z,angle),w=.70,d=level===1?.48:.72;
  for(const dx of [-.27,.27])for(const dz of [-d/2+.08,d/2-.08])a.b(id+'-leg-'+dx+'-'+dz,[.065,.73,.065],[dx,.365,dz],'oak',true);
  a.b(id+'-shelf',[.62,.035,d-.10],[0,.18,0],'oakLight');a.b(id+'-slab',[w,.07,d],[0,.765,0],'stone',true);
  a.vessel(id+'-basin',level===1?.18:.21,.12,[-.07,.80,level===1?.01:.07],'clayLight');a.vessel(id+'-jug',.075,.24,[.22,.80,-d/2+.09],'clay',true);
  a.cyl(id+'-jug-lid',.054,.012,[.22,1.04,-d/2+.09],'oakLight');
  a.vessel(id+'-waste-pail',.17,.29,[0,.1975,0],'oakLight',false,'pail');
  for(const yy of [.245,.45])a.hoop(id+'-pail-hoop-'+yy,[0,yy,0],.17*(.77+.23*(yy-.1975)/.29)+.005,.012,'iron','xz');
  a.hoop(id+'-pail-bail',[0,.46,0],.165,.012,'iron','xy',0,Math.PI);
  if(level===1){
   a.tube(id+'-towel-rail',[[.38,.69,-.16],[.38,.69,.16]],.022,'oak');
   for(const dz of [-.16,.16])a.line(id+'-rail-support-'+dz,[.27,.69,dz],[.38,.69,dz],.018,'oak');
   towel(id+'-towel',...a.point([.38,.69,0]),.28,'linen',angle+Math.PI/2,.014);
  }else{
   a.tube(id+'-towel-rail',[[-.29,.69,d/2+.035],[.29,.69,d/2+.035]],.022,'oak');
   for(const dx of [-.27,.27])a.line(id+'-rail-support-'+dx,[dx,.69,d/2-.08],[dx,.69,d/2+.035],.018,'oak');
   towel(id+'-towel',...a.point([0,.69,d/2+.035]),.28,'linen',angle,.014);
  }
  finish(id,level,'furnishing',{frontAngle:angle});
  // Separate independent tub definition; no distant union hides its joinery.
  const tx=level===1?3.96:6.15,tz=level===1?4.65:1.02,t=at(tx,y,tz),radius=level===1?.42:.34,h=level===1?.52:.43;
  t.cyl(id+'-tub-bottom',radius*.80,.065,[0,0,0],'oak');
  for(let i=0;i<28;i++){
   const u=i*Math.PI*2/28,v=(i+1)*Math.PI*2/28,
    ring=(r,yy)=>[[Math.cos(u)*r,yy,Math.sin(u)*r],[Math.cos(v)*r,yy,Math.sin(v)*r]],
    lo=ring(radius*.83,.04),hi=ring(radius,h),li=ring(radius*.83-.025,.04),ii=ring(radius-.025,h),faces=[[lo[0],hi[0],hi[1],lo[1]],[li[1],ii[1],ii[0],li[0]],[hi[0],ii[0],ii[1],hi[1]],[lo[1],li[1],li[0],lo[0]],[lo[0],li[0],ii[0],hi[0]],[lo[1],hi[1],ii[1],li[1]]];
   solid(id+'-tub-stave-'+i,faces,[tx,y,tz],i%3?'oakLight':'oakPale');
  }
  for(const yy of [.13,h-.07])t.hoop(id+'-tub-band-'+yy,[0,yy,0],radius*.83+(radius*.17)*(yy-.04)/(h-.04)+.006,.019,'iron','xz');
  if(level===0){t.vessel(id+'-soap-crock',.07,.10,[radius*.48,.065,0],'clayLight');}
  textile(id+'-tub-linen',tx,y,tz,24,36,(u,v)=>{
   const zz=(u-.5)*.23,t=v*3,outer=Math.sqrt(radius*radius-zz*zz),inner=Math.sqrt((radius-.025)**2-zz*zz);let xx,yy;
   if(t<1){yy=h-.14*(1-t);xx=inner-.004-(1-t)*.012;}
   else if(t<2){xx=inner-.004+(outer-inner+.008)*(t-1);yy=h+.003+.002*Math.sin((t-1)*Math.PI);}
   else{yy=h-.24*(t-2);const bandLift=.019*Math.exp(-(((yy-(h-.07))/.035)**2));xx=outer+.004-(t-2)*radius*.17*.24/(h-.04)+bandLift;}
   return[xx,yy,zz];
  },'linen');
  t.line(id+'-wash-paddle',[radius*.25,.06,-radius*.2],[radius*.6,h+.16,-radius*.35],.032,'oakLight');
  finish(id+'-tub',level,'furnishing');
 }
 function rug(id,x,y,z,length,width,level=0){
  y=floor(level);const angle=width>length?Math.PI/2:0;if(width>length)[length,width]=[width,length];const a=at(x,y,z,angle);
  textile(id+'-woven-base',x,y+.006,z,Math.ceil(length/.05),16,(u,v)=>[(u-.5)*length,0,(v-.5)*width],'linenDark',angle,.006);
  for(const dz of [-width/2+.024,width/2-.024])a.b(id+'-selvedge-'+dz,[length,.002,.026],[0,.007,dz],'linen');
  for(const dx of [-length/2,length/2])for(let i=0;i<Math.floor(width/.02);i++)a.tube(id+'-fringe-'+dx+'-'+i,[[dx,.005,-width/2+.01+i*.02],[dx+Math.sign(dx)*.025,.004,-width/2+.014+i*.02],[dx+Math.sign(dx)*.047,.003,-width/2+.011+i*.02]],.002,'linen');
  finish(id,level,'furnishing');
 }
 function wallLamp(id,x,y,z,level=0,angle=0){
  const a=at(x,y,z,angle);a.b(id+'-plate',[.07,.26,.015],[0,0,0],'iron',true);
  for(const yy of [-.095,.095])a.b(id+'-nail-'+yy,[.02,.02,.016],[0,yy,.006],'iron');
  a.line(id+'-bracket',[0,-.07,.004],[0,-.10,.16],.022,'iron');a.line(id+'-stem',[0,-.10,.16],[0,.02,.16],.022,'iron');
  a.vessel(id+'-drip-cup',.065,.025,[0,.01,.16],'iron');a.cyl(id+'-candle',.023,.14,[0,.02,.16],'wax');a.cyl(id+'-wick',.003,.016,[0,.16,.16],'charcoal',8);
  a.m(id+'-flame',revolve({profile:[{x:0,y:0},{x:.007,y:.004},{x:.013,y:.013},{x:.014,y:.023},{x:.011,y:.032},{x:.007,y:.043},{x:.003,y:.054},{x:0,y:.062}],segments:32}),[0,.167,.16],'flame');finish(id,level,'furnishing',{frontAngle:angle});
 }
 function latrineUnit(id,x,y,z,level=1){
  y=floor(level);const a=at(x,y,z),w=.60,d=.57;
  for(const dx of [-.25,.25])for(const dz of [-.23,.23])a.b(id+'-post-'+dx+'-'+dz,[.07,.43,.07],[dx,.215,dz],'oak',true);
  for(const dx of [-.276,.276])a.b(id+'-side-'+dx,[.045,.35,.50],[dx,.255,0],'oakLight');a.b(id+'-back',[.51,.35,.04],[0,.255,-.26],'oak');
  a.b(id+'-removable-front',[.51,.36,.025],[0,.25,.26],'oakLight',true);a.hoop(id+'-front-pull',[0,.30,.28],.035,.009,'iron');
  a.line(id+'-front-pull-eye',[0,.331,.262],[0,.331,.283],.010,'iron');
  const hole=Array.from({length:32},(_,i)=>({x:.15*Math.cos(i*Math.PI/16),y:.17*Math.sin(i*Math.PI/16)}));
  mesh(id+'-pierced-seat',extrude({outer:[{x:-w/2,y:-d/2},{x:w/2,y:-d/2},{x:w/2,y:d/2},{x:-w/2,y:d/2}],holes:[hole],depth:.045}),[x,y+.4525,z],'oakLight',Q([1,0,0],Math.PI/2));
  a.vessel(id+'-chamber-pot',.205,.32,[0,0,0],'clayLight',false,'pail');
  mesh(id+'-transport-lid',revolve({profile:[{x:0,y:-.006},{x:.205,y:-.006},{x:.205,y:.006},{x:0,y:.006}],segments:32}),a.point([0,.205,-.225]),'oakLight',Q([1,0,0],Math.PI/2));
  a.hoop(id+'-transport-lid-pull',[0,.215,-.20],.022,.007,'iron');
  a.line(id+'-transport-lid-eye',[0,.234,-.229],[0,.234,-.198],.009,'iron');
  a.b(id+'-raised-lid',[.38,.30,.035],[0,.635,-.255],'oak',true);a.line(id+'-lid-pin',[-.16,.484,-.25],[.16,.484,-.25],.018,'iron');
  finish(id,level,'furnishing');
 }
 function hearth(id,x,y,z,width,height,depth){
  const kitchen=id.startsWith('kitchen'),angle=kitchen?Math.PI:0,base=.45,a=at(x,base,z,angle),h=1.02,back=-depth/2+.055;
  a.b(id+'-hearthstone',[width+.18,.08,depth+.30],[0,.04,.06],'stoneDark',true);
  for(const dx of [-width/2+.10,width/2-.10])for(let i=0;i<5;i++)a.b(id+'-jamb-'+dx+'-'+i,[.20,(h-.08)/5-.006,depth],[dx,.08+(i+.5)*(h-.08)/5,0],i%2?'stone':'stoneLight',true);
  for(const dx of [-width/2+.10,width/2-.10])for(let i=0;i<=5;i++){
   const thickness=i===0||i===5?.003:.006,yy=.08+i*(h-.08)/5+(i===0?.0015:i===5?-.0015:0);
   a.b(id+'-jamb-bed-joint-'+dx+'-'+i,[.194,thickness,depth-.006],[dx,yy,0],'plaster');
  }
  a.b(id+'-fireback',[width-.40,h-.08,.11],[0,(h+.08)/2,back],'charcoal');
  a.b(id+'-lintel',[width,.15,.18],[0,h+.075,depth/2-.09],'stoneDark',true);
  // Four hollow tapered walls lead into the existing, separately visible flue.
  const topY=1.95-base,topZ=(kitchen?-1.57:-1.03)-z,localZ=topZ*Math.cos(angle),ring=(w,d,yy,zz)=>[[-w/2,yy,zz-d/2],[w/2,yy,zz-d/2],[w/2,yy,zz+d/2],[-w/2,yy,zz+d/2]],
   outer0=ring(width,depth,h,0),outer1=ring(.90,.60,topY,localZ),inner0=ring(width-.24,depth-.20,h,0),inner1=ring(.66,.36,topY,localZ),f=[];
  for(let i=0;i<4;i++){const j=(i+1)%4;f.push([outer0[i],outer0[j],outer1[j],outer1[i]],[inner0[j],inner0[i],inner1[i],inner1[j]],[outer1[i],outer1[j],inner1[j],inner1[i]],[outer0[j],outer0[i],inner0[i],inner0[j]]);}
  solid(id+'-hollow-hood',f.map(f=>f.toReversed()),[x,base,z],'plaster',a.r);
  for(const dx of [-width*.22,width*.22]){a.line(id+'-andiron-leg-'+dx,[dx,.08,.14],[dx,.28,.14],.035,'iron');a.line(id+'-andiron-foot-'+dx,[dx,.10,-.19],[dx,.10,.26],.035,'iron');a.line(id+'-andiron-rest-'+dx,[dx,.20,-.18],[dx,.20,.20],.030,'iron');}
  for(let i=0;i<3;i++){
   const p=i===1?[0,.3395,-.16]:[-width*.28,.2565,(i-1)*.10],q=i===1?[0,.3395,.16]:[width*.28,.2565,(i-1)*.10];a.tube(id+'-log-'+i,[p,q],.083,i===1?'charcoal':'oak');
   for(let j=0;j<4;j++)a.tube(id+'-charred-bark-'+i+'-'+j,[p.map((v,k)=>v+(k===1?.036:k===(i===1?0:2)?(j-1.5)*.015:0)),q.map((v,k)=>v+(k===1?.036:k===(i===1?0:2)?(j-1.5)*.015:0))],.012,'charcoal');
  }
  for(let i=0;i<23;i++){const xx=width*.52*(((i*.618)%1)-.5),zz=.32*(((i*.414)%1)-.5);a.m(id+'-coal-'+i,revolve({profile:[{x:0,y:0},{x:.022+(i%3)*.007,y:0},{x:.027,y:.018},{x:0,y:.033}],segments:7}),[xx,.08,zz],i%4?'charcoal':'ember');}
  for(let i=0;i<5;i++){
   const xx=(i-2)*width*.095,zz=-.035+(i%2)*.085,hh=.15+(i%3)*.026;
   a.m(id+'-tongue-fuel-'+i,revolve({profile:[{x:0,y:0},{x:.028,y:0},{x:.033,y:.010},{x:.024,y:.026},{x:0,y:.029}],segments:20}),[xx,.08,zz],'ember');
   const rings=Array.from({length:8},(_,k)=>{const t=k/8,rr=.008*(1-t)+.025*Math.sin(t*Math.PI)**1.4;return Array.from({length:20},(_,j)=>[xx+.024*t*t*Math.sin(i*1.7)+rr*Math.cos(j*Math.PI/10),.095+hh*t,zz+.012*t*t+rr*.65*Math.sin(j*Math.PI/10)]);}),faces=[rings[0].toReversed()],tip=[xx+.024*Math.sin(i*1.7),.095+hh,zz+.012];
   for(let k=0;k<7;k++)for(let j=0;j<20;j++){const n=(j+1)%20;faces.push([rings[k][j],rings[k][n],rings[k+1][n]],[rings[k][j],rings[k+1][n],rings[k+1][j]]);}for(let j=0;j<20;j++)faces.push([rings[7][j],rings[7][(j+1)%20],tip]);solid(id+'-fire-tongue-'+i,faces,[x,base,z],'flame',a.r);
  }
  if(kitchen){
   a.line(id+'-crane-upright',[width*.31,.08,0],[width*.31,1.027,0],.035,'iron');
   for(const yy of [.18,.72]){a.b(id+'-crane-anchor-'+yy,[.11,.06,.075],[width*.31,yy,0],'iron');a.line(id+'-crane-fixing-'+yy,[width*.31,yy,0],[width/2-.12,yy,0],.025,'iron');}
   a.line(id+'-crane-arm',[width*.31,.987,0],[0,.987,.04],.025,'iron');
   for(let i=0;i<7;i++){const yy=.981-i*.037;a.tube(id+'-chain-link-'+i,Array.from({length:20},(_,j)=>{const t=j*Math.PI/10;return i%2?[.013*Math.cos(t),yy+.021*Math.sin(t),.04]:[0,yy+.021*Math.sin(t),.04+.013*Math.cos(t)];}),.005,'iron',true);}
   a.hoop(id+'-bail',[0,.5765,.04],.17,.012,'iron','xy',0,Math.PI);
   a.vessel(id+'-cookpot',.17,.19,[0,.40,.04],'iron',false,'pail');
   for(const dx of [-.17,.17])a.b(id+'-bail-ear-'+dx,[.025,.042,.023],[dx,.5755,.04],'iron');
  }
  finish(id,0,'furnishing');
 }
 function nightStand(id,x,z,level=1){
  const a=at(x,floor(level),z);
  for(const dx of [-.19,.19])for(const dz of [-.16,.16])a.b(id+'-leg-'+dx+'-'+dz,[.06,.60,.06],[dx,.30,dz],'oak',true);
  for(const yy of [.15,.61])a.b(id+'-board-'+yy,[.47,.04,.41],[0,yy,0],'oakLight',true);
  a.vessel(id+'-water-jug',.085,.23,[-.07,.63,-.05],'clay',true);a.cyl(id+'-jug-lid',.061,.012,[-.07,.86,-.05],'oakLight');
  a.vessel(id+'-cup',.042,.08,[.12,.63,.10],'clayLight',false,'cup');finish(id,level,'furnishing');
 }
 function serviceTools(id,x,z){
  const y=floor(0),a=at(x,y,z);
  for(const dx of [-.39,.39]){a.b(id+'-foot-'+dx,[.08,.05,.44],[dx,.025,0],'oak');a.b(id+'-upright-'+dx,[.045,1.16,.045],[dx,.63,0],'oak');}
  for(const yy of [.47,.84,1.2])a.tube(id+'-drying-rail-'+yy,[[-.39,yy,0],[.39,yy,0]],.024,'oak');
  for(const dx of [-.20,.17])towel(id+'-drying-cloth-'+dx,x+dx,y+1.2,z,.25);
  a.line(id+'-broom-handle',[.48,.13,.03],[.48,1.30,.03],.025,'oak');
  a.line(id+'-broom-holder-arm',[.39,.84,0],[.48,.84,.03],.018,'iron');
  a.hoop(id+'-broom-holder',[.48,.84,.03],.016,.007,'iron','xz');
  for(let i=0;i<19;i++){const t=i*Math.PI*2/19;a.line(id+'-broom-straw-'+i,[.48+.065*Math.cos(t),.005,.03+.036*Math.sin(t)],[.48+.013*Math.cos(t),.28,.03+.013*Math.sin(t)],.006,'linenDark');}
  a.hoop(id+'-broom-binding',[.48,.22,.03],.023,.009,'linen','xz');
  a.vessel(id+'-closed-water-pail',.18,.32,[-.62,0,.04],'oakLight',false,'pail');
  for(const yy of [.06,.28])a.hoop(id+'-water-band-'+yy,[-.62,yy,.04],.18*(.77+.23*yy/.32)+.004,.012,'iron','xz');
  a.cyl(id+'-pail-lid',.18,.018,[-.62,.32,.04],'oakLight');a.hoop(id+'-carry-bail',[-.62,.29,.04],.175,.012,'iron','xy',0,Math.PI);finish(id,0,'furnishing');
 }
 return {bevel,at,cloth,table,bench,bed,chest,shelf,cabinet,counter,washBasin,rug,wallLamp,latrineUnit,hearth,nightStand,serviceTools};
}
