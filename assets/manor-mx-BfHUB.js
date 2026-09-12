var Mc=Object.defineProperty;var yc=(n,e,t)=>e in n?Mc(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t;var ci=(n,e,t)=>yc(n,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function t(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(r){if(r.ep)return;r.ep=!0;const s=t(r);fetch(r.href,s)}})();/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const wo="169",Sc=0,Ho=1,bc=2,_l=1,xl=2,Sn=3,An=0,qt=1,dn=2,zn=0,Ri=1,Go=2,Vo=3,Wo=4,Ec=5,ni=100,wc=101,Tc=102,Ac=103,Rc=104,Cc=200,Pc=201,Lc=202,Ic=203,Ns=204,Fs=205,Dc=206,Uc=207,Nc=208,Fc=209,Oc=210,zc=211,Bc=212,kc=213,Hc=214,Os=0,zs=1,Bs=2,Li=3,ks=4,Hs=5,Gs=6,Vs=7,vl=0,Gc=1,Vc=2,Bn=0,Wc=1,Xc=2,qc=3,Ml=4,Yc=5,$c=6,jc=7,Xo="attached",Kc="detached",yl=300,Ii=301,Di=302,Ws=303,Xs=304,Xr=306,zr=1e3,Fn=1001,Br=1002,Ot=1003,Zc=1004,Yi=1005,Kt=1006,Zr=1007,On=1008,Rn=1009,Sl=1010,bl=1011,Zi=1012,To=1013,oi=1014,ln=1015,er=1016,Ao=1017,Ro=1018,Ui=1020,El=35902,wl=1021,Tl=1022,en=1023,Al=1024,Rl=1025,Ci=1026,Ni=1027,Co=1028,Po=1029,Cl=1030,Lo=1031,Io=1033,Lr=33776,Ir=33777,Dr=33778,Ur=33779,qs=35840,Ys=35841,$s=35842,js=35843,Ks=36196,Zs=37492,Js=37496,Qs=37808,eo=37809,to=37810,no=37811,io=37812,ro=37813,so=37814,oo=37815,ao=37816,lo=37817,co=37818,uo=37819,ho=37820,fo=37821,Nr=36492,po=36494,mo=36495,Pl=36283,go=36284,_o=36285,xo=36286,Jc=3200,Qc=3201,Ll=0,eu=1,bn="",sn="srgb",Gn="srgb-linear",Do="display-p3",qr="display-p3-linear",kr="linear",bt="srgb",Hr="rec709",Gr="p3",ui=7680,qo=519,tu=512,nu=513,iu=514,Il=515,ru=516,su=517,ou=518,au=519,Yo=35044,$o="300 es",wn=2e3,Vr=2001;class Oi{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;const i=this._listeners;return i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;const r=this._listeners[e];if(r!==void 0){const s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){if(this._listeners===void 0)return;const i=this._listeners[e.type];if(i!==void 0){e.target=this;const r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}}const Ut=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let jo=1234567;const ji=Math.PI/180,Ji=180/Math.PI;function li(){const n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Ut[n&255]+Ut[n>>8&255]+Ut[n>>16&255]+Ut[n>>24&255]+"-"+Ut[e&255]+Ut[e>>8&255]+"-"+Ut[e>>16&15|64]+Ut[e>>24&255]+"-"+Ut[t&63|128]+Ut[t>>8&255]+"-"+Ut[t>>16&255]+Ut[t>>24&255]+Ut[i&255]+Ut[i>>8&255]+Ut[i>>16&255]+Ut[i>>24&255]).toLowerCase()}function Ft(n,e,t){return Math.max(e,Math.min(t,n))}function Uo(n,e){return(n%e+e)%e}function lu(n,e,t,i,r){return i+(n-e)*(r-i)/(t-e)}function cu(n,e,t){return n!==e?(t-n)/(e-n):0}function Ki(n,e,t){return(1-t)*n+t*e}function uu(n,e,t,i){return Ki(n,e,1-Math.exp(-t*i))}function hu(n,e=1){return e-Math.abs(Uo(n,e*2)-e)}function fu(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function du(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function pu(n,e){return n+Math.floor(Math.random()*(e-n+1))}function mu(n,e){return n+Math.random()*(e-n)}function gu(n){return n*(.5-Math.random())}function _u(n){n!==void 0&&(jo=n);let e=jo+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function xu(n){return n*ji}function vu(n){return n*Ji}function Mu(n){return(n&n-1)===0&&n!==0}function yu(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function Su(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function bu(n,e,t,i,r){const s=Math.cos,o=Math.sin,a=s(t/2),l=o(t/2),u=s((e+i)/2),c=o((e+i)/2),h=s((e-i)/2),f=o((e-i)/2),p=s((i-e)/2),v=o((i-e)/2);switch(r){case"XYX":n.set(a*c,l*h,l*f,a*u);break;case"YZY":n.set(l*f,a*c,l*h,a*u);break;case"ZXZ":n.set(l*h,l*f,a*c,a*u);break;case"XZX":n.set(a*c,l*v,l*p,a*u);break;case"YXY":n.set(l*p,a*c,l*v,a*u);break;case"ZYZ":n.set(l*v,l*p,a*c,a*u);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function wi(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("Invalid component type.")}}function kt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("Invalid component type.")}}const ei={DEG2RAD:ji,RAD2DEG:Ji,generateUUID:li,clamp:Ft,euclideanModulo:Uo,mapLinear:lu,inverseLerp:cu,lerp:Ki,damp:uu,pingpong:hu,smoothstep:fu,smootherstep:du,randInt:pu,randFloat:mu,randFloatSpread:gu,seededRandom:_u,degToRad:xu,radToDeg:vu,isPowerOfTwo:Mu,ceilPowerOfTwo:yu,floorPowerOfTwo:Su,setQuaternionFromProperEuler:bu,normalize:kt,denormalize:wi};class _t{constructor(e=0,t=0){_t.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(Ft(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class ht{constructor(e,t,i,r,s,o,a,l,u){ht.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,u)}set(e,t,i,r,s,o,a,l,u){const c=this.elements;return c[0]=e,c[1]=r,c[2]=a,c[3]=t,c[4]=s,c[5]=l,c[6]=i,c[7]=o,c[8]=u,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[3],l=i[6],u=i[1],c=i[4],h=i[7],f=i[2],p=i[5],v=i[8],M=r[0],m=r[3],g=r[6],P=r[1],L=r[4],F=r[7],Q=r[2],H=r[5],V=r[8];return s[0]=o*M+a*P+l*Q,s[3]=o*m+a*L+l*H,s[6]=o*g+a*F+l*V,s[1]=u*M+c*P+h*Q,s[4]=u*m+c*L+h*H,s[7]=u*g+c*F+h*V,s[2]=f*M+p*P+v*Q,s[5]=f*m+p*L+v*H,s[8]=f*g+p*F+v*V,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],u=e[7],c=e[8];return t*o*c-t*a*u-i*s*c+i*a*l+r*s*u-r*o*l}invert(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],u=e[7],c=e[8],h=c*o-a*u,f=a*l-c*s,p=u*s-o*l,v=t*h+i*f+r*p;if(v===0)return this.set(0,0,0,0,0,0,0,0,0);const M=1/v;return e[0]=h*M,e[1]=(r*u-c*i)*M,e[2]=(a*i-r*o)*M,e[3]=f*M,e[4]=(c*t-r*l)*M,e[5]=(r*s-a*t)*M,e[6]=p*M,e[7]=(i*l-u*t)*M,e[8]=(o*t-i*s)*M,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,o,a){const l=Math.cos(s),u=Math.sin(s);return this.set(i*l,i*u,-i*(l*o+u*a)+o+e,-r*u,r*l,-r*(-u*o+l*a)+a+t,0,0,1),this}scale(e,t){return this.premultiply(Jr.makeScale(e,t)),this}rotate(e){return this.premultiply(Jr.makeRotation(-e)),this}translate(e,t){return this.premultiply(Jr.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const Jr=new ht;function Dl(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Qi(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function Eu(){const n=Qi("canvas");return n.style.display="block",n}const Ko={};function Fr(n){n in Ko||(Ko[n]=!0,console.warn(n))}function wu(n,e,t){return new Promise(function(i,r){function s(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:i()}}setTimeout(s,t)})}function Tu(n){const e=n.elements;e[2]=.5*e[2]+.5*e[3],e[6]=.5*e[6]+.5*e[7],e[10]=.5*e[10]+.5*e[11],e[14]=.5*e[14]+.5*e[15]}function Au(n){const e=n.elements;e[11]===-1?(e[10]=-e[10]-1,e[14]=-e[14]):(e[10]=-e[10],e[14]=-e[14]+1)}const Zo=new ht().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),Jo=new ht().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),Bi={[Gn]:{transfer:kr,primaries:Hr,luminanceCoefficients:[.2126,.7152,.0722],toReference:n=>n,fromReference:n=>n},[sn]:{transfer:bt,primaries:Hr,luminanceCoefficients:[.2126,.7152,.0722],toReference:n=>n.convertSRGBToLinear(),fromReference:n=>n.convertLinearToSRGB()},[qr]:{transfer:kr,primaries:Gr,luminanceCoefficients:[.2289,.6917,.0793],toReference:n=>n.applyMatrix3(Jo),fromReference:n=>n.applyMatrix3(Zo)},[Do]:{transfer:bt,primaries:Gr,luminanceCoefficients:[.2289,.6917,.0793],toReference:n=>n.convertSRGBToLinear().applyMatrix3(Jo),fromReference:n=>n.applyMatrix3(Zo).convertLinearToSRGB()}},Ru=new Set([Gn,qr]),xt={enabled:!0,_workingColorSpace:Gn,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(n){if(!Ru.has(n))throw new Error(`Unsupported working color space, "${n}".`);this._workingColorSpace=n},convert:function(n,e,t){if(this.enabled===!1||e===t||!e||!t)return n;const i=Bi[e].toReference,r=Bi[t].fromReference;return r(i(n))},fromWorkingColorSpace:function(n,e){return this.convert(n,this._workingColorSpace,e)},toWorkingColorSpace:function(n,e){return this.convert(n,e,this._workingColorSpace)},getPrimaries:function(n){return Bi[n].primaries},getTransfer:function(n){return n===bn?kr:Bi[n].transfer},getLuminanceCoefficients:function(n,e=this._workingColorSpace){return n.fromArray(Bi[e].luminanceCoefficients)}};function Pi(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function Qr(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}let hi;class Cu{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{hi===void 0&&(hi=Qi("canvas")),hi.width=e.width,hi.height=e.height;const i=hi.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height),t=hi}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Qi("canvas");t.width=e.width,t.height=e.height;const i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);const r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=Pi(s[o]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){const t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Pi(t[i]/255)*255):t[i]=Pi(t[i]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let Pu=0;class Ul{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Pu++}),this.uuid=li(),this.data=e,this.dataReady=!0,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(es(r[o].image)):s.push(es(r[o]))}else s=es(r);i.url=s}return t||(e.images[this.uuid]=i),i}}function es(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?Cu.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let Lu=0;class zt extends Oi{constructor(e=zt.DEFAULT_IMAGE,t=zt.DEFAULT_MAPPING,i=Fn,r=Fn,s=Kt,o=On,a=en,l=Rn,u=zt.DEFAULT_ANISOTROPY,c=bn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Lu++}),this.uuid=li(),this.name="",this.source=new Ul(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=u,this.format=a,this.internalFormat=null,this.type=l,this.offset=new _t(0,0),this.repeat=new _t(1,1),this.center=new _t(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new ht,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=c,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const i={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==yl)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case zr:e.x=e.x-Math.floor(e.x);break;case Fn:e.x=e.x<0?0:1;break;case Br:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case zr:e.y=e.y-Math.floor(e.y);break;case Fn:e.y=e.y<0?0:1;break;case Br:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}zt.DEFAULT_IMAGE=null;zt.DEFAULT_MAPPING=yl;zt.DEFAULT_ANISOTROPY=1;class Et{constructor(e=0,t=0,i=0,r=1){Et.prototype.isVector4=!0,this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,i=this.y,r=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*t+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*t+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*t+o[7]*i+o[11]*r+o[15]*s,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s;const l=e.elements,u=l[0],c=l[4],h=l[8],f=l[1],p=l[5],v=l[9],M=l[2],m=l[6],g=l[10];if(Math.abs(c-f)<.01&&Math.abs(h-M)<.01&&Math.abs(v-m)<.01){if(Math.abs(c+f)<.1&&Math.abs(h+M)<.1&&Math.abs(v+m)<.1&&Math.abs(u+p+g-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const L=(u+1)/2,F=(p+1)/2,Q=(g+1)/2,H=(c+f)/4,V=(h+M)/4,le=(v+m)/4;return L>F&&L>Q?L<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(L),r=H/i,s=V/i):F>Q?F<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(F),i=H/r,s=le/r):Q<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(Q),i=V/s,r=le/s),this.set(i,r,s,t),this}let P=Math.sqrt((m-v)*(m-v)+(h-M)*(h-M)+(f-c)*(f-c));return Math.abs(P)<.001&&(P=1),this.x=(m-v)/P,this.y=(h-M)/P,this.z=(f-c)/P,this.w=Math.acos((u+p+g-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Iu extends Oi{constructor(e=1,t=1,i={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new Et(0,0,e,t),this.scissorTest=!1,this.viewport=new Et(0,0,e,t);const r={width:e,height:t,depth:1};i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Kt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},i);const s=new zt(r,i.mapping,i.wrapS,i.wrapT,i.magFilter,i.minFilter,i.format,i.type,i.anisotropy,i.colorSpace);s.flipY=!1,s.generateMipmaps=i.generateMipmaps,s.internalFormat=i.internalFormat,this.textures=[];const o=i.count;for(let a=0;a<o;a++)this.textures[a]=s.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.depthTexture=i.depthTexture,this.samples=i.samples}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let i=0,r=e.textures.length;i<r;i++)this.textures[i]=e.textures[i].clone(),this.textures[i].isRenderTargetTexture=!0;const t=Object.assign({},e.texture.image);return this.texture.source=new Ul(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class ai extends Iu{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}}class Nl extends zt{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Ot,this.minFilter=Ot,this.wrapR=Fn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Du extends zt{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Ot,this.minFilter=Ot,this.wrapR=Fn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}let Gt=class{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,s,o,a){let l=i[r+0],u=i[r+1],c=i[r+2],h=i[r+3];const f=s[o+0],p=s[o+1],v=s[o+2],M=s[o+3];if(a===0){e[t+0]=l,e[t+1]=u,e[t+2]=c,e[t+3]=h;return}if(a===1){e[t+0]=f,e[t+1]=p,e[t+2]=v,e[t+3]=M;return}if(h!==M||l!==f||u!==p||c!==v){let m=1-a;const g=l*f+u*p+c*v+h*M,P=g>=0?1:-1,L=1-g*g;if(L>Number.EPSILON){const Q=Math.sqrt(L),H=Math.atan2(Q,g*P);m=Math.sin(m*H)/Q,a=Math.sin(a*H)/Q}const F=a*P;if(l=l*m+f*F,u=u*m+p*F,c=c*m+v*F,h=h*m+M*F,m===1-a){const Q=1/Math.sqrt(l*l+u*u+c*c+h*h);l*=Q,u*=Q,c*=Q,h*=Q}}e[t]=l,e[t+1]=u,e[t+2]=c,e[t+3]=h}static multiplyQuaternionsFlat(e,t,i,r,s,o){const a=i[r],l=i[r+1],u=i[r+2],c=i[r+3],h=s[o],f=s[o+1],p=s[o+2],v=s[o+3];return e[t]=a*v+c*h+l*p-u*f,e[t+1]=l*v+c*f+u*h-a*p,e[t+2]=u*v+c*p+a*f-l*h,e[t+3]=c*v-a*h-l*f-u*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,l=Math.sin,u=a(i/2),c=a(r/2),h=a(s/2),f=l(i/2),p=l(r/2),v=l(s/2);switch(o){case"XYZ":this._x=f*c*h+u*p*v,this._y=u*p*h-f*c*v,this._z=u*c*v+f*p*h,this._w=u*c*h-f*p*v;break;case"YXZ":this._x=f*c*h+u*p*v,this._y=u*p*h-f*c*v,this._z=u*c*v-f*p*h,this._w=u*c*h+f*p*v;break;case"ZXY":this._x=f*c*h-u*p*v,this._y=u*p*h+f*c*v,this._z=u*c*v+f*p*h,this._w=u*c*h-f*p*v;break;case"ZYX":this._x=f*c*h-u*p*v,this._y=u*p*h+f*c*v,this._z=u*c*v-f*p*h,this._w=u*c*h+f*p*v;break;case"YZX":this._x=f*c*h+u*p*v,this._y=u*p*h+f*c*v,this._z=u*c*v-f*p*h,this._w=u*c*h-f*p*v;break;case"XZY":this._x=f*c*h-u*p*v,this._y=u*p*h-f*c*v,this._z=u*c*v+f*p*h,this._w=u*c*h+f*p*v;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,i=t[0],r=t[4],s=t[8],o=t[1],a=t[5],l=t[9],u=t[2],c=t[6],h=t[10],f=i+a+h;if(f>0){const p=.5/Math.sqrt(f+1);this._w=.25/p,this._x=(c-l)*p,this._y=(s-u)*p,this._z=(o-r)*p}else if(i>a&&i>h){const p=2*Math.sqrt(1+i-a-h);this._w=(c-l)/p,this._x=.25*p,this._y=(r+o)/p,this._z=(s+u)/p}else if(a>h){const p=2*Math.sqrt(1+a-i-h);this._w=(s-u)/p,this._x=(r+o)/p,this._y=.25*p,this._z=(l+c)/p}else{const p=2*Math.sqrt(1+h-i-a);this._w=(o-r)/p,this._x=(s+u)/p,this._y=(l+c)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<Number.EPSILON?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ft(this.dot(e),-1,1)))}rotateTowards(e,t){const i=this.angleTo(e);if(i===0)return this;const r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const i=e._x,r=e._y,s=e._z,o=e._w,a=t._x,l=t._y,u=t._z,c=t._w;return this._x=i*c+o*a+r*u-s*l,this._y=r*c+o*l+s*a-i*u,this._z=s*c+o*u+i*l-r*a,this._w=o*c-i*a-r*l-s*u,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const i=this._x,r=this._y,s=this._z,o=this._w;let a=o*e._w+i*e._x+r*e._y+s*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=i,this._y=r,this._z=s,this;const l=1-a*a;if(l<=Number.EPSILON){const p=1-t;return this._w=p*o+t*this._w,this._x=p*i+t*this._x,this._y=p*r+t*this._y,this._z=p*s+t*this._z,this.normalize(),this}const u=Math.sqrt(l),c=Math.atan2(u,a),h=Math.sin((1-t)*c)/u,f=Math.sin(t*c)/u;return this._w=o*h+this._w*f,this._x=i*h+this._x*f,this._y=r*h+this._y*f,this._z=s*h+this._z*f,this._onChangeCallback(),this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},ae=class Fl{constructor(e=0,t=0,i=0){Fl.prototype.isVector3=!0,this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Qo.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Qo.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){const t=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,l=e.w,u=2*(o*r-a*i),c=2*(a*t-s*r),h=2*(s*i-o*t);return this.x=t+l*u+o*h-a*c,this.y=i+l*c+a*u-s*h,this.z=r+l*h+s*c-o*u,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const i=e.x,r=e.y,s=e.z,o=t.x,a=t.y,l=t.z;return this.x=r*l-s*a,this.y=s*o-i*l,this.z=i*a-r*o,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return ts.copy(this).projectOnVector(e),this.sub(ts)}reflect(e){return this.sub(ts.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(Ft(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){const r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};const ts=new ae,Qo=new Gt;class pn{constructor(e=new ae(1/0,1/0,1/0),t=new ae(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(tn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(tn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const i=tn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const i=e.geometry;if(i!==void 0){const s=i.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=s.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,tn):tn.fromBufferAttribute(s,o),tn.applyMatrix4(e.matrixWorld),this.expandByPoint(tn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ir.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),ir.copy(i.boundingBox)),ir.applyMatrix4(e.matrixWorld),this.union(ir)}const r=e.children;for(let s=0,o=r.length;s<o;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,tn),tn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(ki),rr.subVectors(this.max,ki),fi.subVectors(e.a,ki),di.subVectors(e.b,ki),pi.subVectors(e.c,ki),Cn.subVectors(di,fi),Pn.subVectors(pi,di),Xn.subVectors(fi,pi);let t=[0,-Cn.z,Cn.y,0,-Pn.z,Pn.y,0,-Xn.z,Xn.y,Cn.z,0,-Cn.x,Pn.z,0,-Pn.x,Xn.z,0,-Xn.x,-Cn.y,Cn.x,0,-Pn.y,Pn.x,0,-Xn.y,Xn.x,0];return!ns(t,fi,di,pi,rr)||(t=[1,0,0,0,1,0,0,0,1],!ns(t,fi,di,pi,rr))?!1:(sr.crossVectors(Cn,Pn),t=[sr.x,sr.y,sr.z],ns(t,fi,di,pi,rr))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,tn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(tn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(_n[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),_n[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),_n[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),_n[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),_n[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),_n[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),_n[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),_n[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(_n),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}const _n=[new ae,new ae,new ae,new ae,new ae,new ae,new ae,new ae],tn=new ae,ir=new pn,fi=new ae,di=new ae,pi=new ae,Cn=new ae,Pn=new ae,Xn=new ae,ki=new ae,rr=new ae,sr=new ae,qn=new ae;function ns(n,e,t,i,r){for(let s=0,o=n.length-3;s<=o;s+=3){qn.fromArray(n,s);const a=r.x*Math.abs(qn.x)+r.y*Math.abs(qn.y)+r.z*Math.abs(qn.z),l=e.dot(qn),u=t.dot(qn),c=i.dot(qn);if(Math.max(-Math.max(l,u,c),Math.min(l,u,c))>a)return!1}return!0}const Uu=new pn,Hi=new ae,is=new ae;class Vn{constructor(e=new ae,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const i=this.center;t!==void 0?i.copy(t):Uu.setFromPoints(e).getCenter(i);let r=0;for(let s=0,o=e.length;s<o;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Hi.subVectors(e,this.center);const t=Hi.lengthSq();if(t>this.radius*this.radius){const i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(Hi,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(is.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Hi.copy(e.center).add(is)),this.expandByPoint(Hi.copy(e.center).sub(is))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}}const xn=new ae,rs=new ae,or=new ae,Ln=new ae,ss=new ae,ar=new ae,os=new ae;class Ol{constructor(e=new ae,t=new ae(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,xn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=xn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(xn.copy(this.origin).addScaledVector(this.direction,t),xn.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){rs.copy(e).add(t).multiplyScalar(.5),or.copy(t).sub(e).normalize(),Ln.copy(this.origin).sub(rs);const s=e.distanceTo(t)*.5,o=-this.direction.dot(or),a=Ln.dot(this.direction),l=-Ln.dot(or),u=Ln.lengthSq(),c=Math.abs(1-o*o);let h,f,p,v;if(c>0)if(h=o*l-a,f=o*a-l,v=s*c,h>=0)if(f>=-v)if(f<=v){const M=1/c;h*=M,f*=M,p=h*(h+o*f+2*a)+f*(o*h+f+2*l)+u}else f=s,h=Math.max(0,-(o*f+a)),p=-h*h+f*(f+2*l)+u;else f=-s,h=Math.max(0,-(o*f+a)),p=-h*h+f*(f+2*l)+u;else f<=-v?(h=Math.max(0,-(-o*s+a)),f=h>0?-s:Math.min(Math.max(-s,-l),s),p=-h*h+f*(f+2*l)+u):f<=v?(h=0,f=Math.min(Math.max(-s,-l),s),p=f*(f+2*l)+u):(h=Math.max(0,-(o*s+a)),f=h>0?s:Math.min(Math.max(-s,-l),s),p=-h*h+f*(f+2*l)+u);else f=o>0?-s:s,h=Math.max(0,-(o*f+a)),p=-h*h+f*(f+2*l)+u;return i&&i.copy(this.origin).addScaledVector(this.direction,h),r&&r.copy(rs).addScaledVector(or,f),p}intersectSphere(e,t){xn.subVectors(e.center,this.origin);const i=xn.dot(this.direction),r=xn.dot(xn)-i*i,s=e.radius*e.radius;if(r>s)return null;const o=Math.sqrt(s-r),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){const i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,o,a,l;const u=1/this.direction.x,c=1/this.direction.y,h=1/this.direction.z,f=this.origin;return u>=0?(i=(e.min.x-f.x)*u,r=(e.max.x-f.x)*u):(i=(e.max.x-f.x)*u,r=(e.min.x-f.x)*u),c>=0?(s=(e.min.y-f.y)*c,o=(e.max.y-f.y)*c):(s=(e.max.y-f.y)*c,o=(e.min.y-f.y)*c),i>o||s>r||((s>i||isNaN(i))&&(i=s),(o<r||isNaN(r))&&(r=o),h>=0?(a=(e.min.z-f.z)*h,l=(e.max.z-f.z)*h):(a=(e.max.z-f.z)*h,l=(e.min.z-f.z)*h),i>l||a>r)||((a>i||i!==i)&&(i=a),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,xn)!==null}intersectTriangle(e,t,i,r,s){ss.subVectors(t,e),ar.subVectors(i,e),os.crossVectors(ss,ar);let o=this.direction.dot(os),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Ln.subVectors(this.origin,e);const l=a*this.direction.dot(ar.crossVectors(Ln,ar));if(l<0)return null;const u=a*this.direction.dot(ss.cross(Ln));if(u<0||l+u>o)return null;const c=-a*Ln.dot(os);return c<0?null:this.at(c/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}let dt=class vo{constructor(e,t,i,r,s,o,a,l,u,c,h,f,p,v,M,m){vo.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,u,c,h,f,p,v,M,m)}set(e,t,i,r,s,o,a,l,u,c,h,f,p,v,M,m){const g=this.elements;return g[0]=e,g[4]=t,g[8]=i,g[12]=r,g[1]=s,g[5]=o,g[9]=a,g[13]=l,g[2]=u,g[6]=c,g[10]=h,g[14]=f,g[3]=p,g[7]=v,g[11]=M,g[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new vo().fromArray(this.elements)}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){const t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,i=e.elements,r=1/mi.setFromMatrixColumn(e,0).length(),s=1/mi.setFromMatrixColumn(e,1).length(),o=1/mi.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*o,t[9]=i[9]*o,t[10]=i[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(r),u=Math.sin(r),c=Math.cos(s),h=Math.sin(s);if(e.order==="XYZ"){const f=o*c,p=o*h,v=a*c,M=a*h;t[0]=l*c,t[4]=-l*h,t[8]=u,t[1]=p+v*u,t[5]=f-M*u,t[9]=-a*l,t[2]=M-f*u,t[6]=v+p*u,t[10]=o*l}else if(e.order==="YXZ"){const f=l*c,p=l*h,v=u*c,M=u*h;t[0]=f+M*a,t[4]=v*a-p,t[8]=o*u,t[1]=o*h,t[5]=o*c,t[9]=-a,t[2]=p*a-v,t[6]=M+f*a,t[10]=o*l}else if(e.order==="ZXY"){const f=l*c,p=l*h,v=u*c,M=u*h;t[0]=f-M*a,t[4]=-o*h,t[8]=v+p*a,t[1]=p+v*a,t[5]=o*c,t[9]=M-f*a,t[2]=-o*u,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){const f=o*c,p=o*h,v=a*c,M=a*h;t[0]=l*c,t[4]=v*u-p,t[8]=f*u+M,t[1]=l*h,t[5]=M*u+f,t[9]=p*u-v,t[2]=-u,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){const f=o*l,p=o*u,v=a*l,M=a*u;t[0]=l*c,t[4]=M-f*h,t[8]=v*h+p,t[1]=h,t[5]=o*c,t[9]=-a*c,t[2]=-u*c,t[6]=p*h+v,t[10]=f-M*h}else if(e.order==="XZY"){const f=o*l,p=o*u,v=a*l,M=a*u;t[0]=l*c,t[4]=-h,t[8]=u*c,t[1]=f*h+M,t[5]=o*c,t[9]=p*h-v,t[2]=v*h-p,t[6]=a*c,t[10]=M*h+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Nu,e,Fu)}lookAt(e,t,i){const r=this.elements;return $t.subVectors(e,t),$t.lengthSq()===0&&($t.z=1),$t.normalize(),In.crossVectors(i,$t),In.lengthSq()===0&&(Math.abs(i.z)===1?$t.x+=1e-4:$t.z+=1e-4,$t.normalize(),In.crossVectors(i,$t)),In.normalize(),lr.crossVectors($t,In),r[0]=In.x,r[4]=lr.x,r[8]=$t.x,r[1]=In.y,r[5]=lr.y,r[9]=$t.y,r[2]=In.z,r[6]=lr.z,r[10]=$t.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[4],l=i[8],u=i[12],c=i[1],h=i[5],f=i[9],p=i[13],v=i[2],M=i[6],m=i[10],g=i[14],P=i[3],L=i[7],F=i[11],Q=i[15],H=r[0],V=r[4],le=r[8],Te=r[12],y=r[1],A=r[5],Me=r[9],ue=r[13],I=r[2],ie=r[6],x=r[10],j=r[14],X=r[3],ce=r[7],N=r[11],U=r[15];return s[0]=o*H+a*y+l*I+u*X,s[4]=o*V+a*A+l*ie+u*ce,s[8]=o*le+a*Me+l*x+u*N,s[12]=o*Te+a*ue+l*j+u*U,s[1]=c*H+h*y+f*I+p*X,s[5]=c*V+h*A+f*ie+p*ce,s[9]=c*le+h*Me+f*x+p*N,s[13]=c*Te+h*ue+f*j+p*U,s[2]=v*H+M*y+m*I+g*X,s[6]=v*V+M*A+m*ie+g*ce,s[10]=v*le+M*Me+m*x+g*N,s[14]=v*Te+M*ue+m*j+g*U,s[3]=P*H+L*y+F*I+Q*X,s[7]=P*V+L*A+F*ie+Q*ce,s[11]=P*le+L*Me+F*x+Q*N,s[15]=P*Te+L*ue+F*j+Q*U,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],l=e[9],u=e[13],c=e[2],h=e[6],f=e[10],p=e[14],v=e[3],M=e[7],m=e[11],g=e[15];return v*(+s*l*h-r*u*h-s*a*f+i*u*f+r*a*p-i*l*p)+M*(+t*l*p-t*u*f+s*o*f-r*o*p+r*u*c-s*l*c)+m*(+t*u*h-t*a*p-s*o*h+i*o*p+s*a*c-i*u*c)+g*(-r*a*c-t*l*h+t*a*f+r*o*h-i*o*f+i*l*c)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){const r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],u=e[7],c=e[8],h=e[9],f=e[10],p=e[11],v=e[12],M=e[13],m=e[14],g=e[15],P=h*m*u-M*f*u+M*l*p-a*m*p-h*l*g+a*f*g,L=v*f*u-c*m*u-v*l*p+o*m*p+c*l*g-o*f*g,F=c*M*u-v*h*u+v*a*p-o*M*p-c*a*g+o*h*g,Q=v*h*l-c*M*l-v*a*f+o*M*f+c*a*m-o*h*m,H=t*P+i*L+r*F+s*Q;if(H===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const V=1/H;return e[0]=P*V,e[1]=(M*f*s-h*m*s-M*r*p+i*m*p+h*r*g-i*f*g)*V,e[2]=(a*m*s-M*l*s+M*r*u-i*m*u-a*r*g+i*l*g)*V,e[3]=(h*l*s-a*f*s-h*r*u+i*f*u+a*r*p-i*l*p)*V,e[4]=L*V,e[5]=(c*m*s-v*f*s+v*r*p-t*m*p-c*r*g+t*f*g)*V,e[6]=(v*l*s-o*m*s-v*r*u+t*m*u+o*r*g-t*l*g)*V,e[7]=(o*f*s-c*l*s+c*r*u-t*f*u-o*r*p+t*l*p)*V,e[8]=F*V,e[9]=(v*h*s-c*M*s-v*i*p+t*M*p+c*i*g-t*h*g)*V,e[10]=(o*M*s-v*a*s+v*i*u-t*M*u-o*i*g+t*a*g)*V,e[11]=(c*a*s-o*h*s-c*i*u+t*h*u+o*i*p-t*a*p)*V,e[12]=Q*V,e[13]=(c*M*r-v*h*r+v*i*f-t*M*f-c*i*m+t*h*m)*V,e[14]=(v*a*r-o*M*r-v*i*l+t*M*l+o*i*m-t*a*m)*V,e[15]=(o*h*r-c*a*r+c*i*l-t*h*l-o*i*f+t*a*f)*V,this}scale(e){const t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const i=Math.cos(t),r=Math.sin(t),s=1-i,o=e.x,a=e.y,l=e.z,u=s*o,c=s*a;return this.set(u*o+i,u*a-r*l,u*l+r*a,0,u*a+r*l,c*a+i,c*l-r*o,0,u*l-r*a,c*l+r*o,s*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,s,o){return this.set(1,i,s,0,e,1,o,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){const r=this.elements,s=t._x,o=t._y,a=t._z,l=t._w,u=s+s,c=o+o,h=a+a,f=s*u,p=s*c,v=s*h,M=o*c,m=o*h,g=a*h,P=l*u,L=l*c,F=l*h,Q=i.x,H=i.y,V=i.z;return r[0]=(1-(M+g))*Q,r[1]=(p+F)*Q,r[2]=(v-L)*Q,r[3]=0,r[4]=(p-F)*H,r[5]=(1-(f+g))*H,r[6]=(m+P)*H,r[7]=0,r[8]=(v+L)*V,r[9]=(m-P)*V,r[10]=(1-(f+M))*V,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){const r=this.elements;let s=mi.set(r[0],r[1],r[2]).length();const o=mi.set(r[4],r[5],r[6]).length(),a=mi.set(r[8],r[9],r[10]).length();this.determinant()<0&&(s=-s),e.x=r[12],e.y=r[13],e.z=r[14],nn.copy(this);const u=1/s,c=1/o,h=1/a;return nn.elements[0]*=u,nn.elements[1]*=u,nn.elements[2]*=u,nn.elements[4]*=c,nn.elements[5]*=c,nn.elements[6]*=c,nn.elements[8]*=h,nn.elements[9]*=h,nn.elements[10]*=h,t.setFromRotationMatrix(nn),i.x=s,i.y=o,i.z=a,this}makePerspective(e,t,i,r,s,o,a=wn){const l=this.elements,u=2*s/(t-e),c=2*s/(i-r),h=(t+e)/(t-e),f=(i+r)/(i-r);let p,v;if(a===wn)p=-(o+s)/(o-s),v=-2*o*s/(o-s);else if(a===Vr)p=-o/(o-s),v=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return l[0]=u,l[4]=0,l[8]=h,l[12]=0,l[1]=0,l[5]=c,l[9]=f,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=v,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,i,r,s,o,a=wn){const l=this.elements,u=1/(t-e),c=1/(i-r),h=1/(o-s),f=(t+e)*u,p=(i+r)*c;let v,M;if(a===wn)v=(o+s)*h,M=-2*h;else if(a===Vr)v=s*h,M=-1*h;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return l[0]=2*u,l[4]=0,l[8]=0,l[12]=-f,l[1]=0,l[5]=2*c,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=M,l[14]=-v,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){const t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}};const mi=new ae,nn=new dt,Nu=new ae(0,0,0),Fu=new ae(1,1,1),In=new ae,lr=new ae,$t=new ae,ea=new dt,ta=new Gt;class cn{constructor(e=0,t=0,i=0,r=cn.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){const r=e.elements,s=r[0],o=r[4],a=r[8],l=r[1],u=r[5],c=r[9],h=r[2],f=r[6],p=r[10];switch(t){case"XYZ":this._y=Math.asin(Ft(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-c,p),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(f,u),this._z=0);break;case"YXZ":this._x=Math.asin(-Ft(c,-1,1)),Math.abs(c)<.9999999?(this._y=Math.atan2(a,p),this._z=Math.atan2(l,u)):(this._y=Math.atan2(-h,s),this._z=0);break;case"ZXY":this._x=Math.asin(Ft(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-h,p),this._z=Math.atan2(-o,u)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-Ft(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(f,p),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,u));break;case"YZX":this._z=Math.asin(Ft(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-c,u),this._y=Math.atan2(-h,s)):(this._x=0,this._y=Math.atan2(a,p));break;case"XZY":this._z=Math.asin(-Ft(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(f,u),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-c,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return ea.makeRotationFromQuaternion(e),this.setFromRotationMatrix(ea,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return ta.setFromEuler(this),this.setFromQuaternion(ta,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}cn.DEFAULT_ORDER="XYZ";class zl{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Ou=0;const na=new ae,gi=new Gt,vn=new dt,cr=new ae,Gi=new ae,zu=new ae,Bu=new Gt,ia=new ae(1,0,0),ra=new ae(0,1,0),sa=new ae(0,0,1),oa={type:"added"},ku={type:"removed"},_i={type:"childadded",child:null},as={type:"childremoved",child:null};class Lt extends Oi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ou++}),this.uuid=li(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Lt.DEFAULT_UP.clone();const e=new ae,t=new cn,i=new Gt,r=new ae(1,1,1);function s(){i.setFromEuler(t,!1)}function o(){t.setFromQuaternion(i,void 0,!1)}t._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new dt},normalMatrix:{value:new ht}}),this.matrix=new dt,this.matrixWorld=new dt,this.matrixAutoUpdate=Lt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Lt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new zl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return gi.setFromAxisAngle(e,t),this.quaternion.multiply(gi),this}rotateOnWorldAxis(e,t){return gi.setFromAxisAngle(e,t),this.quaternion.premultiply(gi),this}rotateX(e){return this.rotateOnAxis(ia,e)}rotateY(e){return this.rotateOnAxis(ra,e)}rotateZ(e){return this.rotateOnAxis(sa,e)}translateOnAxis(e,t){return na.copy(e).applyQuaternion(this.quaternion),this.position.add(na.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(ia,e)}translateY(e){return this.translateOnAxis(ra,e)}translateZ(e){return this.translateOnAxis(sa,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(vn.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?cr.copy(e):cr.set(e,t,i);const r=this.parent;this.updateWorldMatrix(!0,!1),Gi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?vn.lookAt(Gi,cr,this.up):vn.lookAt(cr,Gi,this.up),this.quaternion.setFromRotationMatrix(vn),r&&(vn.extractRotation(r.matrixWorld),gi.setFromRotationMatrix(vn),this.quaternion.premultiply(gi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(oa),_i.child=e,this.dispatchEvent(_i),_i.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(ku),as.child=e,this.dispatchEvent(as),as.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),vn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),vn.multiply(e.parent.matrixWorld)),e.applyMatrix4(vn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(oa),_i.child=e,this.dispatchEvent(_i),_i.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){const o=this.children[i].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);const r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Gi,e,zu),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Gi,Bu,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t){const i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.visibility=this._visibility,r.active=this._active,r.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.geometryCount=this._geometryCount,r.matricesTexture=this._matricesTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere={center:r.boundingSphere.center.toArray(),radius:r.boundingSphere.radius}),this.boundingBox!==null&&(r.boundingBox={min:r.boundingBox.min.toArray(),max:r.boundingBox.max.toArray()}));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const l=a.shapes;if(Array.isArray(l))for(let u=0,c=l.length;u<c;u++){const h=l[u];s(e.shapes,h)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let l=0,u=this.material.length;l<u;l++)a.push(s(e.materials,this.material[l]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){const l=this.animations[a];r.animations.push(s(e.animations,l))}}if(t){const a=o(e.geometries),l=o(e.materials),u=o(e.textures),c=o(e.images),h=o(e.shapes),f=o(e.skeletons),p=o(e.animations),v=o(e.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),u.length>0&&(i.textures=u),c.length>0&&(i.images=c),h.length>0&&(i.shapes=h),f.length>0&&(i.skeletons=f),p.length>0&&(i.animations=p),v.length>0&&(i.nodes=v)}return i.object=r,i;function o(a){const l=[];for(const u in a){const c=a[u];delete c.metadata,l.push(c)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){const r=e.children[i];this.add(r.clone())}return this}}Lt.DEFAULT_UP=new ae(0,1,0);Lt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Lt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const rn=new ae,Mn=new ae,ls=new ae,yn=new ae,xi=new ae,vi=new ae,aa=new ae,cs=new ae,us=new ae,hs=new ae,fs=new Et,ds=new Et,ps=new Et;class an{constructor(e=new ae,t=new ae,i=new ae){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),rn.subVectors(e,t),r.cross(rn);const s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){rn.subVectors(r,t),Mn.subVectors(i,t),ls.subVectors(e,t);const o=rn.dot(rn),a=rn.dot(Mn),l=rn.dot(ls),u=Mn.dot(Mn),c=Mn.dot(ls),h=o*u-a*a;if(h===0)return s.set(0,0,0),null;const f=1/h,p=(u*l-a*c)*f,v=(o*c-a*l)*f;return s.set(1-p-v,v,p)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,yn)===null?!1:yn.x>=0&&yn.y>=0&&yn.x+yn.y<=1}static getInterpolation(e,t,i,r,s,o,a,l){return this.getBarycoord(e,t,i,r,yn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,yn.x),l.addScaledVector(o,yn.y),l.addScaledVector(a,yn.z),l)}static getInterpolatedAttribute(e,t,i,r,s,o){return fs.setScalar(0),ds.setScalar(0),ps.setScalar(0),fs.fromBufferAttribute(e,t),ds.fromBufferAttribute(e,i),ps.fromBufferAttribute(e,r),o.setScalar(0),o.addScaledVector(fs,s.x),o.addScaledVector(ds,s.y),o.addScaledVector(ps,s.z),o}static isFrontFacing(e,t,i,r){return rn.subVectors(i,t),Mn.subVectors(e,t),rn.cross(Mn).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return rn.subVectors(this.c,this.b),Mn.subVectors(this.a,this.b),rn.cross(Mn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return an.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return an.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,s){return an.getInterpolation(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return an.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return an.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const i=this.a,r=this.b,s=this.c;let o,a;xi.subVectors(r,i),vi.subVectors(s,i),cs.subVectors(e,i);const l=xi.dot(cs),u=vi.dot(cs);if(l<=0&&u<=0)return t.copy(i);us.subVectors(e,r);const c=xi.dot(us),h=vi.dot(us);if(c>=0&&h<=c)return t.copy(r);const f=l*h-c*u;if(f<=0&&l>=0&&c<=0)return o=l/(l-c),t.copy(i).addScaledVector(xi,o);hs.subVectors(e,s);const p=xi.dot(hs),v=vi.dot(hs);if(v>=0&&p<=v)return t.copy(s);const M=p*u-l*v;if(M<=0&&u>=0&&v<=0)return a=u/(u-v),t.copy(i).addScaledVector(vi,a);const m=c*v-p*h;if(m<=0&&h-c>=0&&p-v>=0)return aa.subVectors(s,r),a=(h-c)/(h-c+(p-v)),t.copy(r).addScaledVector(aa,a);const g=1/(m+M+f);return o=M*g,a=f*g,t.copy(i).addScaledVector(xi,o).addScaledVector(vi,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const Bl={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Dn={h:0,s:0,l:0},ur={h:0,s:0,l:0};function ms(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}class ot{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){const r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=sn){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,xt.toWorkingColorSpace(this,t),this}setRGB(e,t,i,r=xt.workingColorSpace){return this.r=e,this.g=t,this.b=i,xt.toWorkingColorSpace(this,r),this}setHSL(e,t,i,r=xt.workingColorSpace){if(e=Uo(e,1),t=Ft(t,0,1),i=Ft(i,0,1),t===0)this.r=this.g=this.b=i;else{const s=i<=.5?i*(1+t):i+t-i*t,o=2*i-s;this.r=ms(o,s,e+1/3),this.g=ms(o,s,e),this.b=ms(o,s,e-1/3)}return xt.toWorkingColorSpace(this,r),this}setStyle(e,t=sn){function i(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s;const o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){const s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(s,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=sn){const i=Bl[e.toLowerCase()];return i!==void 0?this.setHex(i,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Pi(e.r),this.g=Pi(e.g),this.b=Pi(e.b),this}copyLinearToSRGB(e){return this.r=Qr(e.r),this.g=Qr(e.g),this.b=Qr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=sn){return xt.fromWorkingColorSpace(Nt.copy(this),e),Math.round(Ft(Nt.r*255,0,255))*65536+Math.round(Ft(Nt.g*255,0,255))*256+Math.round(Ft(Nt.b*255,0,255))}getHexString(e=sn){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=xt.workingColorSpace){xt.fromWorkingColorSpace(Nt.copy(this),t);const i=Nt.r,r=Nt.g,s=Nt.b,o=Math.max(i,r,s),a=Math.min(i,r,s);let l,u;const c=(a+o)/2;if(a===o)l=0,u=0;else{const h=o-a;switch(u=c<=.5?h/(o+a):h/(2-o-a),o){case i:l=(r-s)/h+(r<s?6:0);break;case r:l=(s-i)/h+2;break;case s:l=(i-r)/h+4;break}l/=6}return e.h=l,e.s=u,e.l=c,e}getRGB(e,t=xt.workingColorSpace){return xt.fromWorkingColorSpace(Nt.copy(this),t),e.r=Nt.r,e.g=Nt.g,e.b=Nt.b,e}getStyle(e=sn){xt.fromWorkingColorSpace(Nt.copy(this),e);const t=Nt.r,i=Nt.g,r=Nt.b;return e!==sn?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(Dn),this.setHSL(Dn.h+e,Dn.s+t,Dn.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(Dn),e.getHSL(ur);const i=Ki(Dn.h,ur.h,t),r=Ki(Dn.s,ur.s,t),s=Ki(Dn.l,ur.l,t);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*i+s[6]*r,this.g=s[1]*t+s[4]*i+s[7]*r,this.b=s[2]*t+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Nt=new ot;ot.NAMES=Bl;let Hu=0;class tr extends Oi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Hu++}),this.uuid=li(),this.name="",this.type="Material",this.blending=Ri,this.side=An,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Ns,this.blendDst=Fs,this.blendEquation=ni,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ot(0,0,0),this.blendAlpha=0,this.depthFunc=Li,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=qo,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ui,this.stencilZFail=ui,this.stencilZPass=ui,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const i=e[t];if(i===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const r=this[t];if(r===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const i={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Ri&&(i.blending=this.blending),this.side!==An&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Ns&&(i.blendSrc=this.blendSrc),this.blendDst!==Fs&&(i.blendDst=this.blendDst),this.blendEquation!==ni&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Li&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==qo&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ui&&(i.stencilFail=this.stencilFail),this.stencilZFail!==ui&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==ui&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){const o=[];for(const a in s){const l=s[a];delete l.metadata,o.push(l)}return o}if(t){const s=r(e.textures),o=r(e.images);s.length>0&&(i.textures=s),o.length>0&&(i.images=o)}return i}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let i=null;if(t!==null){const r=t.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=t[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class kl extends tr{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ot(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new cn,this.combine=vl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const At=new ae,hr=new _t;class Yt{constructor(e,t,i=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Yo,this.updateRanges=[],this.gpuType=ln,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)hr.fromBufferAttribute(this,t),hr.applyMatrix3(e),this.setXY(t,hr.x,hr.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)At.fromBufferAttribute(this,t),At.applyMatrix3(e),this.setXYZ(t,At.x,At.y,At.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)At.fromBufferAttribute(this,t),At.applyMatrix4(e),this.setXYZ(t,At.x,At.y,At.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)At.fromBufferAttribute(this,t),At.applyNormalMatrix(e),this.setXYZ(t,At.x,At.y,At.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)At.fromBufferAttribute(this,t),At.transformDirection(e),this.setXYZ(t,At.x,At.y,At.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=wi(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=kt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=wi(t,this.array)),t}setX(e,t){return this.normalized&&(t=kt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=wi(t,this.array)),t}setY(e,t){return this.normalized&&(t=kt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=wi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=kt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=wi(t,this.array)),t}setW(e,t){return this.normalized&&(t=kt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=kt(t,this.array),i=kt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=kt(t,this.array),i=kt(i,this.array),r=kt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e*=this.itemSize,this.normalized&&(t=kt(t,this.array),i=kt(i,this.array),r=kt(r,this.array),s=kt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Yo&&(e.usage=this.usage),e}}class No extends Yt{constructor(e,t,i){super(new Uint16Array(e),t,i)}}class Hl extends Yt{constructor(e,t,i){super(new Uint32Array(e),t,i)}}class Wt extends Yt{constructor(e,t,i){super(new Float32Array(e),t,i)}}let Gu=0;const Jt=new dt,gs=new Lt,Mi=new ae,jt=new pn,Vi=new pn,Pt=new ae;class gn extends Oi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Gu++}),this.uuid=li(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Dl(e)?Hl:No)(e,1):this.index=e,this}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const s=new ht().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}const r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Jt.makeRotationFromQuaternion(e),this.applyMatrix4(Jt),this}rotateX(e){return Jt.makeRotationX(e),this.applyMatrix4(Jt),this}rotateY(e){return Jt.makeRotationY(e),this.applyMatrix4(Jt),this}rotateZ(e){return Jt.makeRotationZ(e),this.applyMatrix4(Jt),this}translate(e,t,i){return Jt.makeTranslation(e,t,i),this.applyMatrix4(Jt),this}scale(e,t,i){return Jt.makeScale(e,t,i),this.applyMatrix4(Jt),this}lookAt(e){return gs.lookAt(e),gs.updateMatrix(),this.applyMatrix4(gs.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Mi).negate(),this.translate(Mi.x,Mi.y,Mi.z),this}setFromPoints(e){const t=[];for(let i=0,r=e.length;i<r;i++){const s=e[i];t.push(s.x,s.y,s.z||0)}return this.setAttribute("position",new Wt(t,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new pn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new ae(-1/0,-1/0,-1/0),new ae(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){const s=t[i];jt.setFromBufferAttribute(s),this.morphTargetsRelative?(Pt.addVectors(this.boundingBox.min,jt.min),this.boundingBox.expandByPoint(Pt),Pt.addVectors(this.boundingBox.max,jt.max),this.boundingBox.expandByPoint(Pt)):(this.boundingBox.expandByPoint(jt.min),this.boundingBox.expandByPoint(jt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Vn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new ae,1/0);return}if(e){const i=this.boundingSphere.center;if(jt.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){const a=t[s];Vi.setFromBufferAttribute(a),this.morphTargetsRelative?(Pt.addVectors(jt.min,Vi.min),jt.expandByPoint(Pt),Pt.addVectors(jt.max,Vi.max),jt.expandByPoint(Pt)):(jt.expandByPoint(Vi.min),jt.expandByPoint(Vi.max))}jt.getCenter(i);let r=0;for(let s=0,o=e.count;s<o;s++)Pt.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(Pt));if(t)for(let s=0,o=t.length;s<o;s++){const a=t[s],l=this.morphTargetsRelative;for(let u=0,c=a.count;u<c;u++)Pt.fromBufferAttribute(a,u),l&&(Mi.fromBufferAttribute(e,u),Pt.add(Mi)),r=Math.max(r,i.distanceToSquared(Pt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=t.position,r=t.normal,s=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Yt(new Float32Array(4*i.count),4));const o=this.getAttribute("tangent"),a=[],l=[];for(let le=0;le<i.count;le++)a[le]=new ae,l[le]=new ae;const u=new ae,c=new ae,h=new ae,f=new _t,p=new _t,v=new _t,M=new ae,m=new ae;function g(le,Te,y){u.fromBufferAttribute(i,le),c.fromBufferAttribute(i,Te),h.fromBufferAttribute(i,y),f.fromBufferAttribute(s,le),p.fromBufferAttribute(s,Te),v.fromBufferAttribute(s,y),c.sub(u),h.sub(u),p.sub(f),v.sub(f);const A=1/(p.x*v.y-v.x*p.y);isFinite(A)&&(M.copy(c).multiplyScalar(v.y).addScaledVector(h,-p.y).multiplyScalar(A),m.copy(h).multiplyScalar(p.x).addScaledVector(c,-v.x).multiplyScalar(A),a[le].add(M),a[Te].add(M),a[y].add(M),l[le].add(m),l[Te].add(m),l[y].add(m))}let P=this.groups;P.length===0&&(P=[{start:0,count:e.count}]);for(let le=0,Te=P.length;le<Te;++le){const y=P[le],A=y.start,Me=y.count;for(let ue=A,I=A+Me;ue<I;ue+=3)g(e.getX(ue+0),e.getX(ue+1),e.getX(ue+2))}const L=new ae,F=new ae,Q=new ae,H=new ae;function V(le){Q.fromBufferAttribute(r,le),H.copy(Q);const Te=a[le];L.copy(Te),L.sub(Q.multiplyScalar(Q.dot(Te))).normalize(),F.crossVectors(H,Te);const A=F.dot(l[le])<0?-1:1;o.setXYZW(le,L.x,L.y,L.z,A)}for(let le=0,Te=P.length;le<Te;++le){const y=P[le],A=y.start,Me=y.count;for(let ue=A,I=A+Me;ue<I;ue+=3)V(e.getX(ue+0)),V(e.getX(ue+1)),V(e.getX(ue+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new Yt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let f=0,p=i.count;f<p;f++)i.setXYZ(f,0,0,0);const r=new ae,s=new ae,o=new ae,a=new ae,l=new ae,u=new ae,c=new ae,h=new ae;if(e)for(let f=0,p=e.count;f<p;f+=3){const v=e.getX(f+0),M=e.getX(f+1),m=e.getX(f+2);r.fromBufferAttribute(t,v),s.fromBufferAttribute(t,M),o.fromBufferAttribute(t,m),c.subVectors(o,s),h.subVectors(r,s),c.cross(h),a.fromBufferAttribute(i,v),l.fromBufferAttribute(i,M),u.fromBufferAttribute(i,m),a.add(c),l.add(c),u.add(c),i.setXYZ(v,a.x,a.y,a.z),i.setXYZ(M,l.x,l.y,l.z),i.setXYZ(m,u.x,u.y,u.z)}else for(let f=0,p=t.count;f<p;f+=3)r.fromBufferAttribute(t,f+0),s.fromBufferAttribute(t,f+1),o.fromBufferAttribute(t,f+2),c.subVectors(o,s),h.subVectors(r,s),c.cross(h),i.setXYZ(f+0,c.x,c.y,c.z),i.setXYZ(f+1,c.x,c.y,c.z),i.setXYZ(f+2,c.x,c.y,c.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Pt.fromBufferAttribute(e,t),Pt.normalize(),e.setXYZ(t,Pt.x,Pt.y,Pt.z)}toNonIndexed(){function e(a,l){const u=a.array,c=a.itemSize,h=a.normalized,f=new u.constructor(l.length*c);let p=0,v=0;for(let M=0,m=l.length;M<m;M++){a.isInterleavedBufferAttribute?p=l[M]*a.data.stride+a.offset:p=l[M]*c;for(let g=0;g<c;g++)f[v++]=u[p++]}return new Yt(f,c,h)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new gn,i=this.index.array,r=this.attributes;for(const a in r){const l=r[a],u=e(l,i);t.setAttribute(a,u)}const s=this.morphAttributes;for(const a in s){const l=[],u=s[a];for(let c=0,h=u.length;c<h;c++){const f=u[c],p=e(f,i);l.push(p)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,l=o.length;a<l;a++){const u=o[a];t.addGroup(u.start,u.count,u.materialIndex)}return t}toJSON(){const e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const u in l)l[u]!==void 0&&(e[u]=l[u]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const i=this.attributes;for(const l in i){const u=i[l];e.data.attributes[l]=u.toJSON(e.data)}const r={};let s=!1;for(const l in this.morphAttributes){const u=this.morphAttributes[l],c=[];for(let h=0,f=u.length;h<f;h++){const p=u[h];c.push(p.toJSON(e.data))}c.length>0&&(r[l]=c,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(e.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const i=e.index;i!==null&&this.setIndex(i.clone(t));const r=e.attributes;for(const u in r){const c=r[u];this.setAttribute(u,c.clone(t))}const s=e.morphAttributes;for(const u in s){const c=[],h=s[u];for(let f=0,p=h.length;f<p;f++)c.push(h[f].clone(t));this.morphAttributes[u]=c}this.morphTargetsRelative=e.morphTargetsRelative;const o=e.groups;for(let u=0,c=o.length;u<c;u++){const h=o[u];this.addGroup(h.start,h.count,h.materialIndex)}const a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const la=new dt,Yn=new Ol,fr=new Vn,ca=new ae,dr=new ae,pr=new ae,mr=new ae,_s=new ae,gr=new ae,ua=new ae,_r=new ae;class Xt extends Lt{constructor(e=new gn,t=new kl){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){const a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(e,t){const i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,o=i.morphTargetsRelative;t.fromBufferAttribute(r,e);const a=this.morphTargetInfluences;if(s&&a){gr.set(0,0,0);for(let l=0,u=s.length;l<u;l++){const c=a[l],h=s[l];c!==0&&(_s.fromBufferAttribute(h,e),o?gr.addScaledVector(_s,c):gr.addScaledVector(_s.sub(t),c))}t.add(gr)}return t}raycast(e,t){const i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),fr.copy(i.boundingSphere),fr.applyMatrix4(s),Yn.copy(e.ray).recast(e.near),!(fr.containsPoint(Yn.origin)===!1&&(Yn.intersectSphere(fr,ca)===null||Yn.origin.distanceToSquared(ca)>(e.far-e.near)**2))&&(la.copy(s).invert(),Yn.copy(e.ray).applyMatrix4(la),!(i.boundingBox!==null&&Yn.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,Yn)))}_computeIntersections(e,t,i){let r;const s=this.geometry,o=this.material,a=s.index,l=s.attributes.position,u=s.attributes.uv,c=s.attributes.uv1,h=s.attributes.normal,f=s.groups,p=s.drawRange;if(a!==null)if(Array.isArray(o))for(let v=0,M=f.length;v<M;v++){const m=f[v],g=o[m.materialIndex],P=Math.max(m.start,p.start),L=Math.min(a.count,Math.min(m.start+m.count,p.start+p.count));for(let F=P,Q=L;F<Q;F+=3){const H=a.getX(F),V=a.getX(F+1),le=a.getX(F+2);r=xr(this,g,e,i,u,c,h,H,V,le),r&&(r.faceIndex=Math.floor(F/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{const v=Math.max(0,p.start),M=Math.min(a.count,p.start+p.count);for(let m=v,g=M;m<g;m+=3){const P=a.getX(m),L=a.getX(m+1),F=a.getX(m+2);r=xr(this,o,e,i,u,c,h,P,L,F),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(o))for(let v=0,M=f.length;v<M;v++){const m=f[v],g=o[m.materialIndex],P=Math.max(m.start,p.start),L=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let F=P,Q=L;F<Q;F+=3){const H=F,V=F+1,le=F+2;r=xr(this,g,e,i,u,c,h,H,V,le),r&&(r.faceIndex=Math.floor(F/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{const v=Math.max(0,p.start),M=Math.min(l.count,p.start+p.count);for(let m=v,g=M;m<g;m+=3){const P=m,L=m+1,F=m+2;r=xr(this,o,e,i,u,c,h,P,L,F),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}}}function Vu(n,e,t,i,r,s,o,a){let l;if(e.side===qt?l=i.intersectTriangle(o,s,r,!0,a):l=i.intersectTriangle(r,s,o,e.side===An,a),l===null)return null;_r.copy(a),_r.applyMatrix4(n.matrixWorld);const u=t.ray.origin.distanceTo(_r);return u<t.near||u>t.far?null:{distance:u,point:_r.clone(),object:n}}function xr(n,e,t,i,r,s,o,a,l,u){n.getVertexPosition(a,dr),n.getVertexPosition(l,pr),n.getVertexPosition(u,mr);const c=Vu(n,e,t,i,dr,pr,mr,ua);if(c){const h=new ae;an.getBarycoord(ua,dr,pr,mr,h),r&&(c.uv=an.getInterpolatedAttribute(r,a,l,u,h,new _t)),s&&(c.uv1=an.getInterpolatedAttribute(s,a,l,u,h,new _t)),o&&(c.normal=an.getInterpolatedAttribute(o,a,l,u,h,new ae),c.normal.dot(i.direction)>0&&c.normal.multiplyScalar(-1));const f={a,b:l,c:u,normal:new ae,materialIndex:0};an.getNormal(dr,pr,mr,f.normal),c.face=f,c.barycoord=h}return c}class nr extends gn{constructor(e=1,t=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};const a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);const l=[],u=[],c=[],h=[];let f=0,p=0;v("z","y","x",-1,-1,i,t,e,o,s,0),v("z","y","x",1,-1,i,t,-e,o,s,1),v("x","z","y",1,1,e,i,t,r,o,2),v("x","z","y",1,-1,e,i,-t,r,o,3),v("x","y","z",1,-1,e,t,i,r,s,4),v("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new Wt(u,3)),this.setAttribute("normal",new Wt(c,3)),this.setAttribute("uv",new Wt(h,2));function v(M,m,g,P,L,F,Q,H,V,le,Te){const y=F/V,A=Q/le,Me=F/2,ue=Q/2,I=H/2,ie=V+1,x=le+1;let j=0,X=0;const ce=new ae;for(let N=0;N<x;N++){const U=N*A-ue;for(let k=0;k<ie;k++){const te=k*y-Me;ce[M]=te*P,ce[m]=U*L,ce[g]=I,u.push(ce.x,ce.y,ce.z),ce[M]=0,ce[m]=0,ce[g]=H>0?1:-1,c.push(ce.x,ce.y,ce.z),h.push(k/V),h.push(1-N/le),j+=1}}for(let N=0;N<le;N++)for(let U=0;U<V;U++){const k=f+U+ie*N,te=f+U+ie*(N+1),T=f+(U+1)+ie*(N+1),D=f+(U+1)+ie*N;l.push(k,te,D),l.push(te,T,D),X+=6}a.addGroup(p,X,Te),p+=X,f+=j}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new nr(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Fi(n){const e={};for(const t in n){e[t]={};for(const i in n[t]){const r=n[t][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone():Array.isArray(r)?e[t][i]=r.slice():e[t][i]=r}}return e}function Ht(n){const e={};for(let t=0;t<n.length;t++){const i=Fi(n[t]);for(const r in i)e[r]=i[r]}return e}function Wu(n){const e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function Gl(n){const e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:xt.workingColorSpace}const Xu={clone:Fi,merge:Ht};var qu=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Yu=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Hn extends tr{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=qu,this.fragmentShader=Yu,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Fi(e.uniforms),this.uniformsGroups=Wu(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const r in this.uniforms){const o=this.uniforms[r].value;o&&o.isTexture?t.uniforms[r]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[r]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[r]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[r]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[r]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[r]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[r]={type:"m4",value:o.toArray()}:t.uniforms[r]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const i={};for(const r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}}class Vl extends Lt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new dt,this.projectionMatrix=new dt,this.projectionMatrixInverse=new dt,this.coordinateSystem=wn}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Un=new ae,ha=new _t,fa=new _t;class Qt extends Vl{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Ji*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(ji*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ji*2*Math.atan(Math.tan(ji*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){Un.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Un.x,Un.y).multiplyScalar(-e/Un.z),Un.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Un.x,Un.y).multiplyScalar(-e/Un.z)}getViewSize(e,t){return this.getViewBounds(e,ha,fa),t.subVectors(fa,ha)}setViewOffset(e,t,i,r,s,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(ji*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,s=-.5*r;const o=this.view;if(this.view!==null&&this.view.enabled){const l=o.fullWidth,u=o.fullHeight;s+=o.offsetX*r/l,t-=o.offsetY*i/u,r*=o.width/l,i*=o.height/u}const a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-i,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const yi=-90,Si=1;class $u extends Lt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;const r=new Qt(yi,Si,e,t);r.layers=this.layers,this.add(r);const s=new Qt(yi,Si,e,t);s.layers=this.layers,this.add(s);const o=new Qt(yi,Si,e,t);o.layers=this.layers,this.add(o);const a=new Qt(yi,Si,e,t);a.layers=this.layers,this.add(a);const l=new Qt(yi,Si,e,t);l.layers=this.layers,this.add(l);const u=new Qt(yi,Si,e,t);u.layers=this.layers,this.add(u)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[i,r,s,o,a,l]=t;for(const u of t)this.remove(u);if(e===wn)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Vr)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const u of t)this.add(u),u.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[s,o,a,l,u,c]=this.children,h=e.getRenderTarget(),f=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),v=e.xr.enabled;e.xr.enabled=!1;const M=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,e.setRenderTarget(i,0,r),e.render(t,s),e.setRenderTarget(i,1,r),e.render(t,o),e.setRenderTarget(i,2,r),e.render(t,a),e.setRenderTarget(i,3,r),e.render(t,l),e.setRenderTarget(i,4,r),e.render(t,u),i.texture.generateMipmaps=M,e.setRenderTarget(i,5,r),e.render(t,c),e.setRenderTarget(h,f,p),e.xr.enabled=v,i.texture.needsPMREMUpdate=!0}}class Wl extends zt{constructor(e,t,i,r,s,o,a,l,u,c){e=e!==void 0?e:[],t=t!==void 0?t:Ii,super(e,t,i,r,s,o,a,l,u,c),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class ju extends ai{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new Wl(r,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:Kt}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new nr(5,5,5),s=new Hn({name:"CubemapFromEquirect",uniforms:Fi(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:qt,blending:zn});s.uniforms.tEquirect.value=t;const o=new Xt(r,s),a=t.minFilter;return t.minFilter===On&&(t.minFilter=Kt),new $u(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t,i,r){const s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,i,r);e.setRenderTarget(s)}}const xs=new ae,Ku=new ae,Zu=new ht;class on{constructor(e=new ae(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){const r=xs.subVectors(i,t).cross(Ku.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const i=e.delta(xs),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const s=-(e.start.dot(this.normal)+this.constant)/r;return s<0||s>1?null:t.copy(e.start).addScaledVector(i,s)}intersectsLine(e){const t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const i=t||Zu.getNormalMatrix(e),r=this.coplanarPoint(xs).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const $n=new Vn,vr=new ae;class Yr{constructor(e=new on,t=new on,i=new on,r=new on,s=new on,o=new on){this.planes=[e,t,i,r,s,o]}set(e,t,i,r,s,o){const a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(e){const t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=wn){const i=this.planes,r=e.elements,s=r[0],o=r[1],a=r[2],l=r[3],u=r[4],c=r[5],h=r[6],f=r[7],p=r[8],v=r[9],M=r[10],m=r[11],g=r[12],P=r[13],L=r[14],F=r[15];if(i[0].setComponents(l-s,f-u,m-p,F-g).normalize(),i[1].setComponents(l+s,f+u,m+p,F+g).normalize(),i[2].setComponents(l+o,f+c,m+v,F+P).normalize(),i[3].setComponents(l-o,f-c,m-v,F-P).normalize(),i[4].setComponents(l-a,f-h,m-M,F-L).normalize(),t===wn)i[5].setComponents(l+a,f+h,m+M,F+L).normalize();else if(t===Vr)i[5].setComponents(a,h,M,L).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),$n.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),$n.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere($n)}intersectsSprite(e){return $n.center.set(0,0,0),$n.radius=.7071067811865476,$n.applyMatrix4(e.matrixWorld),this.intersectsSphere($n)}intersectsSphere(e){const t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){const t=this.planes;for(let i=0;i<6;i++){const r=t[i];if(vr.x=r.normal.x>0?e.max.x:e.min.x,vr.y=r.normal.y>0?e.max.y:e.min.y,vr.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(vr)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Xl(){let n=null,e=!1,t=null,i=null;function r(s,o){t(s,o),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function Ju(n){const e=new WeakMap;function t(a,l){const u=a.array,c=a.usage,h=u.byteLength,f=n.createBuffer();n.bindBuffer(l,f),n.bufferData(l,u,c),a.onUploadCallback();let p;if(u instanceof Float32Array)p=n.FLOAT;else if(u instanceof Uint16Array)a.isFloat16BufferAttribute?p=n.HALF_FLOAT:p=n.UNSIGNED_SHORT;else if(u instanceof Int16Array)p=n.SHORT;else if(u instanceof Uint32Array)p=n.UNSIGNED_INT;else if(u instanceof Int32Array)p=n.INT;else if(u instanceof Int8Array)p=n.BYTE;else if(u instanceof Uint8Array)p=n.UNSIGNED_BYTE;else if(u instanceof Uint8ClampedArray)p=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+u);return{buffer:f,type:p,bytesPerElement:u.BYTES_PER_ELEMENT,version:a.version,size:h}}function i(a,l,u){const c=l.array,h=l.updateRanges;if(n.bindBuffer(u,a),h.length===0)n.bufferSubData(u,0,c);else{h.sort((p,v)=>p.start-v.start);let f=0;for(let p=1;p<h.length;p++){const v=h[f],M=h[p];M.start<=v.start+v.count+1?v.count=Math.max(v.count,M.start+M.count-v.start):(++f,h[f]=M)}h.length=f+1;for(let p=0,v=h.length;p<v;p++){const M=h[p];n.bufferSubData(u,M.start*c.BYTES_PER_ELEMENT,c,M.start,M.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);const l=e.get(a);l&&(n.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const c=e.get(a);(!c||c.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const u=e.get(a);if(u===void 0)e.set(a,t(a,l));else if(u.version<a.version){if(u.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(u.buffer,a,l),u.version=a.version}}return{get:r,remove:s,update:o}}class $r extends gn{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};const s=e/2,o=t/2,a=Math.floor(i),l=Math.floor(r),u=a+1,c=l+1,h=e/a,f=t/l,p=[],v=[],M=[],m=[];for(let g=0;g<c;g++){const P=g*f-o;for(let L=0;L<u;L++){const F=L*h-s;v.push(F,-P,0),M.push(0,0,1),m.push(L/a),m.push(1-g/l)}}for(let g=0;g<l;g++)for(let P=0;P<a;P++){const L=P+u*g,F=P+u*(g+1),Q=P+1+u*(g+1),H=P+1+u*g;p.push(L,F,H),p.push(F,Q,H)}this.setIndex(p),this.setAttribute("position",new Wt(v,3)),this.setAttribute("normal",new Wt(M,3)),this.setAttribute("uv",new Wt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new $r(e.width,e.height,e.widthSegments,e.heightSegments)}}var Qu=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,eh=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,th=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,nh=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ih=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,rh=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,sh=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,oh=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,ah=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,lh=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,ch=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,uh=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,hh=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,fh=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,dh=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,ph=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,mh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,gh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,_h=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,xh=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,vh=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Mh=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,yh=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Sh=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,bh=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Eh=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,wh=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Th=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Ah=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Rh=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Ch="gl_FragColor = linearToOutputTexel( gl_FragColor );",Ph=`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Lh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,Ih=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Dh=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Uh=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Nh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Fh=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Oh=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,zh=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Bh=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,kh=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Hh=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Gh=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Vh=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Wh=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Xh=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,qh=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Yh=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,$h=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,jh=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Kh=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Zh=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Jh=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Qh=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,ef=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,tf=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,nf=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,rf=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,sf=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,of=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,af=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,lf=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,cf=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,uf=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,hf=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,ff=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,df=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,pf=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,mf=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,gf=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,_f=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,xf=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,vf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Mf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,yf=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Sf=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,bf=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Ef=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,wf=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Tf=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Af=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Rf=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Cf=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Pf=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Lf=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,If=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Df=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Uf=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Nf=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,Ff=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Of=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,zf=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Bf=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,kf=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Hf=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Gf=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Vf=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Wf=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Xf=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,qf=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Yf=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,$f=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,jf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Kf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Zf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Jf=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Qf=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,ed=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,td=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,nd=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,id=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,rd=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,sd=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,od=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,ad=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,ld=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,cd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,ud=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,hd=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,fd=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,dd=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,pd=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,md=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,gd=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,_d=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,xd=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,vd=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Md=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,yd=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Sd=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,bd=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Ed=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,wd=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Td=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ad=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Rd=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Cd=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Pd=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ld=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Id=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,ut={alphahash_fragment:Qu,alphahash_pars_fragment:eh,alphamap_fragment:th,alphamap_pars_fragment:nh,alphatest_fragment:ih,alphatest_pars_fragment:rh,aomap_fragment:sh,aomap_pars_fragment:oh,batching_pars_vertex:ah,batching_vertex:lh,begin_vertex:ch,beginnormal_vertex:uh,bsdfs:hh,iridescence_fragment:fh,bumpmap_pars_fragment:dh,clipping_planes_fragment:ph,clipping_planes_pars_fragment:mh,clipping_planes_pars_vertex:gh,clipping_planes_vertex:_h,color_fragment:xh,color_pars_fragment:vh,color_pars_vertex:Mh,color_vertex:yh,common:Sh,cube_uv_reflection_fragment:bh,defaultnormal_vertex:Eh,displacementmap_pars_vertex:wh,displacementmap_vertex:Th,emissivemap_fragment:Ah,emissivemap_pars_fragment:Rh,colorspace_fragment:Ch,colorspace_pars_fragment:Ph,envmap_fragment:Lh,envmap_common_pars_fragment:Ih,envmap_pars_fragment:Dh,envmap_pars_vertex:Uh,envmap_physical_pars_fragment:Xh,envmap_vertex:Nh,fog_vertex:Fh,fog_pars_vertex:Oh,fog_fragment:zh,fog_pars_fragment:Bh,gradientmap_pars_fragment:kh,lightmap_pars_fragment:Hh,lights_lambert_fragment:Gh,lights_lambert_pars_fragment:Vh,lights_pars_begin:Wh,lights_toon_fragment:qh,lights_toon_pars_fragment:Yh,lights_phong_fragment:$h,lights_phong_pars_fragment:jh,lights_physical_fragment:Kh,lights_physical_pars_fragment:Zh,lights_fragment_begin:Jh,lights_fragment_maps:Qh,lights_fragment_end:ef,logdepthbuf_fragment:tf,logdepthbuf_pars_fragment:nf,logdepthbuf_pars_vertex:rf,logdepthbuf_vertex:sf,map_fragment:of,map_pars_fragment:af,map_particle_fragment:lf,map_particle_pars_fragment:cf,metalnessmap_fragment:uf,metalnessmap_pars_fragment:hf,morphinstance_vertex:ff,morphcolor_vertex:df,morphnormal_vertex:pf,morphtarget_pars_vertex:mf,morphtarget_vertex:gf,normal_fragment_begin:_f,normal_fragment_maps:xf,normal_pars_fragment:vf,normal_pars_vertex:Mf,normal_vertex:yf,normalmap_pars_fragment:Sf,clearcoat_normal_fragment_begin:bf,clearcoat_normal_fragment_maps:Ef,clearcoat_pars_fragment:wf,iridescence_pars_fragment:Tf,opaque_fragment:Af,packing:Rf,premultiplied_alpha_fragment:Cf,project_vertex:Pf,dithering_fragment:Lf,dithering_pars_fragment:If,roughnessmap_fragment:Df,roughnessmap_pars_fragment:Uf,shadowmap_pars_fragment:Nf,shadowmap_pars_vertex:Ff,shadowmap_vertex:Of,shadowmask_pars_fragment:zf,skinbase_vertex:Bf,skinning_pars_vertex:kf,skinning_vertex:Hf,skinnormal_vertex:Gf,specularmap_fragment:Vf,specularmap_pars_fragment:Wf,tonemapping_fragment:Xf,tonemapping_pars_fragment:qf,transmission_fragment:Yf,transmission_pars_fragment:$f,uv_pars_fragment:jf,uv_pars_vertex:Kf,uv_vertex:Zf,worldpos_vertex:Jf,background_vert:Qf,background_frag:ed,backgroundCube_vert:td,backgroundCube_frag:nd,cube_vert:id,cube_frag:rd,depth_vert:sd,depth_frag:od,distanceRGBA_vert:ad,distanceRGBA_frag:ld,equirect_vert:cd,equirect_frag:ud,linedashed_vert:hd,linedashed_frag:fd,meshbasic_vert:dd,meshbasic_frag:pd,meshlambert_vert:md,meshlambert_frag:gd,meshmatcap_vert:_d,meshmatcap_frag:xd,meshnormal_vert:vd,meshnormal_frag:Md,meshphong_vert:yd,meshphong_frag:Sd,meshphysical_vert:bd,meshphysical_frag:Ed,meshtoon_vert:wd,meshtoon_frag:Td,points_vert:Ad,points_frag:Rd,shadow_vert:Cd,shadow_frag:Pd,sprite_vert:Ld,sprite_frag:Id},Ve={common:{diffuse:{value:new ot(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new ht},alphaMap:{value:null},alphaMapTransform:{value:new ht},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new ht}},envmap:{envMap:{value:null},envMapRotation:{value:new ht},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new ht}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new ht}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new ht},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new ht},normalScale:{value:new _t(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new ht},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new ht}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new ht}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new ht}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ot(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ot(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new ht},alphaTest:{value:0},uvTransform:{value:new ht}},sprite:{diffuse:{value:new ot(16777215)},opacity:{value:1},center:{value:new _t(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new ht},alphaMap:{value:null},alphaMapTransform:{value:new ht},alphaTest:{value:0}}},fn={basic:{uniforms:Ht([Ve.common,Ve.specularmap,Ve.envmap,Ve.aomap,Ve.lightmap,Ve.fog]),vertexShader:ut.meshbasic_vert,fragmentShader:ut.meshbasic_frag},lambert:{uniforms:Ht([Ve.common,Ve.specularmap,Ve.envmap,Ve.aomap,Ve.lightmap,Ve.emissivemap,Ve.bumpmap,Ve.normalmap,Ve.displacementmap,Ve.fog,Ve.lights,{emissive:{value:new ot(0)}}]),vertexShader:ut.meshlambert_vert,fragmentShader:ut.meshlambert_frag},phong:{uniforms:Ht([Ve.common,Ve.specularmap,Ve.envmap,Ve.aomap,Ve.lightmap,Ve.emissivemap,Ve.bumpmap,Ve.normalmap,Ve.displacementmap,Ve.fog,Ve.lights,{emissive:{value:new ot(0)},specular:{value:new ot(1118481)},shininess:{value:30}}]),vertexShader:ut.meshphong_vert,fragmentShader:ut.meshphong_frag},standard:{uniforms:Ht([Ve.common,Ve.envmap,Ve.aomap,Ve.lightmap,Ve.emissivemap,Ve.bumpmap,Ve.normalmap,Ve.displacementmap,Ve.roughnessmap,Ve.metalnessmap,Ve.fog,Ve.lights,{emissive:{value:new ot(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:ut.meshphysical_vert,fragmentShader:ut.meshphysical_frag},toon:{uniforms:Ht([Ve.common,Ve.aomap,Ve.lightmap,Ve.emissivemap,Ve.bumpmap,Ve.normalmap,Ve.displacementmap,Ve.gradientmap,Ve.fog,Ve.lights,{emissive:{value:new ot(0)}}]),vertexShader:ut.meshtoon_vert,fragmentShader:ut.meshtoon_frag},matcap:{uniforms:Ht([Ve.common,Ve.bumpmap,Ve.normalmap,Ve.displacementmap,Ve.fog,{matcap:{value:null}}]),vertexShader:ut.meshmatcap_vert,fragmentShader:ut.meshmatcap_frag},points:{uniforms:Ht([Ve.points,Ve.fog]),vertexShader:ut.points_vert,fragmentShader:ut.points_frag},dashed:{uniforms:Ht([Ve.common,Ve.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:ut.linedashed_vert,fragmentShader:ut.linedashed_frag},depth:{uniforms:Ht([Ve.common,Ve.displacementmap]),vertexShader:ut.depth_vert,fragmentShader:ut.depth_frag},normal:{uniforms:Ht([Ve.common,Ve.bumpmap,Ve.normalmap,Ve.displacementmap,{opacity:{value:1}}]),vertexShader:ut.meshnormal_vert,fragmentShader:ut.meshnormal_frag},sprite:{uniforms:Ht([Ve.sprite,Ve.fog]),vertexShader:ut.sprite_vert,fragmentShader:ut.sprite_frag},background:{uniforms:{uvTransform:{value:new ht},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:ut.background_vert,fragmentShader:ut.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new ht}},vertexShader:ut.backgroundCube_vert,fragmentShader:ut.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:ut.cube_vert,fragmentShader:ut.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:ut.equirect_vert,fragmentShader:ut.equirect_frag},distanceRGBA:{uniforms:Ht([Ve.common,Ve.displacementmap,{referencePosition:{value:new ae},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:ut.distanceRGBA_vert,fragmentShader:ut.distanceRGBA_frag},shadow:{uniforms:Ht([Ve.lights,Ve.fog,{color:{value:new ot(0)},opacity:{value:1}}]),vertexShader:ut.shadow_vert,fragmentShader:ut.shadow_frag}};fn.physical={uniforms:Ht([fn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new ht},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new ht},clearcoatNormalScale:{value:new _t(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new ht},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new ht},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new ht},sheen:{value:0},sheenColor:{value:new ot(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new ht},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new ht},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new ht},transmissionSamplerSize:{value:new _t},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new ht},attenuationDistance:{value:0},attenuationColor:{value:new ot(0)},specularColor:{value:new ot(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new ht},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new ht},anisotropyVector:{value:new _t},anisotropyMap:{value:null},anisotropyMapTransform:{value:new ht}}]),vertexShader:ut.meshphysical_vert,fragmentShader:ut.meshphysical_frag};const Mr={r:0,b:0,g:0},jn=new cn,Dd=new dt;function Ud(n,e,t,i,r,s,o){const a=new ot(0);let l=s===!0?0:1,u,c,h=null,f=0,p=null;function v(P){let L=P.isScene===!0?P.background:null;return L&&L.isTexture&&(L=(P.backgroundBlurriness>0?t:e).get(L)),L}function M(P){let L=!1;const F=v(P);F===null?g(a,l):F&&F.isColor&&(g(F,1),L=!0);const Q=n.xr.getEnvironmentBlendMode();Q==="additive"?i.buffers.color.setClear(0,0,0,1,o):Q==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,o),(n.autoClear||L)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function m(P,L){const F=v(L);F&&(F.isCubeTexture||F.mapping===Xr)?(c===void 0&&(c=new Xt(new nr(1,1,1),new Hn({name:"BackgroundCubeMaterial",uniforms:Fi(fn.backgroundCube.uniforms),vertexShader:fn.backgroundCube.vertexShader,fragmentShader:fn.backgroundCube.fragmentShader,side:qt,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(Q,H,V){this.matrixWorld.copyPosition(V.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(c)),jn.copy(L.backgroundRotation),jn.x*=-1,jn.y*=-1,jn.z*=-1,F.isCubeTexture&&F.isRenderTargetTexture===!1&&(jn.y*=-1,jn.z*=-1),c.material.uniforms.envMap.value=F,c.material.uniforms.flipEnvMap.value=F.isCubeTexture&&F.isRenderTargetTexture===!1?-1:1,c.material.uniforms.backgroundBlurriness.value=L.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=L.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Dd.makeRotationFromEuler(jn)),c.material.toneMapped=xt.getTransfer(F.colorSpace)!==bt,(h!==F||f!==F.version||p!==n.toneMapping)&&(c.material.needsUpdate=!0,h=F,f=F.version,p=n.toneMapping),c.layers.enableAll(),P.unshift(c,c.geometry,c.material,0,0,null)):F&&F.isTexture&&(u===void 0&&(u=new Xt(new $r(2,2),new Hn({name:"BackgroundMaterial",uniforms:Fi(fn.background.uniforms),vertexShader:fn.background.vertexShader,fragmentShader:fn.background.fragmentShader,side:An,depthTest:!1,depthWrite:!1,fog:!1})),u.geometry.deleteAttribute("normal"),Object.defineProperty(u.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(u)),u.material.uniforms.t2D.value=F,u.material.uniforms.backgroundIntensity.value=L.backgroundIntensity,u.material.toneMapped=xt.getTransfer(F.colorSpace)!==bt,F.matrixAutoUpdate===!0&&F.updateMatrix(),u.material.uniforms.uvTransform.value.copy(F.matrix),(h!==F||f!==F.version||p!==n.toneMapping)&&(u.material.needsUpdate=!0,h=F,f=F.version,p=n.toneMapping),u.layers.enableAll(),P.unshift(u,u.geometry,u.material,0,0,null))}function g(P,L){P.getRGB(Mr,Gl(n)),i.buffers.color.setClear(Mr.r,Mr.g,Mr.b,L,o)}return{getClearColor:function(){return a},setClearColor:function(P,L=1){a.set(P),l=L,g(a,l)},getClearAlpha:function(){return l},setClearAlpha:function(P){l=P,g(a,l)},render:M,addToRenderList:m}}function Nd(n,e){const t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=f(null);let s=r,o=!1;function a(y,A,Me,ue,I){let ie=!1;const x=h(ue,Me,A);s!==x&&(s=x,u(s.object)),ie=p(y,ue,Me,I),ie&&v(y,ue,Me,I),I!==null&&e.update(I,n.ELEMENT_ARRAY_BUFFER),(ie||o)&&(o=!1,F(y,A,Me,ue),I!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(I).buffer))}function l(){return n.createVertexArray()}function u(y){return n.bindVertexArray(y)}function c(y){return n.deleteVertexArray(y)}function h(y,A,Me){const ue=Me.wireframe===!0;let I=i[y.id];I===void 0&&(I={},i[y.id]=I);let ie=I[A.id];ie===void 0&&(ie={},I[A.id]=ie);let x=ie[ue];return x===void 0&&(x=f(l()),ie[ue]=x),x}function f(y){const A=[],Me=[],ue=[];for(let I=0;I<t;I++)A[I]=0,Me[I]=0,ue[I]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:A,enabledAttributes:Me,attributeDivisors:ue,object:y,attributes:{},index:null}}function p(y,A,Me,ue){const I=s.attributes,ie=A.attributes;let x=0;const j=Me.getAttributes();for(const X in j)if(j[X].location>=0){const N=I[X];let U=ie[X];if(U===void 0&&(X==="instanceMatrix"&&y.instanceMatrix&&(U=y.instanceMatrix),X==="instanceColor"&&y.instanceColor&&(U=y.instanceColor)),N===void 0||N.attribute!==U||U&&N.data!==U.data)return!0;x++}return s.attributesNum!==x||s.index!==ue}function v(y,A,Me,ue){const I={},ie=A.attributes;let x=0;const j=Me.getAttributes();for(const X in j)if(j[X].location>=0){let N=ie[X];N===void 0&&(X==="instanceMatrix"&&y.instanceMatrix&&(N=y.instanceMatrix),X==="instanceColor"&&y.instanceColor&&(N=y.instanceColor));const U={};U.attribute=N,N&&N.data&&(U.data=N.data),I[X]=U,x++}s.attributes=I,s.attributesNum=x,s.index=ue}function M(){const y=s.newAttributes;for(let A=0,Me=y.length;A<Me;A++)y[A]=0}function m(y){g(y,0)}function g(y,A){const Me=s.newAttributes,ue=s.enabledAttributes,I=s.attributeDivisors;Me[y]=1,ue[y]===0&&(n.enableVertexAttribArray(y),ue[y]=1),I[y]!==A&&(n.vertexAttribDivisor(y,A),I[y]=A)}function P(){const y=s.newAttributes,A=s.enabledAttributes;for(let Me=0,ue=A.length;Me<ue;Me++)A[Me]!==y[Me]&&(n.disableVertexAttribArray(Me),A[Me]=0)}function L(y,A,Me,ue,I,ie,x){x===!0?n.vertexAttribIPointer(y,A,Me,I,ie):n.vertexAttribPointer(y,A,Me,ue,I,ie)}function F(y,A,Me,ue){M();const I=ue.attributes,ie=Me.getAttributes(),x=A.defaultAttributeValues;for(const j in ie){const X=ie[j];if(X.location>=0){let ce=I[j];if(ce===void 0&&(j==="instanceMatrix"&&y.instanceMatrix&&(ce=y.instanceMatrix),j==="instanceColor"&&y.instanceColor&&(ce=y.instanceColor)),ce!==void 0){const N=ce.normalized,U=ce.itemSize,k=e.get(ce);if(k===void 0)continue;const te=k.buffer,T=k.type,D=k.bytesPerElement,O=T===n.INT||T===n.UNSIGNED_INT||ce.gpuType===To;if(ce.isInterleavedBufferAttribute){const G=ce.data,ne=G.stride,Z=ce.offset;if(G.isInstancedInterleavedBuffer){for(let q=0;q<X.locationSize;q++)g(X.location+q,G.meshPerAttribute);y.isInstancedMesh!==!0&&ue._maxInstanceCount===void 0&&(ue._maxInstanceCount=G.meshPerAttribute*G.count)}else for(let q=0;q<X.locationSize;q++)m(X.location+q);n.bindBuffer(n.ARRAY_BUFFER,te);for(let q=0;q<X.locationSize;q++)L(X.location+q,U/X.locationSize,T,N,ne*D,(Z+U/X.locationSize*q)*D,O)}else{if(ce.isInstancedBufferAttribute){for(let G=0;G<X.locationSize;G++)g(X.location+G,ce.meshPerAttribute);y.isInstancedMesh!==!0&&ue._maxInstanceCount===void 0&&(ue._maxInstanceCount=ce.meshPerAttribute*ce.count)}else for(let G=0;G<X.locationSize;G++)m(X.location+G);n.bindBuffer(n.ARRAY_BUFFER,te);for(let G=0;G<X.locationSize;G++)L(X.location+G,U/X.locationSize,T,N,U*D,U/X.locationSize*G*D,O)}}else if(x!==void 0){const N=x[j];if(N!==void 0)switch(N.length){case 2:n.vertexAttrib2fv(X.location,N);break;case 3:n.vertexAttrib3fv(X.location,N);break;case 4:n.vertexAttrib4fv(X.location,N);break;default:n.vertexAttrib1fv(X.location,N)}}}}P()}function Q(){le();for(const y in i){const A=i[y];for(const Me in A){const ue=A[Me];for(const I in ue)c(ue[I].object),delete ue[I];delete A[Me]}delete i[y]}}function H(y){if(i[y.id]===void 0)return;const A=i[y.id];for(const Me in A){const ue=A[Me];for(const I in ue)c(ue[I].object),delete ue[I];delete A[Me]}delete i[y.id]}function V(y){for(const A in i){const Me=i[A];if(Me[y.id]===void 0)continue;const ue=Me[y.id];for(const I in ue)c(ue[I].object),delete ue[I];delete Me[y.id]}}function le(){Te(),o=!0,s!==r&&(s=r,u(s.object))}function Te(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:le,resetDefaultState:Te,dispose:Q,releaseStatesOfGeometry:H,releaseStatesOfProgram:V,initAttributes:M,enableAttribute:m,disableUnusedAttributes:P}}function Fd(n,e,t){let i;function r(u){i=u}function s(u,c){n.drawArrays(i,u,c),t.update(c,i,1)}function o(u,c,h){h!==0&&(n.drawArraysInstanced(i,u,c,h),t.update(c,i,h))}function a(u,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,u,0,c,0,h);let p=0;for(let v=0;v<h;v++)p+=c[v];t.update(p,i,1)}function l(u,c,h,f){if(h===0)return;const p=e.get("WEBGL_multi_draw");if(p===null)for(let v=0;v<u.length;v++)o(u[v],c[v],f[v]);else{p.multiDrawArraysInstancedWEBGL(i,u,0,c,0,f,0,h);let v=0;for(let M=0;M<h;M++)v+=c[M];for(let M=0;M<f.length;M++)t.update(v,i,f[M])}}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=l}function Od(n,e,t,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){const V=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(V.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(V){return!(V!==en&&i.convert(V)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(V){const le=V===er&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(V!==Rn&&i.convert(V)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&V!==ln&&!le)}function l(V){if(V==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";V="mediump"}return V==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let u=t.precision!==void 0?t.precision:"highp";const c=l(u);c!==u&&(console.warn("THREE.WebGLRenderer:",u,"not supported, using",c,"instead."),u=c);const h=t.logarithmicDepthBuffer===!0,f=t.reverseDepthBuffer===!0&&e.has("EXT_clip_control");if(f===!0){const V=e.get("EXT_clip_control");V.clipControlEXT(V.LOWER_LEFT_EXT,V.ZERO_TO_ONE_EXT)}const p=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),v=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),M=n.getParameter(n.MAX_TEXTURE_SIZE),m=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),g=n.getParameter(n.MAX_VERTEX_ATTRIBS),P=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),L=n.getParameter(n.MAX_VARYING_VECTORS),F=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),Q=v>0,H=n.getParameter(n.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:u,logarithmicDepthBuffer:h,reverseDepthBuffer:f,maxTextures:p,maxVertexTextures:v,maxTextureSize:M,maxCubemapSize:m,maxAttributes:g,maxVertexUniforms:P,maxVaryings:L,maxFragmentUniforms:F,vertexTextures:Q,maxSamples:H}}function zd(n){const e=this;let t=null,i=0,r=!1,s=!1;const o=new on,a=new ht,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,f){const p=h.length!==0||f||i!==0||r;return r=f,i=h.length,p},this.beginShadows=function(){s=!0,c(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(h,f){t=c(h,f,0)},this.setState=function(h,f,p){const v=h.clippingPlanes,M=h.clipIntersection,m=h.clipShadows,g=n.get(h);if(!r||v===null||v.length===0||s&&!m)s?c(null):u();else{const P=s?0:i,L=P*4;let F=g.clippingState||null;l.value=F,F=c(v,f,L,p);for(let Q=0;Q!==L;++Q)F[Q]=t[Q];g.clippingState=F,this.numIntersection=M?this.numPlanes:0,this.numPlanes+=P}};function u(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function c(h,f,p,v){const M=h!==null?h.length:0;let m=null;if(M!==0){if(m=l.value,v!==!0||m===null){const g=p+M*4,P=f.matrixWorldInverse;a.getNormalMatrix(P),(m===null||m.length<g)&&(m=new Float32Array(g));for(let L=0,F=p;L!==M;++L,F+=4)o.copy(h[L]).applyMatrix4(P,a),o.normal.toArray(m,F),m[F+3]=o.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=M,e.numIntersection=0,m}}function Bd(n){let e=new WeakMap;function t(o,a){return a===Ws?o.mapping=Ii:a===Xs&&(o.mapping=Di),o}function i(o){if(o&&o.isTexture){const a=o.mapping;if(a===Ws||a===Xs)if(e.has(o)){const l=e.get(o).texture;return t(l,o.mapping)}else{const l=o.image;if(l&&l.height>0){const u=new ju(l.height);return u.fromEquirectangularTexture(n,o),e.set(o,u),o.addEventListener("dispose",r),t(u.texture,o.mapping)}else return null}}return o}function r(o){const a=o.target;a.removeEventListener("dispose",r);const l=e.get(a);l!==void 0&&(e.delete(a),l.dispose())}function s(){e=new WeakMap}return{get:i,dispose:s}}class ql extends Vl{constructor(e=-1,t=1,i=1,r=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2;let s=i-e,o=i+e,a=r+t,l=r-t;if(this.view!==null&&this.view.enabled){const u=(this.right-this.left)/this.view.fullWidth/this.zoom,c=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=u*this.view.offsetX,o=s+u*this.view.width,a-=c*this.view.offsetY,l=a-c*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}const Ai=4,da=[.125,.215,.35,.446,.526,.582],ii=20,vs=new ql,pa=new ot;let Ms=null,ys=0,Ss=0,bs=!1;const ti=(1+Math.sqrt(5))/2,bi=1/ti,ma=[new ae(-ti,bi,0),new ae(ti,bi,0),new ae(-bi,0,ti),new ae(bi,0,ti),new ae(0,ti,-bi),new ae(0,ti,bi),new ae(-1,1,-1),new ae(1,1,-1),new ae(-1,1,1),new ae(1,1,1)];class ga{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,i=.1,r=100){Ms=this._renderer.getRenderTarget(),ys=this._renderer.getActiveCubeFace(),Ss=this._renderer.getActiveMipmapLevel(),bs=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,i,r,s),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=va(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=xa(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Ms,ys,Ss),this._renderer.xr.enabled=bs,e.scissorTest=!1,yr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Ii||e.mapping===Di?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Ms=this._renderer.getRenderTarget(),ys=this._renderer.getActiveCubeFace(),Ss=this._renderer.getActiveMipmapLevel(),bs=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:Kt,minFilter:Kt,generateMipmaps:!1,type:er,format:en,colorSpace:Gn,depthBuffer:!1},r=_a(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=_a(e,t,i);const{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=kd(s)),this._blurMaterial=Hd(s,e,t)}return r}_compileMaterial(e){const t=new Xt(this._lodPlanes[0],e);this._renderer.compile(t,vs)}_sceneToCubeUV(e,t,i,r){const a=new Qt(90,1,t,i),l=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],c=this._renderer,h=c.autoClear,f=c.toneMapping;c.getClearColor(pa),c.toneMapping=Bn,c.autoClear=!1;const p=new kl({name:"PMREM.Background",side:qt,depthWrite:!1,depthTest:!1}),v=new Xt(new nr,p);let M=!1;const m=e.background;m?m.isColor&&(p.color.copy(m),e.background=null,M=!0):(p.color.copy(pa),M=!0);for(let g=0;g<6;g++){const P=g%3;P===0?(a.up.set(0,l[g],0),a.lookAt(u[g],0,0)):P===1?(a.up.set(0,0,l[g]),a.lookAt(0,u[g],0)):(a.up.set(0,l[g],0),a.lookAt(0,0,u[g]));const L=this._cubeSize;yr(r,P*L,g>2?L:0,L,L),c.setRenderTarget(r),M&&c.render(v,a),c.render(e,a)}v.geometry.dispose(),v.material.dispose(),c.toneMapping=f,c.autoClear=h,e.background=m}_textureToCubeUV(e,t){const i=this._renderer,r=e.mapping===Ii||e.mapping===Di;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=va()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=xa());const s=r?this._cubemapMaterial:this._equirectMaterial,o=new Xt(this._lodPlanes[0],s),a=s.uniforms;a.envMap.value=e;const l=this._cubeSize;yr(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(o,vs)}_applyPMREM(e){const t=this._renderer,i=t.autoClear;t.autoClear=!1;const r=this._lodPlanes.length;for(let s=1;s<r;s++){const o=Math.sqrt(this._sigmas[s]*this._sigmas[s]-this._sigmas[s-1]*this._sigmas[s-1]),a=ma[(r-s-1)%ma.length];this._blur(e,s-1,s,o,a)}t.autoClear=i}_blur(e,t,i,r,s){const o=this._pingPongRenderTarget;this._halfBlur(e,o,t,i,r,"latitudinal",s),this._halfBlur(o,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,o,a){const l=this._renderer,u=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const c=3,h=new Xt(this._lodPlanes[r],u),f=u.uniforms,p=this._sizeLods[i]-1,v=isFinite(s)?Math.PI/(2*p):2*Math.PI/(2*ii-1),M=s/v,m=isFinite(s)?1+Math.floor(c*M):ii;m>ii&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${ii}`);const g=[];let P=0;for(let V=0;V<ii;++V){const le=V/M,Te=Math.exp(-le*le/2);g.push(Te),V===0?P+=Te:V<m&&(P+=2*Te)}for(let V=0;V<g.length;V++)g[V]=g[V]/P;f.envMap.value=e.texture,f.samples.value=m,f.weights.value=g,f.latitudinal.value=o==="latitudinal",a&&(f.poleAxis.value=a);const{_lodMax:L}=this;f.dTheta.value=v,f.mipInt.value=L-i;const F=this._sizeLods[r],Q=3*F*(r>L-Ai?r-L+Ai:0),H=4*(this._cubeSize-F);yr(t,Q,H,3*F,2*F),l.setRenderTarget(t),l.render(h,vs)}}function kd(n){const e=[],t=[],i=[];let r=n;const s=n-Ai+1+da.length;for(let o=0;o<s;o++){const a=Math.pow(2,r);t.push(a);let l=1/a;o>n-Ai?l=da[o-n+Ai-1]:o===0&&(l=0),i.push(l);const u=1/(a-2),c=-u,h=1+u,f=[c,c,h,c,h,h,c,c,h,h,c,h],p=6,v=6,M=3,m=2,g=1,P=new Float32Array(M*v*p),L=new Float32Array(m*v*p),F=new Float32Array(g*v*p);for(let H=0;H<p;H++){const V=H%3*2/3-1,le=H>2?0:-1,Te=[V,le,0,V+2/3,le,0,V+2/3,le+1,0,V,le,0,V+2/3,le+1,0,V,le+1,0];P.set(Te,M*v*H),L.set(f,m*v*H);const y=[H,H,H,H,H,H];F.set(y,g*v*H)}const Q=new gn;Q.setAttribute("position",new Yt(P,M)),Q.setAttribute("uv",new Yt(L,m)),Q.setAttribute("faceIndex",new Yt(F,g)),e.push(Q),r>Ai&&r--}return{lodPlanes:e,sizeLods:t,sigmas:i}}function _a(n,e,t){const i=new ai(n,e,t);return i.texture.mapping=Xr,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function yr(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function Hd(n,e,t){const i=new Float32Array(ii),r=new ae(0,1,0);return new Hn({name:"SphericalGaussianBlur",defines:{n:ii,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:Fo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:zn,depthTest:!1,depthWrite:!1})}function xa(){return new Hn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Fo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:zn,depthTest:!1,depthWrite:!1})}function va(){return new Hn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Fo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:zn,depthTest:!1,depthWrite:!1})}function Fo(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Gd(n){let e=new WeakMap,t=null;function i(a){if(a&&a.isTexture){const l=a.mapping,u=l===Ws||l===Xs,c=l===Ii||l===Di;if(u||c){let h=e.get(a);const f=h!==void 0?h.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==f)return t===null&&(t=new ga(n)),h=u?t.fromEquirectangular(a,h):t.fromCubemap(a,h),h.texture.pmremVersion=a.pmremVersion,e.set(a,h),h.texture;if(h!==void 0)return h.texture;{const p=a.image;return u&&p&&p.height>0||c&&p&&r(p)?(t===null&&(t=new ga(n)),h=u?t.fromEquirectangular(a):t.fromCubemap(a),h.texture.pmremVersion=a.pmremVersion,e.set(a,h),a.addEventListener("dispose",s),h.texture):null}}}return a}function r(a){let l=0;const u=6;for(let c=0;c<u;c++)a[c]!==void 0&&l++;return l===u}function s(a){const l=a.target;l.removeEventListener("dispose",s);const u=e.get(l);u!==void 0&&(e.delete(l),u.dispose())}function o(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:i,dispose:o}}function Vd(n){const e={};function t(i){if(e[i]!==void 0)return e[i];let r;switch(i){case"WEBGL_depth_texture":r=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=n.getExtension(i)}return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){const r=t(i);return r===null&&Fr("THREE.WebGLRenderer: "+i+" extension not supported."),r}}}function Wd(n,e,t,i){const r={},s=new WeakMap;function o(h){const f=h.target;f.index!==null&&e.remove(f.index);for(const v in f.attributes)e.remove(f.attributes[v]);for(const v in f.morphAttributes){const M=f.morphAttributes[v];for(let m=0,g=M.length;m<g;m++)e.remove(M[m])}f.removeEventListener("dispose",o),delete r[f.id];const p=s.get(f);p&&(e.remove(p),s.delete(f)),i.releaseStatesOfGeometry(f),f.isInstancedBufferGeometry===!0&&delete f._maxInstanceCount,t.memory.geometries--}function a(h,f){return r[f.id]===!0||(f.addEventListener("dispose",o),r[f.id]=!0,t.memory.geometries++),f}function l(h){const f=h.attributes;for(const v in f)e.update(f[v],n.ARRAY_BUFFER);const p=h.morphAttributes;for(const v in p){const M=p[v];for(let m=0,g=M.length;m<g;m++)e.update(M[m],n.ARRAY_BUFFER)}}function u(h){const f=[],p=h.index,v=h.attributes.position;let M=0;if(p!==null){const P=p.array;M=p.version;for(let L=0,F=P.length;L<F;L+=3){const Q=P[L+0],H=P[L+1],V=P[L+2];f.push(Q,H,H,V,V,Q)}}else if(v!==void 0){const P=v.array;M=v.version;for(let L=0,F=P.length/3-1;L<F;L+=3){const Q=L+0,H=L+1,V=L+2;f.push(Q,H,H,V,V,Q)}}else return;const m=new(Dl(f)?Hl:No)(f,1);m.version=M;const g=s.get(h);g&&e.remove(g),s.set(h,m)}function c(h){const f=s.get(h);if(f){const p=h.index;p!==null&&f.version<p.version&&u(h)}else u(h);return s.get(h)}return{get:a,update:l,getWireframeAttribute:c}}function Xd(n,e,t){let i;function r(f){i=f}let s,o;function a(f){s=f.type,o=f.bytesPerElement}function l(f,p){n.drawElements(i,p,s,f*o),t.update(p,i,1)}function u(f,p,v){v!==0&&(n.drawElementsInstanced(i,p,s,f*o,v),t.update(p,i,v))}function c(f,p,v){if(v===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,p,0,s,f,0,v);let m=0;for(let g=0;g<v;g++)m+=p[g];t.update(m,i,1)}function h(f,p,v,M){if(v===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let g=0;g<f.length;g++)u(f[g]/o,p[g],M[g]);else{m.multiDrawElementsInstancedWEBGL(i,p,0,s,f,0,M,0,v);let g=0;for(let P=0;P<v;P++)g+=p[P];for(let P=0;P<M.length;P++)t.update(g,i,M[P])}}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=u,this.renderMultiDraw=c,this.renderMultiDrawInstances=h}function qd(n){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(t.calls++,o){case n.TRIANGLES:t.triangles+=a*(s/3);break;case n.LINES:t.lines+=a*(s/2);break;case n.LINE_STRIP:t.lines+=a*(s-1);break;case n.LINE_LOOP:t.lines+=a*s;break;case n.POINTS:t.points+=a*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function Yd(n,e,t){const i=new WeakMap,r=new Et;function s(o,a,l){const u=o.morphTargetInfluences,c=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,h=c!==void 0?c.length:0;let f=i.get(a);if(f===void 0||f.count!==h){let Te=function(){V.dispose(),i.delete(a),a.removeEventListener("dispose",Te)};f!==void 0&&f.texture.dispose();const p=a.morphAttributes.position!==void 0,v=a.morphAttributes.normal!==void 0,M=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],g=a.morphAttributes.normal||[],P=a.morphAttributes.color||[];let L=0;p===!0&&(L=1),v===!0&&(L=2),M===!0&&(L=3);let F=a.attributes.position.count*L,Q=1;F>e.maxTextureSize&&(Q=Math.ceil(F/e.maxTextureSize),F=e.maxTextureSize);const H=new Float32Array(F*Q*4*h),V=new Nl(H,F,Q,h);V.type=ln,V.needsUpdate=!0;const le=L*4;for(let y=0;y<h;y++){const A=m[y],Me=g[y],ue=P[y],I=F*Q*4*y;for(let ie=0;ie<A.count;ie++){const x=ie*le;p===!0&&(r.fromBufferAttribute(A,ie),H[I+x+0]=r.x,H[I+x+1]=r.y,H[I+x+2]=r.z,H[I+x+3]=0),v===!0&&(r.fromBufferAttribute(Me,ie),H[I+x+4]=r.x,H[I+x+5]=r.y,H[I+x+6]=r.z,H[I+x+7]=0),M===!0&&(r.fromBufferAttribute(ue,ie),H[I+x+8]=r.x,H[I+x+9]=r.y,H[I+x+10]=r.z,H[I+x+11]=ue.itemSize===4?r.w:1)}}f={count:h,texture:V,size:new _t(F,Q)},i.set(a,f),a.addEventListener("dispose",Te)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",o.morphTexture,t);else{let p=0;for(let M=0;M<u.length;M++)p+=u[M];const v=a.morphTargetsRelative?1:1-p;l.getUniforms().setValue(n,"morphTargetBaseInfluence",v),l.getUniforms().setValue(n,"morphTargetInfluences",u)}l.getUniforms().setValue(n,"morphTargetsTexture",f.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",f.size)}return{update:s}}function $d(n,e,t,i){let r=new WeakMap;function s(l){const u=i.render.frame,c=l.geometry,h=e.get(l,c);if(r.get(h)!==u&&(e.update(h),r.set(h,u)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),r.get(l)!==u&&(t.update(l.instanceMatrix,n.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,n.ARRAY_BUFFER),r.set(l,u))),l.isSkinnedMesh){const f=l.skeleton;r.get(f)!==u&&(f.update(),r.set(f,u))}return h}function o(){r=new WeakMap}function a(l){const u=l.target;u.removeEventListener("dispose",a),t.remove(u.instanceMatrix),u.instanceColor!==null&&t.remove(u.instanceColor)}return{update:s,dispose:o}}class Yl extends zt{constructor(e,t,i,r,s,o,a,l,u,c=Ci){if(c!==Ci&&c!==Ni)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");i===void 0&&c===Ci&&(i=oi),i===void 0&&c===Ni&&(i=Ui),super(null,r,s,o,a,l,c,i,u),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=a!==void 0?a:Ot,this.minFilter=l!==void 0?l:Ot,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}const $l=new zt,Ma=new Yl(1,1),jl=new Nl,Kl=new Du,Zl=new Wl,ya=[],Sa=[],ba=new Float32Array(16),Ea=new Float32Array(9),wa=new Float32Array(4);function zi(n,e,t){const i=n[0];if(i<=0||i>0)return n;const r=e*t;let s=ya[r];if(s===void 0&&(s=new Float32Array(r),ya[r]=s),e!==0){i.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,n[o].toArray(s,a)}return s}function Rt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function Ct(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function jr(n,e){let t=Sa[e];t===void 0&&(t=new Int32Array(e),Sa[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function jd(n,e){const t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function Kd(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Rt(t,e))return;n.uniform2fv(this.addr,e),Ct(t,e)}}function Zd(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Rt(t,e))return;n.uniform3fv(this.addr,e),Ct(t,e)}}function Jd(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Rt(t,e))return;n.uniform4fv(this.addr,e),Ct(t,e)}}function Qd(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(Rt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),Ct(t,e)}else{if(Rt(t,i))return;wa.set(i),n.uniformMatrix2fv(this.addr,!1,wa),Ct(t,i)}}function ep(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(Rt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),Ct(t,e)}else{if(Rt(t,i))return;Ea.set(i),n.uniformMatrix3fv(this.addr,!1,Ea),Ct(t,i)}}function tp(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(Rt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),Ct(t,e)}else{if(Rt(t,i))return;ba.set(i),n.uniformMatrix4fv(this.addr,!1,ba),Ct(t,i)}}function np(n,e){const t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function ip(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Rt(t,e))return;n.uniform2iv(this.addr,e),Ct(t,e)}}function rp(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Rt(t,e))return;n.uniform3iv(this.addr,e),Ct(t,e)}}function sp(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Rt(t,e))return;n.uniform4iv(this.addr,e),Ct(t,e)}}function op(n,e){const t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function ap(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Rt(t,e))return;n.uniform2uiv(this.addr,e),Ct(t,e)}}function lp(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Rt(t,e))return;n.uniform3uiv(this.addr,e),Ct(t,e)}}function cp(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Rt(t,e))return;n.uniform4uiv(this.addr,e),Ct(t,e)}}function up(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s;this.type===n.SAMPLER_2D_SHADOW?(Ma.compareFunction=Il,s=Ma):s=$l,t.setTexture2D(e||s,r)}function hp(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||Kl,r)}function fp(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||Zl,r)}function dp(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||jl,r)}function pp(n){switch(n){case 5126:return jd;case 35664:return Kd;case 35665:return Zd;case 35666:return Jd;case 35674:return Qd;case 35675:return ep;case 35676:return tp;case 5124:case 35670:return np;case 35667:case 35671:return ip;case 35668:case 35672:return rp;case 35669:case 35673:return sp;case 5125:return op;case 36294:return ap;case 36295:return lp;case 36296:return cp;case 35678:case 36198:case 36298:case 36306:case 35682:return up;case 35679:case 36299:case 36307:return hp;case 35680:case 36300:case 36308:case 36293:return fp;case 36289:case 36303:case 36311:case 36292:return dp}}function mp(n,e){n.uniform1fv(this.addr,e)}function gp(n,e){const t=zi(e,this.size,2);n.uniform2fv(this.addr,t)}function _p(n,e){const t=zi(e,this.size,3);n.uniform3fv(this.addr,t)}function xp(n,e){const t=zi(e,this.size,4);n.uniform4fv(this.addr,t)}function vp(n,e){const t=zi(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function Mp(n,e){const t=zi(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function yp(n,e){const t=zi(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function Sp(n,e){n.uniform1iv(this.addr,e)}function bp(n,e){n.uniform2iv(this.addr,e)}function Ep(n,e){n.uniform3iv(this.addr,e)}function wp(n,e){n.uniform4iv(this.addr,e)}function Tp(n,e){n.uniform1uiv(this.addr,e)}function Ap(n,e){n.uniform2uiv(this.addr,e)}function Rp(n,e){n.uniform3uiv(this.addr,e)}function Cp(n,e){n.uniform4uiv(this.addr,e)}function Pp(n,e,t){const i=this.cache,r=e.length,s=jr(t,r);Rt(i,s)||(n.uniform1iv(this.addr,s),Ct(i,s));for(let o=0;o!==r;++o)t.setTexture2D(e[o]||$l,s[o])}function Lp(n,e,t){const i=this.cache,r=e.length,s=jr(t,r);Rt(i,s)||(n.uniform1iv(this.addr,s),Ct(i,s));for(let o=0;o!==r;++o)t.setTexture3D(e[o]||Kl,s[o])}function Ip(n,e,t){const i=this.cache,r=e.length,s=jr(t,r);Rt(i,s)||(n.uniform1iv(this.addr,s),Ct(i,s));for(let o=0;o!==r;++o)t.setTextureCube(e[o]||Zl,s[o])}function Dp(n,e,t){const i=this.cache,r=e.length,s=jr(t,r);Rt(i,s)||(n.uniform1iv(this.addr,s),Ct(i,s));for(let o=0;o!==r;++o)t.setTexture2DArray(e[o]||jl,s[o])}function Up(n){switch(n){case 5126:return mp;case 35664:return gp;case 35665:return _p;case 35666:return xp;case 35674:return vp;case 35675:return Mp;case 35676:return yp;case 5124:case 35670:return Sp;case 35667:case 35671:return bp;case 35668:case 35672:return Ep;case 35669:case 35673:return wp;case 5125:return Tp;case 36294:return Ap;case 36295:return Rp;case 36296:return Cp;case 35678:case 36198:case 36298:case 36306:case 35682:return Pp;case 35679:case 36299:case 36307:return Lp;case 35680:case 36300:case 36308:case 36293:return Ip;case 36289:case 36303:case 36311:case 36292:return Dp}}class Np{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=pp(t.type)}}class Fp{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Up(t.type)}}class Op{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){const r=this.seq;for(let s=0,o=r.length;s!==o;++s){const a=r[s];a.setValue(e,t[a.id],i)}}}const Es=/(\w+)(\])?(\[|\.)?/g;function Ta(n,e){n.seq.push(e),n.map[e.id]=e}function zp(n,e,t){const i=n.name,r=i.length;for(Es.lastIndex=0;;){const s=Es.exec(i),o=Es.lastIndex;let a=s[1];const l=s[2]==="]",u=s[3];if(l&&(a=a|0),u===void 0||u==="["&&o+2===r){Ta(t,u===void 0?new Np(a,n,e):new Fp(a,n,e));break}else{let h=t.map[a];h===void 0&&(h=new Op(a),Ta(t,h)),t=h}}}class Or{constructor(e,t){this.seq=[],this.map={};const i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){const s=e.getActiveUniform(t,r),o=e.getUniformLocation(t,s.name);zp(s,o,this)}}setValue(e,t,i,r){const s=this.map[t];s!==void 0&&s.setValue(e,i,r)}setOptional(e,t,i){const r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let s=0,o=t.length;s!==o;++s){const a=t[s],l=i[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,r)}}static seqWithValue(e,t){const i=[];for(let r=0,s=e.length;r!==s;++r){const o=e[r];o.id in t&&i.push(o)}return i}}function Aa(n,e,t){const i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}const Bp=37297;let kp=0;function Hp(n,e){const t=n.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let o=r;o<s;o++){const a=o+1;i.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return i.join(`
`)}function Gp(n){const e=xt.getPrimaries(xt.workingColorSpace),t=xt.getPrimaries(n);let i;switch(e===t?i="":e===Gr&&t===Hr?i="LinearDisplayP3ToLinearSRGB":e===Hr&&t===Gr&&(i="LinearSRGBToLinearDisplayP3"),n){case Gn:case qr:return[i,"LinearTransferOETF"];case sn:case Do:return[i,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",n),[i,"LinearTransferOETF"]}}function Ra(n,e,t){const i=n.getShaderParameter(e,n.COMPILE_STATUS),r=n.getShaderInfoLog(e).trim();if(i&&r==="")return"";const s=/ERROR: 0:(\d+)/.exec(r);if(s){const o=parseInt(s[1]);return t.toUpperCase()+`

`+r+`

`+Hp(n.getShaderSource(e),o)}else return r}function Vp(n,e){const t=Gp(e);return`vec4 ${n}( vec4 value ) { return ${t[0]}( ${t[1]}( value ) ); }`}function Wp(n,e){let t;switch(e){case Wc:t="Linear";break;case Xc:t="Reinhard";break;case qc:t="Cineon";break;case Ml:t="ACESFilmic";break;case $c:t="AgX";break;case jc:t="Neutral";break;case Yc:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const Sr=new ae;function Xp(){xt.getLuminanceCoefficients(Sr);const n=Sr.x.toFixed(4),e=Sr.y.toFixed(4),t=Sr.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function qp(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter($i).join(`
`)}function Yp(n){const e=[];for(const t in n){const i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function $p(n,e){const t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){const s=n.getActiveAttrib(e,r),o=s.name;let a=1;s.type===n.FLOAT_MAT2&&(a=2),s.type===n.FLOAT_MAT3&&(a=3),s.type===n.FLOAT_MAT4&&(a=4),t[o]={type:s.type,location:n.getAttribLocation(e,o),locationSize:a}}return t}function $i(n){return n!==""}function Ca(n,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Pa(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const jp=/^[ \t]*#include +<([\w\d./]+)>/gm;function Mo(n){return n.replace(jp,Zp)}const Kp=new Map;function Zp(n,e){let t=ut[e];if(t===void 0){const i=Kp.get(e);if(i!==void 0)t=ut[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("Can not resolve #include <"+e+">")}return Mo(t)}const Jp=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function La(n){return n.replace(Jp,Qp)}function Qp(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function Ia(n){let e=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?e+=`
#define HIGH_PRECISION`:n.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function em(n){let e="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===_l?e="SHADOWMAP_TYPE_PCF":n.shadowMapType===xl?e="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===Sn&&(e="SHADOWMAP_TYPE_VSM"),e}function tm(n){let e="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case Ii:case Di:e="ENVMAP_TYPE_CUBE";break;case Xr:e="ENVMAP_TYPE_CUBE_UV";break}return e}function nm(n){let e="ENVMAP_MODE_REFLECTION";if(n.envMap)switch(n.envMapMode){case Di:e="ENVMAP_MODE_REFRACTION";break}return e}function im(n){let e="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case vl:e="ENVMAP_BLENDING_MULTIPLY";break;case Gc:e="ENVMAP_BLENDING_MIX";break;case Vc:e="ENVMAP_BLENDING_ADD";break}return e}function rm(n){const e=n.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),7*16)),texelHeight:i,maxMip:t}}function sm(n,e,t,i){const r=n.getContext(),s=t.defines;let o=t.vertexShader,a=t.fragmentShader;const l=em(t),u=tm(t),c=nm(t),h=im(t),f=rm(t),p=qp(t),v=Yp(s),M=r.createProgram();let m,g,P=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v].filter($i).join(`
`),m.length>0&&(m+=`
`),g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v].filter($i).join(`
`),g.length>0&&(g+=`
`)):(m=[Ia(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter($i).join(`
`),g=[Ia(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",f?"#define CUBEUV_TEXEL_WIDTH "+f.texelWidth:"",f?"#define CUBEUV_TEXEL_HEIGHT "+f.texelHeight:"",f?"#define CUBEUV_MAX_MIP "+f.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Bn?"#define TONE_MAPPING":"",t.toneMapping!==Bn?ut.tonemapping_pars_fragment:"",t.toneMapping!==Bn?Wp("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",ut.colorspace_pars_fragment,Vp("linearToOutputTexel",t.outputColorSpace),Xp(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter($i).join(`
`)),o=Mo(o),o=Ca(o,t),o=Pa(o,t),a=Mo(a),a=Ca(a,t),a=Pa(a,t),o=La(o),a=La(a),t.isRawShaderMaterial!==!0&&(P=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,g=["#define varying in",t.glslVersion===$o?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===$o?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);const L=P+m+o,F=P+g+a,Q=Aa(r,r.VERTEX_SHADER,L),H=Aa(r,r.FRAGMENT_SHADER,F);r.attachShader(M,Q),r.attachShader(M,H),t.index0AttributeName!==void 0?r.bindAttribLocation(M,0,t.index0AttributeName):t.morphTargets===!0&&r.bindAttribLocation(M,0,"position"),r.linkProgram(M);function V(A){if(n.debug.checkShaderErrors){const Me=r.getProgramInfoLog(M).trim(),ue=r.getShaderInfoLog(Q).trim(),I=r.getShaderInfoLog(H).trim();let ie=!0,x=!0;if(r.getProgramParameter(M,r.LINK_STATUS)===!1)if(ie=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,M,Q,H);else{const j=Ra(r,Q,"vertex"),X=Ra(r,H,"fragment");console.error("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(M,r.VALIDATE_STATUS)+`

Material Name: `+A.name+`
Material Type: `+A.type+`

Program Info Log: `+Me+`
`+j+`
`+X)}else Me!==""?console.warn("THREE.WebGLProgram: Program Info Log:",Me):(ue===""||I==="")&&(x=!1);x&&(A.diagnostics={runnable:ie,programLog:Me,vertexShader:{log:ue,prefix:m},fragmentShader:{log:I,prefix:g}})}r.deleteShader(Q),r.deleteShader(H),le=new Or(r,M),Te=$p(r,M)}let le;this.getUniforms=function(){return le===void 0&&V(this),le};let Te;this.getAttributes=function(){return Te===void 0&&V(this),Te};let y=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return y===!1&&(y=r.getProgramParameter(M,Bp)),y},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(M),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=kp++,this.cacheKey=e,this.usedTimes=1,this.program=M,this.vertexShader=Q,this.fragmentShader=H,this}let om=0;class am{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,i=e.fragmentShader,r=this._getShaderStage(t),s=this._getShaderStage(i),o=this._getShaderCacheForMaterial(e);return o.has(r)===!1&&(o.add(r),r.usedTimes++),o.has(s)===!1&&(o.add(s),s.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){const t=this.shaderCache;let i=t.get(e);return i===void 0&&(i=new lm(e),t.set(e,i)),i}}class lm{constructor(e){this.id=om++,this.code=e,this.usedTimes=0}}function cm(n,e,t,i,r,s,o){const a=new zl,l=new am,u=new Set,c=[],h=r.logarithmicDepthBuffer,f=r.reverseDepthBuffer,p=r.vertexTextures;let v=r.precision;const M={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function m(y){return u.add(y),y===0?"uv":`uv${y}`}function g(y,A,Me,ue,I){const ie=ue.fog,x=I.geometry,j=y.isMeshStandardMaterial?ue.environment:null,X=(y.isMeshStandardMaterial?t:e).get(y.envMap||j),ce=X&&X.mapping===Xr?X.image.height:null,N=M[y.type];y.precision!==null&&(v=r.getMaxPrecision(y.precision),v!==y.precision&&console.warn("THREE.WebGLProgram.getParameters:",y.precision,"not supported, using",v,"instead."));const U=x.morphAttributes.position||x.morphAttributes.normal||x.morphAttributes.color,k=U!==void 0?U.length:0;let te=0;x.morphAttributes.position!==void 0&&(te=1),x.morphAttributes.normal!==void 0&&(te=2),x.morphAttributes.color!==void 0&&(te=3);let T,D,O,G;if(N){const xe=fn[N];T=xe.vertexShader,D=xe.fragmentShader}else T=y.vertexShader,D=y.fragmentShader,l.update(y),O=l.getVertexShaderID(y),G=l.getFragmentShaderID(y);const ne=n.getRenderTarget(),Z=I.isInstancedMesh===!0,q=I.isBatchedMesh===!0,J=!!y.map,re=!!y.matcap,R=!!X,$=!!y.aoMap,he=!!y.lightMap,ye=!!y.bumpMap,Pe=!!y.normalMap,fe=!!y.displacementMap,Ce=!!y.emissiveMap,C=!!y.metalnessMap,S=!!y.roughnessMap,se=y.anisotropy>0,me=y.clearcoat>0,Ae=y.dispersion>0,ee=y.iridescence>0,Ie=y.sheen>0,Le=y.transmission>0,Be=se&&!!y.anisotropyMap,$e=me&&!!y.clearcoatMap,Ne=me&&!!y.clearcoatNormalMap,Fe=me&&!!y.clearcoatRoughnessMap,tt=ee&&!!y.iridescenceMap,it=ee&&!!y.iridescenceThicknessMap,Ge=Ie&&!!y.sheenColorMap,at=Ie&&!!y.sheenRoughnessMap,rt=!!y.specularMap,mt=!!y.specularColorMap,oe=!!y.specularIntensityMap,d=Le&&!!y.transmissionMap,_=Le&&!!y.thicknessMap,b=!!y.gradientMap,z=!!y.alphaMap,B=y.alphaTest>0,pe=!!y.alphaHash,_e=!!y.extensions;let Ee=Bn;y.toneMapped&&(ne===null||ne.isXRRenderTarget===!0)&&(Ee=n.toneMapping);const ge={shaderID:N,shaderType:y.type,shaderName:y.name,vertexShader:T,fragmentShader:D,defines:y.defines,customVertexShaderID:O,customFragmentShaderID:G,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:v,batching:q,batchingColor:q&&I._colorsTexture!==null,instancing:Z,instancingColor:Z&&I.instanceColor!==null,instancingMorph:Z&&I.morphTexture!==null,supportsVertexTextures:p,outputColorSpace:ne===null?n.outputColorSpace:ne.isXRRenderTarget===!0?ne.texture.colorSpace:Gn,alphaToCoverage:!!y.alphaToCoverage,map:J,matcap:re,envMap:R,envMapMode:R&&X.mapping,envMapCubeUVHeight:ce,aoMap:$,lightMap:he,bumpMap:ye,normalMap:Pe,displacementMap:p&&fe,emissiveMap:Ce,normalMapObjectSpace:Pe&&y.normalMapType===eu,normalMapTangentSpace:Pe&&y.normalMapType===Ll,metalnessMap:C,roughnessMap:S,anisotropy:se,anisotropyMap:Be,clearcoat:me,clearcoatMap:$e,clearcoatNormalMap:Ne,clearcoatRoughnessMap:Fe,dispersion:Ae,iridescence:ee,iridescenceMap:tt,iridescenceThicknessMap:it,sheen:Ie,sheenColorMap:Ge,sheenRoughnessMap:at,specularMap:rt,specularColorMap:mt,specularIntensityMap:oe,transmission:Le,transmissionMap:d,thicknessMap:_,gradientMap:b,opaque:y.transparent===!1&&y.blending===Ri&&y.alphaToCoverage===!1,alphaMap:z,alphaTest:B,alphaHash:pe,combine:y.combine,mapUv:J&&m(y.map.channel),aoMapUv:$&&m(y.aoMap.channel),lightMapUv:he&&m(y.lightMap.channel),bumpMapUv:ye&&m(y.bumpMap.channel),normalMapUv:Pe&&m(y.normalMap.channel),displacementMapUv:fe&&m(y.displacementMap.channel),emissiveMapUv:Ce&&m(y.emissiveMap.channel),metalnessMapUv:C&&m(y.metalnessMap.channel),roughnessMapUv:S&&m(y.roughnessMap.channel),anisotropyMapUv:Be&&m(y.anisotropyMap.channel),clearcoatMapUv:$e&&m(y.clearcoatMap.channel),clearcoatNormalMapUv:Ne&&m(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Fe&&m(y.clearcoatRoughnessMap.channel),iridescenceMapUv:tt&&m(y.iridescenceMap.channel),iridescenceThicknessMapUv:it&&m(y.iridescenceThicknessMap.channel),sheenColorMapUv:Ge&&m(y.sheenColorMap.channel),sheenRoughnessMapUv:at&&m(y.sheenRoughnessMap.channel),specularMapUv:rt&&m(y.specularMap.channel),specularColorMapUv:mt&&m(y.specularColorMap.channel),specularIntensityMapUv:oe&&m(y.specularIntensityMap.channel),transmissionMapUv:d&&m(y.transmissionMap.channel),thicknessMapUv:_&&m(y.thicknessMap.channel),alphaMapUv:z&&m(y.alphaMap.channel),vertexTangents:!!x.attributes.tangent&&(Pe||se),vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!x.attributes.color&&x.attributes.color.itemSize===4,pointsUvs:I.isPoints===!0&&!!x.attributes.uv&&(J||z),fog:!!ie,useFog:y.fog===!0,fogExp2:!!ie&&ie.isFogExp2,flatShading:y.flatShading===!0,sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:h,reverseDepthBuffer:f,skinning:I.isSkinnedMesh===!0,morphTargets:x.morphAttributes.position!==void 0,morphNormals:x.morphAttributes.normal!==void 0,morphColors:x.morphAttributes.color!==void 0,morphTargetsCount:k,morphTextureStride:te,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:y.dithering,shadowMapEnabled:n.shadowMap.enabled&&Me.length>0,shadowMapType:n.shadowMap.type,toneMapping:Ee,decodeVideoTexture:J&&y.map.isVideoTexture===!0&&xt.getTransfer(y.map.colorSpace)===bt,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===dn,flipSided:y.side===qt,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:_e&&y.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(_e&&y.extensions.multiDraw===!0||q)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return ge.vertexUv1s=u.has(1),ge.vertexUv2s=u.has(2),ge.vertexUv3s=u.has(3),u.clear(),ge}function P(y){const A=[];if(y.shaderID?A.push(y.shaderID):(A.push(y.customVertexShaderID),A.push(y.customFragmentShaderID)),y.defines!==void 0)for(const Me in y.defines)A.push(Me),A.push(y.defines[Me]);return y.isRawShaderMaterial===!1&&(L(A,y),F(A,y),A.push(n.outputColorSpace)),A.push(y.customProgramCacheKey),A.join()}function L(y,A){y.push(A.precision),y.push(A.outputColorSpace),y.push(A.envMapMode),y.push(A.envMapCubeUVHeight),y.push(A.mapUv),y.push(A.alphaMapUv),y.push(A.lightMapUv),y.push(A.aoMapUv),y.push(A.bumpMapUv),y.push(A.normalMapUv),y.push(A.displacementMapUv),y.push(A.emissiveMapUv),y.push(A.metalnessMapUv),y.push(A.roughnessMapUv),y.push(A.anisotropyMapUv),y.push(A.clearcoatMapUv),y.push(A.clearcoatNormalMapUv),y.push(A.clearcoatRoughnessMapUv),y.push(A.iridescenceMapUv),y.push(A.iridescenceThicknessMapUv),y.push(A.sheenColorMapUv),y.push(A.sheenRoughnessMapUv),y.push(A.specularMapUv),y.push(A.specularColorMapUv),y.push(A.specularIntensityMapUv),y.push(A.transmissionMapUv),y.push(A.thicknessMapUv),y.push(A.combine),y.push(A.fogExp2),y.push(A.sizeAttenuation),y.push(A.morphTargetsCount),y.push(A.morphAttributeCount),y.push(A.numDirLights),y.push(A.numPointLights),y.push(A.numSpotLights),y.push(A.numSpotLightMaps),y.push(A.numHemiLights),y.push(A.numRectAreaLights),y.push(A.numDirLightShadows),y.push(A.numPointLightShadows),y.push(A.numSpotLightShadows),y.push(A.numSpotLightShadowsWithMaps),y.push(A.numLightProbes),y.push(A.shadowMapType),y.push(A.toneMapping),y.push(A.numClippingPlanes),y.push(A.numClipIntersection),y.push(A.depthPacking)}function F(y,A){a.disableAll(),A.supportsVertexTextures&&a.enable(0),A.instancing&&a.enable(1),A.instancingColor&&a.enable(2),A.instancingMorph&&a.enable(3),A.matcap&&a.enable(4),A.envMap&&a.enable(5),A.normalMapObjectSpace&&a.enable(6),A.normalMapTangentSpace&&a.enable(7),A.clearcoat&&a.enable(8),A.iridescence&&a.enable(9),A.alphaTest&&a.enable(10),A.vertexColors&&a.enable(11),A.vertexAlphas&&a.enable(12),A.vertexUv1s&&a.enable(13),A.vertexUv2s&&a.enable(14),A.vertexUv3s&&a.enable(15),A.vertexTangents&&a.enable(16),A.anisotropy&&a.enable(17),A.alphaHash&&a.enable(18),A.batching&&a.enable(19),A.dispersion&&a.enable(20),A.batchingColor&&a.enable(21),y.push(a.mask),a.disableAll(),A.fog&&a.enable(0),A.useFog&&a.enable(1),A.flatShading&&a.enable(2),A.logarithmicDepthBuffer&&a.enable(3),A.reverseDepthBuffer&&a.enable(4),A.skinning&&a.enable(5),A.morphTargets&&a.enable(6),A.morphNormals&&a.enable(7),A.morphColors&&a.enable(8),A.premultipliedAlpha&&a.enable(9),A.shadowMapEnabled&&a.enable(10),A.doubleSided&&a.enable(11),A.flipSided&&a.enable(12),A.useDepthPacking&&a.enable(13),A.dithering&&a.enable(14),A.transmission&&a.enable(15),A.sheen&&a.enable(16),A.opaque&&a.enable(17),A.pointsUvs&&a.enable(18),A.decodeVideoTexture&&a.enable(19),A.alphaToCoverage&&a.enable(20),y.push(a.mask)}function Q(y){const A=M[y.type];let Me;if(A){const ue=fn[A];Me=Xu.clone(ue.uniforms)}else Me=y.uniforms;return Me}function H(y,A){let Me;for(let ue=0,I=c.length;ue<I;ue++){const ie=c[ue];if(ie.cacheKey===A){Me=ie,++Me.usedTimes;break}}return Me===void 0&&(Me=new sm(n,A,y,s),c.push(Me)),Me}function V(y){if(--y.usedTimes===0){const A=c.indexOf(y);c[A]=c[c.length-1],c.pop(),y.destroy()}}function le(y){l.remove(y)}function Te(){l.dispose()}return{getParameters:g,getProgramCacheKey:P,getUniforms:Q,acquireProgram:H,releaseProgram:V,releaseShaderCache:le,programs:c,dispose:Te}}function um(){let n=new WeakMap;function e(o){return n.has(o)}function t(o){let a=n.get(o);return a===void 0&&(a={},n.set(o,a)),a}function i(o){n.delete(o)}function r(o,a,l){n.get(o)[a]=l}function s(){n=new WeakMap}return{has:e,get:t,remove:i,update:r,dispose:s}}function hm(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.z!==e.z?n.z-e.z:n.id-e.id}function Da(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function Ua(){const n=[];let e=0;const t=[],i=[],r=[];function s(){e=0,t.length=0,i.length=0,r.length=0}function o(h,f,p,v,M,m){let g=n[e];return g===void 0?(g={id:h.id,object:h,geometry:f,material:p,groupOrder:v,renderOrder:h.renderOrder,z:M,group:m},n[e]=g):(g.id=h.id,g.object=h,g.geometry=f,g.material=p,g.groupOrder=v,g.renderOrder=h.renderOrder,g.z=M,g.group=m),e++,g}function a(h,f,p,v,M,m){const g=o(h,f,p,v,M,m);p.transmission>0?i.push(g):p.transparent===!0?r.push(g):t.push(g)}function l(h,f,p,v,M,m){const g=o(h,f,p,v,M,m);p.transmission>0?i.unshift(g):p.transparent===!0?r.unshift(g):t.unshift(g)}function u(h,f){t.length>1&&t.sort(h||hm),i.length>1&&i.sort(f||Da),r.length>1&&r.sort(f||Da)}function c(){for(let h=e,f=n.length;h<f;h++){const p=n[h];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:i,transparent:r,init:s,push:a,unshift:l,finish:c,sort:u}}function fm(){let n=new WeakMap;function e(i,r){const s=n.get(i);let o;return s===void 0?(o=new Ua,n.set(i,[o])):r>=s.length?(o=new Ua,s.push(o)):o=s[r],o}function t(){n=new WeakMap}return{get:e,dispose:t}}function dm(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new ae,color:new ot};break;case"SpotLight":t={position:new ae,direction:new ae,color:new ot,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new ae,color:new ot,distance:0,decay:0};break;case"HemisphereLight":t={direction:new ae,skyColor:new ot,groundColor:new ot};break;case"RectAreaLight":t={color:new ot,position:new ae,halfWidth:new ae,halfHeight:new ae};break}return n[e.id]=t,t}}}function pm(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _t};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _t};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _t,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}let mm=0;function gm(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function _m(n){const e=new dm,t=pm(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let u=0;u<9;u++)i.probe.push(new ae);const r=new ae,s=new dt,o=new dt;function a(u){let c=0,h=0,f=0;for(let Te=0;Te<9;Te++)i.probe[Te].set(0,0,0);let p=0,v=0,M=0,m=0,g=0,P=0,L=0,F=0,Q=0,H=0,V=0;u.sort(gm);for(let Te=0,y=u.length;Te<y;Te++){const A=u[Te],Me=A.color,ue=A.intensity,I=A.distance,ie=A.shadow&&A.shadow.map?A.shadow.map.texture:null;if(A.isAmbientLight)c+=Me.r*ue,h+=Me.g*ue,f+=Me.b*ue;else if(A.isLightProbe){for(let x=0;x<9;x++)i.probe[x].addScaledVector(A.sh.coefficients[x],ue);V++}else if(A.isDirectionalLight){const x=e.get(A);if(x.color.copy(A.color).multiplyScalar(A.intensity),A.castShadow){const j=A.shadow,X=t.get(A);X.shadowIntensity=j.intensity,X.shadowBias=j.bias,X.shadowNormalBias=j.normalBias,X.shadowRadius=j.radius,X.shadowMapSize=j.mapSize,i.directionalShadow[p]=X,i.directionalShadowMap[p]=ie,i.directionalShadowMatrix[p]=A.shadow.matrix,P++}i.directional[p]=x,p++}else if(A.isSpotLight){const x=e.get(A);x.position.setFromMatrixPosition(A.matrixWorld),x.color.copy(Me).multiplyScalar(ue),x.distance=I,x.coneCos=Math.cos(A.angle),x.penumbraCos=Math.cos(A.angle*(1-A.penumbra)),x.decay=A.decay,i.spot[M]=x;const j=A.shadow;if(A.map&&(i.spotLightMap[Q]=A.map,Q++,j.updateMatrices(A),A.castShadow&&H++),i.spotLightMatrix[M]=j.matrix,A.castShadow){const X=t.get(A);X.shadowIntensity=j.intensity,X.shadowBias=j.bias,X.shadowNormalBias=j.normalBias,X.shadowRadius=j.radius,X.shadowMapSize=j.mapSize,i.spotShadow[M]=X,i.spotShadowMap[M]=ie,F++}M++}else if(A.isRectAreaLight){const x=e.get(A);x.color.copy(Me).multiplyScalar(ue),x.halfWidth.set(A.width*.5,0,0),x.halfHeight.set(0,A.height*.5,0),i.rectArea[m]=x,m++}else if(A.isPointLight){const x=e.get(A);if(x.color.copy(A.color).multiplyScalar(A.intensity),x.distance=A.distance,x.decay=A.decay,A.castShadow){const j=A.shadow,X=t.get(A);X.shadowIntensity=j.intensity,X.shadowBias=j.bias,X.shadowNormalBias=j.normalBias,X.shadowRadius=j.radius,X.shadowMapSize=j.mapSize,X.shadowCameraNear=j.camera.near,X.shadowCameraFar=j.camera.far,i.pointShadow[v]=X,i.pointShadowMap[v]=ie,i.pointShadowMatrix[v]=A.shadow.matrix,L++}i.point[v]=x,v++}else if(A.isHemisphereLight){const x=e.get(A);x.skyColor.copy(A.color).multiplyScalar(ue),x.groundColor.copy(A.groundColor).multiplyScalar(ue),i.hemi[g]=x,g++}}m>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=Ve.LTC_FLOAT_1,i.rectAreaLTC2=Ve.LTC_FLOAT_2):(i.rectAreaLTC1=Ve.LTC_HALF_1,i.rectAreaLTC2=Ve.LTC_HALF_2)),i.ambient[0]=c,i.ambient[1]=h,i.ambient[2]=f;const le=i.hash;(le.directionalLength!==p||le.pointLength!==v||le.spotLength!==M||le.rectAreaLength!==m||le.hemiLength!==g||le.numDirectionalShadows!==P||le.numPointShadows!==L||le.numSpotShadows!==F||le.numSpotMaps!==Q||le.numLightProbes!==V)&&(i.directional.length=p,i.spot.length=M,i.rectArea.length=m,i.point.length=v,i.hemi.length=g,i.directionalShadow.length=P,i.directionalShadowMap.length=P,i.pointShadow.length=L,i.pointShadowMap.length=L,i.spotShadow.length=F,i.spotShadowMap.length=F,i.directionalShadowMatrix.length=P,i.pointShadowMatrix.length=L,i.spotLightMatrix.length=F+Q-H,i.spotLightMap.length=Q,i.numSpotLightShadowsWithMaps=H,i.numLightProbes=V,le.directionalLength=p,le.pointLength=v,le.spotLength=M,le.rectAreaLength=m,le.hemiLength=g,le.numDirectionalShadows=P,le.numPointShadows=L,le.numSpotShadows=F,le.numSpotMaps=Q,le.numLightProbes=V,i.version=mm++)}function l(u,c){let h=0,f=0,p=0,v=0,M=0;const m=c.matrixWorldInverse;for(let g=0,P=u.length;g<P;g++){const L=u[g];if(L.isDirectionalLight){const F=i.directional[h];F.direction.setFromMatrixPosition(L.matrixWorld),r.setFromMatrixPosition(L.target.matrixWorld),F.direction.sub(r),F.direction.transformDirection(m),h++}else if(L.isSpotLight){const F=i.spot[p];F.position.setFromMatrixPosition(L.matrixWorld),F.position.applyMatrix4(m),F.direction.setFromMatrixPosition(L.matrixWorld),r.setFromMatrixPosition(L.target.matrixWorld),F.direction.sub(r),F.direction.transformDirection(m),p++}else if(L.isRectAreaLight){const F=i.rectArea[v];F.position.setFromMatrixPosition(L.matrixWorld),F.position.applyMatrix4(m),o.identity(),s.copy(L.matrixWorld),s.premultiply(m),o.extractRotation(s),F.halfWidth.set(L.width*.5,0,0),F.halfHeight.set(0,L.height*.5,0),F.halfWidth.applyMatrix4(o),F.halfHeight.applyMatrix4(o),v++}else if(L.isPointLight){const F=i.point[f];F.position.setFromMatrixPosition(L.matrixWorld),F.position.applyMatrix4(m),f++}else if(L.isHemisphereLight){const F=i.hemi[M];F.direction.setFromMatrixPosition(L.matrixWorld),F.direction.transformDirection(m),M++}}}return{setup:a,setupView:l,state:i}}function Na(n){const e=new _m(n),t=[],i=[];function r(c){u.camera=c,t.length=0,i.length=0}function s(c){t.push(c)}function o(c){i.push(c)}function a(){e.setup(t)}function l(c){e.setupView(t,c)}const u={lightsArray:t,shadowsArray:i,camera:null,lights:e,transmissionRenderTarget:{}};return{init:r,state:u,setupLights:a,setupLightsView:l,pushLight:s,pushShadow:o}}function xm(n){let e=new WeakMap;function t(r,s=0){const o=e.get(r);let a;return o===void 0?(a=new Na(n),e.set(r,[a])):s>=o.length?(a=new Na(n),o.push(a)):a=o[s],a}function i(){e=new WeakMap}return{get:t,dispose:i}}class vm extends tr{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Jc,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Mm extends tr{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}const ym=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Sm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function bm(n,e,t){let i=new Yr;const r=new _t,s=new _t,o=new Et,a=new vm({depthPacking:Qc}),l=new Mm,u={},c=t.maxTextureSize,h={[An]:qt,[qt]:An,[dn]:dn},f=new Hn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new _t},radius:{value:4}},vertexShader:ym,fragmentShader:Sm}),p=f.clone();p.defines.HORIZONTAL_PASS=1;const v=new gn;v.setAttribute("position",new Yt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const M=new Xt(v,f),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=_l;let g=this.type;this.render=function(H,V,le){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||H.length===0)return;const Te=n.getRenderTarget(),y=n.getActiveCubeFace(),A=n.getActiveMipmapLevel(),Me=n.state;Me.setBlending(zn),Me.buffers.color.setClear(1,1,1,1),Me.buffers.depth.setTest(!0),Me.setScissorTest(!1);const ue=g!==Sn&&this.type===Sn,I=g===Sn&&this.type!==Sn;for(let ie=0,x=H.length;ie<x;ie++){const j=H[ie],X=j.shadow;if(X===void 0){console.warn("THREE.WebGLShadowMap:",j,"has no shadow.");continue}if(X.autoUpdate===!1&&X.needsUpdate===!1)continue;r.copy(X.mapSize);const ce=X.getFrameExtents();if(r.multiply(ce),s.copy(X.mapSize),(r.x>c||r.y>c)&&(r.x>c&&(s.x=Math.floor(c/ce.x),r.x=s.x*ce.x,X.mapSize.x=s.x),r.y>c&&(s.y=Math.floor(c/ce.y),r.y=s.y*ce.y,X.mapSize.y=s.y)),X.map===null||ue===!0||I===!0){const U=this.type!==Sn?{minFilter:Ot,magFilter:Ot}:{};X.map!==null&&X.map.dispose(),X.map=new ai(r.x,r.y,U),X.map.texture.name=j.name+".shadowMap",X.camera.updateProjectionMatrix()}n.setRenderTarget(X.map),n.clear();const N=X.getViewportCount();for(let U=0;U<N;U++){const k=X.getViewport(U);o.set(s.x*k.x,s.y*k.y,s.x*k.z,s.y*k.w),Me.viewport(o),X.updateMatrices(j,U),i=X.getFrustum(),F(V,le,X.camera,j,this.type)}X.isPointLightShadow!==!0&&this.type===Sn&&P(X,le),X.needsUpdate=!1}g=this.type,m.needsUpdate=!1,n.setRenderTarget(Te,y,A)};function P(H,V){const le=e.update(M);f.defines.VSM_SAMPLES!==H.blurSamples&&(f.defines.VSM_SAMPLES=H.blurSamples,p.defines.VSM_SAMPLES=H.blurSamples,f.needsUpdate=!0,p.needsUpdate=!0),H.mapPass===null&&(H.mapPass=new ai(r.x,r.y)),f.uniforms.shadow_pass.value=H.map.texture,f.uniforms.resolution.value=H.mapSize,f.uniforms.radius.value=H.radius,n.setRenderTarget(H.mapPass),n.clear(),n.renderBufferDirect(V,null,le,f,M,null),p.uniforms.shadow_pass.value=H.mapPass.texture,p.uniforms.resolution.value=H.mapSize,p.uniforms.radius.value=H.radius,n.setRenderTarget(H.map),n.clear(),n.renderBufferDirect(V,null,le,p,M,null)}function L(H,V,le,Te){let y=null;const A=le.isPointLight===!0?H.customDistanceMaterial:H.customDepthMaterial;if(A!==void 0)y=A;else if(y=le.isPointLight===!0?l:a,n.localClippingEnabled&&V.clipShadows===!0&&Array.isArray(V.clippingPlanes)&&V.clippingPlanes.length!==0||V.displacementMap&&V.displacementScale!==0||V.alphaMap&&V.alphaTest>0||V.map&&V.alphaTest>0){const Me=y.uuid,ue=V.uuid;let I=u[Me];I===void 0&&(I={},u[Me]=I);let ie=I[ue];ie===void 0&&(ie=y.clone(),I[ue]=ie,V.addEventListener("dispose",Q)),y=ie}if(y.visible=V.visible,y.wireframe=V.wireframe,Te===Sn?y.side=V.shadowSide!==null?V.shadowSide:V.side:y.side=V.shadowSide!==null?V.shadowSide:h[V.side],y.alphaMap=V.alphaMap,y.alphaTest=V.alphaTest,y.map=V.map,y.clipShadows=V.clipShadows,y.clippingPlanes=V.clippingPlanes,y.clipIntersection=V.clipIntersection,y.displacementMap=V.displacementMap,y.displacementScale=V.displacementScale,y.displacementBias=V.displacementBias,y.wireframeLinewidth=V.wireframeLinewidth,y.linewidth=V.linewidth,le.isPointLight===!0&&y.isMeshDistanceMaterial===!0){const Me=n.properties.get(y);Me.light=le}return y}function F(H,V,le,Te,y){if(H.visible===!1)return;if(H.layers.test(V.layers)&&(H.isMesh||H.isLine||H.isPoints)&&(H.castShadow||H.receiveShadow&&y===Sn)&&(!H.frustumCulled||i.intersectsObject(H))){H.modelViewMatrix.multiplyMatrices(le.matrixWorldInverse,H.matrixWorld);const ue=e.update(H),I=H.material;if(Array.isArray(I)){const ie=ue.groups;for(let x=0,j=ie.length;x<j;x++){const X=ie[x],ce=I[X.materialIndex];if(ce&&ce.visible){const N=L(H,ce,Te,y);H.onBeforeShadow(n,H,V,le,ue,N,X),n.renderBufferDirect(le,null,ue,N,H,X),H.onAfterShadow(n,H,V,le,ue,N,X)}}}else if(I.visible){const ie=L(H,I,Te,y);H.onBeforeShadow(n,H,V,le,ue,ie,null),n.renderBufferDirect(le,null,ue,ie,H,null),H.onAfterShadow(n,H,V,le,ue,ie,null)}}const Me=H.children;for(let ue=0,I=Me.length;ue<I;ue++)F(Me[ue],V,le,Te,y)}function Q(H){H.target.removeEventListener("dispose",Q);for(const le in u){const Te=u[le],y=H.target.uuid;y in Te&&(Te[y].dispose(),delete Te[y])}}}const Em={[Os]:zs,[Bs]:Gs,[ks]:Vs,[Li]:Hs,[zs]:Os,[Gs]:Bs,[Vs]:ks,[Hs]:Li};function wm(n){function e(){let oe=!1;const d=new Et;let _=null;const b=new Et(0,0,0,0);return{setMask:function(z){_!==z&&!oe&&(n.colorMask(z,z,z,z),_=z)},setLocked:function(z){oe=z},setClear:function(z,B,pe,_e,Ee){Ee===!0&&(z*=_e,B*=_e,pe*=_e),d.set(z,B,pe,_e),b.equals(d)===!1&&(n.clearColor(z,B,pe,_e),b.copy(d))},reset:function(){oe=!1,_=null,b.set(-1,0,0,0)}}}function t(){let oe=!1,d=!1,_=null,b=null,z=null;return{setReversed:function(B){d=B},setTest:function(B){B?O(n.DEPTH_TEST):G(n.DEPTH_TEST)},setMask:function(B){_!==B&&!oe&&(n.depthMask(B),_=B)},setFunc:function(B){if(d&&(B=Em[B]),b!==B){switch(B){case Os:n.depthFunc(n.NEVER);break;case zs:n.depthFunc(n.ALWAYS);break;case Bs:n.depthFunc(n.LESS);break;case Li:n.depthFunc(n.LEQUAL);break;case ks:n.depthFunc(n.EQUAL);break;case Hs:n.depthFunc(n.GEQUAL);break;case Gs:n.depthFunc(n.GREATER);break;case Vs:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}b=B}},setLocked:function(B){oe=B},setClear:function(B){z!==B&&(n.clearDepth(B),z=B)},reset:function(){oe=!1,_=null,b=null,z=null}}}function i(){let oe=!1,d=null,_=null,b=null,z=null,B=null,pe=null,_e=null,Ee=null;return{setTest:function(ge){oe||(ge?O(n.STENCIL_TEST):G(n.STENCIL_TEST))},setMask:function(ge){d!==ge&&!oe&&(n.stencilMask(ge),d=ge)},setFunc:function(ge,xe,Se){(_!==ge||b!==xe||z!==Se)&&(n.stencilFunc(ge,xe,Se),_=ge,b=xe,z=Se)},setOp:function(ge,xe,Se){(B!==ge||pe!==xe||_e!==Se)&&(n.stencilOp(ge,xe,Se),B=ge,pe=xe,_e=Se)},setLocked:function(ge){oe=ge},setClear:function(ge){Ee!==ge&&(n.clearStencil(ge),Ee=ge)},reset:function(){oe=!1,d=null,_=null,b=null,z=null,B=null,pe=null,_e=null,Ee=null}}}const r=new e,s=new t,o=new i,a=new WeakMap,l=new WeakMap;let u={},c={},h=new WeakMap,f=[],p=null,v=!1,M=null,m=null,g=null,P=null,L=null,F=null,Q=null,H=new ot(0,0,0),V=0,le=!1,Te=null,y=null,A=null,Me=null,ue=null;const I=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let ie=!1,x=0;const j=n.getParameter(n.VERSION);j.indexOf("WebGL")!==-1?(x=parseFloat(/^WebGL (\d)/.exec(j)[1]),ie=x>=1):j.indexOf("OpenGL ES")!==-1&&(x=parseFloat(/^OpenGL ES (\d)/.exec(j)[1]),ie=x>=2);let X=null,ce={};const N=n.getParameter(n.SCISSOR_BOX),U=n.getParameter(n.VIEWPORT),k=new Et().fromArray(N),te=new Et().fromArray(U);function T(oe,d,_,b){const z=new Uint8Array(4),B=n.createTexture();n.bindTexture(oe,B),n.texParameteri(oe,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(oe,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let pe=0;pe<_;pe++)oe===n.TEXTURE_3D||oe===n.TEXTURE_2D_ARRAY?n.texImage3D(d,0,n.RGBA,1,1,b,0,n.RGBA,n.UNSIGNED_BYTE,z):n.texImage2D(d+pe,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,z);return B}const D={};D[n.TEXTURE_2D]=T(n.TEXTURE_2D,n.TEXTURE_2D,1),D[n.TEXTURE_CUBE_MAP]=T(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),D[n.TEXTURE_2D_ARRAY]=T(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),D[n.TEXTURE_3D]=T(n.TEXTURE_3D,n.TEXTURE_3D,1,1),r.setClear(0,0,0,1),s.setClear(1),o.setClear(0),O(n.DEPTH_TEST),s.setFunc(Li),he(!1),ye(Ho),O(n.CULL_FACE),R(zn);function O(oe){u[oe]!==!0&&(n.enable(oe),u[oe]=!0)}function G(oe){u[oe]!==!1&&(n.disable(oe),u[oe]=!1)}function ne(oe,d){return c[oe]!==d?(n.bindFramebuffer(oe,d),c[oe]=d,oe===n.DRAW_FRAMEBUFFER&&(c[n.FRAMEBUFFER]=d),oe===n.FRAMEBUFFER&&(c[n.DRAW_FRAMEBUFFER]=d),!0):!1}function Z(oe,d){let _=f,b=!1;if(oe){_=h.get(d),_===void 0&&(_=[],h.set(d,_));const z=oe.textures;if(_.length!==z.length||_[0]!==n.COLOR_ATTACHMENT0){for(let B=0,pe=z.length;B<pe;B++)_[B]=n.COLOR_ATTACHMENT0+B;_.length=z.length,b=!0}}else _[0]!==n.BACK&&(_[0]=n.BACK,b=!0);b&&n.drawBuffers(_)}function q(oe){return p!==oe?(n.useProgram(oe),p=oe,!0):!1}const J={[ni]:n.FUNC_ADD,[wc]:n.FUNC_SUBTRACT,[Tc]:n.FUNC_REVERSE_SUBTRACT};J[Ac]=n.MIN,J[Rc]=n.MAX;const re={[Cc]:n.ZERO,[Pc]:n.ONE,[Lc]:n.SRC_COLOR,[Ns]:n.SRC_ALPHA,[Oc]:n.SRC_ALPHA_SATURATE,[Nc]:n.DST_COLOR,[Dc]:n.DST_ALPHA,[Ic]:n.ONE_MINUS_SRC_COLOR,[Fs]:n.ONE_MINUS_SRC_ALPHA,[Fc]:n.ONE_MINUS_DST_COLOR,[Uc]:n.ONE_MINUS_DST_ALPHA,[zc]:n.CONSTANT_COLOR,[Bc]:n.ONE_MINUS_CONSTANT_COLOR,[kc]:n.CONSTANT_ALPHA,[Hc]:n.ONE_MINUS_CONSTANT_ALPHA};function R(oe,d,_,b,z,B,pe,_e,Ee,ge){if(oe===zn){v===!0&&(G(n.BLEND),v=!1);return}if(v===!1&&(O(n.BLEND),v=!0),oe!==Ec){if(oe!==M||ge!==le){if((m!==ni||L!==ni)&&(n.blendEquation(n.FUNC_ADD),m=ni,L=ni),ge)switch(oe){case Ri:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Go:n.blendFunc(n.ONE,n.ONE);break;case Vo:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Wo:n.blendFuncSeparate(n.ZERO,n.SRC_COLOR,n.ZERO,n.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",oe);break}else switch(oe){case Ri:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Go:n.blendFunc(n.SRC_ALPHA,n.ONE);break;case Vo:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Wo:n.blendFunc(n.ZERO,n.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",oe);break}g=null,P=null,F=null,Q=null,H.set(0,0,0),V=0,M=oe,le=ge}return}z=z||d,B=B||_,pe=pe||b,(d!==m||z!==L)&&(n.blendEquationSeparate(J[d],J[z]),m=d,L=z),(_!==g||b!==P||B!==F||pe!==Q)&&(n.blendFuncSeparate(re[_],re[b],re[B],re[pe]),g=_,P=b,F=B,Q=pe),(_e.equals(H)===!1||Ee!==V)&&(n.blendColor(_e.r,_e.g,_e.b,Ee),H.copy(_e),V=Ee),M=oe,le=!1}function $(oe,d){oe.side===dn?G(n.CULL_FACE):O(n.CULL_FACE);let _=oe.side===qt;d&&(_=!_),he(_),oe.blending===Ri&&oe.transparent===!1?R(zn):R(oe.blending,oe.blendEquation,oe.blendSrc,oe.blendDst,oe.blendEquationAlpha,oe.blendSrcAlpha,oe.blendDstAlpha,oe.blendColor,oe.blendAlpha,oe.premultipliedAlpha),s.setFunc(oe.depthFunc),s.setTest(oe.depthTest),s.setMask(oe.depthWrite),r.setMask(oe.colorWrite);const b=oe.stencilWrite;o.setTest(b),b&&(o.setMask(oe.stencilWriteMask),o.setFunc(oe.stencilFunc,oe.stencilRef,oe.stencilFuncMask),o.setOp(oe.stencilFail,oe.stencilZFail,oe.stencilZPass)),fe(oe.polygonOffset,oe.polygonOffsetFactor,oe.polygonOffsetUnits),oe.alphaToCoverage===!0?O(n.SAMPLE_ALPHA_TO_COVERAGE):G(n.SAMPLE_ALPHA_TO_COVERAGE)}function he(oe){Te!==oe&&(oe?n.frontFace(n.CW):n.frontFace(n.CCW),Te=oe)}function ye(oe){oe!==Sc?(O(n.CULL_FACE),oe!==y&&(oe===Ho?n.cullFace(n.BACK):oe===bc?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):G(n.CULL_FACE),y=oe}function Pe(oe){oe!==A&&(ie&&n.lineWidth(oe),A=oe)}function fe(oe,d,_){oe?(O(n.POLYGON_OFFSET_FILL),(Me!==d||ue!==_)&&(n.polygonOffset(d,_),Me=d,ue=_)):G(n.POLYGON_OFFSET_FILL)}function Ce(oe){oe?O(n.SCISSOR_TEST):G(n.SCISSOR_TEST)}function C(oe){oe===void 0&&(oe=n.TEXTURE0+I-1),X!==oe&&(n.activeTexture(oe),X=oe)}function S(oe,d,_){_===void 0&&(X===null?_=n.TEXTURE0+I-1:_=X);let b=ce[_];b===void 0&&(b={type:void 0,texture:void 0},ce[_]=b),(b.type!==oe||b.texture!==d)&&(X!==_&&(n.activeTexture(_),X=_),n.bindTexture(oe,d||D[oe]),b.type=oe,b.texture=d)}function se(){const oe=ce[X];oe!==void 0&&oe.type!==void 0&&(n.bindTexture(oe.type,null),oe.type=void 0,oe.texture=void 0)}function me(){try{n.compressedTexImage2D.apply(n,arguments)}catch(oe){console.error("THREE.WebGLState:",oe)}}function Ae(){try{n.compressedTexImage3D.apply(n,arguments)}catch(oe){console.error("THREE.WebGLState:",oe)}}function ee(){try{n.texSubImage2D.apply(n,arguments)}catch(oe){console.error("THREE.WebGLState:",oe)}}function Ie(){try{n.texSubImage3D.apply(n,arguments)}catch(oe){console.error("THREE.WebGLState:",oe)}}function Le(){try{n.compressedTexSubImage2D.apply(n,arguments)}catch(oe){console.error("THREE.WebGLState:",oe)}}function Be(){try{n.compressedTexSubImage3D.apply(n,arguments)}catch(oe){console.error("THREE.WebGLState:",oe)}}function $e(){try{n.texStorage2D.apply(n,arguments)}catch(oe){console.error("THREE.WebGLState:",oe)}}function Ne(){try{n.texStorage3D.apply(n,arguments)}catch(oe){console.error("THREE.WebGLState:",oe)}}function Fe(){try{n.texImage2D.apply(n,arguments)}catch(oe){console.error("THREE.WebGLState:",oe)}}function tt(){try{n.texImage3D.apply(n,arguments)}catch(oe){console.error("THREE.WebGLState:",oe)}}function it(oe){k.equals(oe)===!1&&(n.scissor(oe.x,oe.y,oe.z,oe.w),k.copy(oe))}function Ge(oe){te.equals(oe)===!1&&(n.viewport(oe.x,oe.y,oe.z,oe.w),te.copy(oe))}function at(oe,d){let _=l.get(d);_===void 0&&(_=new WeakMap,l.set(d,_));let b=_.get(oe);b===void 0&&(b=n.getUniformBlockIndex(d,oe.name),_.set(oe,b))}function rt(oe,d){const b=l.get(d).get(oe);a.get(d)!==b&&(n.uniformBlockBinding(d,b,oe.__bindingPointIndex),a.set(d,b))}function mt(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),u={},X=null,ce={},c={},h=new WeakMap,f=[],p=null,v=!1,M=null,m=null,g=null,P=null,L=null,F=null,Q=null,H=new ot(0,0,0),V=0,le=!1,Te=null,y=null,A=null,Me=null,ue=null,k.set(0,0,n.canvas.width,n.canvas.height),te.set(0,0,n.canvas.width,n.canvas.height),r.reset(),s.reset(),o.reset()}return{buffers:{color:r,depth:s,stencil:o},enable:O,disable:G,bindFramebuffer:ne,drawBuffers:Z,useProgram:q,setBlending:R,setMaterial:$,setFlipSided:he,setCullFace:ye,setLineWidth:Pe,setPolygonOffset:fe,setScissorTest:Ce,activeTexture:C,bindTexture:S,unbindTexture:se,compressedTexImage2D:me,compressedTexImage3D:Ae,texImage2D:Fe,texImage3D:tt,updateUBOMapping:at,uniformBlockBinding:rt,texStorage2D:$e,texStorage3D:Ne,texSubImage2D:ee,texSubImage3D:Ie,compressedTexSubImage2D:Le,compressedTexSubImage3D:Be,scissor:it,viewport:Ge,reset:mt}}function Fa(n,e,t,i){const r=Tm(i);switch(t){case wl:return n*e;case Al:return n*e;case Rl:return n*e*2;case Co:return n*e/r.components*r.byteLength;case Po:return n*e/r.components*r.byteLength;case Cl:return n*e*2/r.components*r.byteLength;case Lo:return n*e*2/r.components*r.byteLength;case Tl:return n*e*3/r.components*r.byteLength;case en:return n*e*4/r.components*r.byteLength;case Io:return n*e*4/r.components*r.byteLength;case Lr:case Ir:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Dr:case Ur:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Ys:case js:return Math.max(n,16)*Math.max(e,8)/4;case qs:case $s:return Math.max(n,8)*Math.max(e,8)/2;case Ks:case Zs:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Js:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Qs:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case eo:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case to:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case no:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case io:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case ro:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case so:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case oo:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case ao:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case lo:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case co:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case uo:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case ho:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case fo:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Nr:case po:case mo:return Math.ceil(n/4)*Math.ceil(e/4)*16;case Pl:case go:return Math.ceil(n/4)*Math.ceil(e/4)*8;case _o:case xo:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Tm(n){switch(n){case Rn:case Sl:return{byteLength:1,components:1};case Zi:case bl:case er:return{byteLength:2,components:1};case Ao:case Ro:return{byteLength:2,components:4};case oi:case To:case ln:return{byteLength:4,components:1};case El:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${n}.`)}function Am(n,e,t,i,r,s,o){const a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),u=new _t,c=new WeakMap;let h;const f=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function v(C,S){return p?new OffscreenCanvas(C,S):Qi("canvas")}function M(C,S,se){let me=1;const Ae=Ce(C);if((Ae.width>se||Ae.height>se)&&(me=se/Math.max(Ae.width,Ae.height)),me<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){const ee=Math.floor(me*Ae.width),Ie=Math.floor(me*Ae.height);h===void 0&&(h=v(ee,Ie));const Le=S?v(ee,Ie):h;return Le.width=ee,Le.height=Ie,Le.getContext("2d").drawImage(C,0,0,ee,Ie),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+Ae.width+"x"+Ae.height+") to ("+ee+"x"+Ie+")."),Le}else return"data"in C&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+Ae.width+"x"+Ae.height+")."),C;return C}function m(C){return C.generateMipmaps&&C.minFilter!==Ot&&C.minFilter!==Kt}function g(C){n.generateMipmap(C)}function P(C,S,se,me,Ae=!1){if(C!==null){if(n[C]!==void 0)return n[C];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let ee=S;if(S===n.RED&&(se===n.FLOAT&&(ee=n.R32F),se===n.HALF_FLOAT&&(ee=n.R16F),se===n.UNSIGNED_BYTE&&(ee=n.R8)),S===n.RED_INTEGER&&(se===n.UNSIGNED_BYTE&&(ee=n.R8UI),se===n.UNSIGNED_SHORT&&(ee=n.R16UI),se===n.UNSIGNED_INT&&(ee=n.R32UI),se===n.BYTE&&(ee=n.R8I),se===n.SHORT&&(ee=n.R16I),se===n.INT&&(ee=n.R32I)),S===n.RG&&(se===n.FLOAT&&(ee=n.RG32F),se===n.HALF_FLOAT&&(ee=n.RG16F),se===n.UNSIGNED_BYTE&&(ee=n.RG8)),S===n.RG_INTEGER&&(se===n.UNSIGNED_BYTE&&(ee=n.RG8UI),se===n.UNSIGNED_SHORT&&(ee=n.RG16UI),se===n.UNSIGNED_INT&&(ee=n.RG32UI),se===n.BYTE&&(ee=n.RG8I),se===n.SHORT&&(ee=n.RG16I),se===n.INT&&(ee=n.RG32I)),S===n.RGB_INTEGER&&(se===n.UNSIGNED_BYTE&&(ee=n.RGB8UI),se===n.UNSIGNED_SHORT&&(ee=n.RGB16UI),se===n.UNSIGNED_INT&&(ee=n.RGB32UI),se===n.BYTE&&(ee=n.RGB8I),se===n.SHORT&&(ee=n.RGB16I),se===n.INT&&(ee=n.RGB32I)),S===n.RGBA_INTEGER&&(se===n.UNSIGNED_BYTE&&(ee=n.RGBA8UI),se===n.UNSIGNED_SHORT&&(ee=n.RGBA16UI),se===n.UNSIGNED_INT&&(ee=n.RGBA32UI),se===n.BYTE&&(ee=n.RGBA8I),se===n.SHORT&&(ee=n.RGBA16I),se===n.INT&&(ee=n.RGBA32I)),S===n.RGB&&se===n.UNSIGNED_INT_5_9_9_9_REV&&(ee=n.RGB9_E5),S===n.RGBA){const Ie=Ae?kr:xt.getTransfer(me);se===n.FLOAT&&(ee=n.RGBA32F),se===n.HALF_FLOAT&&(ee=n.RGBA16F),se===n.UNSIGNED_BYTE&&(ee=Ie===bt?n.SRGB8_ALPHA8:n.RGBA8),se===n.UNSIGNED_SHORT_4_4_4_4&&(ee=n.RGBA4),se===n.UNSIGNED_SHORT_5_5_5_1&&(ee=n.RGB5_A1)}return(ee===n.R16F||ee===n.R32F||ee===n.RG16F||ee===n.RG32F||ee===n.RGBA16F||ee===n.RGBA32F)&&e.get("EXT_color_buffer_float"),ee}function L(C,S){let se;return C?S===null||S===oi||S===Ui?se=n.DEPTH24_STENCIL8:S===ln?se=n.DEPTH32F_STENCIL8:S===Zi&&(se=n.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):S===null||S===oi||S===Ui?se=n.DEPTH_COMPONENT24:S===ln?se=n.DEPTH_COMPONENT32F:S===Zi&&(se=n.DEPTH_COMPONENT16),se}function F(C,S){return m(C)===!0||C.isFramebufferTexture&&C.minFilter!==Ot&&C.minFilter!==Kt?Math.log2(Math.max(S.width,S.height))+1:C.mipmaps!==void 0&&C.mipmaps.length>0?C.mipmaps.length:C.isCompressedTexture&&Array.isArray(C.image)?S.mipmaps.length:1}function Q(C){const S=C.target;S.removeEventListener("dispose",Q),V(S),S.isVideoTexture&&c.delete(S)}function H(C){const S=C.target;S.removeEventListener("dispose",H),Te(S)}function V(C){const S=i.get(C);if(S.__webglInit===void 0)return;const se=C.source,me=f.get(se);if(me){const Ae=me[S.__cacheKey];Ae.usedTimes--,Ae.usedTimes===0&&le(C),Object.keys(me).length===0&&f.delete(se)}i.remove(C)}function le(C){const S=i.get(C);n.deleteTexture(S.__webglTexture);const se=C.source,me=f.get(se);delete me[S.__cacheKey],o.memory.textures--}function Te(C){const S=i.get(C);if(C.depthTexture&&C.depthTexture.dispose(),C.isWebGLCubeRenderTarget)for(let me=0;me<6;me++){if(Array.isArray(S.__webglFramebuffer[me]))for(let Ae=0;Ae<S.__webglFramebuffer[me].length;Ae++)n.deleteFramebuffer(S.__webglFramebuffer[me][Ae]);else n.deleteFramebuffer(S.__webglFramebuffer[me]);S.__webglDepthbuffer&&n.deleteRenderbuffer(S.__webglDepthbuffer[me])}else{if(Array.isArray(S.__webglFramebuffer))for(let me=0;me<S.__webglFramebuffer.length;me++)n.deleteFramebuffer(S.__webglFramebuffer[me]);else n.deleteFramebuffer(S.__webglFramebuffer);if(S.__webglDepthbuffer&&n.deleteRenderbuffer(S.__webglDepthbuffer),S.__webglMultisampledFramebuffer&&n.deleteFramebuffer(S.__webglMultisampledFramebuffer),S.__webglColorRenderbuffer)for(let me=0;me<S.__webglColorRenderbuffer.length;me++)S.__webglColorRenderbuffer[me]&&n.deleteRenderbuffer(S.__webglColorRenderbuffer[me]);S.__webglDepthRenderbuffer&&n.deleteRenderbuffer(S.__webglDepthRenderbuffer)}const se=C.textures;for(let me=0,Ae=se.length;me<Ae;me++){const ee=i.get(se[me]);ee.__webglTexture&&(n.deleteTexture(ee.__webglTexture),o.memory.textures--),i.remove(se[me])}i.remove(C)}let y=0;function A(){y=0}function Me(){const C=y;return C>=r.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+C+" texture units while this GPU supports only "+r.maxTextures),y+=1,C}function ue(C){const S=[];return S.push(C.wrapS),S.push(C.wrapT),S.push(C.wrapR||0),S.push(C.magFilter),S.push(C.minFilter),S.push(C.anisotropy),S.push(C.internalFormat),S.push(C.format),S.push(C.type),S.push(C.generateMipmaps),S.push(C.premultiplyAlpha),S.push(C.flipY),S.push(C.unpackAlignment),S.push(C.colorSpace),S.join()}function I(C,S){const se=i.get(C);if(C.isVideoTexture&&Pe(C),C.isRenderTargetTexture===!1&&C.version>0&&se.__version!==C.version){const me=C.image;if(me===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(me.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{te(se,C,S);return}}t.bindTexture(n.TEXTURE_2D,se.__webglTexture,n.TEXTURE0+S)}function ie(C,S){const se=i.get(C);if(C.version>0&&se.__version!==C.version){te(se,C,S);return}t.bindTexture(n.TEXTURE_2D_ARRAY,se.__webglTexture,n.TEXTURE0+S)}function x(C,S){const se=i.get(C);if(C.version>0&&se.__version!==C.version){te(se,C,S);return}t.bindTexture(n.TEXTURE_3D,se.__webglTexture,n.TEXTURE0+S)}function j(C,S){const se=i.get(C);if(C.version>0&&se.__version!==C.version){T(se,C,S);return}t.bindTexture(n.TEXTURE_CUBE_MAP,se.__webglTexture,n.TEXTURE0+S)}const X={[zr]:n.REPEAT,[Fn]:n.CLAMP_TO_EDGE,[Br]:n.MIRRORED_REPEAT},ce={[Ot]:n.NEAREST,[Zc]:n.NEAREST_MIPMAP_NEAREST,[Yi]:n.NEAREST_MIPMAP_LINEAR,[Kt]:n.LINEAR,[Zr]:n.LINEAR_MIPMAP_NEAREST,[On]:n.LINEAR_MIPMAP_LINEAR},N={[tu]:n.NEVER,[au]:n.ALWAYS,[nu]:n.LESS,[Il]:n.LEQUAL,[iu]:n.EQUAL,[ou]:n.GEQUAL,[ru]:n.GREATER,[su]:n.NOTEQUAL};function U(C,S){if(S.type===ln&&e.has("OES_texture_float_linear")===!1&&(S.magFilter===Kt||S.magFilter===Zr||S.magFilter===Yi||S.magFilter===On||S.minFilter===Kt||S.minFilter===Zr||S.minFilter===Yi||S.minFilter===On)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(C,n.TEXTURE_WRAP_S,X[S.wrapS]),n.texParameteri(C,n.TEXTURE_WRAP_T,X[S.wrapT]),(C===n.TEXTURE_3D||C===n.TEXTURE_2D_ARRAY)&&n.texParameteri(C,n.TEXTURE_WRAP_R,X[S.wrapR]),n.texParameteri(C,n.TEXTURE_MAG_FILTER,ce[S.magFilter]),n.texParameteri(C,n.TEXTURE_MIN_FILTER,ce[S.minFilter]),S.compareFunction&&(n.texParameteri(C,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(C,n.TEXTURE_COMPARE_FUNC,N[S.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(S.magFilter===Ot||S.minFilter!==Yi&&S.minFilter!==On||S.type===ln&&e.has("OES_texture_float_linear")===!1)return;if(S.anisotropy>1||i.get(S).__currentAnisotropy){const se=e.get("EXT_texture_filter_anisotropic");n.texParameterf(C,se.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,r.getMaxAnisotropy())),i.get(S).__currentAnisotropy=S.anisotropy}}}function k(C,S){let se=!1;C.__webglInit===void 0&&(C.__webglInit=!0,S.addEventListener("dispose",Q));const me=S.source;let Ae=f.get(me);Ae===void 0&&(Ae={},f.set(me,Ae));const ee=ue(S);if(ee!==C.__cacheKey){Ae[ee]===void 0&&(Ae[ee]={texture:n.createTexture(),usedTimes:0},o.memory.textures++,se=!0),Ae[ee].usedTimes++;const Ie=Ae[C.__cacheKey];Ie!==void 0&&(Ae[C.__cacheKey].usedTimes--,Ie.usedTimes===0&&le(S)),C.__cacheKey=ee,C.__webglTexture=Ae[ee].texture}return se}function te(C,S,se){let me=n.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(me=n.TEXTURE_2D_ARRAY),S.isData3DTexture&&(me=n.TEXTURE_3D);const Ae=k(C,S),ee=S.source;t.bindTexture(me,C.__webglTexture,n.TEXTURE0+se);const Ie=i.get(ee);if(ee.version!==Ie.__version||Ae===!0){t.activeTexture(n.TEXTURE0+se);const Le=xt.getPrimaries(xt.workingColorSpace),Be=S.colorSpace===bn?null:xt.getPrimaries(S.colorSpace),$e=S.colorSpace===bn||Le===Be?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,S.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,S.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,$e);let Ne=M(S.image,!1,r.maxTextureSize);Ne=fe(S,Ne);const Fe=s.convert(S.format,S.colorSpace),tt=s.convert(S.type);let it=P(S.internalFormat,Fe,tt,S.colorSpace,S.isVideoTexture);U(me,S);let Ge;const at=S.mipmaps,rt=S.isVideoTexture!==!0,mt=Ie.__version===void 0||Ae===!0,oe=ee.dataReady,d=F(S,Ne);if(S.isDepthTexture)it=L(S.format===Ni,S.type),mt&&(rt?t.texStorage2D(n.TEXTURE_2D,1,it,Ne.width,Ne.height):t.texImage2D(n.TEXTURE_2D,0,it,Ne.width,Ne.height,0,Fe,tt,null));else if(S.isDataTexture)if(at.length>0){rt&&mt&&t.texStorage2D(n.TEXTURE_2D,d,it,at[0].width,at[0].height);for(let _=0,b=at.length;_<b;_++)Ge=at[_],rt?oe&&t.texSubImage2D(n.TEXTURE_2D,_,0,0,Ge.width,Ge.height,Fe,tt,Ge.data):t.texImage2D(n.TEXTURE_2D,_,it,Ge.width,Ge.height,0,Fe,tt,Ge.data);S.generateMipmaps=!1}else rt?(mt&&t.texStorage2D(n.TEXTURE_2D,d,it,Ne.width,Ne.height),oe&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,Ne.width,Ne.height,Fe,tt,Ne.data)):t.texImage2D(n.TEXTURE_2D,0,it,Ne.width,Ne.height,0,Fe,tt,Ne.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){rt&&mt&&t.texStorage3D(n.TEXTURE_2D_ARRAY,d,it,at[0].width,at[0].height,Ne.depth);for(let _=0,b=at.length;_<b;_++)if(Ge=at[_],S.format!==en)if(Fe!==null)if(rt){if(oe)if(S.layerUpdates.size>0){const z=Fa(Ge.width,Ge.height,S.format,S.type);for(const B of S.layerUpdates){const pe=Ge.data.subarray(B*z/Ge.data.BYTES_PER_ELEMENT,(B+1)*z/Ge.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,_,0,0,B,Ge.width,Ge.height,1,Fe,pe,0,0)}S.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,_,0,0,0,Ge.width,Ge.height,Ne.depth,Fe,Ge.data,0,0)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,_,it,Ge.width,Ge.height,Ne.depth,0,Ge.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else rt?oe&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,_,0,0,0,Ge.width,Ge.height,Ne.depth,Fe,tt,Ge.data):t.texImage3D(n.TEXTURE_2D_ARRAY,_,it,Ge.width,Ge.height,Ne.depth,0,Fe,tt,Ge.data)}else{rt&&mt&&t.texStorage2D(n.TEXTURE_2D,d,it,at[0].width,at[0].height);for(let _=0,b=at.length;_<b;_++)Ge=at[_],S.format!==en?Fe!==null?rt?oe&&t.compressedTexSubImage2D(n.TEXTURE_2D,_,0,0,Ge.width,Ge.height,Fe,Ge.data):t.compressedTexImage2D(n.TEXTURE_2D,_,it,Ge.width,Ge.height,0,Ge.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):rt?oe&&t.texSubImage2D(n.TEXTURE_2D,_,0,0,Ge.width,Ge.height,Fe,tt,Ge.data):t.texImage2D(n.TEXTURE_2D,_,it,Ge.width,Ge.height,0,Fe,tt,Ge.data)}else if(S.isDataArrayTexture)if(rt){if(mt&&t.texStorage3D(n.TEXTURE_2D_ARRAY,d,it,Ne.width,Ne.height,Ne.depth),oe)if(S.layerUpdates.size>0){const _=Fa(Ne.width,Ne.height,S.format,S.type);for(const b of S.layerUpdates){const z=Ne.data.subarray(b*_/Ne.data.BYTES_PER_ELEMENT,(b+1)*_/Ne.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,b,Ne.width,Ne.height,1,Fe,tt,z)}S.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,Ne.width,Ne.height,Ne.depth,Fe,tt,Ne.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,it,Ne.width,Ne.height,Ne.depth,0,Fe,tt,Ne.data);else if(S.isData3DTexture)rt?(mt&&t.texStorage3D(n.TEXTURE_3D,d,it,Ne.width,Ne.height,Ne.depth),oe&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,Ne.width,Ne.height,Ne.depth,Fe,tt,Ne.data)):t.texImage3D(n.TEXTURE_3D,0,it,Ne.width,Ne.height,Ne.depth,0,Fe,tt,Ne.data);else if(S.isFramebufferTexture){if(mt)if(rt)t.texStorage2D(n.TEXTURE_2D,d,it,Ne.width,Ne.height);else{let _=Ne.width,b=Ne.height;for(let z=0;z<d;z++)t.texImage2D(n.TEXTURE_2D,z,it,_,b,0,Fe,tt,null),_>>=1,b>>=1}}else if(at.length>0){if(rt&&mt){const _=Ce(at[0]);t.texStorage2D(n.TEXTURE_2D,d,it,_.width,_.height)}for(let _=0,b=at.length;_<b;_++)Ge=at[_],rt?oe&&t.texSubImage2D(n.TEXTURE_2D,_,0,0,Fe,tt,Ge):t.texImage2D(n.TEXTURE_2D,_,it,Fe,tt,Ge);S.generateMipmaps=!1}else if(rt){if(mt){const _=Ce(Ne);t.texStorage2D(n.TEXTURE_2D,d,it,_.width,_.height)}oe&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,Fe,tt,Ne)}else t.texImage2D(n.TEXTURE_2D,0,it,Fe,tt,Ne);m(S)&&g(me),Ie.__version=ee.version,S.onUpdate&&S.onUpdate(S)}C.__version=S.version}function T(C,S,se){if(S.image.length!==6)return;const me=k(C,S),Ae=S.source;t.bindTexture(n.TEXTURE_CUBE_MAP,C.__webglTexture,n.TEXTURE0+se);const ee=i.get(Ae);if(Ae.version!==ee.__version||me===!0){t.activeTexture(n.TEXTURE0+se);const Ie=xt.getPrimaries(xt.workingColorSpace),Le=S.colorSpace===bn?null:xt.getPrimaries(S.colorSpace),Be=S.colorSpace===bn||Ie===Le?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,S.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,S.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Be);const $e=S.isCompressedTexture||S.image[0].isCompressedTexture,Ne=S.image[0]&&S.image[0].isDataTexture,Fe=[];for(let b=0;b<6;b++)!$e&&!Ne?Fe[b]=M(S.image[b],!0,r.maxCubemapSize):Fe[b]=Ne?S.image[b].image:S.image[b],Fe[b]=fe(S,Fe[b]);const tt=Fe[0],it=s.convert(S.format,S.colorSpace),Ge=s.convert(S.type),at=P(S.internalFormat,it,Ge,S.colorSpace),rt=S.isVideoTexture!==!0,mt=ee.__version===void 0||me===!0,oe=Ae.dataReady;let d=F(S,tt);U(n.TEXTURE_CUBE_MAP,S);let _;if($e){rt&&mt&&t.texStorage2D(n.TEXTURE_CUBE_MAP,d,at,tt.width,tt.height);for(let b=0;b<6;b++){_=Fe[b].mipmaps;for(let z=0;z<_.length;z++){const B=_[z];S.format!==en?it!==null?rt?oe&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,z,0,0,B.width,B.height,it,B.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,z,at,B.width,B.height,0,B.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):rt?oe&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,z,0,0,B.width,B.height,it,Ge,B.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,z,at,B.width,B.height,0,it,Ge,B.data)}}}else{if(_=S.mipmaps,rt&&mt){_.length>0&&d++;const b=Ce(Fe[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,d,at,b.width,b.height)}for(let b=0;b<6;b++)if(Ne){rt?oe&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,0,0,0,Fe[b].width,Fe[b].height,it,Ge,Fe[b].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,0,at,Fe[b].width,Fe[b].height,0,it,Ge,Fe[b].data);for(let z=0;z<_.length;z++){const pe=_[z].image[b].image;rt?oe&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,z+1,0,0,pe.width,pe.height,it,Ge,pe.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,z+1,at,pe.width,pe.height,0,it,Ge,pe.data)}}else{rt?oe&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,0,0,0,it,Ge,Fe[b]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,0,at,it,Ge,Fe[b]);for(let z=0;z<_.length;z++){const B=_[z];rt?oe&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,z+1,0,0,it,Ge,B.image[b]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+b,z+1,at,it,Ge,B.image[b])}}}m(S)&&g(n.TEXTURE_CUBE_MAP),ee.__version=Ae.version,S.onUpdate&&S.onUpdate(S)}C.__version=S.version}function D(C,S,se,me,Ae,ee){const Ie=s.convert(se.format,se.colorSpace),Le=s.convert(se.type),Be=P(se.internalFormat,Ie,Le,se.colorSpace);if(!i.get(S).__hasExternalTextures){const Ne=Math.max(1,S.width>>ee),Fe=Math.max(1,S.height>>ee);Ae===n.TEXTURE_3D||Ae===n.TEXTURE_2D_ARRAY?t.texImage3D(Ae,ee,Be,Ne,Fe,S.depth,0,Ie,Le,null):t.texImage2D(Ae,ee,Be,Ne,Fe,0,Ie,Le,null)}t.bindFramebuffer(n.FRAMEBUFFER,C),ye(S)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,me,Ae,i.get(se).__webglTexture,0,he(S)):(Ae===n.TEXTURE_2D||Ae>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&Ae<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,me,Ae,i.get(se).__webglTexture,ee),t.bindFramebuffer(n.FRAMEBUFFER,null)}function O(C,S,se){if(n.bindRenderbuffer(n.RENDERBUFFER,C),S.depthBuffer){const me=S.depthTexture,Ae=me&&me.isDepthTexture?me.type:null,ee=L(S.stencilBuffer,Ae),Ie=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,Le=he(S);ye(S)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,Le,ee,S.width,S.height):se?n.renderbufferStorageMultisample(n.RENDERBUFFER,Le,ee,S.width,S.height):n.renderbufferStorage(n.RENDERBUFFER,ee,S.width,S.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,Ie,n.RENDERBUFFER,C)}else{const me=S.textures;for(let Ae=0;Ae<me.length;Ae++){const ee=me[Ae],Ie=s.convert(ee.format,ee.colorSpace),Le=s.convert(ee.type),Be=P(ee.internalFormat,Ie,Le,ee.colorSpace),$e=he(S);se&&ye(S)===!1?n.renderbufferStorageMultisample(n.RENDERBUFFER,$e,Be,S.width,S.height):ye(S)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,$e,Be,S.width,S.height):n.renderbufferStorage(n.RENDERBUFFER,Be,S.width,S.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function G(C,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(n.FRAMEBUFFER,C),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!i.get(S.depthTexture).__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),I(S.depthTexture,0);const me=i.get(S.depthTexture).__webglTexture,Ae=he(S);if(S.depthTexture.format===Ci)ye(S)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,me,0,Ae):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,me,0);else if(S.depthTexture.format===Ni)ye(S)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,me,0,Ae):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,me,0);else throw new Error("Unknown depthTexture format")}function ne(C){const S=i.get(C),se=C.isWebGLCubeRenderTarget===!0;if(S.__boundDepthTexture!==C.depthTexture){const me=C.depthTexture;if(S.__depthDisposeCallback&&S.__depthDisposeCallback(),me){const Ae=()=>{delete S.__boundDepthTexture,delete S.__depthDisposeCallback,me.removeEventListener("dispose",Ae)};me.addEventListener("dispose",Ae),S.__depthDisposeCallback=Ae}S.__boundDepthTexture=me}if(C.depthTexture&&!S.__autoAllocateDepthBuffer){if(se)throw new Error("target.depthTexture not supported in Cube render targets");G(S.__webglFramebuffer,C)}else if(se){S.__webglDepthbuffer=[];for(let me=0;me<6;me++)if(t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer[me]),S.__webglDepthbuffer[me]===void 0)S.__webglDepthbuffer[me]=n.createRenderbuffer(),O(S.__webglDepthbuffer[me],C,!1);else{const Ae=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ee=S.__webglDepthbuffer[me];n.bindRenderbuffer(n.RENDERBUFFER,ee),n.framebufferRenderbuffer(n.FRAMEBUFFER,Ae,n.RENDERBUFFER,ee)}}else if(t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer===void 0)S.__webglDepthbuffer=n.createRenderbuffer(),O(S.__webglDepthbuffer,C,!1);else{const me=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,Ae=S.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,Ae),n.framebufferRenderbuffer(n.FRAMEBUFFER,me,n.RENDERBUFFER,Ae)}t.bindFramebuffer(n.FRAMEBUFFER,null)}function Z(C,S,se){const me=i.get(C);S!==void 0&&D(me.__webglFramebuffer,C,C.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),se!==void 0&&ne(C)}function q(C){const S=C.texture,se=i.get(C),me=i.get(S);C.addEventListener("dispose",H);const Ae=C.textures,ee=C.isWebGLCubeRenderTarget===!0,Ie=Ae.length>1;if(Ie||(me.__webglTexture===void 0&&(me.__webglTexture=n.createTexture()),me.__version=S.version,o.memory.textures++),ee){se.__webglFramebuffer=[];for(let Le=0;Le<6;Le++)if(S.mipmaps&&S.mipmaps.length>0){se.__webglFramebuffer[Le]=[];for(let Be=0;Be<S.mipmaps.length;Be++)se.__webglFramebuffer[Le][Be]=n.createFramebuffer()}else se.__webglFramebuffer[Le]=n.createFramebuffer()}else{if(S.mipmaps&&S.mipmaps.length>0){se.__webglFramebuffer=[];for(let Le=0;Le<S.mipmaps.length;Le++)se.__webglFramebuffer[Le]=n.createFramebuffer()}else se.__webglFramebuffer=n.createFramebuffer();if(Ie)for(let Le=0,Be=Ae.length;Le<Be;Le++){const $e=i.get(Ae[Le]);$e.__webglTexture===void 0&&($e.__webglTexture=n.createTexture(),o.memory.textures++)}if(C.samples>0&&ye(C)===!1){se.__webglMultisampledFramebuffer=n.createFramebuffer(),se.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,se.__webglMultisampledFramebuffer);for(let Le=0;Le<Ae.length;Le++){const Be=Ae[Le];se.__webglColorRenderbuffer[Le]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,se.__webglColorRenderbuffer[Le]);const $e=s.convert(Be.format,Be.colorSpace),Ne=s.convert(Be.type),Fe=P(Be.internalFormat,$e,Ne,Be.colorSpace,C.isXRRenderTarget===!0),tt=he(C);n.renderbufferStorageMultisample(n.RENDERBUFFER,tt,Fe,C.width,C.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Le,n.RENDERBUFFER,se.__webglColorRenderbuffer[Le])}n.bindRenderbuffer(n.RENDERBUFFER,null),C.depthBuffer&&(se.__webglDepthRenderbuffer=n.createRenderbuffer(),O(se.__webglDepthRenderbuffer,C,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(ee){t.bindTexture(n.TEXTURE_CUBE_MAP,me.__webglTexture),U(n.TEXTURE_CUBE_MAP,S);for(let Le=0;Le<6;Le++)if(S.mipmaps&&S.mipmaps.length>0)for(let Be=0;Be<S.mipmaps.length;Be++)D(se.__webglFramebuffer[Le][Be],C,S,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+Le,Be);else D(se.__webglFramebuffer[Le],C,S,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+Le,0);m(S)&&g(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(Ie){for(let Le=0,Be=Ae.length;Le<Be;Le++){const $e=Ae[Le],Ne=i.get($e);t.bindTexture(n.TEXTURE_2D,Ne.__webglTexture),U(n.TEXTURE_2D,$e),D(se.__webglFramebuffer,C,$e,n.COLOR_ATTACHMENT0+Le,n.TEXTURE_2D,0),m($e)&&g(n.TEXTURE_2D)}t.unbindTexture()}else{let Le=n.TEXTURE_2D;if((C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(Le=C.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(Le,me.__webglTexture),U(Le,S),S.mipmaps&&S.mipmaps.length>0)for(let Be=0;Be<S.mipmaps.length;Be++)D(se.__webglFramebuffer[Be],C,S,n.COLOR_ATTACHMENT0,Le,Be);else D(se.__webglFramebuffer,C,S,n.COLOR_ATTACHMENT0,Le,0);m(S)&&g(Le),t.unbindTexture()}C.depthBuffer&&ne(C)}function J(C){const S=C.textures;for(let se=0,me=S.length;se<me;se++){const Ae=S[se];if(m(Ae)){const ee=C.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:n.TEXTURE_2D,Ie=i.get(Ae).__webglTexture;t.bindTexture(ee,Ie),g(ee),t.unbindTexture()}}}const re=[],R=[];function $(C){if(C.samples>0){if(ye(C)===!1){const S=C.textures,se=C.width,me=C.height;let Ae=n.COLOR_BUFFER_BIT;const ee=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,Ie=i.get(C),Le=S.length>1;if(Le)for(let Be=0;Be<S.length;Be++)t.bindFramebuffer(n.FRAMEBUFFER,Ie.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Be,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,Ie.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+Be,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,Ie.__webglMultisampledFramebuffer),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,Ie.__webglFramebuffer);for(let Be=0;Be<S.length;Be++){if(C.resolveDepthBuffer&&(C.depthBuffer&&(Ae|=n.DEPTH_BUFFER_BIT),C.stencilBuffer&&C.resolveStencilBuffer&&(Ae|=n.STENCIL_BUFFER_BIT)),Le){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,Ie.__webglColorRenderbuffer[Be]);const $e=i.get(S[Be]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,$e,0)}n.blitFramebuffer(0,0,se,me,0,0,se,me,Ae,n.NEAREST),l===!0&&(re.length=0,R.length=0,re.push(n.COLOR_ATTACHMENT0+Be),C.depthBuffer&&C.resolveDepthBuffer===!1&&(re.push(ee),R.push(ee),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,R)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,re))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),Le)for(let Be=0;Be<S.length;Be++){t.bindFramebuffer(n.FRAMEBUFFER,Ie.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Be,n.RENDERBUFFER,Ie.__webglColorRenderbuffer[Be]);const $e=i.get(S[Be]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,Ie.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+Be,n.TEXTURE_2D,$e,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,Ie.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.resolveDepthBuffer===!1&&l){const S=C.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[S])}}}function he(C){return Math.min(r.maxSamples,C.samples)}function ye(C){const S=i.get(C);return C.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function Pe(C){const S=o.render.frame;c.get(C)!==S&&(c.set(C,S),C.update())}function fe(C,S){const se=C.colorSpace,me=C.format,Ae=C.type;return C.isCompressedTexture===!0||C.isVideoTexture===!0||se!==Gn&&se!==bn&&(xt.getTransfer(se)===bt?(me!==en||Ae!==Rn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",se)),S}function Ce(C){return typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement?(u.width=C.naturalWidth||C.width,u.height=C.naturalHeight||C.height):typeof VideoFrame<"u"&&C instanceof VideoFrame?(u.width=C.displayWidth,u.height=C.displayHeight):(u.width=C.width,u.height=C.height),u}this.allocateTextureUnit=Me,this.resetTextureUnits=A,this.setTexture2D=I,this.setTexture2DArray=ie,this.setTexture3D=x,this.setTextureCube=j,this.rebindTextures=Z,this.setupRenderTarget=q,this.updateRenderTargetMipmap=J,this.updateMultisampleRenderTarget=$,this.setupDepthRenderbuffer=ne,this.setupFrameBufferTexture=D,this.useMultisampledRTT=ye}function Rm(n,e){function t(i,r=bn){let s;const o=xt.getTransfer(r);if(i===Rn)return n.UNSIGNED_BYTE;if(i===Ao)return n.UNSIGNED_SHORT_4_4_4_4;if(i===Ro)return n.UNSIGNED_SHORT_5_5_5_1;if(i===El)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===Sl)return n.BYTE;if(i===bl)return n.SHORT;if(i===Zi)return n.UNSIGNED_SHORT;if(i===To)return n.INT;if(i===oi)return n.UNSIGNED_INT;if(i===ln)return n.FLOAT;if(i===er)return n.HALF_FLOAT;if(i===wl)return n.ALPHA;if(i===Tl)return n.RGB;if(i===en)return n.RGBA;if(i===Al)return n.LUMINANCE;if(i===Rl)return n.LUMINANCE_ALPHA;if(i===Ci)return n.DEPTH_COMPONENT;if(i===Ni)return n.DEPTH_STENCIL;if(i===Co)return n.RED;if(i===Po)return n.RED_INTEGER;if(i===Cl)return n.RG;if(i===Lo)return n.RG_INTEGER;if(i===Io)return n.RGBA_INTEGER;if(i===Lr||i===Ir||i===Dr||i===Ur)if(o===bt)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===Lr)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Ir)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Dr)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Ur)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===Lr)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Ir)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Dr)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Ur)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===qs||i===Ys||i===$s||i===js)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===qs)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Ys)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===$s)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===js)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Ks||i===Zs||i===Js)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===Ks||i===Zs)return o===bt?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===Js)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===Qs||i===eo||i===to||i===no||i===io||i===ro||i===so||i===oo||i===ao||i===lo||i===co||i===uo||i===ho||i===fo)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===Qs)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===eo)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===to)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===no)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===io)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===ro)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===so)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===oo)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===ao)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===lo)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===co)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===uo)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===ho)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===fo)return o===bt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Nr||i===po||i===mo)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===Nr)return o===bt?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===po)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===mo)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Pl||i===go||i===_o||i===xo)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===Nr)return s.COMPRESSED_RED_RGTC1_EXT;if(i===go)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===_o)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===xo)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Ui?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}class Cm extends Qt{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}}class ri extends Lt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Pm={type:"move"};class ws{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ri,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ri,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new ae,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new ae),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ri,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new ae,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new ae),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,s=null,o=null;const a=this._targetRay,l=this._grip,u=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(u&&e.hand){o=!0;for(const M of e.hand.values()){const m=t.getJointPose(M,i),g=this._getHandJoint(u,M);m!==null&&(g.matrix.fromArray(m.transform.matrix),g.matrix.decompose(g.position,g.rotation,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=m.radius),g.visible=m!==null}const c=u.joints["index-finger-tip"],h=u.joints["thumb-tip"],f=c.position.distanceTo(h.position),p=.02,v=.005;u.inputState.pinching&&f>p+v?(u.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!u.inputState.pinching&&f<=p-v&&(u.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));a!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(Pm)))}return a!==null&&(a.visible=r!==null),l!==null&&(l.visible=s!==null),u!==null&&(u.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const i=new ri;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}}const Lm=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Im=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class Dm{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t,i){if(this.texture===null){const r=new zt,s=e.properties.get(r);s.__webglTexture=t.texture,(t.depthNear!=i.depthNear||t.depthFar!=i.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=r}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,i=new Hn({vertexShader:Lm,fragmentShader:Im,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Xt(new $r(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Um extends Oi{constructor(e,t){super();const i=this;let r=null,s=1,o=null,a="local-floor",l=1,u=null,c=null,h=null,f=null,p=null,v=null;const M=new Dm,m=t.getContextAttributes();let g=null,P=null;const L=[],F=[],Q=new _t;let H=null;const V=new Qt;V.layers.enable(1),V.viewport=new Et;const le=new Qt;le.layers.enable(2),le.viewport=new Et;const Te=[V,le],y=new Cm;y.layers.enable(1),y.layers.enable(2);let A=null,Me=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(T){let D=L[T];return D===void 0&&(D=new ws,L[T]=D),D.getTargetRaySpace()},this.getControllerGrip=function(T){let D=L[T];return D===void 0&&(D=new ws,L[T]=D),D.getGripSpace()},this.getHand=function(T){let D=L[T];return D===void 0&&(D=new ws,L[T]=D),D.getHandSpace()};function ue(T){const D=F.indexOf(T.inputSource);if(D===-1)return;const O=L[D];O!==void 0&&(O.update(T.inputSource,T.frame,u||o),O.dispatchEvent({type:T.type,data:T.inputSource}))}function I(){r.removeEventListener("select",ue),r.removeEventListener("selectstart",ue),r.removeEventListener("selectend",ue),r.removeEventListener("squeeze",ue),r.removeEventListener("squeezestart",ue),r.removeEventListener("squeezeend",ue),r.removeEventListener("end",I),r.removeEventListener("inputsourceschange",ie);for(let T=0;T<L.length;T++){const D=F[T];D!==null&&(F[T]=null,L[T].disconnect(D))}A=null,Me=null,M.reset(),e.setRenderTarget(g),p=null,f=null,h=null,r=null,P=null,te.stop(),i.isPresenting=!1,e.setPixelRatio(H),e.setSize(Q.width,Q.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(T){s=T,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(T){a=T,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return u||o},this.setReferenceSpace=function(T){u=T},this.getBaseLayer=function(){return f!==null?f:p},this.getBinding=function(){return h},this.getFrame=function(){return v},this.getSession=function(){return r},this.setSession=async function(T){if(r=T,r!==null){if(g=e.getRenderTarget(),r.addEventListener("select",ue),r.addEventListener("selectstart",ue),r.addEventListener("selectend",ue),r.addEventListener("squeeze",ue),r.addEventListener("squeezestart",ue),r.addEventListener("squeezeend",ue),r.addEventListener("end",I),r.addEventListener("inputsourceschange",ie),m.xrCompatible!==!0&&await t.makeXRCompatible(),H=e.getPixelRatio(),e.getSize(Q),r.renderState.layers===void 0){const D={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:s};p=new XRWebGLLayer(r,t,D),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),P=new ai(p.framebufferWidth,p.framebufferHeight,{format:en,type:Rn,colorSpace:e.outputColorSpace,stencilBuffer:m.stencil})}else{let D=null,O=null,G=null;m.depth&&(G=m.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,D=m.stencil?Ni:Ci,O=m.stencil?Ui:oi);const ne={colorFormat:t.RGBA8,depthFormat:G,scaleFactor:s};h=new XRWebGLBinding(r,t),f=h.createProjectionLayer(ne),r.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),P=new ai(f.textureWidth,f.textureHeight,{format:en,type:Rn,depthTexture:new Yl(f.textureWidth,f.textureHeight,O,void 0,void 0,void 0,void 0,void 0,void 0,D),stencilBuffer:m.stencil,colorSpace:e.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1})}P.isXRRenderTarget=!0,this.setFoveation(l),u=null,o=await r.requestReferenceSpace(a),te.setContext(r),te.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return M.getDepthTexture()};function ie(T){for(let D=0;D<T.removed.length;D++){const O=T.removed[D],G=F.indexOf(O);G>=0&&(F[G]=null,L[G].disconnect(O))}for(let D=0;D<T.added.length;D++){const O=T.added[D];let G=F.indexOf(O);if(G===-1){for(let Z=0;Z<L.length;Z++)if(Z>=F.length){F.push(O),G=Z;break}else if(F[Z]===null){F[Z]=O,G=Z;break}if(G===-1)break}const ne=L[G];ne&&ne.connect(O)}}const x=new ae,j=new ae;function X(T,D,O){x.setFromMatrixPosition(D.matrixWorld),j.setFromMatrixPosition(O.matrixWorld);const G=x.distanceTo(j),ne=D.projectionMatrix.elements,Z=O.projectionMatrix.elements,q=ne[14]/(ne[10]-1),J=ne[14]/(ne[10]+1),re=(ne[9]+1)/ne[5],R=(ne[9]-1)/ne[5],$=(ne[8]-1)/ne[0],he=(Z[8]+1)/Z[0],ye=q*$,Pe=q*he,fe=G/(-$+he),Ce=fe*-$;if(D.matrixWorld.decompose(T.position,T.quaternion,T.scale),T.translateX(Ce),T.translateZ(fe),T.matrixWorld.compose(T.position,T.quaternion,T.scale),T.matrixWorldInverse.copy(T.matrixWorld).invert(),ne[10]===-1)T.projectionMatrix.copy(D.projectionMatrix),T.projectionMatrixInverse.copy(D.projectionMatrixInverse);else{const C=q+fe,S=J+fe,se=ye-Ce,me=Pe+(G-Ce),Ae=re*J/S*C,ee=R*J/S*C;T.projectionMatrix.makePerspective(se,me,Ae,ee,C,S),T.projectionMatrixInverse.copy(T.projectionMatrix).invert()}}function ce(T,D){D===null?T.matrixWorld.copy(T.matrix):T.matrixWorld.multiplyMatrices(D.matrixWorld,T.matrix),T.matrixWorldInverse.copy(T.matrixWorld).invert()}this.updateCamera=function(T){if(r===null)return;let D=T.near,O=T.far;M.texture!==null&&(M.depthNear>0&&(D=M.depthNear),M.depthFar>0&&(O=M.depthFar)),y.near=le.near=V.near=D,y.far=le.far=V.far=O,(A!==y.near||Me!==y.far)&&(r.updateRenderState({depthNear:y.near,depthFar:y.far}),A=y.near,Me=y.far);const G=T.parent,ne=y.cameras;ce(y,G);for(let Z=0;Z<ne.length;Z++)ce(ne[Z],G);ne.length===2?X(y,V,le):y.projectionMatrix.copy(V.projectionMatrix),N(T,y,G)};function N(T,D,O){O===null?T.matrix.copy(D.matrixWorld):(T.matrix.copy(O.matrixWorld),T.matrix.invert(),T.matrix.multiply(D.matrixWorld)),T.matrix.decompose(T.position,T.quaternion,T.scale),T.updateMatrixWorld(!0),T.projectionMatrix.copy(D.projectionMatrix),T.projectionMatrixInverse.copy(D.projectionMatrixInverse),T.isPerspectiveCamera&&(T.fov=Ji*2*Math.atan(1/T.projectionMatrix.elements[5]),T.zoom=1)}this.getCamera=function(){return y},this.getFoveation=function(){if(!(f===null&&p===null))return l},this.setFoveation=function(T){l=T,f!==null&&(f.fixedFoveation=T),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=T)},this.hasDepthSensing=function(){return M.texture!==null},this.getDepthSensingMesh=function(){return M.getMesh(y)};let U=null;function k(T,D){if(c=D.getViewerPose(u||o),v=D,c!==null){const O=c.views;p!==null&&(e.setRenderTargetFramebuffer(P,p.framebuffer),e.setRenderTarget(P));let G=!1;O.length!==y.cameras.length&&(y.cameras.length=0,G=!0);for(let Z=0;Z<O.length;Z++){const q=O[Z];let J=null;if(p!==null)J=p.getViewport(q);else{const R=h.getViewSubImage(f,q);J=R.viewport,Z===0&&(e.setRenderTargetTextures(P,R.colorTexture,f.ignoreDepthValues?void 0:R.depthStencilTexture),e.setRenderTarget(P))}let re=Te[Z];re===void 0&&(re=new Qt,re.layers.enable(Z),re.viewport=new Et,Te[Z]=re),re.matrix.fromArray(q.transform.matrix),re.matrix.decompose(re.position,re.quaternion,re.scale),re.projectionMatrix.fromArray(q.projectionMatrix),re.projectionMatrixInverse.copy(re.projectionMatrix).invert(),re.viewport.set(J.x,J.y,J.width,J.height),Z===0&&(y.matrix.copy(re.matrix),y.matrix.decompose(y.position,y.quaternion,y.scale)),G===!0&&y.cameras.push(re)}const ne=r.enabledFeatures;if(ne&&ne.includes("depth-sensing")){const Z=h.getDepthInformation(O[0]);Z&&Z.isValid&&Z.texture&&M.init(e,Z,r.renderState)}}for(let O=0;O<L.length;O++){const G=F[O],ne=L[O];G!==null&&ne!==void 0&&ne.update(G,D,u||o)}U&&U(T,D),D.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:D}),v=null}const te=new Xl;te.setAnimationLoop(k),this.setAnimationLoop=function(T){U=T},this.dispose=function(){}}}const Kn=new cn,Nm=new dt;function Fm(n,e){function t(m,g){m.matrixAutoUpdate===!0&&m.updateMatrix(),g.value.copy(m.matrix)}function i(m,g){g.color.getRGB(m.fogColor.value,Gl(n)),g.isFog?(m.fogNear.value=g.near,m.fogFar.value=g.far):g.isFogExp2&&(m.fogDensity.value=g.density)}function r(m,g,P,L,F){g.isMeshBasicMaterial||g.isMeshLambertMaterial?s(m,g):g.isMeshToonMaterial?(s(m,g),h(m,g)):g.isMeshPhongMaterial?(s(m,g),c(m,g)):g.isMeshStandardMaterial?(s(m,g),f(m,g),g.isMeshPhysicalMaterial&&p(m,g,F)):g.isMeshMatcapMaterial?(s(m,g),v(m,g)):g.isMeshDepthMaterial?s(m,g):g.isMeshDistanceMaterial?(s(m,g),M(m,g)):g.isMeshNormalMaterial?s(m,g):g.isLineBasicMaterial?(o(m,g),g.isLineDashedMaterial&&a(m,g)):g.isPointsMaterial?l(m,g,P,L):g.isSpriteMaterial?u(m,g):g.isShadowMaterial?(m.color.value.copy(g.color),m.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function s(m,g){m.opacity.value=g.opacity,g.color&&m.diffuse.value.copy(g.color),g.emissive&&m.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.bumpMap&&(m.bumpMap.value=g.bumpMap,t(g.bumpMap,m.bumpMapTransform),m.bumpScale.value=g.bumpScale,g.side===qt&&(m.bumpScale.value*=-1)),g.normalMap&&(m.normalMap.value=g.normalMap,t(g.normalMap,m.normalMapTransform),m.normalScale.value.copy(g.normalScale),g.side===qt&&m.normalScale.value.negate()),g.displacementMap&&(m.displacementMap.value=g.displacementMap,t(g.displacementMap,m.displacementMapTransform),m.displacementScale.value=g.displacementScale,m.displacementBias.value=g.displacementBias),g.emissiveMap&&(m.emissiveMap.value=g.emissiveMap,t(g.emissiveMap,m.emissiveMapTransform)),g.specularMap&&(m.specularMap.value=g.specularMap,t(g.specularMap,m.specularMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest);const P=e.get(g),L=P.envMap,F=P.envMapRotation;L&&(m.envMap.value=L,Kn.copy(F),Kn.x*=-1,Kn.y*=-1,Kn.z*=-1,L.isCubeTexture&&L.isRenderTargetTexture===!1&&(Kn.y*=-1,Kn.z*=-1),m.envMapRotation.value.setFromMatrix4(Nm.makeRotationFromEuler(Kn)),m.flipEnvMap.value=L.isCubeTexture&&L.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=g.reflectivity,m.ior.value=g.ior,m.refractionRatio.value=g.refractionRatio),g.lightMap&&(m.lightMap.value=g.lightMap,m.lightMapIntensity.value=g.lightMapIntensity,t(g.lightMap,m.lightMapTransform)),g.aoMap&&(m.aoMap.value=g.aoMap,m.aoMapIntensity.value=g.aoMapIntensity,t(g.aoMap,m.aoMapTransform))}function o(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform))}function a(m,g){m.dashSize.value=g.dashSize,m.totalSize.value=g.dashSize+g.gapSize,m.scale.value=g.scale}function l(m,g,P,L){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.size.value=g.size*P,m.scale.value=L*.5,g.map&&(m.map.value=g.map,t(g.map,m.uvTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function u(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.rotation.value=g.rotation,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function c(m,g){m.specular.value.copy(g.specular),m.shininess.value=Math.max(g.shininess,1e-4)}function h(m,g){g.gradientMap&&(m.gradientMap.value=g.gradientMap)}function f(m,g){m.metalness.value=g.metalness,g.metalnessMap&&(m.metalnessMap.value=g.metalnessMap,t(g.metalnessMap,m.metalnessMapTransform)),m.roughness.value=g.roughness,g.roughnessMap&&(m.roughnessMap.value=g.roughnessMap,t(g.roughnessMap,m.roughnessMapTransform)),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)}function p(m,g,P){m.ior.value=g.ior,g.sheen>0&&(m.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),m.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(m.sheenColorMap.value=g.sheenColorMap,t(g.sheenColorMap,m.sheenColorMapTransform)),g.sheenRoughnessMap&&(m.sheenRoughnessMap.value=g.sheenRoughnessMap,t(g.sheenRoughnessMap,m.sheenRoughnessMapTransform))),g.clearcoat>0&&(m.clearcoat.value=g.clearcoat,m.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(m.clearcoatMap.value=g.clearcoatMap,t(g.clearcoatMap,m.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,t(g.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(m.clearcoatNormalMap.value=g.clearcoatNormalMap,t(g.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===qt&&m.clearcoatNormalScale.value.negate())),g.dispersion>0&&(m.dispersion.value=g.dispersion),g.iridescence>0&&(m.iridescence.value=g.iridescence,m.iridescenceIOR.value=g.iridescenceIOR,m.iridescenceThicknessMinimum.value=g.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=g.iridescenceThicknessRange[1],g.iridescenceMap&&(m.iridescenceMap.value=g.iridescenceMap,t(g.iridescenceMap,m.iridescenceMapTransform)),g.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=g.iridescenceThicknessMap,t(g.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),g.transmission>0&&(m.transmission.value=g.transmission,m.transmissionSamplerMap.value=P.texture,m.transmissionSamplerSize.value.set(P.width,P.height),g.transmissionMap&&(m.transmissionMap.value=g.transmissionMap,t(g.transmissionMap,m.transmissionMapTransform)),m.thickness.value=g.thickness,g.thicknessMap&&(m.thicknessMap.value=g.thicknessMap,t(g.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=g.attenuationDistance,m.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(m.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(m.anisotropyMap.value=g.anisotropyMap,t(g.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=g.specularIntensity,m.specularColor.value.copy(g.specularColor),g.specularColorMap&&(m.specularColorMap.value=g.specularColorMap,t(g.specularColorMap,m.specularColorMapTransform)),g.specularIntensityMap&&(m.specularIntensityMap.value=g.specularIntensityMap,t(g.specularIntensityMap,m.specularIntensityMapTransform))}function v(m,g){g.matcap&&(m.matcap.value=g.matcap)}function M(m,g){const P=e.get(g).light;m.referencePosition.value.setFromMatrixPosition(P.matrixWorld),m.nearDistance.value=P.shadow.camera.near,m.farDistance.value=P.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function Om(n,e,t,i){let r={},s={},o=[];const a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(P,L){const F=L.program;i.uniformBlockBinding(P,F)}function u(P,L){let F=r[P.id];F===void 0&&(v(P),F=c(P),r[P.id]=F,P.addEventListener("dispose",m));const Q=L.program;i.updateUBOMapping(P,Q);const H=e.render.frame;s[P.id]!==H&&(f(P),s[P.id]=H)}function c(P){const L=h();P.__bindingPointIndex=L;const F=n.createBuffer(),Q=P.__size,H=P.usage;return n.bindBuffer(n.UNIFORM_BUFFER,F),n.bufferData(n.UNIFORM_BUFFER,Q,H),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,L,F),F}function h(){for(let P=0;P<a;P++)if(o.indexOf(P)===-1)return o.push(P),P;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function f(P){const L=r[P.id],F=P.uniforms,Q=P.__cache;n.bindBuffer(n.UNIFORM_BUFFER,L);for(let H=0,V=F.length;H<V;H++){const le=Array.isArray(F[H])?F[H]:[F[H]];for(let Te=0,y=le.length;Te<y;Te++){const A=le[Te];if(p(A,H,Te,Q)===!0){const Me=A.__offset,ue=Array.isArray(A.value)?A.value:[A.value];let I=0;for(let ie=0;ie<ue.length;ie++){const x=ue[ie],j=M(x);typeof x=="number"||typeof x=="boolean"?(A.__data[0]=x,n.bufferSubData(n.UNIFORM_BUFFER,Me+I,A.__data)):x.isMatrix3?(A.__data[0]=x.elements[0],A.__data[1]=x.elements[1],A.__data[2]=x.elements[2],A.__data[3]=0,A.__data[4]=x.elements[3],A.__data[5]=x.elements[4],A.__data[6]=x.elements[5],A.__data[7]=0,A.__data[8]=x.elements[6],A.__data[9]=x.elements[7],A.__data[10]=x.elements[8],A.__data[11]=0):(x.toArray(A.__data,I),I+=j.storage/Float32Array.BYTES_PER_ELEMENT)}n.bufferSubData(n.UNIFORM_BUFFER,Me,A.__data)}}}n.bindBuffer(n.UNIFORM_BUFFER,null)}function p(P,L,F,Q){const H=P.value,V=L+"_"+F;if(Q[V]===void 0)return typeof H=="number"||typeof H=="boolean"?Q[V]=H:Q[V]=H.clone(),!0;{const le=Q[V];if(typeof H=="number"||typeof H=="boolean"){if(le!==H)return Q[V]=H,!0}else if(le.equals(H)===!1)return le.copy(H),!0}return!1}function v(P){const L=P.uniforms;let F=0;const Q=16;for(let V=0,le=L.length;V<le;V++){const Te=Array.isArray(L[V])?L[V]:[L[V]];for(let y=0,A=Te.length;y<A;y++){const Me=Te[y],ue=Array.isArray(Me.value)?Me.value:[Me.value];for(let I=0,ie=ue.length;I<ie;I++){const x=ue[I],j=M(x),X=F%Q,ce=X%j.boundary,N=X+ce;F+=ce,N!==0&&Q-N<j.storage&&(F+=Q-N),Me.__data=new Float32Array(j.storage/Float32Array.BYTES_PER_ELEMENT),Me.__offset=F,F+=j.storage}}}const H=F%Q;return H>0&&(F+=Q-H),P.__size=F,P.__cache={},this}function M(P){const L={boundary:0,storage:0};return typeof P=="number"||typeof P=="boolean"?(L.boundary=4,L.storage=4):P.isVector2?(L.boundary=8,L.storage=8):P.isVector3||P.isColor?(L.boundary=16,L.storage=12):P.isVector4?(L.boundary=16,L.storage=16):P.isMatrix3?(L.boundary=48,L.storage=48):P.isMatrix4?(L.boundary=64,L.storage=64):P.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",P),L}function m(P){const L=P.target;L.removeEventListener("dispose",m);const F=o.indexOf(L.__bindingPointIndex);o.splice(F,1),n.deleteBuffer(r[L.id]),delete r[L.id],delete s[L.id]}function g(){for(const P in r)n.deleteBuffer(r[P]);o=[],r={},s={}}return{bind:l,update:u,dispose:g}}class zm{constructor(e={}){const{canvas:t=Eu(),context:i=null,depth:r=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:u=!1,powerPreference:c="default",failIfMajorPerformanceCaveat:h=!1}=e;this.isWebGLRenderer=!0;let f;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=i.getContextAttributes().alpha}else f=o;const p=new Uint32Array(4),v=new Int32Array(4);let M=null,m=null;const g=[],P=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=sn,this.toneMapping=Bn,this.toneMappingExposure=1;const L=this;let F=!1,Q=0,H=0,V=null,le=-1,Te=null;const y=new Et,A=new Et;let Me=null;const ue=new ot(0);let I=0,ie=t.width,x=t.height,j=1,X=null,ce=null;const N=new Et(0,0,ie,x),U=new Et(0,0,ie,x);let k=!1;const te=new Yr;let T=!1,D=!1;const O=new dt,G=new dt,ne=new ae,Z=new Et,q={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let J=!1;function re(){return V===null?j:1}let R=i;function $(E,K){return t.getContext(E,K)}try{const E={alpha:!0,depth:r,stencil:s,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:u,powerPreference:c,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${wo}`),t.addEventListener("webglcontextlost",b,!1),t.addEventListener("webglcontextrestored",z,!1),t.addEventListener("webglcontextcreationerror",B,!1),R===null){const K="webgl2";if(R=$(K,E),R===null)throw $(K)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(E){throw console.error("THREE.WebGLRenderer: "+E.message),E}let he,ye,Pe,fe,Ce,C,S,se,me,Ae,ee,Ie,Le,Be,$e,Ne,Fe,tt,it,Ge,at,rt,mt,oe;function d(){he=new Vd(R),he.init(),rt=new Rm(R,he),ye=new Od(R,he,e,rt),Pe=new wm(R),ye.reverseDepthBuffer&&Pe.buffers.depth.setReversed(!0),fe=new qd(R),Ce=new um,C=new Am(R,he,Pe,Ce,ye,rt,fe),S=new Bd(L),se=new Gd(L),me=new Ju(R),mt=new Nd(R,me),Ae=new Wd(R,me,fe,mt),ee=new $d(R,Ae,me,fe),it=new Yd(R,ye,C),Ne=new zd(Ce),Ie=new cm(L,S,se,he,ye,mt,Ne),Le=new Fm(L,Ce),Be=new fm,$e=new xm(he),tt=new Ud(L,S,se,Pe,ee,f,l),Fe=new bm(L,ee,ye),oe=new Om(R,fe,ye,Pe),Ge=new Fd(R,he,fe),at=new Xd(R,he,fe),fe.programs=Ie.programs,L.capabilities=ye,L.extensions=he,L.properties=Ce,L.renderLists=Be,L.shadowMap=Fe,L.state=Pe,L.info=fe}d();const _=new Um(L,R);this.xr=_,this.getContext=function(){return R},this.getContextAttributes=function(){return R.getContextAttributes()},this.forceContextLoss=function(){const E=he.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){const E=he.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return j},this.setPixelRatio=function(E){E!==void 0&&(j=E,this.setSize(ie,x,!1))},this.getSize=function(E){return E.set(ie,x)},this.setSize=function(E,K,w=!0){if(_.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}ie=E,x=K,t.width=Math.floor(E*j),t.height=Math.floor(K*j),w===!0&&(t.style.width=E+"px",t.style.height=K+"px"),this.setViewport(0,0,E,K)},this.getDrawingBufferSize=function(E){return E.set(ie*j,x*j).floor()},this.setDrawingBufferSize=function(E,K,w){ie=E,x=K,j=w,t.width=Math.floor(E*w),t.height=Math.floor(K*w),this.setViewport(0,0,E,K)},this.getCurrentViewport=function(E){return E.copy(y)},this.getViewport=function(E){return E.copy(N)},this.setViewport=function(E,K,w,W){E.isVector4?N.set(E.x,E.y,E.z,E.w):N.set(E,K,w,W),Pe.viewport(y.copy(N).multiplyScalar(j).round())},this.getScissor=function(E){return E.copy(U)},this.setScissor=function(E,K,w,W){E.isVector4?U.set(E.x,E.y,E.z,E.w):U.set(E,K,w,W),Pe.scissor(A.copy(U).multiplyScalar(j).round())},this.getScissorTest=function(){return k},this.setScissorTest=function(E){Pe.setScissorTest(k=E)},this.setOpaqueSort=function(E){X=E},this.setTransparentSort=function(E){ce=E},this.getClearColor=function(E){return E.copy(tt.getClearColor())},this.setClearColor=function(){tt.setClearColor.apply(tt,arguments)},this.getClearAlpha=function(){return tt.getClearAlpha()},this.setClearAlpha=function(){tt.setClearAlpha.apply(tt,arguments)},this.clear=function(E=!0,K=!0,w=!0){let W=0;if(E){let Y=!1;if(V!==null){const we=V.texture.format;Y=we===Io||we===Lo||we===Po}if(Y){const we=V.texture.type,ve=we===Rn||we===oi||we===Zi||we===Ui||we===Ao||we===Ro,de=tt.getClearColor(),be=tt.getClearAlpha(),De=de.r,ke=de.g,Re=de.b;ve?(p[0]=De,p[1]=ke,p[2]=Re,p[3]=be,R.clearBufferuiv(R.COLOR,0,p)):(v[0]=De,v[1]=ke,v[2]=Re,v[3]=be,R.clearBufferiv(R.COLOR,0,v))}else W|=R.COLOR_BUFFER_BIT}K&&(W|=R.DEPTH_BUFFER_BIT,R.clearDepth(this.capabilities.reverseDepthBuffer?0:1)),w&&(W|=R.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),R.clear(W)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",b,!1),t.removeEventListener("webglcontextrestored",z,!1),t.removeEventListener("webglcontextcreationerror",B,!1),Be.dispose(),$e.dispose(),Ce.dispose(),S.dispose(),se.dispose(),ee.dispose(),mt.dispose(),oe.dispose(),Ie.dispose(),_.dispose(),_.removeEventListener("sessionstart",Ue),_.removeEventListener("sessionend",ze),Qe.stop()};function b(E){E.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),F=!0}function z(){console.log("THREE.WebGLRenderer: Context Restored."),F=!1;const E=fe.autoReset,K=Fe.enabled,w=Fe.autoUpdate,W=Fe.needsUpdate,Y=Fe.type;d(),fe.autoReset=E,Fe.enabled=K,Fe.autoUpdate=w,Fe.needsUpdate=W,Fe.type=Y}function B(E){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function pe(E){const K=E.target;K.removeEventListener("dispose",pe),_e(K)}function _e(E){Ee(E),Ce.remove(E)}function Ee(E){const K=Ce.get(E).programs;K!==void 0&&(K.forEach(function(w){Ie.releaseProgram(w)}),E.isShaderMaterial&&Ie.releaseShaderCache(E))}this.renderBufferDirect=function(E,K,w,W,Y,we){K===null&&(K=q);const ve=Y.isMesh&&Y.matrixWorld.determinant()<0,de=gt(E,K,w,W,Y);Pe.setMaterial(W,ve);let be=w.index,De=1;if(W.wireframe===!0){if(be=Ae.getWireframeAttribute(w),be===void 0)return;De=2}const ke=w.drawRange,Re=w.attributes.position;let et=ke.start*De,He=(ke.start+ke.count)*De;we!==null&&(et=Math.max(et,we.start*De),He=Math.min(He,(we.start+we.count)*De)),be!==null?(et=Math.max(et,0),He=Math.min(He,be.count)):Re!=null&&(et=Math.max(et,0),He=Math.min(He,Re.count));const ft=He-et;if(ft<0||ft===1/0)return;mt.setup(Y,W,de,w,be);let st,We=Ge;if(be!==null&&(st=me.get(be),We=at,We.setIndex(st)),Y.isMesh)W.wireframe===!0?(Pe.setLineWidth(W.wireframeLinewidth*re()),We.setMode(R.LINES)):We.setMode(R.TRIANGLES);else if(Y.isLine){let Xe=W.linewidth;Xe===void 0&&(Xe=1),Pe.setLineWidth(Xe*re()),Y.isLineSegments?We.setMode(R.LINES):Y.isLineLoop?We.setMode(R.LINE_LOOP):We.setMode(R.LINE_STRIP)}else Y.isPoints?We.setMode(R.POINTS):Y.isSprite&&We.setMode(R.TRIANGLES);if(Y.isBatchedMesh)if(Y._multiDrawInstances!==null)We.renderMultiDrawInstances(Y._multiDrawStarts,Y._multiDrawCounts,Y._multiDrawCount,Y._multiDrawInstances);else if(he.get("WEBGL_multi_draw"))We.renderMultiDraw(Y._multiDrawStarts,Y._multiDrawCounts,Y._multiDrawCount);else{const Xe=Y._multiDrawStarts,vt=Y._multiDrawCounts,lt=Y._multiDrawCount,It=be?me.get(be).bytesPerElement:1,Zt=Ce.get(W).currentProgram.getUniforms();for(let yt=0;yt<lt;yt++)Zt.setValue(R,"_gl_DrawID",yt),We.render(Xe[yt]/It,vt[yt])}else if(Y.isInstancedMesh)We.renderInstances(et,ft,Y.count);else if(w.isInstancedBufferGeometry){const Xe=w._maxInstanceCount!==void 0?w._maxInstanceCount:1/0,vt=Math.min(w.instanceCount,Xe);We.renderInstances(et,ft,vt)}else We.render(et,ft)};function ge(E,K,w){E.transparent===!0&&E.side===dn&&E.forceSinglePass===!1?(E.side=qt,E.needsUpdate=!0,Ke(E,K,w),E.side=An,E.needsUpdate=!0,Ke(E,K,w),E.side=dn):Ke(E,K,w)}this.compile=function(E,K,w=null){w===null&&(w=E),m=$e.get(w),m.init(K),P.push(m),w.traverseVisible(function(Y){Y.isLight&&Y.layers.test(K.layers)&&(m.pushLight(Y),Y.castShadow&&m.pushShadow(Y))}),E!==w&&E.traverseVisible(function(Y){Y.isLight&&Y.layers.test(K.layers)&&(m.pushLight(Y),Y.castShadow&&m.pushShadow(Y))}),m.setupLights();const W=new Set;return E.traverse(function(Y){if(!(Y.isMesh||Y.isPoints||Y.isLine||Y.isSprite))return;const we=Y.material;if(we)if(Array.isArray(we))for(let ve=0;ve<we.length;ve++){const de=we[ve];ge(de,w,Y),W.add(de)}else ge(we,w,Y),W.add(we)}),P.pop(),m=null,W},this.compileAsync=function(E,K,w=null){const W=this.compile(E,K,w);return new Promise(Y=>{function we(){if(W.forEach(function(ve){Ce.get(ve).currentProgram.isReady()&&W.delete(ve)}),W.size===0){Y(E);return}setTimeout(we,10)}he.get("KHR_parallel_shader_compile")!==null?we():setTimeout(we,10)})};let xe=null;function Se(E){xe&&xe(E)}function Ue(){Qe.stop()}function ze(){Qe.start()}const Qe=new Xl;Qe.setAnimationLoop(Se),typeof self<"u"&&Qe.setContext(self),this.setAnimationLoop=function(E){xe=E,_.setAnimationLoop(E),E===null?Qe.stop():Qe.start()},_.addEventListener("sessionstart",Ue),_.addEventListener("sessionend",ze),this.render=function(E,K){if(K!==void 0&&K.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(F===!0)return;if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),K.parent===null&&K.matrixWorldAutoUpdate===!0&&K.updateMatrixWorld(),_.enabled===!0&&_.isPresenting===!0&&(_.cameraAutoUpdate===!0&&_.updateCamera(K),K=_.getCamera()),E.isScene===!0&&E.onBeforeRender(L,E,K,V),m=$e.get(E,P.length),m.init(K),P.push(m),G.multiplyMatrices(K.projectionMatrix,K.matrixWorldInverse),te.setFromProjectionMatrix(G),D=this.localClippingEnabled,T=Ne.init(this.clippingPlanes,D),M=Be.get(E,g.length),M.init(),g.push(M),_.enabled===!0&&_.isPresenting===!0){const we=L.xr.getDepthSensingMesh();we!==null&&Ze(we,K,-1/0,L.sortObjects)}Ze(E,K,0,L.sortObjects),M.finish(),L.sortObjects===!0&&M.sort(X,ce),J=_.enabled===!1||_.isPresenting===!1||_.hasDepthSensing()===!1,J&&tt.addToRenderList(M,E),this.info.render.frame++,T===!0&&Ne.beginShadows();const w=m.state.shadowsArray;Fe.render(w,E,K),T===!0&&Ne.endShadows(),this.info.autoReset===!0&&this.info.reset();const W=M.opaque,Y=M.transmissive;if(m.setupLights(),K.isArrayCamera){const we=K.cameras;if(Y.length>0)for(let ve=0,de=we.length;ve<de;ve++){const be=we[ve];nt(W,Y,E,be)}J&&tt.render(E);for(let ve=0,de=we.length;ve<de;ve++){const be=we[ve];Je(M,E,be,be.viewport)}}else Y.length>0&&nt(W,Y,E,K),J&&tt.render(E),Je(M,E,K);V!==null&&(C.updateMultisampleRenderTarget(V),C.updateRenderTargetMipmap(V)),E.isScene===!0&&E.onAfterRender(L,E,K),mt.resetDefaultState(),le=-1,Te=null,P.pop(),P.length>0?(m=P[P.length-1],T===!0&&Ne.setGlobalState(L.clippingPlanes,m.state.camera)):m=null,g.pop(),g.length>0?M=g[g.length-1]:M=null};function Ze(E,K,w,W){if(E.visible===!1)return;if(E.layers.test(K.layers)){if(E.isGroup)w=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(K);else if(E.isLight)m.pushLight(E),E.castShadow&&m.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||te.intersectsSprite(E)){W&&Z.setFromMatrixPosition(E.matrixWorld).applyMatrix4(G);const ve=ee.update(E),de=E.material;de.visible&&M.push(E,ve,de,w,Z.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||te.intersectsObject(E))){const ve=ee.update(E),de=E.material;if(W&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),Z.copy(E.boundingSphere.center)):(ve.boundingSphere===null&&ve.computeBoundingSphere(),Z.copy(ve.boundingSphere.center)),Z.applyMatrix4(E.matrixWorld).applyMatrix4(G)),Array.isArray(de)){const be=ve.groups;for(let De=0,ke=be.length;De<ke;De++){const Re=be[De],et=de[Re.materialIndex];et&&et.visible&&M.push(E,ve,et,w,Z.z,Re)}}else de.visible&&M.push(E,ve,de,w,Z.z,null)}}const we=E.children;for(let ve=0,de=we.length;ve<de;ve++)Ze(we[ve],K,w,W)}function Je(E,K,w,W){const Y=E.opaque,we=E.transmissive,ve=E.transparent;m.setupLightsView(w),T===!0&&Ne.setGlobalState(L.clippingPlanes,w),W&&Pe.viewport(y.copy(W)),Y.length>0&&Oe(Y,K,w),we.length>0&&Oe(we,K,w),ve.length>0&&Oe(ve,K,w),Pe.buffers.depth.setTest(!0),Pe.buffers.depth.setMask(!0),Pe.buffers.color.setMask(!0),Pe.setPolygonOffset(!1)}function nt(E,K,w,W){if((w.isScene===!0?w.overrideMaterial:null)!==null)return;m.state.transmissionRenderTarget[W.id]===void 0&&(m.state.transmissionRenderTarget[W.id]=new ai(1,1,{generateMipmaps:!0,type:he.has("EXT_color_buffer_half_float")||he.has("EXT_color_buffer_float")?er:Rn,minFilter:On,samples:4,stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:xt.workingColorSpace}));const we=m.state.transmissionRenderTarget[W.id],ve=W.viewport||y;we.setSize(ve.z,ve.w);const de=L.getRenderTarget();L.setRenderTarget(we),L.getClearColor(ue),I=L.getClearAlpha(),I<1&&L.setClearColor(16777215,.5),L.clear(),J&&tt.render(w);const be=L.toneMapping;L.toneMapping=Bn;const De=W.viewport;if(W.viewport!==void 0&&(W.viewport=void 0),m.setupLightsView(W),T===!0&&Ne.setGlobalState(L.clippingPlanes,W),Oe(E,w,W),C.updateMultisampleRenderTarget(we),C.updateRenderTargetMipmap(we),he.has("WEBGL_multisampled_render_to_texture")===!1){let ke=!1;for(let Re=0,et=K.length;Re<et;Re++){const He=K[Re],ft=He.object,st=He.geometry,We=He.material,Xe=He.group;if(We.side===dn&&ft.layers.test(W.layers)){const vt=We.side;We.side=qt,We.needsUpdate=!0,je(ft,w,W,st,We,Xe),We.side=vt,We.needsUpdate=!0,ke=!0}}ke===!0&&(C.updateMultisampleRenderTarget(we),C.updateRenderTargetMipmap(we))}L.setRenderTarget(de),L.setClearColor(ue,I),De!==void 0&&(W.viewport=De),L.toneMapping=be}function Oe(E,K,w){const W=K.isScene===!0?K.overrideMaterial:null;for(let Y=0,we=E.length;Y<we;Y++){const ve=E[Y],de=ve.object,be=ve.geometry,De=W===null?ve.material:W,ke=ve.group;de.layers.test(w.layers)&&je(de,K,w,be,De,ke)}}function je(E,K,w,W,Y,we){E.onBeforeRender(L,K,w,W,Y,we),E.modelViewMatrix.multiplyMatrices(w.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),Y.onBeforeRender(L,K,w,W,E,we),Y.transparent===!0&&Y.side===dn&&Y.forceSinglePass===!1?(Y.side=qt,Y.needsUpdate=!0,L.renderBufferDirect(w,K,W,Y,E,we),Y.side=An,Y.needsUpdate=!0,L.renderBufferDirect(w,K,W,Y,E,we),Y.side=dn):L.renderBufferDirect(w,K,W,Y,E,we),E.onAfterRender(L,K,w,W,Y,we)}function Ke(E,K,w){K.isScene!==!0&&(K=q);const W=Ce.get(E),Y=m.state.lights,we=m.state.shadowsArray,ve=Y.state.version,de=Ie.getParameters(E,Y.state,we,K,w),be=Ie.getProgramCacheKey(de);let De=W.programs;W.environment=E.isMeshStandardMaterial?K.environment:null,W.fog=K.fog,W.envMap=(E.isMeshStandardMaterial?se:S).get(E.envMap||W.environment),W.envMapRotation=W.environment!==null&&E.envMap===null?K.environmentRotation:E.envMapRotation,De===void 0&&(E.addEventListener("dispose",pe),De=new Map,W.programs=De);let ke=De.get(be);if(ke!==void 0){if(W.currentProgram===ke&&W.lightsStateVersion===ve)return Mt(E,de),ke}else de.uniforms=Ie.getUniforms(E),E.onBeforeCompile(de,L),ke=Ie.acquireProgram(de,be),De.set(be,ke),W.uniforms=de.uniforms;const Re=W.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(Re.clippingPlanes=Ne.uniform),Mt(E,de),W.needsLights=ct(E),W.lightsStateVersion=ve,W.needsLights&&(Re.ambientLightColor.value=Y.state.ambient,Re.lightProbe.value=Y.state.probe,Re.directionalLights.value=Y.state.directional,Re.directionalLightShadows.value=Y.state.directionalShadow,Re.spotLights.value=Y.state.spot,Re.spotLightShadows.value=Y.state.spotShadow,Re.rectAreaLights.value=Y.state.rectArea,Re.ltc_1.value=Y.state.rectAreaLTC1,Re.ltc_2.value=Y.state.rectAreaLTC2,Re.pointLights.value=Y.state.point,Re.pointLightShadows.value=Y.state.pointShadow,Re.hemisphereLights.value=Y.state.hemi,Re.directionalShadowMap.value=Y.state.directionalShadowMap,Re.directionalShadowMatrix.value=Y.state.directionalShadowMatrix,Re.spotShadowMap.value=Y.state.spotShadowMap,Re.spotLightMatrix.value=Y.state.spotLightMatrix,Re.spotLightMap.value=Y.state.spotLightMap,Re.pointShadowMap.value=Y.state.pointShadowMap,Re.pointShadowMatrix.value=Y.state.pointShadowMatrix),W.currentProgram=ke,W.uniformsList=null,ke}function pt(E){if(E.uniformsList===null){const K=E.currentProgram.getUniforms();E.uniformsList=Or.seqWithValue(K.seq,E.uniforms)}return E.uniformsList}function Mt(E,K){const w=Ce.get(E);w.outputColorSpace=K.outputColorSpace,w.batching=K.batching,w.batchingColor=K.batchingColor,w.instancing=K.instancing,w.instancingColor=K.instancingColor,w.instancingMorph=K.instancingMorph,w.skinning=K.skinning,w.morphTargets=K.morphTargets,w.morphNormals=K.morphNormals,w.morphColors=K.morphColors,w.morphTargetsCount=K.morphTargetsCount,w.numClippingPlanes=K.numClippingPlanes,w.numIntersection=K.numClipIntersection,w.vertexAlphas=K.vertexAlphas,w.vertexTangents=K.vertexTangents,w.toneMapping=K.toneMapping}function gt(E,K,w,W,Y){K.isScene!==!0&&(K=q),C.resetTextureUnits();const we=K.fog,ve=W.isMeshStandardMaterial?K.environment:null,de=V===null?L.outputColorSpace:V.isXRRenderTarget===!0?V.texture.colorSpace:Gn,be=(W.isMeshStandardMaterial?se:S).get(W.envMap||ve),De=W.vertexColors===!0&&!!w.attributes.color&&w.attributes.color.itemSize===4,ke=!!w.attributes.tangent&&(!!W.normalMap||W.anisotropy>0),Re=!!w.morphAttributes.position,et=!!w.morphAttributes.normal,He=!!w.morphAttributes.color;let ft=Bn;W.toneMapped&&(V===null||V.isXRRenderTarget===!0)&&(ft=L.toneMapping);const st=w.morphAttributes.position||w.morphAttributes.normal||w.morphAttributes.color,We=st!==void 0?st.length:0,Xe=Ce.get(W),vt=m.state.lights;if(T===!0&&(D===!0||E!==Te)){const Dt=E===Te&&W.id===le;Ne.setState(W,E,Dt)}let lt=!1;W.version===Xe.__version?(Xe.needsLights&&Xe.lightsStateVersion!==vt.state.version||Xe.outputColorSpace!==de||Y.isBatchedMesh&&Xe.batching===!1||!Y.isBatchedMesh&&Xe.batching===!0||Y.isBatchedMesh&&Xe.batchingColor===!0&&Y.colorTexture===null||Y.isBatchedMesh&&Xe.batchingColor===!1&&Y.colorTexture!==null||Y.isInstancedMesh&&Xe.instancing===!1||!Y.isInstancedMesh&&Xe.instancing===!0||Y.isSkinnedMesh&&Xe.skinning===!1||!Y.isSkinnedMesh&&Xe.skinning===!0||Y.isInstancedMesh&&Xe.instancingColor===!0&&Y.instanceColor===null||Y.isInstancedMesh&&Xe.instancingColor===!1&&Y.instanceColor!==null||Y.isInstancedMesh&&Xe.instancingMorph===!0&&Y.morphTexture===null||Y.isInstancedMesh&&Xe.instancingMorph===!1&&Y.morphTexture!==null||Xe.envMap!==be||W.fog===!0&&Xe.fog!==we||Xe.numClippingPlanes!==void 0&&(Xe.numClippingPlanes!==Ne.numPlanes||Xe.numIntersection!==Ne.numIntersection)||Xe.vertexAlphas!==De||Xe.vertexTangents!==ke||Xe.morphTargets!==Re||Xe.morphNormals!==et||Xe.morphColors!==He||Xe.toneMapping!==ft||Xe.morphTargetsCount!==We)&&(lt=!0):(lt=!0,Xe.__version=W.version);let It=Xe.currentProgram;lt===!0&&(It=Ke(W,K,Y));let Zt=!1,yt=!1,Bt=!1;const St=It.getUniforms(),un=Xe.uniforms;if(Pe.useProgram(It.program)&&(Zt=!0,yt=!0,Bt=!0),W.id!==le&&(le=W.id,yt=!0),Zt||Te!==E){ye.reverseDepthBuffer?(O.copy(E.projectionMatrix),Tu(O),Au(O),St.setValue(R,"projectionMatrix",O)):St.setValue(R,"projectionMatrix",E.projectionMatrix),St.setValue(R,"viewMatrix",E.matrixWorldInverse);const Dt=St.map.cameraPosition;Dt!==void 0&&Dt.setValue(R,ne.setFromMatrixPosition(E.matrixWorld)),ye.logarithmicDepthBuffer&&St.setValue(R,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(W.isMeshPhongMaterial||W.isMeshToonMaterial||W.isMeshLambertMaterial||W.isMeshBasicMaterial||W.isMeshStandardMaterial||W.isShaderMaterial)&&St.setValue(R,"isOrthographic",E.isOrthographicCamera===!0),Te!==E&&(Te=E,yt=!0,Bt=!0)}if(Y.isSkinnedMesh){St.setOptional(R,Y,"bindMatrix"),St.setOptional(R,Y,"bindMatrixInverse");const Dt=Y.skeleton;Dt&&(Dt.boneTexture===null&&Dt.computeBoneTexture(),St.setValue(R,"boneTexture",Dt.boneTexture,C))}Y.isBatchedMesh&&(St.setOptional(R,Y,"batchingTexture"),St.setValue(R,"batchingTexture",Y._matricesTexture,C),St.setOptional(R,Y,"batchingIdTexture"),St.setValue(R,"batchingIdTexture",Y._indirectTexture,C),St.setOptional(R,Y,"batchingColorTexture"),Y._colorsTexture!==null&&St.setValue(R,"batchingColorTexture",Y._colorsTexture,C));const Wn=w.morphAttributes;if((Wn.position!==void 0||Wn.normal!==void 0||Wn.color!==void 0)&&it.update(Y,w,It),(yt||Xe.receiveShadow!==Y.receiveShadow)&&(Xe.receiveShadow=Y.receiveShadow,St.setValue(R,"receiveShadow",Y.receiveShadow)),W.isMeshGouraudMaterial&&W.envMap!==null&&(un.envMap.value=be,un.flipEnvMap.value=be.isCubeTexture&&be.isRenderTargetTexture===!1?-1:1),W.isMeshStandardMaterial&&W.envMap===null&&K.environment!==null&&(un.envMapIntensity.value=K.environmentIntensity),yt&&(St.setValue(R,"toneMappingExposure",L.toneMappingExposure),Xe.needsLights&&Ye(un,Bt),we&&W.fog===!0&&Le.refreshFogUniforms(un,we),Le.refreshMaterialUniforms(un,W,j,x,m.state.transmissionRenderTarget[E.id]),Or.upload(R,pt(Xe),un,C)),W.isShaderMaterial&&W.uniformsNeedUpdate===!0&&(Or.upload(R,pt(Xe),un,C),W.uniformsNeedUpdate=!1),W.isSpriteMaterial&&St.setValue(R,"center",Y.center),St.setValue(R,"modelViewMatrix",Y.modelViewMatrix),St.setValue(R,"normalMatrix",Y.normalMatrix),St.setValue(R,"modelMatrix",Y.matrixWorld),W.isShaderMaterial||W.isRawShaderMaterial){const Dt=W.uniformsGroups;for(let Kr=0,vc=Dt.length;Kr<vc;Kr++){const ko=Dt[Kr];oe.update(ko,It),oe.bind(ko,It)}}return It}function Ye(E,K){E.ambientLightColor.needsUpdate=K,E.lightProbe.needsUpdate=K,E.directionalLights.needsUpdate=K,E.directionalLightShadows.needsUpdate=K,E.pointLights.needsUpdate=K,E.pointLightShadows.needsUpdate=K,E.spotLights.needsUpdate=K,E.spotLightShadows.needsUpdate=K,E.rectAreaLights.needsUpdate=K,E.hemisphereLights.needsUpdate=K}function ct(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return Q},this.getActiveMipmapLevel=function(){return H},this.getRenderTarget=function(){return V},this.setRenderTargetTextures=function(E,K,w){Ce.get(E.texture).__webglTexture=K,Ce.get(E.depthTexture).__webglTexture=w;const W=Ce.get(E);W.__hasExternalTextures=!0,W.__autoAllocateDepthBuffer=w===void 0,W.__autoAllocateDepthBuffer||he.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),W.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(E,K){const w=Ce.get(E);w.__webglFramebuffer=K,w.__useDefaultFramebuffer=K===void 0},this.setRenderTarget=function(E,K=0,w=0){V=E,Q=K,H=w;let W=!0,Y=null,we=!1,ve=!1;if(E){const be=Ce.get(E);if(be.__useDefaultFramebuffer!==void 0)Pe.bindFramebuffer(R.FRAMEBUFFER,null),W=!1;else if(be.__webglFramebuffer===void 0)C.setupRenderTarget(E);else if(be.__hasExternalTextures)C.rebindTextures(E,Ce.get(E.texture).__webglTexture,Ce.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){const Re=E.depthTexture;if(be.__boundDepthTexture!==Re){if(Re!==null&&Ce.has(Re)&&(E.width!==Re.image.width||E.height!==Re.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");C.setupDepthRenderbuffer(E)}}const De=E.texture;(De.isData3DTexture||De.isDataArrayTexture||De.isCompressedArrayTexture)&&(ve=!0);const ke=Ce.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(ke[K])?Y=ke[K][w]:Y=ke[K],we=!0):E.samples>0&&C.useMultisampledRTT(E)===!1?Y=Ce.get(E).__webglMultisampledFramebuffer:Array.isArray(ke)?Y=ke[w]:Y=ke,y.copy(E.viewport),A.copy(E.scissor),Me=E.scissorTest}else y.copy(N).multiplyScalar(j).floor(),A.copy(U).multiplyScalar(j).floor(),Me=k;if(Pe.bindFramebuffer(R.FRAMEBUFFER,Y)&&W&&Pe.drawBuffers(E,Y),Pe.viewport(y),Pe.scissor(A),Pe.setScissorTest(Me),we){const be=Ce.get(E.texture);R.framebufferTexture2D(R.FRAMEBUFFER,R.COLOR_ATTACHMENT0,R.TEXTURE_CUBE_MAP_POSITIVE_X+K,be.__webglTexture,w)}else if(ve){const be=Ce.get(E.texture),De=K||0;R.framebufferTextureLayer(R.FRAMEBUFFER,R.COLOR_ATTACHMENT0,be.__webglTexture,w||0,De)}le=-1},this.readRenderTargetPixels=function(E,K,w,W,Y,we,ve){if(!(E&&E.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let de=Ce.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&ve!==void 0&&(de=de[ve]),de){Pe.bindFramebuffer(R.FRAMEBUFFER,de);try{const be=E.texture,De=be.format,ke=be.type;if(!ye.textureFormatReadable(De)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!ye.textureTypeReadable(ke)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}K>=0&&K<=E.width-W&&w>=0&&w<=E.height-Y&&R.readPixels(K,w,W,Y,rt.convert(De),rt.convert(ke),we)}finally{const be=V!==null?Ce.get(V).__webglFramebuffer:null;Pe.bindFramebuffer(R.FRAMEBUFFER,be)}}},this.readRenderTargetPixelsAsync=async function(E,K,w,W,Y,we,ve){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let de=Ce.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&ve!==void 0&&(de=de[ve]),de){const be=E.texture,De=be.format,ke=be.type;if(!ye.textureFormatReadable(De))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!ye.textureTypeReadable(ke))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(K>=0&&K<=E.width-W&&w>=0&&w<=E.height-Y){Pe.bindFramebuffer(R.FRAMEBUFFER,de);const Re=R.createBuffer();R.bindBuffer(R.PIXEL_PACK_BUFFER,Re),R.bufferData(R.PIXEL_PACK_BUFFER,we.byteLength,R.STREAM_READ),R.readPixels(K,w,W,Y,rt.convert(De),rt.convert(ke),0);const et=V!==null?Ce.get(V).__webglFramebuffer:null;Pe.bindFramebuffer(R.FRAMEBUFFER,et);const He=R.fenceSync(R.SYNC_GPU_COMMANDS_COMPLETE,0);return R.flush(),await wu(R,He,4),R.bindBuffer(R.PIXEL_PACK_BUFFER,Re),R.getBufferSubData(R.PIXEL_PACK_BUFFER,0,we),R.deleteBuffer(Re),R.deleteSync(He),we}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(E,K=null,w=0){E.isTexture!==!0&&(Fr("WebGLRenderer: copyFramebufferToTexture function signature has changed."),K=arguments[0]||null,E=arguments[1]);const W=Math.pow(2,-w),Y=Math.floor(E.image.width*W),we=Math.floor(E.image.height*W),ve=K!==null?K.x:0,de=K!==null?K.y:0;C.setTexture2D(E,0),R.copyTexSubImage2D(R.TEXTURE_2D,w,0,0,ve,de,Y,we),Pe.unbindTexture()},this.copyTextureToTexture=function(E,K,w=null,W=null,Y=0){E.isTexture!==!0&&(Fr("WebGLRenderer: copyTextureToTexture function signature has changed."),W=arguments[0]||null,E=arguments[1],K=arguments[2],Y=arguments[3]||0,w=null);let we,ve,de,be,De,ke;w!==null?(we=w.max.x-w.min.x,ve=w.max.y-w.min.y,de=w.min.x,be=w.min.y):(we=E.image.width,ve=E.image.height,de=0,be=0),W!==null?(De=W.x,ke=W.y):(De=0,ke=0);const Re=rt.convert(K.format),et=rt.convert(K.type);C.setTexture2D(K,0),R.pixelStorei(R.UNPACK_FLIP_Y_WEBGL,K.flipY),R.pixelStorei(R.UNPACK_PREMULTIPLY_ALPHA_WEBGL,K.premultiplyAlpha),R.pixelStorei(R.UNPACK_ALIGNMENT,K.unpackAlignment);const He=R.getParameter(R.UNPACK_ROW_LENGTH),ft=R.getParameter(R.UNPACK_IMAGE_HEIGHT),st=R.getParameter(R.UNPACK_SKIP_PIXELS),We=R.getParameter(R.UNPACK_SKIP_ROWS),Xe=R.getParameter(R.UNPACK_SKIP_IMAGES),vt=E.isCompressedTexture?E.mipmaps[Y]:E.image;R.pixelStorei(R.UNPACK_ROW_LENGTH,vt.width),R.pixelStorei(R.UNPACK_IMAGE_HEIGHT,vt.height),R.pixelStorei(R.UNPACK_SKIP_PIXELS,de),R.pixelStorei(R.UNPACK_SKIP_ROWS,be),E.isDataTexture?R.texSubImage2D(R.TEXTURE_2D,Y,De,ke,we,ve,Re,et,vt.data):E.isCompressedTexture?R.compressedTexSubImage2D(R.TEXTURE_2D,Y,De,ke,vt.width,vt.height,Re,vt.data):R.texSubImage2D(R.TEXTURE_2D,Y,De,ke,we,ve,Re,et,vt),R.pixelStorei(R.UNPACK_ROW_LENGTH,He),R.pixelStorei(R.UNPACK_IMAGE_HEIGHT,ft),R.pixelStorei(R.UNPACK_SKIP_PIXELS,st),R.pixelStorei(R.UNPACK_SKIP_ROWS,We),R.pixelStorei(R.UNPACK_SKIP_IMAGES,Xe),Y===0&&K.generateMipmaps&&R.generateMipmap(R.TEXTURE_2D),Pe.unbindTexture()},this.copyTextureToTexture3D=function(E,K,w=null,W=null,Y=0){E.isTexture!==!0&&(Fr("WebGLRenderer: copyTextureToTexture3D function signature has changed."),w=arguments[0]||null,W=arguments[1]||null,E=arguments[2],K=arguments[3],Y=arguments[4]||0);let we,ve,de,be,De,ke,Re,et,He;const ft=E.isCompressedTexture?E.mipmaps[Y]:E.image;w!==null?(we=w.max.x-w.min.x,ve=w.max.y-w.min.y,de=w.max.z-w.min.z,be=w.min.x,De=w.min.y,ke=w.min.z):(we=ft.width,ve=ft.height,de=ft.depth,be=0,De=0,ke=0),W!==null?(Re=W.x,et=W.y,He=W.z):(Re=0,et=0,He=0);const st=rt.convert(K.format),We=rt.convert(K.type);let Xe;if(K.isData3DTexture)C.setTexture3D(K,0),Xe=R.TEXTURE_3D;else if(K.isDataArrayTexture||K.isCompressedArrayTexture)C.setTexture2DArray(K,0),Xe=R.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}R.pixelStorei(R.UNPACK_FLIP_Y_WEBGL,K.flipY),R.pixelStorei(R.UNPACK_PREMULTIPLY_ALPHA_WEBGL,K.premultiplyAlpha),R.pixelStorei(R.UNPACK_ALIGNMENT,K.unpackAlignment);const vt=R.getParameter(R.UNPACK_ROW_LENGTH),lt=R.getParameter(R.UNPACK_IMAGE_HEIGHT),It=R.getParameter(R.UNPACK_SKIP_PIXELS),Zt=R.getParameter(R.UNPACK_SKIP_ROWS),yt=R.getParameter(R.UNPACK_SKIP_IMAGES);R.pixelStorei(R.UNPACK_ROW_LENGTH,ft.width),R.pixelStorei(R.UNPACK_IMAGE_HEIGHT,ft.height),R.pixelStorei(R.UNPACK_SKIP_PIXELS,be),R.pixelStorei(R.UNPACK_SKIP_ROWS,De),R.pixelStorei(R.UNPACK_SKIP_IMAGES,ke),E.isDataTexture||E.isData3DTexture?R.texSubImage3D(Xe,Y,Re,et,He,we,ve,de,st,We,ft.data):K.isCompressedArrayTexture?R.compressedTexSubImage3D(Xe,Y,Re,et,He,we,ve,de,st,ft.data):R.texSubImage3D(Xe,Y,Re,et,He,we,ve,de,st,We,ft),R.pixelStorei(R.UNPACK_ROW_LENGTH,vt),R.pixelStorei(R.UNPACK_IMAGE_HEIGHT,lt),R.pixelStorei(R.UNPACK_SKIP_PIXELS,It),R.pixelStorei(R.UNPACK_SKIP_ROWS,Zt),R.pixelStorei(R.UNPACK_SKIP_IMAGES,yt),Y===0&&K.generateMipmaps&&R.generateMipmap(Xe),Pe.unbindTexture()},this.initRenderTarget=function(E){Ce.get(E).__webglFramebuffer===void 0&&C.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?C.setTextureCube(E,0):E.isData3DTexture?C.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?C.setTexture2DArray(E,0):C.setTexture2D(E,0),Pe.unbindTexture()},this.resetState=function(){Q=0,H=0,V=null,Pe.reset(),mt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return wn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=e===Do?"display-p3":"srgb",t.unpackColorSpace=xt.workingColorSpace===qr?"display-p3":"srgb"}}class Bm extends Lt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new cn,this.environmentIntensity=1,this.environmentRotation=new cn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}const Oa=new ae,za=new Et,Ba=new Et,km=new ae,ka=new dt,br=new ae,Ts=new Vn,Ha=new dt,As=new Ol;class yo extends Xt{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Xo,this.bindMatrix=new dt,this.bindMatrixInverse=new dt,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const e=this.geometry;this.boundingBox===null&&(this.boundingBox=new pn),this.boundingBox.makeEmpty();const t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,br),this.boundingBox.expandByPoint(br)}computeBoundingSphere(){const e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new Vn),this.boundingSphere.makeEmpty();const t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,br),this.boundingSphere.expandByPoint(br)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){const i=this.material,r=this.matrixWorld;i!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Ts.copy(this.boundingSphere),Ts.applyMatrix4(r),e.ray.intersectsSphere(Ts)!==!1&&(Ha.copy(r).invert(),As.copy(e.ray).applyMatrix4(Ha),!(this.boundingBox!==null&&As.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,As)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const e=new Et,t=this.geometry.attributes.skinWeight;for(let i=0,r=t.count;i<r;i++){e.fromBufferAttribute(t,i);const s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(i,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Xo?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===Kc?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){const i=this.skeleton,r=this.geometry;za.fromBufferAttribute(r.attributes.skinIndex,e),Ba.fromBufferAttribute(r.attributes.skinWeight,e),Oa.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let s=0;s<4;s++){const o=Ba.getComponent(s);if(o!==0){const a=za.getComponent(s);ka.multiplyMatrices(i.bones[a].matrixWorld,i.boneInverses[a]),t.addScaledVector(km.copy(Oa).applyMatrix4(ka),o)}}return t.applyMatrix4(this.bindMatrixInverse)}}class Jl extends Lt{constructor(){super(),this.isBone=!0,this.type="Bone"}}class Ql extends zt{constructor(e=null,t=1,i=1,r,s,o,a,l,u=Ot,c=Ot,h,f){super(null,o,a,l,u,c,r,s,h,f),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const Ga=new dt,Hm=new dt;class Oo{constructor(e=[],t=[]){this.uuid=li(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){const e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let i=0,r=this.bones.length;i<r;i++)this.boneInverses.push(new dt)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){const i=new dt;this.bones[e]&&i.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(i)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&i.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&(i.parent&&i.parent.isBone?(i.matrix.copy(i.parent.matrixWorld).invert(),i.matrix.multiply(i.matrixWorld)):i.matrix.copy(i.matrixWorld),i.matrix.decompose(i.position,i.quaternion,i.scale))}}update(){const e=this.bones,t=this.boneInverses,i=this.boneMatrices,r=this.boneTexture;for(let s=0,o=e.length;s<o;s++){const a=e[s]?e[s].matrixWorld:Hm;Ga.multiplyMatrices(a,t[s]),Ga.toArray(i,s*16)}r!==null&&(r.needsUpdate=!0)}clone(){return new Oo(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);const t=new Float32Array(e*e*4);t.set(this.boneMatrices);const i=new Ql(t,e,e,en,ln);return i.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=i,this}getBoneByName(e){for(let t=0,i=this.bones.length;t<i;t++){const r=this.bones[t];if(r.name===e)return r}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let i=0,r=e.bones.length;i<r;i++){const s=e.bones[i];let o=t[s];o===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",s),o=new Jl),this.bones.push(o),this.boneInverses.push(new dt().fromArray(e.boneInverses[i]))}return this.init(),this}toJSON(){const e={metadata:{version:4.6,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;const t=this.bones,i=this.boneInverses;for(let r=0,s=t.length;r<s;r++){const o=t[r];e.bones.push(o.uuid);const a=i[r];e.boneInverses.push(a.toArray())}return e}}class So extends Yt{constructor(e,t,i,r=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const Ei=new dt,Va=new dt,Er=[],Wa=new pn,Gm=new dt,Wi=new Xt,Xi=new Vn;class Vm extends Xt{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new So(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<i;r++)this.setMatrixAt(r,Gm)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new pn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Ei),Wa.copy(e.boundingBox).applyMatrix4(Ei),this.boundingBox.union(Wa)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Vn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Ei),Xi.copy(e.boundingSphere).applyMatrix4(Ei),this.boundingSphere.union(Xi)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const i=t.morphTargetInfluences,r=this.morphTexture.source.data.data,s=i.length+1,o=e*s+1;for(let a=0;a<i.length;a++)i[a]=r[o+a]}raycast(e,t){const i=this.matrixWorld,r=this.count;if(Wi.geometry=this.geometry,Wi.material=this.material,Wi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Xi.copy(this.boundingSphere),Xi.applyMatrix4(i),e.ray.intersectsSphere(Xi)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,Ei),Va.multiplyMatrices(i,Ei),Wi.matrixWorld=Va,Wi.raycast(e,Er);for(let o=0,a=Er.length;o<a;o++){const l=Er[o];l.instanceId=s,l.object=this,t.push(l)}Er.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new So(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){const i=t.morphTargetInfluences,r=i.length+1;this.morphTexture===null&&(this.morphTexture=new Ql(new Float32Array(r*this.count),r,this.count,Co,ln));const s=this.morphTexture.source.data.data;let o=0;for(let u=0;u<i.length;u++)o+=i[u];const a=this.geometry.morphTargetsRelative?1:1-o,l=r*e;s[l]=a,s.set(i,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class ec extends tr{constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new ot(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ot(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ll,this.normalScale=new _t(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new cn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Wm extends ec{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new _t(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Ft(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new ot(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new ot(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new ot(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}const Xa={enabled:!1,files:{},add:function(n,e){this.enabled!==!1&&(this.files[n]=e)},get:function(n){if(this.enabled!==!1)return this.files[n]},remove:function(n){delete this.files[n]},clear:function(){this.files={}}};class Xm{constructor(e,t,i){const r=this;let s=!1,o=0,a=0,l;const u=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this.itemStart=function(c){a++,s===!1&&r.onStart!==void 0&&r.onStart(c,o,a),s=!0},this.itemEnd=function(c){o++,r.onProgress!==void 0&&r.onProgress(c,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(c){r.onError!==void 0&&r.onError(c)},this.resolveURL=function(c){return l?l(c):c},this.setURLModifier=function(c){return l=c,this},this.addHandler=function(c,h){return u.push(c,h),this},this.removeHandler=function(c){const h=u.indexOf(c);return h!==-1&&u.splice(h,2),this},this.getHandler=function(c){for(let h=0,f=u.length;h<f;h+=2){const p=u[h],v=u[h+1];if(p.global&&(p.lastIndex=0),p.test(c))return v}return null}}}const qm=new Xm;class zo{constructor(e){this.manager=e!==void 0?e:qm,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){const i=this;return new Promise(function(r,s){i.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}}zo.DEFAULT_MATERIAL_NAME="__DEFAULT";class Ym extends zo{constructor(e){super(e)}load(e,t,i,r){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,o=Xa.get(e);if(o!==void 0)return s.manager.itemStart(e),setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o;const a=Qi("img");function l(){c(),Xa.add(e,this),t&&t(this),s.manager.itemEnd(e)}function u(h){c(),r&&r(h),s.manager.itemError(e),s.manager.itemEnd(e)}function c(){a.removeEventListener("load",l,!1),a.removeEventListener("error",u,!1)}return a.addEventListener("load",l,!1),a.addEventListener("error",u,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),s.manager.itemStart(e),a.src=e,a}}class $m extends zo{constructor(e){super(e)}load(e,t,i,r){const s=new zt,o=new Ym(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){s.image=a,s.needsUpdate=!0,t!==void 0&&t(s)},i,r),s}}class tc extends Lt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new ot(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}}class jm extends tc{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Lt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new ot(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}}const Rs=new dt,qa=new ae,Ya=new ae;class Km{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new _t(512,512),this.map=null,this.mapPass=null,this.matrix=new dt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Yr,this._frameExtents=new _t(1,1),this._viewportCount=1,this._viewports=[new Et(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,i=this.matrix;qa.setFromMatrixPosition(e.matrixWorld),t.position.copy(qa),Ya.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Ya),t.updateMatrixWorld(),Rs.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Rs),i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Rs)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class Zm extends Km{constructor(){super(new ql(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class $a extends tc{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Lt.DEFAULT_UP),this.updateMatrix(),this.target=new Lt,this.shadow=new Zm}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:wo}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=wo);var wt;(n=>{n.create=(t=0,i=0,r=0)=>({x:t,y:i,z:r}),n.add=(t,i)=>({x:t.x+i.x,y:t.y+i.y,z:t.z+i.z}),n.subtract=(t,i)=>({x:t.x-i.x,y:t.y-i.y,z:t.z-i.z}),n.scale=(t,i)=>({x:t.x*i,y:t.y*i,z:t.z*i}),n.dot=(t,i)=>t.x*i.x+t.y*i.y+t.z*i.z,n.cross=(t,i)=>({x:t.y*i.z-t.z*i.y,y:t.z*i.x-t.x*i.z,z:t.x*i.y-t.y*i.x}),n.length=t=>e(t)===0?Math.sqrt((0,n.dot)(t,t)):Math.hypot(t.x,t.y,t.z),n.normalize=t=>{const i=e(t),r=i===0?t:{x:t.x/i,y:t.y/i,z:t.z/i},s=(0,n.length)(r);return s===0?(0,n.create)(0,0,0):(0,n.scale)(r,1/s)};const e=t=>{const i=Math.max(Math.abs(t.x),Math.abs(t.y),Math.abs(t.z));return Number.isFinite(i)&&i>0&&(i<2**-511||i>2**511)?i:0};n.lerp=(t,i,r)=>({x:t.x+(i.x-t.x)*r,y:t.y+(i.y-t.y)*r,z:t.z+(i.z-t.z)*r})})(wt||(wt={}));const Jm=(n,e)=>{const t=Math.trunc(n),i=t>>>0,r=Math.floor(t/4294967296)>>>0;let s=(e^i)>>>0;return s=Math.imul(s^s>>>16,2146121005),s=Math.imul(s^s>>>15^r,2221713035),(s^s>>>16)>>>0},Vt=(...n)=>{let e=2654435769;for(const i of n)e=Jm(i,e);e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296};var si;(n=>{n.identity=()=>({x:0,y:0,z:0,w:1}),n.DEG2RAD=Math.PI/180,n.multiply=(e,t)=>({x:e.w*t.x+e.x*t.w+e.y*t.z-e.z*t.y,y:e.w*t.y-e.x*t.z+e.y*t.w+e.z*t.x,z:e.w*t.z+e.x*t.y-e.y*t.x+e.z*t.w,w:e.w*t.w-e.x*t.x-e.y*t.y-e.z*t.z}),n.normalize=e=>{const t=Math.sqrt(e.x*e.x+e.y*e.y+e.z*e.z+e.w*e.w);if(t===0)return(0,n.identity)();const i=1/t;return{x:e.x*i,y:e.y*i,z:e.z*i,w:e.w*i}},n.inverse=e=>(0,n.normalize)({x:-e.x,y:-e.y,z:-e.z,w:e.w}),n.fromAxisAngle=(e,t)=>{const i=Math.sqrt(e.x*e.x+e.y*e.y+e.z*e.z);if(i===0)return(0,n.identity)();const r=t*n.DEG2RAD/2,s=Math.sin(r)/i;return{x:e.x*s,y:e.y*s,z:e.z*s,w:Math.cos(r)}},n.fromEuler=e=>{const t=r=>r==="X"?{x:1,y:0,z:0}:r==="Y"?{x:0,y:1,z:0}:{x:0,y:0,z:1},i=r=>r==="X"?e.x:r==="Y"?e.y:e.z;return e.order.split("").map(r=>(0,n.fromAxisAngle)(t(r),i(r))).reduce((r,s)=>(0,n.multiply)(r,s),(0,n.identity)())},n.rotateVector=(e,t)=>{const i=2*(e.y*t.z-e.z*t.y),r=2*(e.z*t.x-e.x*t.z),s=2*(e.x*t.y-e.y*t.x);return{x:t.x+e.w*i+(e.y*s-e.z*r),y:t.y+e.w*r+(e.z*i-e.x*s),z:t.z+e.w*s+(e.x*r-e.y*i)}},n.slerp=(e,t,i)=>{let r=e.x*t.x+e.y*t.y+e.z*t.z+e.w*t.w,s=t.x,o=t.y,a=t.z,l=t.w;if(r<0&&(r=-r,s=-s,o=-o,a=-a,l=-l),r>.9995)return(0,n.normalize)({x:e.x+(s-e.x)*i,y:e.y+(o-e.y)*i,z:e.z+(a-e.z)*i,w:e.w+(l-e.w)*i});const u=Math.acos(r),c=Math.sin(u),h=Math.sin((1-i)*u)/c,f=Math.sin(i*u)/c;return{x:e.x*h+s*f,y:e.y*h+o*f,z:e.z*h+a*f,w:e.w*h+l*f}}})(si||(si={}));var ja;(n=>{n.identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],n.compose=(e,t,i)=>{const r=t.x+t.x,s=t.y+t.y,o=t.z+t.z,a=t.x*r,l=t.x*s,u=t.x*o,c=t.y*s,h=t.y*o,f=t.z*o,p=t.w*r,v=t.w*s,M=t.w*o;return[(1-(c+f))*i.x,(l+M)*i.x,(u-v)*i.x,0,(l-M)*i.y,(1-(a+f))*i.y,(h+p)*i.y,0,(u+v)*i.z,(h-p)*i.z,(1-(a+c))*i.z,0,e.x,e.y,e.z,1]},n.multiply=(e,t)=>{const i=new Array(16);for(let r=0;r<4;++r)for(let s=0;s<4;++s){let o=0;for(let a=0;a<4;++a)o+=e[a*4+s]*t[r*4+a];i[r*4+s]=o}return i},n.position=e=>({x:e[12],y:e[13],z:e[14]}),n.decompose=e=>{const t=Math.hypot(e[0],e[1],e[2]),i=Math.hypot(e[4],e[5],e[6]),r=Math.hypot(e[8],e[9],e[10]),s=Math.max(t,Number.EPSILON),o=Math.max(i,Number.EPSILON),a=Math.max(r,Number.EPSILON),l=e[0]/s,u=e[1]/s,c=e[2]/s,h=e[4]/o,f=e[5]/o,p=e[6]/o,v=e[8]/a,M=e[9]/a,m=e[10]/a,g=l+f+m;let P,L,F,Q;if(g>0){const H=.5/Math.sqrt(g+1);Q=.25/H,P=(p-M)*H,L=(v-c)*H,F=(u-h)*H}else if(l>f&&l>m){const H=2*Math.sqrt(1+l-f-m);Q=(p-M)/H,P=.25*H,L=(h+u)/H,F=(v+c)/H}else if(f>m){const H=2*Math.sqrt(1+f-l-m);Q=(v-c)/H,P=(h+u)/H,L=.25*H,F=(M+p)/H}else{const H=2*Math.sqrt(1+m-l-f);Q=(u-h)/H,P=(v+c)/H,L=(M+p)/H,F=.25*H}return{position:{x:e[12],y:e[13],z:e[14]},rotation:{x:P,y:L,z:F,w:Q},scale:{x:t,y:i,z:r}}}})(ja||(ja={}));const Qm=/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i,e0=n=>{const e=Qm.exec(n);if(e===null)throw new Error(`sRGB color "${n}" is not one opaque six-digit #RRGGBB swatch.`);const t={r:Ps(Number.parseInt(e[1],16)/255),g:Ps(Number.parseInt(e[2],16)/255),b:Ps(Number.parseInt(e[3],16)/255)};return{...t,a:1,hex:t0(t)}},t0=n=>`#${Cs(n.r)}${Cs(n.g)}${Cs(n.b)}`,Cs=n=>{if(Number.isFinite(n)===!1)throw new Error(`Linear color component ${n} is not a finite number.`);return Math.round(n0(Math.min(1,Math.max(0,n)))*255).toString(16).padStart(2,"0")},Ps=n=>n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4),n0=n=>n<=.0031308?n*12.92:1.055*Math.pow(n,1/2.4)-.055,nc=n=>{switch(n.type){case"box":return Ka(n.width,n.height,n.depth);case"plane":return Ka(n.width,0,n.depth);case"sphere":return i0(n.radius,16,12);case"cylinder":return Ls(n.radius,n.radius,n.height,16);case"cone":return Ls(n.radius,0,n.height,16);case"capsule":return Ls(n.radius,n.radius,n.height+2*n.radius,16);default:{const e=n;throw new Error(`unknown primitive shape "${String(e.type)}"`)}}},Ka=(n,e,t)=>{const i=n/2,r=e/2,s=t/2,o=[],a=[],l=[],u=[[[i,-r,-s,i,r,-s,i,r,s,i,-r,s],[1,0,0]],[[-i,-r,s,-i,r,s,-i,r,-s,-i,-r,-s],[-1,0,0]],[[-i,r,-s,-i,r,s,i,r,s,i,r,-s],[0,1,0]],[[-i,-r,s,-i,-r,-s,i,-r,-s,i,-r,s],[0,-1,0]],[[-i,-r,s,i,-r,s,i,r,s,-i,r,s],[0,0,1]],[[i,-r,-s,-i,-r,-s,-i,r,-s,i,r,-s],[0,0,-1]]];for(const[c,h]of u){const f=o.length/3;for(let p=0;p<4;++p)o.push(c[p*3],c[p*3+1],c[p*3+2]),a.push(h[0],h[1],h[2]);l.push(f,f+1,f+2,f,f+2,f+3)}return{positions:o,normals:a,indices:l}},i0=(n,e,t)=>{const i=[],r=[],s=[];for(let a=0;a<=t;++a){const l=a/t*Math.PI,u=Math.sin(l),c=Math.cos(l);for(let h=0;h<=e;++h){const f=h/e*Math.PI*2,p=u*Math.cos(f),v=c,M=u*Math.sin(f);r.push(p,v,M),i.push(p*n,v*n,M*n)}}const o=e+1;for(let a=0;a<t;++a)for(let l=0;l<e;++l){const u=a*o+l,c=u+o;s.push(u,u+1,c,u+1,c+1,c)}return{positions:i,normals:r,indices:s}},Ls=(n,e,t,i)=>{const r=[],s=[],o=[],a=t/2,l=Math.hypot(t,e-n),u=t/l,c=(e-n)/l;for(let f=0;f<=i;++f){const p=f/i*Math.PI*2,v=Math.cos(p),M=Math.sin(p);r.push(v*n,a,M*n),s.push(v*u,c,M*u),r.push(v*e,-a,M*e),s.push(v*u,c,M*u)}for(let f=0;f<i;++f){const p=f*2;o.push(p,p+2,p+1,p+2,p+3,p+1)}const h=(f,p,v)=>{if(f<=0)return;const M=r.length/3;r.push(0,p,0),s.push(0,v,0);for(let m=0;m<=i;++m){const g=m/i*Math.PI*2;r.push(Math.cos(g)*f,p,Math.sin(g)*f),s.push(0,v,0)}for(let m=0;m<i;++m){const g=M+1+m;v===1?o.push(M,g+1,g):o.push(M,g,g+1)}};return h(n,a,1),h(e,-a,-1),{positions:r,normals:s,indices:o}},kn=1e-12,r0=n=>{const e=n.label??"polygon",t=n.holes??[],i=[`${e} outer ring`,...t.map((s,o)=>`${e} hole[${o}]`)],r=[n.outer,...t];for(let s=0;s<r.length;++s){const o=s0(r[s],i[s]);if(o!==null)return o}for(let s=0;s+1<r.length;++s)for(let o=s+1;o<r.length;++o){const a=r[s],l=r[o];for(let u=0;u<a.length;++u)for(let c=0;c<l.length;++c)if(ic(a[u],a[(u+1)%a.length],l[c],l[(c+1)%l.length]))return`${i[s]} and ${i[o]} touch or cross at edge ${u} and edge ${c}`}for(let s=1;s<r.length;++s){const o=r[s][0];if(Ja(o,r[0])===!1)return`${i[s]} must lie inside ${i[0]}`;for(let a=1;a<r.length;++a)if(a!==s&&Ja(o,r[a]))return`${i[s]} must lie outside ${i[a]}`}return null},s0=(n,e)=>{if(n.length<3)return`${e} needs at least three points`;for(let i=0;i<n.length;++i){const r=n[i];if(!Number.isFinite(r.x)||!Number.isFinite(r.y))return`${e}[${i}] must be finite`}const t=n.length;for(let i=0;i<t;++i){const r=n[i],s=n[(i+1)%t];if(Math.hypot(s.x-r.x,s.y-r.y)<=kn)return`${e}[${i}] repeats the point beside it`}if(Math.abs(l0(n))<=kn)return`${e} encloses no area`;for(let i=0;i<t;++i){const r=n[(i+t-1)%t],s=n[i],o=n[(i+1)%t];if(Math.abs(Ti(r,s,o))<=kn&&(s.x-r.x)*(o.x-s.x)+(s.y-r.y)*(o.y-s.y)<0)return`${e}[${i}] doubles back along its own edge`}return o0(n,e)},o0=(n,e)=>{for(let t=0;t<n.length;++t)for(let i=t+1;i<n.length;++i)if(a0(n.length,t,i)===!1&&ic(n[t],n[(t+1)%n.length],n[i],n[(i+1)%n.length]))return`${e} crosses itself between edge ${t} and edge ${i}`;return null},a0=(n,e,t)=>(e+1)%n===t||(t+1)%n===e,l0=n=>{let e=0;for(let t=0;t<n.length;++t){const i=n[t],r=n[(t+1)%n.length];e+=i.x*r.y-r.x*i.y}return e/2},Ti=(n,e,t)=>(e.x-n.x)*(t.y-n.y)-(e.y-n.y)*(t.x-n.x),ic=(n,e,t,i)=>Za(Ti(t,i,n),Ti(t,i,e))&&Za(Ti(n,e,t),Ti(n,e,i))?!0:[[t,i,n],[t,i,e],[n,e,t],[n,e,i]].some(([s,o,a])=>{if(Math.abs(Ti(s,o,a))>kn)return!1;const l=o.x-s.x,u=o.y-s.y,c=((a.x-s.x)*l+(a.y-s.y)*u)/(l*l+u*u);return c>=-kn&&c<=1+kn}),Za=(n,e)=>Math.abs(n)>kn&&Math.abs(e)>kn&&n*e<0,Ja=(n,e)=>{let t=!1;for(let i=0;i<e.length;++i){const r=e[i],s=e[(i+1)%e.length];r.y>n.y!=s.y>n.y&&n.x<r.x+(n.y-r.y)/(s.y-r.y)*(s.x-r.x)&&(t=!t)}return t},c0={left:0,top:0,right:1,bottom:1},u0=n=>{const e=n??c0;if([e.left,e.top,e.right,e.bottom].every(t=>Number.isFinite(t)&&t>=0&&t<=1)===!1||e.left>=e.right||e.top>=e.bottom)throw new RangeError("Delivery crop edges must be finite, normalized to [0, 1], and ordered left < right and top < bottom.");return{...e}},rc=n=>`automovie:model:${n}`,h0=n=>{if(n.lod.length===0)throw new Error("A compiled formation requires at least one LOD tier.");const e=Math.max(1,n.projectedPixels),t=n.distance*(24/e),i=n.lod.findIndex(a=>a.maxDistance===null||t<=a.maxDistance),r=i<0?n.lod.length-1:i,s=n.lod.findIndex(a=>a.tier===n.previous);if(s<0||s===r)return{lod:n.lod[r],effectiveDistance:t};const o=n.hysteresis??.1;if(r>s){const a=n.lod[s].maxDistance;if(t<=a*(1+o))return{lod:n.lod[s],effectiveDistance:t}}else{const a=n.lod[r].maxDistance;if(t>=a*(1-o))return{lod:n.lod[s],effectiveDistance:t}}return{lod:n.lod[r],effectiveDistance:t}};(()=>{const n={flexion:{x:0,y:1,z:0},abduction:{x:0,y:0,z:1},twist:{x:1,y:0,z:0}},e=["leftShoulder","leftUpperArm","leftLowerArm","leftHand","rightShoulder","rightUpperArm","rightLowerArm","rightHand"],t={};for(const i of e)t[i]=n;return t})();const f0=[{effector:"leftFoot",upper:"leftUpperLeg",lower:"leftLowerLeg"},{effector:"rightFoot",upper:"rightUpperLeg",lower:"rightLowerLeg"}];f0.map(n=>({foot:n.effector,upper:n.upper,lower:n.lower}));const qe=(n,e)=>({bone:n,flexion:e.flexion??null,abduction:e.abduction??null,twist:e.twist??null});qe("spine",{flexion:0}),qe("head",{flexion:0}),qe("spine",{flexion:50}),qe("head",{flexion:15}),qe("spine",{flexion:50}),qe("head",{flexion:15}),qe("spine",{flexion:0}),qe("head",{flexion:0}),qe("head",{flexion:0}),qe("head",{flexion:22}),qe("head",{flexion:2}),qe("head",{flexion:22}),qe("head",{flexion:0}),qe("head",{twist:0}),qe("head",{twist:30}),qe("head",{twist:-30}),qe("head",{twist:30}),qe("head",{twist:0}),Tr(0),Tr(1),Tr(1),Tr(0),qe("rightUpperLeg",{flexion:55}),qe("rightLowerLeg",{flexion:75}),qe("spine",{flexion:-6}),qe("rightUpperLeg",{flexion:68}),qe("rightLowerLeg",{flexion:6}),qe("spine",{flexion:-8}),qe("rightUpperLeg",{flexion:52}),qe("rightLowerLeg",{flexion:72}),qe("spine",{flexion:-5}),qe("spine",{flexion:18,abduction:24}),qe("rightUpperLeg",{flexion:30}),qe("rightLowerLeg",{flexion:22}),qe("spine",{flexion:6,abduction:-20}),qe("leftUpperLeg",{flexion:24}),qe("leftLowerLeg",{flexion:16}),qe("spine",{flexion:8,abduction:6}),wr(0),wr(55),wr(12),wr(55),Is(1),Is(1.1),Is(1),Qa(),Qa(),qe("leftUpperArm",{flexion:86,abduction:8}),qe("rightUpperArm",{abduction:70,flexion:34}),qe("rightLowerArm",{flexion:30}),qe("rightUpperArm",{abduction:92,flexion:-46}),qe("rightLowerArm",{flexion:108}),qe("leftUpperArm",{abduction:18,flexion:62}),qe("leftLowerArm",{flexion:16}),qe("spine",{flexion:-8,twist:-22}),qe("rightUpperArm",{abduction:104,flexion:60}),qe("rightLowerArm",{flexion:16}),qe("leftUpperArm",{abduction:24,flexion:-22}),qe("leftLowerArm",{flexion:24}),qe("spine",{flexion:16,twist:16}),qe("rightUpperArm",{abduction:62,flexion:30}),qe("rightLowerArm",{flexion:36}),qe("leftUpperArm",{abduction:20,flexion:-10}),qe("spine",{flexion:12,twist:4});function Is(n){return[qe("leftUpperArm",{abduction:150*n,flexion:10}),qe("rightUpperArm",{abduction:150*n,flexion:10})]}function Qa(){return[qe("leftUpperArm",{flexion:88,abduction:8}),qe("leftLowerArm",{flexion:8}),qe("rightUpperArm",{abduction:84,flexion:24}),qe("rightLowerArm",{flexion:118}),qe("head",{twist:12})]}function wr(n){return[qe("rightUpperArm",{abduction:132,flexion:6}),qe("rightLowerArm",{flexion:n}),qe("leftUpperArm",{abduction:14})]}function Tr(n){return[qe("leftUpperLeg",{flexion:55*n}),qe("rightUpperLeg",{flexion:55*n}),qe("leftLowerLeg",{flexion:65*n}),qe("rightLowerLeg",{flexion:65*n}),qe("spine",{flexion:15*n})]}const Zn=n=>{if(n.profile.length<2)throw new Error("revolve profile needs at least two points");C0(n.segments,3,"revolve segments"),n.profile.forEach((a,l)=>{if(T0(a,`revolve profile[${l}]`),a.x<0)throw new Error(`revolve profile[${l}] radius must be >= 0`)});const e=[0];for(let a=1;a<n.profile.length;++a)e.push(e[a-1]+Math.hypot(n.profile[a].x-n.profile[a-1].x,n.profile[a].y-n.profile[a-1].y));const t=[],i=[];for(let a=0;a<=n.segments;++a){const l=a/n.segments*Math.PI*2,u=Math.cos(l),c=Math.sin(l);n.profile.forEach((h,f)=>{t.push(h.x*u,h.y,h.x*c),i.push((Math.PI*2-l)*h.x,e[f])})}const r=n.profile.length,s=[];for(let a=0;a<n.segments;++a)for(let l=0;l+1<r;++l){const u=a*r+l,c=u+r;s.push(u,u+1,c),s.push(u+1,c+1,c)}const o=n.profile.map((a,l)=>a.x===0?Array.from({length:n.segments+1},(u,c)=>c*r+l):[l,n.segments*r+l]);return E0(t,s,i,o)},hn=n=>{if(n.length===0)throw new Error("polyhedron needs at least one face");const e=[],t=[],i=[],r=[];return n.forEach((s,o)=>{if(s.length<3)throw new Error(`polyhedron face[${o}] needs at least three corners`);s.forEach((f,p)=>A0(f,`polyhedron face[${o}] corner[${p}]`));const a=s[0],l=wt.cross(wt.subtract(s[1],a),wt.subtract(s[s.length-1],a));if(wt.length(l)<=Us)throw new Error(`polyhedron face[${o}] encloses no area`);const u=wt.normalize(l);if(s.some(f=>Math.abs(wt.dot(wt.subtract(f,a),u))>Us))throw new Error(`polyhedron face[${o}] is not planar`);for(let f=0;f<s.length;++f){const p=s[(f+s.length-1)%s.length],v=s[f],M=s[(f+1)%s.length];if(wt.dot(wt.cross(wt.subtract(v,p),wt.subtract(M,v)),u)<-Us)throw new Error(`polyhedron face[${o}] must be convex`)}const c=d0(u),h=e.length/3;for(const f of s)e.push(f.x,f.y,f.z),t.push(u.x,u.y,u.z),i.push(wt.dot(f,c.u),wt.dot(f,c.v));for(let f=1;f+1<s.length;++f)r.push(h,h+f,h+f+1)}),{positions:e,normals:t,uvs:i,indices:r,skin:null}},Ds=n=>sc(n.outer,n.holes??[],"polygon"),Ar=n=>{R0(n.depth,"polygon extrusion depth");const e=sc(n.outer,n.holes??[],"polygon"),t=n.depth/2,i=m0();for(const[r,s]of[[1,t],[-1,-t]]){const o=i.positions.length/3;for(const a of e.points)i.positions.push(a.x,a.y,s),i.normals.push(0,0,r),i.uvs.push(a.x,a.y*r);for(let a=0;a<e.triangles.length;a+=3)i.indices.push(o+e.triangles[a],o+e.triangles[a+(r===1?1:2)],o+e.triangles[a+(r===1?2:1)])}for(const r of e.rings){let s=0;for(let o=0;o<r.count;++o){const a=e.points[r.start+o],l=e.points[r.start+(o+1)%r.count],u=Math.hypot(l.x-a.x,l.y-a.y),c={x:(l.y-a.y)/u,y:(a.x-l.x)/u,z:0},h=i.positions.length/3;for(const[f,p,v]of[[a,t,s],[a,-t,s],[l,-t,s+u],[l,t,s+u]])i.positions.push(f.x,f.y,p),i.normals.push(c.x,c.y,c.z),i.uvs.push(v,p);i.indices.push(h,h+1,h+2,h,h+2,h+3),s+=u}}return{...i,skin:null}},d0=n=>{if(Math.abs(n.y)<p0){const t=el({x:0,y:1,z:0},n);return{u:wt.cross(t,n),v:t}}const e=el({x:1,y:0,z:0},n);return{u:e,v:wt.cross(n,e)}},el=(n,e)=>wt.normalize(wt.subtract(n,wt.scale(e,wt.dot(n,e)))),p0=1-1e-6,m0=()=>({positions:[],normals:[],uvs:[],indices:[]}),g0=(n,e,t)=>{const i=r0({outer:n,holes:e,label:t});if(i!==null)throw new Error(i);const r=[n,...e].map((a,l)=>x0(a.map(u=>({x:u.x,y:u.y})),l===0)),s=[],o=[];for(const a of r){o.push({start:s.length,count:a.length});for(const l of a)s.push(l)}return{points:s,rings:o,area:r.reduce((a,l)=>a+oc(l),0)}},sc=(n,e,t)=>{const i=g0(n,e,t);return{...i,triangles:_0(i)}},_0=n=>y0(n.points,v0(n.points,n.rings)),x0=(n,e)=>oc(n)>0===e?n:n.reverse(),oc=n=>{let e=0;for(let t=0;t<n.length;++t){const i=n[t],r=n[(t+1)%n.length];e+=i.x*r.y-r.x*i.y}return e/2},En=(n,e,t)=>(e.x-n.x)*(t.y-n.y)-(e.y-n.y)*(t.x-n.x),tl=(n,e,t,i)=>nl(En(t,i,n),En(t,i,e))&&nl(En(n,e,t),En(n,e,i))?!0:[[t,i,n],[t,i,e],[n,e,t],[n,e,i]].some(([s,o,a])=>{if(Math.abs(En(s,o,a))>Tn)return!1;const l=o.x-s.x,u=o.y-s.y,c=((a.x-s.x)*l+(a.y-s.y)*u)/(l*l+u*u);return c>=-Tn&&c<=1+Tn}),nl=(n,e)=>Math.abs(n)>Tn&&Math.abs(e)>Tn&&n*e<0,il=(n,e)=>{let t=!1;for(let i=0;i<e.length;++i){const r=e[i],s=e[(i+1)%e.length];r.y>n.y!=s.y>n.y&&n.x<r.x+(n.y-r.y)/(s.y-r.y)*(s.x-r.x)&&(t=!t)}return t},v0=(n,e)=>{const t=e.map(s=>Array.from({length:s.count},(o,a)=>s.start+a)),i=e.map(s=>n.slice(s.start,s.start+s.count)),r=[...t[0]];for(let s=1;s<t.length;++s){const o=r.flatMap((c,h)=>t[s].map((f,p)=>({at:h,from:p}))).find(c=>M0(n,i,r,t,s,c)),a=[...t[s].slice(o.from),...t[s].slice(0,o.from)],l=r[o.at],u=r.splice(o.at+1);for(const c of a)r.push(c);r.push(a[0],l);for(const c of u)r.push(c)}return r},M0=(n,e,t,i,r,s)=>{const o=n[t[s.at]],a=n[i[r][s.from]],l=t.length;for(let c=0;c<l;++c)if(c!==s.at&&c!==(s.at+l-1)%l&&tl(o,a,n[t[c]],n[t[(c+1)%l]]))return!1;for(let c=r;c<i.length;++c){const h=i[c];for(let f=0;f<h.length;++f)if((c!==r||f!==s.from&&f!==(s.from+h.length-1)%h.length)&&tl(o,a,n[h[f]],n[h[(f+1)%h.length]]))return!1}const u={x:(o.x+a.x)/2,y:(o.y+a.y)/2};return il(u,e[0])&&e.every((c,h)=>h===0||il(u,c)===!1)},y0=(n,e)=>{const t=[...e],i=[];for(let r=t.length;r>3;--r){const s=t.length,o=t.findIndex((a,l)=>S0(n,t,l));if(o===-1)throw new Error("polygon triangulation could not find a valid ear");i.push(t[(o+s-1)%s],t[o],t[(o+1)%s]),t.splice(o,1)}return i.push(t[0],t[1],t[2]),i},S0=(n,e,t)=>{const i=e.length,r=(t+i-1)%i,s=(t+1)%i,o=n[e[r]],a=n[e[t]],l=n[e[s]];return En(o,a,l)<=Tn?!1:e.every(u=>u===e[r]||u===e[t]||u===e[s]?!0:b0(o,a,l,n[u])===!1)},b0=(n,e,t,i)=>En(n,e,i)>=-Tn&&En(e,t,i)>=-Tn&&En(t,n,i)>=-Tn,Tn=1e-12,Us=1e-9,E0=(n,e,t=null,i=[])=>({positions:n,normals:w0(n,e,i),uvs:t,indices:e,skin:null}),w0=(n,e,t=[])=>{const i=new Array(n.length).fill(0);for(let r=0;r<e.length;r+=3){const s=e[r]*3,o=e[r+1]*3,a=e[r+2]*3,l={x:n[o]-n[s],y:n[o+1]-n[s+1],z:n[o+2]-n[s+2]},u={x:n[a]-n[s],y:n[a+1]-n[s+1],z:n[a+2]-n[s+2]},c=wt.cross(l,u);for(const h of[s,o,a])i[h]+=c.x,i[h+1]+=c.y,i[h+2]+=c.z}for(const r of t){const s={x:0,y:0,z:0};for(const o of r)s.x+=i[o*3],s.y+=i[o*3+1],s.z+=i[o*3+2];for(const o of r)i[o*3]=s.x,i[o*3+1]=s.y,i[o*3+2]=s.z}for(let r=0;r<i.length;r+=3){const s=wt.normalize({x:i[r],y:i[r+1],z:i[r+2]});i[r]=s.x,i[r+1]=s.y,i[r+2]=s.z}return i},T0=(n,e)=>{if(!Number.isFinite(n.x)||!Number.isFinite(n.y))throw new Error(`${e} must be finite`)},A0=(n,e)=>{if(![n.x,n.y,n.z].every(Number.isFinite))throw new Error(`${e} must be finite`)},R0=(n,e)=>{if(!Number.isFinite(n)||n<=0)throw new Error(`${e} must be a finite number > 0`)},C0=(n,e,t)=>{if(!Number.isSafeInteger(n)||n<e)throw new Error(`${t} must be a safe integer >= ${e}`)},P0=(n,e,t)=>{const i=n.prototypes??[{id:"default",modelRecipe:n.modelRecipe,weight:1}];if(t!==void 0){const o=i.find(a=>a.id===t);if(o===void 0)throw new Error(`Instance set "${n.id}" slot ${e} references missing prototype "${t}".`);return o}const r=i.reduce((o,a)=>o+a.weight,0);let s=Vt(n.seed,e,1886547828)*r;for(const o of i.slice(0,-1)){if(s<o.weight)return o;s-=o.weight}return i.at(-1)},L0=(n,e)=>{if(Number.isSafeInteger(e)===!1||e<0||e>=n.count)throw new RangeError(`Instance set "${n.id}" slot ${e} is outside 0..${n.count-1}.`);const t=D0(n,e),i=n.facingDeg*Math.PI/180,r=Math.cos(i),s=Math.sin(i),o=Vt(n.seed,e,1935892844),a=Nn(n.variation.scale.min,n.variation.scale.max,o),l=Math.min(n.variation.palette.length-1,Math.floor(Vt(n.seed,e,1885432933)*n.variation.palette.length)),u=n.layout.kind==="along-route"?{x:t.x,y:n.anchor.y,z:t.z}:{x:n.anchor.x+t.x*r+t.z*s,y:n.anchor.y+t.y,z:n.anchor.z-t.x*s+t.z*r},c=Object.fromEntries(n.variation.traits.map((P,L)=>[P.name,Nn(P.min,P.max,Vt(n.seed,e,L,1953653097))])),h=n.layout.kind==="explicit"?n.layout.transforms[e]:void 0,f=(h==null?void 0:h.palette)??n.variation.palette[l];if([u.x,u.y,u.z,a,...Object.values(c)].some(P=>Number.isFinite(P)===!1)||f===void 0)throw new RangeError(`Instance set "${n.id}" slot ${e} derived non-finite variation or an empty palette.`);const p=n.prototypes===void 0&&n.layout.kind!=="lattice"&&n.layout.kind!=="explicit"&&n.variation.scale3===void 0&&n.variation.rotationDeg===void 0&&n.variation.visibleProbability===void 0,v=P0(n,e,h==null?void 0:h.prototype),M={slot:e,node:h===void 0?`instance:${n.id}:slot:${String(e).padStart(6,"0")}`:`instance:${n.id}:${h.id}`,modelRecipe:v.modelRecipe,position:u,facingDeg:n.facingDeg,scale:a,palette:f,traits:{...c,...h==null?void 0:h.traits}};if(p)return M;const m=(h==null?void 0:h.scale)??(n.variation.scale3===void 0?{x:a,y:a,z:a}:{x:Nn(n.variation.scale3.min.x,n.variation.scale3.max.x,Vt(n.seed,e,1935898744)),y:Nn(n.variation.scale3.min.y,n.variation.scale3.max.y,Vt(n.seed,e,1935899001)),z:Nn(n.variation.scale3.min.z,n.variation.scale3.max.z,Vt(n.seed,e,1935899258))}),g=si.normalize(si.multiply(si.fromAxisAngle({x:0,y:1,z:0},n.facingDeg),(h==null?void 0:h.rotation)??I0(n,e)));return{...M,prototype:v.id,rotation:g,scale3:m,visible:(h==null?void 0:h.visible)??(n.variation.visibleProbability===void 0||Vt(n.seed,e,1986622313)<n.variation.visibleProbability)}},I0=(n,e)=>{const t=n.variation.rotationDeg;return t===void 0?si.identity():si.fromEuler({x:Nn(t.x.min,t.x.max,Vt(n.seed,e,1919906936)),y:Nn(t.y.min,t.y.max,Vt(n.seed,e,1919906937)),z:Nn(t.z.min,t.z.max,Vt(n.seed,e,1919906938)),order:"XYZ"})},D0=(n,e)=>{const t=n.layout;if(t.kind==="grid"){const f=Math.floor(e/t.columns);return{x:(e%t.columns-(t.columns-1)/2)*t.spacing.x,y:0,z:f*t.spacing.z}}if(t.kind==="scatter"){const f=Math.sqrt(Vt(n.seed,e,1918985321))*t.radius,p=Vt(n.seed,e,1634625388)*Math.PI*2;return{x:Math.cos(p)*f,y:0,z:Math.sin(p)*f}}if(t.kind==="lattice"){const f=t.rows*t.columns,p=Math.floor(e/f),v=e%f,M=Math.floor(v/t.columns);return{x:(v%t.columns-(t.columns-1)/2)*t.spacing.x,y:p*t.spacing.y,z:M*t.spacing.z}}if(t.kind==="explicit"){const f=t.transforms[e];if(f===void 0)throw new Error(`Instance set "${n.id}" slot ${e} has no explicit transform.`);return f.translation}const i=n.route;if(i===null||i.id!==t.route||i.waypoints.length<2)throw new Error(`Instance set "${n.id}" references unavailable route "${t.route}".`);const r=i.waypoints.slice(1).map((f,p)=>{const v=i.waypoints[p];return{left:v,right:f,length:Math.hypot(f.x-v.x,f.z-v.z)}}),s=r.reduce((f,p)=>f+p.length,0);if(Number.isFinite(s)===!1||s<=0)throw new RangeError(`Instance set "${n.id}" route "${t.route}" must have finite non-zero length.`);let o=(e+.5)/n.count*s,a=r.at(-1);for(const f of r.slice(0,-1)){if(o<=f.length){a=f;break}o-=f.length}const l=Math.min(1,o/a.length),u={x:a.right.x-a.left.x,z:a.right.z-a.left.z},c=Math.hypot(u.x,u.z),h=(Vt(n.seed,e,1785295988)*2-1)*t.lateralJitter;return{x:a.left.x+u.x*l-u.z/c*h,y:0,z:a.left.z+u.z*l+u.x/c*h}},Nn=(n,e,t)=>n*(1-t)+e*t,U0=n=>{const e=new gn;if(n.type==="primitive"){const i=nc(n.shape);return e.setAttribute("position",new Wt(i.positions,3)),e.setAttribute("normal",new Wt(i.normals,3)),e.setIndex(i.indices),e}const t=n.mesh;return e.setAttribute("position",new Wt(t.positions,3)),t.normals!==null&&e.setAttribute("normal",new Wt(t.normals,3)),t.uvs!==null&&e.setAttribute("uv",new Wt(t.uvs,2)),t.indices!==null&&e.setIndex(t.indices),t.skin!==null&&(e.setAttribute("skinIndex",new No(t.skin.boneIndices,4)),e.setAttribute("skinWeight",new Wt(t.skin.weights,4))),t.normals===null&&e.computeVertexNormals(),e},rl=n=>typeof n=="string"?n:n.asset;class N0{constructor(e){ci(this,"pending",new Map);ci(this,"sources",new Map);ci(this,"issued",[]);ci(this,"disposed",!1);ci(this,"resolve");this.load=e,this.resolve=t=>{this.assertLive();const i=rl(t),r=this.sources.get(i);if(r===void 0)throw new Error(`Texture asset "${i}" was never primed into this shot cache.`);const s=r.clone();return this.issued.push(s),s}}async prime(e){this.assertLive();const t=new Set;for(const s of e)s!=null&&t.add(rl(s));const i=await Promise.allSettled([...t].map(s=>this.decodeOnce(s))),r=[...t].filter((s,o)=>i[o].status==="rejected");if(r.length!==0)throw new Error(`Texture assets could not be decoded: ${r.join(", ")}.`)}get size(){return this.sources.size}async dispose(){if(this.disposed)return;this.disposed=!0;const e=await Promise.allSettled(this.pending.values());for(const t of this.issued)t.dispose();this.issued.length=0;for(const t of e)t.status==="fulfilled"&&t.value.dispose();this.pending.clear(),this.sources.clear()}decodeOnce(e){const t=this.pending.get(e);if(t!==void 0)return t;const i=this.load(e).then(r=>(this.sources.set(e,r),r));return this.pending.set(e,i),i}assertLive(){if(this.disposed)throw new Error("This shot texture cache has already been disposed.")}}const F0=(n,e)=>{const t=n.baseColor,i=n.alphaMode??(n.opacity<1?"blend":"opaque"),r=new Wm({color:new ot(t.r,t.g,t.b),metalness:n.metallic,roughness:n.roughness,transparent:i==="blend",depthWrite:i!=="blend",opacity:n.opacity,alphaTest:i==="mask"?n.alphaCutoff??.5:0,side:n.doubleSided===!0?dn:An,transmission:n.transmission??0,ior:n.ior??1.5,thickness:n.thickness??0,clearcoat:n.clearcoat??0});r.map=qi(n.baseColorTexture,"srgb",e);const s=qi(n.metallicRoughnessTexture,"linear",e);return r.metalnessMap=s,r.roughnessMap=s,r.normalMap=qi(n.normalTexture,"linear",e),n.normalScale!==void 0&&r.normalScale.setScalar(n.normalScale),r.aoMap=qi(n.occlusionTexture,"linear",e),r.aoMapIntensity=n.occlusionStrength??1,r.emissiveMap=qi(n.emissiveTexture,"srgb",e),n.emissive!==null?r.emissive=new ot(n.emissive.r,n.emissive.g,n.emissive.b):r.emissiveMap!==null&&r.emissive.setRGB(1,1,1),r},qi=(n,e,t)=>{if(n==null||t===void 0)return null;const i=t(n);if(i===void 0)return null;const r=typeof n=="string"?{texCoord:0,colorSpace:e}:n;return i.colorSpace=r.colorSpace==="srgb"?sn:bn,i.channel=r.texCoord,r.transform!==void 0&&(i.offset.set(r.transform.offset.x,r.transform.offset.y),i.repeat.set(r.transform.scale.x,r.transform.scale.y),i.rotation=r.transform.rotationDeg*Math.PI/180),r.sampler!==void 0&&(i.wrapS=sl(r.sampler.wrapS),i.wrapT=sl(r.sampler.wrapT),i.minFilter=O0(r.sampler.minFilter),i.magFilter=r.sampler.magFilter==="nearest"?Ot:Kt),i.needsUpdate=!0,i},sl=n=>n==="clamp"?Fn:n==="repeat"?zr:Br,O0=n=>{switch(n){case"nearest":return Ot;case"linear":return Kt;case"nearestMipmapLinear":return Yi;case"linearMipmapLinear":return On}},ol=()=>new ec({color:new ot(.8,.8,.8),metalness:0,roughness:.9}),z0=(n,e)=>{n.position.set(e.translation.x,e.translation.y,e.translation.z),n.quaternion.set(e.rotation.x,e.rotation.y,e.rotation.z,e.rotation.w),n.scale.set(e.scale.x,e.scale.y,e.scale.z)},Wr=(n,e)=>{const t=new ri;t.name=n.name??n.id;const i=new Map;if(n.skeleton!==null){for(const o of n.skeleton.bones){const a=new Jl;a.name=o.bone,a.position.set(o.rest.translation.x,o.rest.translation.y,o.rest.translation.z),a.quaternion.set(o.rest.rotation.x,o.rest.rotation.y,o.rest.rotation.z,o.rest.rotation.w),i.set(o.bone,a)}for(const o of n.skeleton.bones){const a=i.get(o.bone);((o.parent!==null?i.get(o.parent):void 0)??t).add(a)}}const r=new Map(n.materials.map(o=>[o.id,F0(o,e)])),s=new Map;for(const o of n.parts){const a=U0(o.geometry),l=o.material!==null?r.get(o.material)??ol():ol(),u=o.attachedBone===null&&o.geometry.type==="mesh"?o.geometry.mesh.skin:null,c=u!==null?new yo(a,l):new Xt(a,l);if(c.name=o.name??o.id,s.set(o.id,c),o.transform!==null&&z0(c,o.transform),c instanceof yo&&u!==null){const h=u.joints.map(f=>{const p=i.get(f);if(p===void 0)throw new Error(`part "${o.id}" skin references missing bone "${f}"`);return p});t.add(c),t.updateMatrixWorld(!0),c.bind(new Oo(h)),c.normalizeSkinWeights()}else if(o.attachedBone!==null){const h=i.get(o.attachedBone);if(h===void 0)throw new Error(`part "${o.id}" attachedBone references missing bone "${o.attachedBone}"`);h.add(c)}else t.add(c)}return{object:t,bones:i,parts:s}},al=new WeakMap,B0=n=>{const e=al.get(n);e!==void 0&&(e.target.dispose(),e.quadGeometry.dispose(),e.quadMaterial.dispose(),al.delete(n))},k0=n=>{const e=n.view;if(e===null||e.enabled===!1)return;const t=u0({left:e.offsetX/e.fullWidth,top:e.offsetY/e.fullHeight,right:(e.offsetX+e.width)/e.fullWidth,bottom:(e.offsetY+e.height)/e.fullHeight});return t.left===0&&t.top===0&&t.right===1&&t.bottom===1?void 0:t},ll=new WeakMap,H0=n=>{const e=ll.get(n);e!==void 0&&(e.target.dispose(),e.quadGeometry.dispose(),e.quadMaterial.dispose(),ll.delete(n))},G0=n=>{B0(n),H0(n),n.dispose()},V0=(n,e,t,i,r)=>{const s=new zm({canvas:n,antialias:(r==null?void 0:r.antialias)??!0,preserveDrawingBuffer:(r==null?void 0:r.preserveDrawingBuffer)??!1});(r==null?void 0:r.pixelRatio)!==void 0&&s.setPixelRatio(r.pixelRatio),(()=>{const c=n.clientWidth||1,h=n.clientHeight||1;s.setSize(c,h,!1),t.aspect=c/h,t.updateProjectionMatrix()})();let a=!0,l=null;const u=c=>{if(!a)return;l===null&&(l=c),i((c-l)/1e3)!==!0&&s.render(e,t),requestAnimationFrame(u)};return requestAnimationFrame(u),{renderer:s,stop:()=>{a=!1,G0(s)}}},ac=n=>{const e=[];return n.traverse(t=>{t.isMesh===!0&&e.push(t)}),e};function lc(n,e=!1){const t=n[0].index!==null,i=new Set(Object.keys(n[0].attributes)),r=new Set(Object.keys(n[0].morphAttributes)),s={},o={},a=n[0].morphTargetsRelative,l=new gn;let u=0;for(let c=0;c<n.length;++c){const h=n[c];let f=0;if(t!==(h.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const p in h.attributes){if(!i.has(p))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+'. All geometries must have compatible attributes; make sure "'+p+'" attribute exists among all geometries, or in none of them.'),null;s[p]===void 0&&(s[p]=[]),s[p].push(h.attributes[p]),f++}if(f!==i.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+". Make sure all geometries have the same number of attributes."),null;if(a!==h.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const p in h.morphAttributes){if(!r.has(p))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+".  .morphAttributes must be consistent throughout all geometries."),null;o[p]===void 0&&(o[p]=[]),o[p].push(h.morphAttributes[p])}if(e){let p;if(t)p=h.index.count;else if(h.attributes.position!==void 0)p=h.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+". The geometry must have either an index or a position attribute"),null;l.addGroup(u,p,c),u+=p}}if(t){let c=0;const h=[];for(let f=0;f<n.length;++f){const p=n[f].index;for(let v=0;v<p.count;++v)h.push(p.getX(v)+c);c+=n[f].attributes.position.count}l.setIndex(h)}for(const c in s){const h=cl(s[c]);if(!h)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+c+" attribute."),null;l.setAttribute(c,h)}for(const c in o){const h=o[c][0].length;if(h===0)break;l.morphAttributes=l.morphAttributes||{},l.morphAttributes[c]=[];for(let f=0;f<h;++f){const p=[];for(let M=0;M<o[c].length;++M)p.push(o[c][M][f]);const v=cl(p);if(!v)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+c+" morphAttribute."),null;l.morphAttributes[c].push(v)}}return l}function cl(n){let e,t,i,r=-1,s=0;for(let u=0;u<n.length;++u){const c=n[u];if(e===void 0&&(e=c.array.constructor),e!==c.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=c.itemSize),t!==c.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(i===void 0&&(i=c.normalized),i!==c.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(r===-1&&(r=c.gpuType),r!==c.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;s+=c.count*t}const o=new e(s),a=new Yt(o,t,i);let l=0;for(let u=0;u<n.length;++u){const c=n[u];if(c.isInterleavedBufferAttribute){const h=l/t;for(let f=0,p=c.count;f<p;f++)for(let v=0;v<t;v++){const M=c.getComponent(f,v);a.setComponent(f+h,v,M)}}else o.set(c.array,l);l+=c.count*t}return r!==void 0&&(a.gpuType=r),a}const W0=(n,e=`Instanced runtime model "${n.id}"`,t)=>{const i=Wr(n);i.object.updateMatrixWorld(!0);const r=ac(i.object);return{...cc(r,e),cycle:null}},X0=(n,e="Loaded instanced runtime model")=>(n.object.updateMatrixWorld(!0),{...cc(ac(n.object),e),cycle:null}),cc=(n,e)=>{const t=[],i=[];n.forEach((s,o)=>{if(s instanceof yo)throw new Error(`${e} has a skinned source mesh.`);if(Object.values(s.geometry.morphAttributes).some(l=>l.length>0))throw new Error(`${e} has morph-target source geometry.`);if(Array.isArray(s.material))throw new Error(`${e} has a multi-material source mesh.`);const a=s.geometry.clone().applyMatrix4(s.matrixWorld);a.setAttribute("automoviePart",new Wt(new Float32Array(a.getAttribute("position").count).fill(o),1)),t.push(a),i.push(s.material)});const r=lc(t,!0);if(r===null||i.length===0)throw new Error(`${e} cannot be flattened for instancing.`);return{geometry:r,materials:i}},q0=n=>{const e=new ri,t=new Map;e.name=`instance-set:${n.instanceSet.id}`,e.position.copy(uc(n.instanceSet.anchor));const i=n.instanceSet.prototypes??[{id:"default",modelRecipe:n.instanceSet.modelRecipe,weight:1,lod:n.instanceSet.lod,projectionRadius:n.instanceSet.projectionRadius}],r=new Map(i.map(c=>[c.id,new Map(c.lod.map(h=>{var m;const f=n.models.get(h.model);if(f===void 0)throw new Error(`Instance set "${n.instanceSet.id}" prototype "${c.id}" LOD "${h.tier}" references missing runtime model "${h.model}".`);const p=`Instance set "${n.instanceSet.id}" prototype "${c.id}" LOD "${h.tier}"`,v=(m=n.prototypeObjects)==null?void 0:m.get(h.model),M=v===void 0?W0(f,p):X0(v,p);return[h.tier,{geometry:M.geometry,materials:M.materials.map(J0)}]}))])),s=j0(n.instanceSet),o=n.instanceSet.variation.traits.map(c=>c.name),a=n.instanceSet.chunks.map(c=>{const f=Array.from({length:c.count},(v,M)=>Y0(n.instanceSet,c.start+M)).filter(v=>v.visible!==!1),p=i.flatMap(v=>{const M=f.filter(P=>(P.prototype??"default")===v.id);if(M.length===0)return[];const m=new Map,g=r.get(v.id);for(const P of v.lod){const L=g.get(P.tier),F=L.geometry.clone();for(const[H,V]of o.entries())F.setAttribute(`automovieTrait${H}`,new So(new Float32Array(M.map(le=>le.traits[V])),1));const Q=new Vm(F,L.materials,M.length);Q.name=`${n.instanceSet.id}:${c.index}:${v.id}:${P.tier}`,Q.userData.automovieTraitNames=[...o],Q.userData.automoviePrototype=v.id,Q.userData.automovieSlots=M.map(H=>H.slot),M.forEach((H,V)=>{Q.setMatrixAt(V,$0(H,n.instanceSet.anchor));let le=t.get(H.palette);if(le===void 0){const Te=e0(H.palette);le=new ot(Te.r,Te.g,Te.b),t.set(H.palette,le)}Q.setColorAt(V,le)}),Q.instanceMatrix.needsUpdate=!0,Q.instanceColor.needsUpdate=!0,Q.computeBoundingBox(),Q.computeBoundingSphere(),Q.frustumCulled=!1,Q.visible=!1,e.add(Q),m.set(P.tier,Q)}return[{projectionRadius:v.projectionRadius,count:M.length,lod:v.lod,tiers:m,selected:null}]});return{runtime:c,radius:K0(c.bounds,c.centroid),prototypes:p}}),l=a.reduce((c,h)=>c+h.prototypes.reduce((f,p)=>f+p.count,0),0),u={visible:{hero:0,near:0,far:0},culled:0,hidden:n.instanceSet.count-l};return{object:e,stats:u,update(c,h){u.visible={hero:0,near:0,far:0},u.culled=0,e.updateMatrixWorld(!0),c.updateMatrixWorld(!0),c.updateProjectionMatrix();const f=new dt().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse),p=new Yr().setFromProjectionMatrix(f),v=new ae;c.getWorldPosition(v);const M=Math.tan(ei.degToRad(c.fov)/2),m=k0(c),g=M*(m===void 0?1:m.bottom-m.top);for(const P of a){const L=e.localToWorld(new ae(P.runtime.centroid.x-n.instanceSet.anchor.x,P.runtime.centroid.y-n.instanceSet.anchor.y,P.runtime.centroid.z-n.instanceSet.anchor.z)),F=new Vn(L,P.radius+n.instanceSet.projectionRadius*s);if(p.intersectsSphere(F)===!1){for(const V of P.prototypes)for(const le of V.tiers.values())le.visible=!1;u.culled+=P.prototypes.reduce((V,le)=>V+le.count,0);continue}const Q=Math.max(.001,v.distanceTo(L)),H=Math.max(.001,-L.clone().applyMatrix4(c.matrixWorldInverse).z);for(const V of P.prototypes){const le=V.projectionRadius*s*h/(g*H),Te=h0({lod:V.lod,distance:Q,projectedPixels:le,previous:V.selected}).lod;V.selected=Te.tier;for(const[y,A]of V.tiers)A.visible=y===Te.tier;u.visible[Te.tier]+=V.count}}}}},Y0=(n,e)=>L0(n,e),$0=(n,e)=>new dt().compose(new ae(n.position.x-e.x,n.position.y-e.y,n.position.z-e.z),n.rotation===void 0?new Gt().setFromAxisAngle(new ae(0,1,0),Z0(n.facingDeg)):new Gt(n.rotation.x,n.rotation.y,n.rotation.z,n.rotation.w),n.scale3===void 0?new ae(n.scale,n.scale,n.scale):uc(n.scale3)),j0=n=>{if(n.layout.kind==="explicit"){let t=Number.EPSILON;for(const i of n.layout.transforms)t=Math.max(t,i.scale.x,i.scale.y,i.scale.z);return t}const e=n.variation.scale3;return e===void 0?n.variation.scale.max:Math.max(e.max.x,e.max.y,e.max.z)},K0=(n,e)=>Math.max(.01,...[n.min.x,n.max.x].flatMap(t=>[n.min.y,n.max.y].flatMap(i=>[n.min.z,n.max.z].map(r=>Math.hypot(t-e.x,i-e.y,r-e.z))))),Z0=n=>n*Math.PI/180,uc=n=>new ae(n.x,n.y,n.z),J0=n=>{var t;const e=n.clone();return(t=e.color)==null||t.set(16777215),e},hc={wood:{file:"oak-albedo-v1.png",metres:[.4,1]},stone:{file:"limestone-albedo-v1.png",metres:[.6,.6]},plaster:{file:"lime-plaster-albedo-v1.png",metres:[.8,.8]},tile:{file:"terracotta-albedo-v1.png",metres:[.3,.3]},cloth:{file:"linen-albedo-v1.png",metres:[.04,.04]},bark:{file:"apple-bark-albedo-v1.png",metres:[.55,.9]},soil:{file:"garden-soil-albedo-v1.png",metres:[1.2,1.2]}},fc={oak:"wood",oakLight:"wood",oakPale:"wood",oakGrain:"wood",upper:"wood",bark:"bark",soil:"soil",stone:"stone",stoneLight:"stone",stoneDark:"stone",floor:"stone",gravel:"stone",plaster:"plaster",roof:"tile",roofLight:"tile",roofMuted:"tile",bed:"cloth",linen:"cloth",linenDark:"cloth",quiltRust:"cloth",quiltSage:"cloth"},Q0={oak:[.14,.19,.25],oakLight:[.22,.28,.34],oakPale:[.31,.37,.44],oakGrain:[.1,.15,.2],upper:[.19,.23,.29],bark:[.78,.78,.76],soil:[.64,.62,.57],stone:[.68,.69,.67],stoneLight:[.85,.85,.8],stoneDark:[.35,.37,.35],floor:[.65,.63,.56],gravel:[.72,.69,.6],plaster:[.75,.71,.61],roof:[.17,.22,.27],roofLight:[.23,.26,.29],roofMuted:[.2,.24,.28],bed:[.63,.61,.53],linen:[.94,.91,.82],linenDark:[.57,.54,.44],quiltRust:[.54,.24,.17],quiltSage:[.34,.43,.27]};function dc(n){const e=hc[n];return{asset:"assets/textures/manor/"+e.file,texCoord:0,coordinateSource:"surface-metres",colorSpace:"srgb",transform:{offset:{x:0,y:0},scale:{x:1/e.metres[0],y:1/e.metres[1]},rotationDeg:0},sampler:{wrapS:"mirror",wrapT:"mirror",minFilter:"linearMipmapLinear",magFilter:"linear"}}}const eg=()=>Object.keys(hc).map(dc);function tg(n){return n.map(e=>{const t=fc[e.id];if(!t)return e;const[i,r,s]=Q0[e.id];return{...e,baseColor:{r:i,g:r,b:s,a:1,hex:null},baseColorTexture:dc(t)}})}const Jn=(n,e)=>n.reduce((t,i,r)=>t+i*e[r],0),Qn=n=>{const e=Math.hypot(...n);return n.map(t=>t/e)},Rr=(n,e)=>[n[1]*e[2]-n[2]*e[1],n[2]*e[0]-n[0]*e[2],n[0]*e[1]-n[1]*e[0]],ng=n=>{const e=[1/0,1/0,1/0],t=[-1/0,-1/0,-1/0];for(let s=0;s<n.length;s++){const o=s%3;e[o]=Math.min(e[o],n[s]),t[o]=Math.max(t[o],n[s])}const i=t.map((s,o)=>s-e[o]),r=i.indexOf(Math.max(...i));return[0,1,2].map(s=>s===r?1:0)};function ul(n,e,{grainAxis:t,origin:i,faceFrames:r,developed:s=!1,projected:o=!1,cylindrical:a=!1}={}){var F;const l=fc[e];if(!l)return n;const u=l==="wood"||l==="bark",c=n.type==="primitive"?{...nc(n.shape),uvs:null,skin:null}:n.mesh;if(s||!o&&!u&&c.uvs!==null&&c.uvs!==void 0)return{type:"mesh",mesh:c};if(o||a){const Q=[],H=[],V=[],le=[],Te=c.indices??Array.from({length:c.positions.length/3},(y,A)=>A);for(let y=0;y<Te.length;y+=3){const A=Te.slice(y,y+3).map(x=>c.positions.slice(x*3,x*3+3)),Me=Te.slice(y,y+3).map(x=>c.normals.slice(x*3,x*3+3)),ue=Qn(Rr(A[1].map((x,j)=>x-A[0][j]),A[2].map((x,j)=>x-A[0][j]))),I=ue.map(Math.abs).indexOf(Math.max(...ue.map(Math.abs))),ie=A.map(x=>Math.atan2(x[2],x[0]));if(Math.max(...ie)-Math.min(...ie)>Math.PI)for(let x=0;x<3;x++)ie[x]<0&&(ie[x]+=Math.PI*2);for(let x=0;x<3;x++){const j=A[x];if(Q.push(...j),H.push(...Me[x]),le.push(le.length),a&&Math.abs(ue[1])<.94)V.push(ie[x]*Math.hypot(j[0],j[2]),j[1]);else{const X=I===0?[2,1]:I===1?[0,2]:[0,1];V.push(j[X[0]],j[X[1]])}}}return{type:"mesh",mesh:{...c,positions:Q,normals:H,uvs:V,indices:le}}}const h=c.positions,f=c.normals,p=[],v=Qn(t??ng(h)),M=[1/0,1/0,1/0],m=M.map(Q=>-Q);for(let Q=0;Q<h.length;Q++)M[Q%3]=Math.min(M[Q%3],h[Q]),m[Q%3]=Math.max(m[Q%3],h[Q]);const g=i??M.map((Q,H)=>(Q+m[H])/2);let P=0,L=((F=r==null?void 0:r[0])==null?void 0:F.count)??1/0;for(let Q=0;Q<h.length;Q+=3){for(;Q/3>=L;)P++,L+=r[P].count;const H=r==null?void 0:r[P],V=(H==null?void 0:H.origin)??g,le=h.slice(Q,Q+3).map((ue,I)=>ue-V[I]),Te=Qn(f.slice(Q,Q+3)),y=l==="wood"?Qn((H==null?void 0:H.grainAxis)??v):[0,1,0];if(l==="wood"&&Math.abs(Jn(y,Te))>.94){const ue=Qn(Rr(y,Math.abs(y[2])<.9?[0,0,1]:[1,0,0])),I=Rr(y,ue),ie=Jn(le,ue),x=Jn(le,I);p.push(ie,x);continue}let A=y.map((ue,I)=>ue-Te[I]*Jn(y,Te));if(Math.hypot(...A)<1e-8){const ue=Math.abs(Te[2])<.9?[0,0,1]:[1,0,0];A=ue.map((I,ie)=>I-Te[ie]*Jn(ue,Te))}A=Qn(A);const Me=Qn(Rr(A,Te));p.push(Jn(le,Me),Jn(le,A))}return{type:"mesh",mesh:{...c,uvs:p}}}function ig({box:n,mesh:e,beam:t,finish:i,polyhedron:r,revolve:s,extrude:o,V:a,Q:l,registerMechanism:u}){const c=x=>x<0?0:x===1?3.33:.45,h=(x,j,X,ce,N,U={})=>{const k=r(j.map(D=>D.map(a)));let te=0,T=!1;for(const D of j){if(D.every(O=>O.uv)){const[O,G,ne]=D.map(q=>q.uv),Z=(G[0]-O[0])*(ne[1]-O[1])-(G[1]-O[1])*(ne[0]-O[0]);if(Math.abs(Z)>1e-12){for(let q=0;q<D.length;q++)k.uvs[(te+q)*2]=D[q].uv[0],k.uvs[(te+q)*2+1]=D[q].uv[1];T=!0}}te+=D.length}e(x,k,X,ce,N,{...U,developed:T})};function f(x,j,X,ce="oakLight",N,U=.003,k){const[te,T,D]=j,O=Math.min(U,te/5,T/3,D/5),G=(q,J)=>{const re=te/2-q,R=D/2-q,$=Math.min(O,re/3,R/3);return[[-re+$,J,-R],[re-$,J,-R],[re,J,-R+$],[re,J,R-$],[re-$,J,R],[-re+$,J,R],[-re,J,R-$],[-re,J,-R+$]]},ne=[G(O,-T/2),G(0,-T/2+O),G(0,T/2-O),G(O,T/2)],Z=[ne[0].toReversed(),ne[3]];for(let q=0;q<3;q++)for(let J=0;J<8;J++)Z.push([ne[q][J],ne[q][(J+1)%8],ne[q+1][(J+1)%8],ne[q+1][J]]);h(x,Z.map(q=>q.toReversed()),X,ce,N,k)}function p(x,j,X,ce=0){const N=Math.cos(ce),U=Math.sin(ce),k=J=>[x+N*J[0]+U*J[2],j+J[1],X-U*J[0]+N*J[2]],te=l([0,1,0],ce),T=(J,re,R,$="oak",he=!1,ye)=>he?f(J,re,k(R),$,te,.003,ye):n(J,re,k(R),$,te,ye),D=(J,re,R,$,he)=>e(J,re,k(R),$,te,he),O=(J,re,R,$=.035,he="oak")=>t(J,k(re),k(R),$,he),G=(J,re,R,$,he="iron",ye=24)=>e(J,s({profile:[{x:0,y:0},{x:re,y:0},{x:re,y:R},{x:0,y:R}],segments:ye}),k($),he,te,{grainAxis:[0,1,0],cylindrical:!0}),ne=(J,re,R,$="iron",he=!1)=>{const ye=re.length,Pe=R/2,fe=re[1].map((ee,Ie)=>ee-re[0][Ie]),Ce=re[Math.min(2,ye-1)].map((ee,Ie)=>ee-re[1][Ie]),C=[fe[1]*Ce[2]-fe[2]*Ce[1],fe[2]*Ce[0]-fe[0]*Ce[2],fe[0]*Ce[1]-fe[1]*Ce[0]],S=Math.hypot(...C),se=S>1e-10&&re.every(ee=>Math.abs(ee.reduce((Ie,Le,Be)=>Ie+(Le-re[0][Be])*C[Be]/S,0))<1e-8),me=re.map((ee,Ie)=>{const Le=re[he?(Ie+ye-1)%ye:Math.max(0,Ie-1)],Be=re[he?(Ie+1)%ye:Math.min(ye-1,Ie+1)],$e=Be.map((Ge,at)=>Ge-Le[at]),Ne=Math.hypot(...$e);for(let Ge=0;Ge<3;Ge++)$e[Ge]/=Ne;const Fe=se?[C[1]*$e[2]-C[2]*$e[1],C[2]*$e[0]-C[0]*$e[2],C[0]*$e[1]-C[1]*$e[0]]:Math.abs($e[2])<.9?[-$e[1],$e[0],0]:[0,-$e[2],$e[1]],tt=Math.hypot(...Fe);for(let Ge=0;Ge<3;Ge++)Fe[Ge]/=tt;const it=[$e[1]*Fe[2]-$e[2]*Fe[1],$e[2]*Fe[0]-$e[0]*Fe[2],$e[0]*Fe[1]-$e[1]*Fe[0]];return Array.from({length:8},(Ge,at)=>ee.map((rt,mt)=>rt+Pe*(Fe[mt]*Math.cos(at*Math.PI/4)+it[mt]*Math.sin(at*Math.PI/4))))}),Ae=[];for(let ee=0;ee<(he?ye:ye-1);ee++)for(let Ie=0;Ie<8;Ie++){const Le=me[ee][Ie],Be=me[ee][(Ie+1)%8],$e=me[(ee+1)%ye][(Ie+1)%8],Ne=me[(ee+1)%ye][Ie];Ae.push([Le,Be,$e],[Le,$e,Ne])}he||Ae.push(me[0].toReversed(),me[ye-1]),h(J,Ae,[x,j,X],$,te)};return{b:T,m:D,line:O,cyl:G,vessel:(J,re,R,$,he="clay",ye=!1,Pe="jar")=>{Pe==="jar"&&R<re*.9&&(Pe="bowl"),Pe==="jar"&&ye&&R<.15&&(Pe="cup");const fe=Math.min(.014,re*.12),Ce=Pe==="bowl"?[[0,0],[re*.4,0],[re*.66,.2*R],[re,.88*R],[re,R],[re-fe,R],[re*.63,.27*R],[re*.38,fe],[0,fe]]:Pe==="cup"||Pe==="pail"?[[0,0],[re*.77,0],[re,R],[re-fe,R],[re*.77-fe,fe],[0,fe]]:[[0,0],[re*.68,0],[re,.25*R],[re*.92,.7*R],[re*.72,R],[re*.72-fe,R],[re*.92-fe,.7*R],[re-fe,.25*R],[re*.65,fe],[0,fe]];if(D(J,s({profile:Ce.map(([C,S])=>({x:C,y:S})),segments:24}),$,he,{grainAxis:[0,1,0],cylindrical:!0}),ye){const C=Array.from({length:25},(S,se)=>{const me=-Math.PI/2+se*Math.PI/24;return[$[0]+re*.86+Math.cos(me)*re*.65,$[1]+R*.55+Math.sin(me)*R*.3,$[2]]});ne(J+"-handle",C,Math.min(.022,re*.27),he)}},hoop:(J,re,R,$,he="iron",ye="xy",Pe=0,fe=Math.PI*2)=>{const Ce=Math.abs(fe-Pe-Math.PI*2)<1e-8,C=Array.from({length:Ce?32:25},(S,se)=>{const me=Pe+(fe-Pe)*se/(Ce?32:24);return ye==="xy"?[re[0]+R*Math.cos(me),re[1]+R*Math.sin(me),re[2]]:[re[0]+R*Math.cos(me),re[1],re[2]+R*Math.sin(me)]});ne(J,C,$,he,Ce)},tube:ne,point:k,r:te}}function v(x,j,X,ce,N,U,k,te="linen",T=0,D=.003,O){const G=Array.from({length:N+1},($,he)=>Array.from({length:U+1},(ye,Pe)=>k(he/N,Pe/U))),ne=Array.from({length:N+1},()=>Array(U+1).fill(0)),Z=Array.from({length:N+1},()=>Array(U+1).fill(0)),q=($,he)=>Math.hypot(...$.map((ye,Pe)=>ye-he[Pe]));for(let $=0;$<=N;$++)for(let he=0;he<=U;he++)$&&(ne[$][he]=ne[$-1][he]+q(G[$][he],G[$-1][he])),he&&(Z[$][he]=Z[$][he-1]+q(G[$][he],G[$][he-1]));const J=($,he,ye=!1)=>{const Pe=$/N,fe=he/U,Ce=G[$][he],C=[ne[$][he],Z[$][he]],S=Ne=>Object.assign(Ne,{uv:C});if(!ye)return S(Ce);if(O)return S(O(Pe,fe));const se=k(Math.max(0,Pe-1e-4),fe),me=k(Math.min(1,Pe+1e-4),fe),Ae=k(Pe,Math.max(0,fe-1e-4)),ee=k(Pe,Math.min(1,fe+1e-4)),Ie=me.map((Ne,Fe)=>Ne-se[Fe]),Le=ee.map((Ne,Fe)=>Ne-Ae[Fe]),Be=[Le[1]*Ie[2]-Le[2]*Ie[1],Le[2]*Ie[0]-Le[0]*Ie[2],Le[0]*Ie[1]-Le[1]*Ie[0]],$e=Math.hypot(...Be);return S(Ce.map((Ne,Fe)=>Ne-D*Be[Fe]/$e))},re=[],R=($,he,ye,Pe)=>re.push([$,he,ye],[$,ye,Pe]);for(let $=0;$<N;$++)for(let he=0;he<U;he++)R(J($,he),J($,he+1),J($+1,he+1),J($+1,he)),R(J($,he,!0),J($+1,he,!0),J($+1,he+1,!0),J($,he+1,!0));for(let $=0;$<N;$++)R(J($,0),J($+1,0),J($+1,0,!0),J($,0,!0)),R(J($,U),J($,U,!0),J($+1,U,!0),J($+1,U));for(let $=0;$<U;$++)R(J(0,$),J(0,$,!0),J(0,$+1,!0),J(0,$+1)),R(J(N,$),J(N,$+1),J(N,$+1,!0),J(N,$,!0));h(x,re,[j,X,ce],te,l([0,1,0],T))}function M(x,j,X,ce,N,U,k="linen",te=0){for(let T=0;T<3;T++)v(x+"-layer-"+T,j,X+T*.02,ce,16,12,(D,O)=>[(D-.5)*N,.02+.004*Math.sin(Math.PI*D)*Math.sin(Math.PI*O),(O-.5)*U],T===1?"linen":k,te,.02,(D,O)=>[(D-.5)*N,T===0?0:.004*Math.sin(Math.PI*D)*Math.sin(Math.PI*O),(O-.5)*U])}function m(x,j,X,ce,N,U="linen",k=0,te=.015){v(x,j,X,ce,16,36,(T,D)=>{const O=D*3;let G,ne;if(O<1)G=-.17*(1-O),ne=-te;else if(O<2){const Z=(O-1)*Math.PI;G=te*Math.sin(Z),ne=-te*Math.cos(Z)}else G=-.28*(O-2),ne=te;return[(T-.5)*N,G,ne+.002*Math.sin(T*31)*Math.max(0,-G)]},U,k)}function g(x,j,X,ce,N,U,k="linen",te=0,T=.04,D=.015){const O=p(j,X,ce,te),G=20,ne=12,Z=[],q=(J,re,R=!1)=>{const $=J/G,he=re/ne,ye=Math.min($,1-$,he,1-he),Pe=.006*Math.sin($*43+he*7)+.004*Math.sin(he*35);return[($-.5)*N,D*Math.sin(Math.PI*$)*Math.sin(Math.PI*he)+Pe-T*Math.max(0,1-ye/.12)-(R?.008:0),(he-.5)*U]};for(let J=0;J<G;J++)for(let re=0;re<ne;re++)Z.push([q(J,re),q(J,re+1),q(J+1,re+1),q(J+1,re)],[q(J,re,!0),q(J+1,re,!0),q(J+1,re+1,!0),q(J,re+1,!0)]);for(let J=0;J<G;J++)for(const re of[0,ne])Z.push([q(J,re),q(J+1,re),q(J+1,re,!0),q(J,re,!0)]);for(let J=0;J<ne;J++)for(const re of[0,G])Z.push([q(re,J),q(re,J,!0),q(re,J+1,!0),q(re,J+1)]);h(x,Z.flatMap(J=>[[J[0],J[1],J[2]],[J[0],J[2],J[3]]]),[j,X,ce],k,O.r)}function P(x,j,X,ce,N,U,k=0,te=0){const T=x==="hall-table",D=T?.1:.12,O=T?.11:.13,G=T?.655:.645,ne=T?.645:.22;X=c(k)+(T?.006:0);const Z=p(j,X,ce,te),q=N/2-(T?.06:.14),J=U/2-.12,re=$=>T?Math.sign($)*(N/2-.14):$;for(const $ of[-q,q])for(const he of[-J,J])Z.b(x+"-leg-"+re($)+"-"+he,[D,.71,D],[$,.355,he],"oak",!0);for(const $ of[-J,J])Z.b(x+"-apron-long-"+$,[2*q-D,O,.065],[0,G,$],"oak");for(const $ of[-q,q])Z.b(x+"-apron-end-"+re($),[T?.075:.065,O,2*J-D],[$,G,0],"oak"),T||Z.b(x+"-end-stretcher-"+re($),[.075,.075,2*J-D],[$,ne,0],"oak");Z.b(x+"-long-stretcher",[2*q-.075,.085,.085],[0,ne,0],"oak");const R=Math.ceil(U/.22);for(let $=0;$<R;$++)Z.b(x+"-top-plank-"+$,[N,.055,U/R-.003],[0,.7375,-U/2+($+.5)*U/R],$%2?"oak":"oakLight",!0);for(const $ of[-q,q])for(const he of[-J,J])Z.b(x+"-joint-peg-"+re($)+"-"+he,[.025,.025,T?D+.012:.132],[$,.66,he],"oakLight");if(x==="hall-table"){Z.vessel(x+"-pitcher",.115,.27,[-.65,.765,0],"clay",!0);for(const $ of[-.65,0,.65])for(const he of[-U*.3,U*.3])Z.vessel(x+"-dish-"+$+"-"+he,.105,.032,[$,.765,he],"oakLight"),Z.vessel(x+"-cup-"+$+"-"+he,.045,.095,[$+.16,.765,he],"clay",!0);Z.vessel(x+"-serving-bowl",.16,.09,[.15,.765,0],"clay")}else{const $=-N*.2,he=0;if(x!=="ledger-desk"){for(const ee of[.7715,.8205])Z.b(x+"-book-board-"+ee,[.27,.013,.34],[$,ee,he],"leather",!0);Z.b(x+"-book-pages",[.247,.036,.315],[$+.004,.796,he],"paper"),Z.b(x+"-book-spine",[.017,.062,.34],[$-.126,.796,he],"leather");for(let ee=0;ee<5;ee++)Z.b(x+"-page-edge-"+ee,[.24,.001,.001],[$+.004,.781+ee*.007,he+.1575],"linenDark");Z.b(x+"-book-clasp",[.025,.007,.06],[$+.04,.8305,he+.14],"iron")}Z.vessel(x+"-inkpot",.037,.07,[N*.28,.765,-U*.25],"charcoal"),Z.line(x+"-quill",[N*.28,.8,-U*.25],[N*.19,1.01,-U*.27],.007,"paper");const ye=[N*.28,.8],Pe=[N*.19,1.01],fe=Pe.map((ee,Ie)=>ee-ye[Ie]),Ce=Math.hypot(...fe),C=(ee,Ie)=>({x:ye[0]+fe[0]*ee+fe[1]/Ce*Ie,y:ye[1]+fe[1]*ee-fe[0]/Ce*Ie}),S=ee=>-U*.25+(ee-.8)/.21*(-U*.02),se=[C(.34,0),C(.6,.028),C(1,0),C(.62,-.032)].map(ee=>[ee.x,ee.y,S(ee.y)+.001]),me=se.map(ee=>[ee[0],ee[1],ee[2]-.002]),Ae=[se,me.toReversed()];for(let ee=0;ee<4;ee++)Ae.push([se[ee],me[ee],me[(ee+1)%4],se[(ee+1)%4]]);h(x+"-quill-vane",Ae.map(ee=>ee.map(Z.point)),[0,0,0],"paper");for(let ee=0;ee<7;ee++){const Ie=C(.42+ee*.065,0),Le=C(.5+ee*.061,ee%2?.022:-.023);Z.line(x+"-quill-barb-"+ee,[Ie.x,Ie.y,S(Ie.y)+.002],[Le.x,Le.y,S(Le.y)+.002],.0018,"linenDark")}Z.b(x+"-loose-parchment",[.22,.002,.25],[N*.12,.766,.06],"paper");for(let ee=0;ee<7;ee++)Z.b(x+"-ink-line-"+ee,[.14-ee%3*.023,2e-4,.002],[N*.12,.7671,-.025+ee*.022],"charcoal");if(x==="ledger-desk")for(const ee of[-1,1]){Z.b(x+"-open-register-cover-"+ee,[.19,.008,.29],[$+ee*.1,.769,0],"leather");const Ie=$+ee*.096,Le=.178;Z.b(x+"-open-register-leaves-"+ee,[Le,.02,.27],[Ie,.783,0],"paper");for(let Be=0;Be<9;Be++)Z.b(x+"-register-entry-"+ee+"-"+Be,[Le-.045-Be%3*.012,.001,.002],[Ie,.7935,-.105+Be*.025],"charcoal")}}i(x,k,"furnishing",{frontAngle:te})}function L(x,j,X,ce,N,U,k=0,te=0,T=!1){X=c(k)+(/^hall-bench/.test(x)?.006:0);const D=p(j,X,ce,te),O=Math.max(.09,N/2-.1),G=Math.max(.065,U/2-(x==="hall-bench-west"?.075:.055)),ne=.075,Z=q=>x==="hall-bench-west"?Math.sign(q)*Math.max(.065,U/2-.055):q;for(const q of[-O,O])for(const J of[-G,G])D.b(x+"-leg-"+q+"-"+Z(J),[ne,.405,ne],[q,.2025,J],"oak",!0);for(const q of[-O,O])D.b(x+"-end-rail-"+q,[.06,.07,2*G],[q,.37,0],"oak"),D.b(x+"-end-tie-"+q,[.055,.055,2*G],[q,.15,0],"oak");D.b(x+"-stretcher",[2*O,.065,.055],[0,.15,0],"oak");for(const q of[-G,G])D.b(x+"-seat-rail-"+Z(q),[2*O,.07,.05],[0,.37,q],"oak");for(let q=0;q<2;q++)D.b(x+"-seat-board-"+q,[N,.045,U/2-.002],[0,.4275,(q-.5)*U/2],"oakLight",!0);if(T){for(const q of[-O,O])D.b(x+"-back-post-"+q,[.065,.48,.065],[q,.665,-G],"oak",!0);for(const q of[.64,.85])D.b(x+"-back-rail-"+q,[2*O,.075,.04],[0,q,-G],"oakLight",!0);for(let q=0;q<3;q++)D.b(x+"-back-splat-"+q,[.045,.2,.025],[(q-1)*N*.22,.745,-G],"oak")}i(x,k,"furnishing",{frontAngle:te})}function F(x,j,X,ce,N,U,k=1){X=c(k);const te=p(j,X,ce),T=N/2-.065,D=U/2-.065;for(const Z of[-T,T])for(const q of[-D,D]){const J=Z<0?1.06:.7;te.b(x+"-post-"+Z+"-"+q,[.11,J,.11],[Z,J/2,q],"oak",!0),e(x+"-finial-"+Z+"-"+q,s({profile:[{x:0,y:0},{x:.046,y:0},{x:.047,y:.015},{x:.033,y:.03},{x:.047,y:.055},{x:.042,y:.083},{x:.021,y:.103},{x:0,y:.106}],segments:32}),te.point([Z,J,q]),"oakLight",te.r,{grainAxis:[0,1,0]})}for(const Z of[-D,D])te.b(x+"-side-rail-"+Z,[N-.13,.16,.075],[0,.36,Z],"oak");for(const Z of[-T,T])te.b(x+"-end-rail-"+Z,[.075,.16,U-.13],[Z,.36,0],"oak");const O=14;for(let Z=0;Z<O;Z++)te.b(x+"-slat-"+Z,[.09,.035,U-.14],[-N/2+.14+Z*(N-.28)/(O-1),.4375,0],"oakLight");for(let Z=0;Z<5;Z++)te.b(x+"-head-panel-"+Z,[.04,.58,(U-.22)/5-.003],[-T,.715,-(U-.22)/2+(Z+.5)*(U-.22)/5],"oakLight",!0);te.b(x+"-head-top",[.08,.075,U-.11],[-T,1.02,0],"oak",!0);for(let Z=0;Z<3;Z++)te.b(x+"-foot-panel-"+Z,[.04,.2,(U-.22)/3-.003],[T,.53,-(U-.22)/2+(Z+.5)*(U-.22)/3],"oakLight",!0);te.b(x+"-mattress",[N-.23,.17,U-.23],[0,.54,0],"bed",!0);const G=(Z,q=0)=>{const J=(Z-.5)*2,re=Math.abs(J),R=Math.sign(J),$=(U-.23)/2;if(re<=.7)return[.628+q+.007*Math.sin(re/.7*Math.PI)**2,R*($-.004)*re/.7];if(re<=.8){const he=(re-.7)/.1*Math.PI/2;return[.616+(.012+q)*Math.cos(he),R*($-.004+(.012+q)*Math.sin(he))]}return[.616-.1*(re-.8)/.2,R*($+.008+q)]};for(const[Z,q,J,re,R,$]of[[x+"-sheet",j,N-.24,0,.003,"linen"],[x+"-quilt",j+N*.17,N*.56,.009,.009,x==="master-bed"?"quiltRust":x==="child-west-bed"?"quiltSage":"linenDark"]]){const he=(ye,Pe)=>.0025*Math.sin(((q-j+(ye-.5)*J)/(N-.24)+.5)*Math.PI*6)*Math.sin(Pe*Math.PI)**2;v(Z,q,X,ce,32,40,(ye,Pe)=>{const[fe,Ce]=G(Pe,re);return[(ye-.5)*J,fe+he(ye,Pe),Ce]},$,0,R,(ye,Pe)=>{const[fe,Ce]=G(Pe,re-R);return[(ye-.5)*J,fe+he(ye,Pe),Ce]})}const ne=U>1.2?2:1;for(let Z=0;Z<ne;Z++){const q=U>1.2?.57:U*.68,J=ce+(Z-(ne-1)/2)*.68,re=(R,$)=>{const he=J-ce+($-.5)*q,ye=.5+he*.7/(U-.238),Pe=(-N/2+.42+(R-.5)*.43)/(N-.24)+.5;return G(ye,0)[0]+.0025*Math.sin(Pe*Math.PI*6)*Math.sin(ye*Math.PI)**2};v(x+"-pillow-"+Z,j-N/2+.42,X,J,20,16,(R,$)=>[(R-.5)*.43,re(R,$)+.011+.11*Math.sin(Math.PI*R)*Math.sin(Math.PI*$),($-.5)*q],"linen",0,.011,(R,$)=>[(R-.5)*.43,re(R,$),($-.5)*q])}i(x,k,"furnishing")}function Q(x,j,X,ce,N,U,k=1,te=0){X=c(k);const T=p(j,X,ce,te);for(const D of[-N/2+.065,N/2-.065])for(const O of[-U/2+.065,U/2-.065])T.b(x+"-foot-"+D+"-"+O,[.085,.12,.085],[D,.06,O],"oak");T.b(x+"-bottom",[N-.09,.045,U-.09],[0,.12,0],"oak");for(const D of[-U/2+.025,U/2-.025]){T.b(x+"-rebate-backing-"+D,[N-.06,.34,.012],[0,.305,D-Math.sign(D)*.024],"oak",!1,{grainAxis:[0,1,0]});for(let O=0;O<4;O++)T.b(x+"-panel-"+D+"-"+O,[N/4-.001,.35,.05],[-N/2+(O+.5)*N/4,.305,D],O%3?"oak":"oakLight",!0)}for(const D of[-N/2+.025,N/2-.025])T.b(x+"-end-"+D,[.05,.35,U-.1],[D,.305,0],"oak",!0,{grainAxis:[0,1,0]});for(let D=0;D<3;D++)T.b(x+"-lid-board-"+D,[N+.035,.045,U/3-.002],[0,.5025,-U/2+(D+.5)*U/3],"oakLight",!0);T.b(x+"-lid-rebate",[N+.027,.012,U-.006],[0,.481,0],"oak");for(const D of[-N*.3,N*.3]){T.b(x+"-lid-strap-"+D,[.035,.008,U+.03],[D,.529,0],"iron"),T.b(x+"-front-strap-"+D,[.035,.33,.008],[D,.315,U/2+.004],"iron"),T.b(x+"-lid-hinge-leaf-"+D,[.04,.008,.045],[D,.505,-U/2+.01],"iron");const O=l([-Math.sin(te),0,-Math.cos(te)],Math.PI/2),G=[{x:.008,y:-.021},{x:.014,y:-.021},{x:.014,y:.021},{x:.008,y:.021},{x:.008,y:-.021}];e(x+"-lid-knuckle-"+D,s({profile:G,segments:28}),T.point([D,.489,-U/2-.012]),"iron",O),e(x+"-hinge-pin-"+D,s({profile:[{x:0,y:-.044},{x:.015,y:-.044},{x:.015,y:-.023},{x:.007,y:-.023},{x:.007,y:.023},{x:.015,y:.023},{x:.015,y:.044},{x:0,y:.044}],segments:28}),T.point([D,.489,-U/2-.012]),"iron",O),T.b(x+"-hinge-leaf-"+D,[.088,.14,.009],[D,.42,-U/2-.0045],"iron");for(const ne of[-U*.32,0,U*.32])T.b(x+"-lid-rivet-"+D+"-"+ne,[.014,.02,.014],[D,.528,ne],"ironWarm",!0);for(const ne of[.17,.3,.45])T.b(x+"-rivet-"+D+"-"+ne,[.013,.013,.018],[D,ne,U/2+.005],"iron")}T.b(x+"-lock",[.07,.105,.022],[0,.422,U/2+.011],"iron"),T.b(x+"-keyhole",[.008,.02,.003],[0,.415,U/2+.0235],"charcoal");for(const D of[-.023,.023])T.b(x+"-lid-hasp-side-"+D,[.014,.08,.009],[D,.471,U/2+.03],"iron");for(const D of[.5175])T.b(x+"-lid-hasp-end-"+D,[.06,.014,.009],[0,D,U/2+.03],"iron");T.b(x+"-lid-hasp-return",[.06,.009,.044],[0,.522,U/2+.012],"iron"),T.tube(x+"-lock-staple",[[-.012,.459,U/2+.019],[-.012,.459,U/2+.046],[.012,.459,U/2+.046],[.012,.459,U/2+.019]],.008,"iron"),u({id:x+"-lid",parent:x,prefix:x+"-lid-",level:k,pivot:T.point([0,.489,-U/2-.012]),restAngle:te,axis:[1,0,0],travel:-Math.PI*.48,kind:"furnishing-lid"}),i(x,k,"furnishing",{frontAngle:te})}function H(x,j,X,ce,N,U,k,te=0){X=c(te);const T=p(j,X,ce),D=N/2-.04,O=k/2-.055;for(const ne of[-D,D])for(const Z of[-O,0,O])T.b(x+"-upright-"+ne+"-"+Z,[.07,U,.085],[ne,U/2,Z],"oak",!0);const G=[];for(let ne=0;ne<4;ne++){const Z=.13+ne*(U-.16)/3;G.push(Z+.023),T.b(x+"-board-"+ne,[N,.046,k],[0,Z,0],"oakLight",!0);for(const q of[-O,O])T.b(x+"-cleat-"+ne+"-"+q,[N-.05,.045,.05],[0,Z-.045,q],"oak")}T.line(x+"-rear-brace",[-D,.12,-O],[-D,U-.07,O],.04,"oak");for(let ne=0;ne<3;ne++)for(let Z=0;Z<Math.floor(k/.31);Z++){const q=-k/2+.18+Z*.31;if(te===0)if((Z+ne)%3===1){const J=x+"-grain-sack-"+ne+"-"+Z,re=[[.075,0],[.1,.025],[.112,.085],[.098,.175],[.0295,.232],[.0295,.24],[.038,.263],[.008,.272]],R=24,$=re.map(([ye,Pe],fe)=>Array.from({length:R},(Ce,C)=>{const S=C*2*Math.PI/R,se=1+(fe>3?.055:.022)*Math.sin(S*7+Z);return[ye*Math.cos(S)*se,Pe,fe>3?ye*Math.sin(S)*se:ye*.82*Math.sin(S)*se]})),he=[];for(let ye=0;ye<R;ye++){const Pe=(ye+1)%R;he.push([[0,re[0][1],0],$[0][ye],$[0][Pe]],[[0,re.at(-1)[1],0],$.at(-1)[Pe],$.at(-1)[ye]])}for(let ye=0;ye<$.length-1;ye++)for(let Pe=0;Pe<R;Pe++){const fe=(Pe+1)%R;he.push([$[ye][Pe],$[ye+1][Pe],$[ye+1][fe]],[$[ye][Pe],$[ye+1][fe],$[ye][fe]])}h(J,he,T.point([.015,G[ne],q]),"linenDark",T.r),T.hoop(x+"-sack-tie-"+ne+"-"+Z,[.015,G[ne]+.235,q],.031,.006,"linen","xz"),T.tube(J+"-tie-ends",[[.045,G[ne]+.235,q],[.063,G[ne]+.233,q+.009],[.073,G[ne]+.211,q+.012]],.005,"linen")}else T.vessel(x+"-crock-"+ne+"-"+Z,Math.min(.115,N*.29),.21+ne*.028,[.015,G[ne],q],Z%3?"clay":"clayLight"),T.cyl(x+"-jar-lid-"+ne+"-"+Z,.084,.017,[.015,G[ne]+.21+ne*.028,q],"oakLight");else M(x+"-folded-cloth-"+ne+"-"+Z,j,X+G[ne],ce+q,N-.16,.24,Z%2?"linen":"linenDark")}i(x,te,"furnishing",{frontAngle:Math.PI/2})}function V(x,j,X,ce,N,U,k,te=0,T=0,D="vessels"){X=c(te);const O=p(j,X,ce,T);for(const G of[-N/2+.055,N/2-.055])for(const ne of[-k/2+.055,k/2-.055])O.b(x+"-leg-"+G+"-"+ne,[.07,U,.07],[G,U/2,ne],"oak",!0);O.b(x+"-back",[N-.1,U-.15,.035],[0,(U+.15)/2,-k/2+.023],"oak");for(const G of[-N/2+.025,N/2-.025])O.b(x+"-side-"+G,[.04,U-.15,k-.09],[G,(U+.15)/2,0],"oak");O.b(x+"-top",[N+.045,.06,k+.035],[0,U+.03,0],"oakLight",!0);for(let G=0;G<3;G++){const ne=.15+G*(U-.22)/3;if(O.b(x+"-shelf-"+G,[N-.08,.045,k-.065],[0,ne,0],"oakLight"),D==="clothes"||D==="linen"){const Z=O.point([0,ne+.0225,.01]);M(x+"-linen-stack-"+G,...Z,N-.17,k-.12,G===1?"quiltSage":"linen",T)}else if(D==="books"){const Z=Math.floor((N-.18)/.09);for(let q=0;q<Z;q++){const J=-N/2+.11+q*.09,re=.215+.055*((q*7+G*3)%11)/10;O.b(x+"-pages-"+G+"-"+q,[.056,re,k-.107],[J,ne+.0225+re/2,.01],"paper");for(const R of[-.033,.033])O.b(x+"-cover-"+G+"-"+q+"-"+R,[.01,re,k-.105],[J+R,ne+.0225+re/2,.01],"leather",!0);O.b(x+"-spine-"+G+"-"+q,[.071,re,.017],[J,ne+.0225+re/2,k/2-.035],"leather");for(const R of[.05,re-.05])O.b(x+"-binding-band-"+G+"-"+q+"-"+R,[.073,.012,.019],[J,ne+.0225+R,k/2-.032],"linenDark")}}else if(D==="shoes")for(const Z of[-.09,.09]){const q=x+"-shoe-"+G+"-"+Z,J=ne+.0225;O.b(q+"-sole",[.1,.018,.2],[Z,J+.009,.005],"leather",!0),O.m(q+"-heel-upper",s({profile:[{x:0,y:0},{x:.044,y:0},{x:.043,y:.068},{x:.035,y:.074},{x:.03,y:.074},{x:.036,y:.018},{x:0,y:.018}],segments:24}),[Z,J+.018,-.035],"leather");const re=Array.from({length:7},($,he)=>{const ye=he/6,Pe=-.012+ye*.108,fe=.045*(1-.72*ye**3);return Array.from({length:12},(Ce,C)=>{const S=C*Math.PI*2/12;return[Z+fe*Math.cos(S),J+.035+.019*Math.sin(S)*(1-.65*ye),Pe]})}),R=[re[0].toReversed(),re.at(-1)];for(let $=0;$<6;$++)for(let he=0;he<12;he++){const ye=(he+1)%12;R.push([re[$][he],re[$][ye],re[$+1][ye]],[re[$][he],re[$+1][ye],re[$+1][he]])}h(q+"-toe-box",R,O.point([0,0,0]),"leather",O.r);for(const $ of[-1,1])O.line(q+"-lace-"+$,[Z+$*.027,J+.067,-.015],[Z-$*.021,J+.061,.027],.003,"linenDark")}else{const Z=Math.max(1,Math.floor((N-.12)/.22));for(let q=0;q<Z;q++)O.vessel(x+"-vessel-"+G+"-"+q,Math.min(.075,(k-.09)/2),.15+G*.025,[(q-(Z-1)/2)*.22,ne+.0225,.015],q%2?"clayLight":"clay")}}if(D==="clothes"||D==="linen")for(const G of[-1,1]){const ne=x+"-door-"+G,Z=N/2-.01,q=U-.16,J=G*(N/2-.004),re=J-G*Z,R=(J+re)/2;for(const $ of[J-G*.021,re+G*.021])O.b(ne+"-stile-"+$,[.042,q,.028],[$,.155+q/2,k/2+.018],"oak",!0);for(const $ of[.155+.032,U-.005-.032])O.b(ne+"-rail-"+$,[Z-.042,.064,.028],[R,$,k/2+.018],"oakLight",!0);O.b(ne+"-recessed-panel",[Z-.076,q-.112,.015],[R,.155+q/2,k/2+.015],"oakLight");for(const $ of[.25,U-.1]){O.b(ne+"-hinge-strap-"+$,[.09,.026,.008],[J-G*.034,$,k/2+.036],"iron"),O.m(ne+"-hinge-knuckle-"+$,s({profile:[{x:.008,y:0},{x:.013,y:0},{x:.013,y:.056},{x:.008,y:.056},{x:.008,y:0}],segments:28}),[J,$-.028,k/2+.047],"iron"),O.m(x+"-fixed-door-pin-"+G+"-"+$,s({profile:[{x:0,y:0},{x:.013,y:0},{x:.013,y:.009},{x:.007,y:.009},{x:.007,y:.074},{x:0,y:.074}],segments:28}),[J,$-.037,k/2+.047],"iron");const he=$<U/2?.13:U+.024;O.cyl(x+"-fixed-door-stem-"+G+"-"+$,.007,Math.abs($-he),[J,Math.min($,he),k/2+.047],"iron"),O.line(x+"-fixed-door-anchor-"+G+"-"+$,[J-G*.035,he,k/2-.04],[J,he,k/2+.047],.014,"iron");for(const ye of[J-G*.027,J-G*.06])O.b(ne+"-hinge-rivet-"+$+"-"+ye,[.011,.011,.018],[ye,$,k/2+.039],"ironWarm",!0)}O.line(ne+"-pull-eye",[re+G*.028,.155+q*.55,k/2+.015],[re+G*.028,.155+q*.55,k/2+.057],.009,"iron"),O.hoop(ne+"-pull",[re+G*.028,.155+q*.55-.024,k/2+.053],.026,.007,"iron"),u({id:ne,parent:x,prefix:ne+"-",level:te,pivot:O.point([J,.155,k/2+.047]),restAngle:T,axis:[0,1,0],travel:G*Math.PI*.48,kind:"furnishing-door"})}i(x,te,"furnishing",{frontAngle:T})}function le(x,j,X,ce,N,U){X=c(0);const k=p(j,X,ce),te=N/2-.085,T=U/2-.07;for(const D of[-te,te])for(const O of[-T,T])k.b(x+"-leg-"+D+"-"+O,[.1,.83,.1],[D,.415,O],"oak",!0);for(const D of[.16,.47])k.b(x+"-shelf-"+D,[N-.08,.045,U-.06],[0,D,0],"oakLight");for(const D of[-T,T])k.b(x+"-apron-"+D,[N-.1,.14,.05],[0,.76,D],"oak");for(let D=0;D<3;D++)k.b(x+"-worktop-"+D,[N,.06,U/3-.003],[0,.86,(D-1)*U/3],"oakLight",!0);for(let D=0;D<4;D++)k.vessel(x+"-lower-pot-"+D,.13,.24,[-N*.32+D*N*.21,.1825,0],"clay");k.vessel(x+"-mixing-bowl",.18,.12,[-.65,.89,0],"clayLight"),k.vessel(x+"-pitcher",.1,.26,[.62,.89,-.02],"clay",!0),k.cyl(x+"-water-jug-cover-plug",.059,.016,[.62,1.134,-.02],"oakLight"),k.cyl(x+"-water-jug-cover-cap",.076,.015,[.62,1.15,-.02],"oakLight"),k.cyl(x+"-water-jug-cover-knob",.012,.025,[.62,1.165,-.02],"oak"),k.b(x+"-cutting-board",[.4,.025,.25],[0,.9025,.06],"oak",!0),k.b(x+"-knife-blade",[.16,.008,.032],[.02,.921,.06],"iron"),k.b(x+"-knife-grip",[.085,.017,.03],[.142,.923,.06],"oak");for(const D of[-N*.32,N*.32])k.b(x+"-rack-post-"+D,[.045,.43,.045],[D,1.055,-U/2+.045],"oak");k.b(x+"-rack",[N*.74,.06,.04],[0,1.24,-U/2+.045],"oak");for(let D=0;D<5;D++){const O=-N*.28+D*N*.14,G=-U/2+.115,ne=D===2?"iron":"oakLight";if(k.line(x+"-peg-"+D,[O,1.24,-U/2+.045],[O,1.24,-U/2+.13],.01,"oak"),k.hoop(x+"-tool-eye-"+D,[O,1.231,G],.017,.006,ne),k.line(x+"-tool-handle-"+D,[O,1.221,G],[O,1.009,G],.012,ne),D===3){for(const Z of[-.02,0,.02])k.line(x+"-fork-tine-"+Z,[O+Z,1.019,G],[O+Z,.964,G],.009,ne);k.line(x+"-fork-crosspiece",[O-.02,1.014,G],[O+.02,1.014,G],.012,ne)}else{const Z=D===2?.038:.027,q=[[0,0],[Z*.6,0],[Z,.009],[Z,.014],[Z-.005,.014],[Z*.52,.004],[0,.004]];e(x+"-spoon-bowl-"+D,s({profile:q.map(([J,re])=>({x:J,y:re})),segments:20}),k.point([O,.995,G]),ne,l([1,0,0],Math.PI/2))}}i(x,0,"furnishing")}function Te(x,j,X,ce,N=1){X=c(N);const U=N===1?Math.PI/2:0,k=p(j,X,ce,U),te=.7,T=N===1?.48:.72;for(const q of[-.27,.27])for(const J of[-T/2+.08,T/2-.08])k.b(x+"-leg-"+q+"-"+J,[.065,.73,.065],[q,.365,J],"oak",!0);k.b(x+"-shelf",[.62,.035,T-.1],[0,.18,0],"oakLight"),k.b(x+"-slab",[te,.07,T],[0,.765,0],"stone",!0),k.vessel(x+"-basin",N===1?.18:.21,.12,[-.07,.8,N===1?.01:.07],"clayLight"),k.vessel(x+"-jug",.075,.24,[.22,.8,-T/2+.09],"clay",!0),k.cyl(x+"-jug-lid",.054,.012,[.22,1.04,-T/2+.09],"oakLight"),k.vessel(x+"-waste-pail",.17,.29,[0,.1975,0],"oakLight",!1,"pail");for(const q of[.245,.45])k.hoop(x+"-pail-hoop-"+q,[0,q,0],.17*(.77+.23*(q-.1975)/.29)+.005,.012,"iron","xz");if(k.hoop(x+"-pail-bail",[0,.46,0],.165,.012,"iron","xy",0,Math.PI),N===1){k.tube(x+"-towel-rail",[[.38,.69,-.16],[.38,.69,.16]],.022,"oak");for(const q of[-.16,.16])k.line(x+"-rail-support-"+q,[.27,.69,q],[.38,.69,q],.018,"oak");m(x+"-towel",...k.point([.38,.69,0]),.28,"linen",U+Math.PI/2,.014)}else{k.tube(x+"-towel-rail",[[-.29,.69,T/2+.035],[.29,.69,T/2+.035]],.022,"oak");for(const q of[-.27,.27])k.line(x+"-rail-support-"+q,[q,.69,T/2-.08],[q,.69,T/2+.035],.018,"oak");m(x+"-towel",...k.point([0,.69,T/2+.035]),.28,"linen",U,.014)}i(x,N,"furnishing",{frontAngle:U});const D=N===1?3.96:6.15,O=N===1?4.65:1.02,G=p(D,X,O),ne=N===1?.42:.34,Z=N===1?.52:.43;G.cyl(x+"-tub-bottom",ne*.8,.065,[0,0,0],"oak");for(let q=0;q<28;q++){const J=q*Math.PI*2/28,re=(q+1)*Math.PI*2/28,R=(Ce,C)=>[[Math.cos(J)*Ce,C,Math.sin(J)*Ce],[Math.cos(re)*Ce,C,Math.sin(re)*Ce]],$=R(ne*.83,.04),he=R(ne,Z),ye=R(ne*.83-.025,.04),Pe=R(ne-.025,Z),fe=[[$[0],he[0],he[1],$[1]],[ye[1],Pe[1],Pe[0],ye[0]],[he[0],Pe[0],Pe[1],he[1]],[$[1],ye[1],ye[0],$[0]],[$[0],ye[0],Pe[0],he[0]],[$[1],he[1],Pe[1],ye[1]]];h(x+"-tub-stave-"+q,fe,[D,X,O],q%3?"oakLight":"oakPale")}for(const q of[.13,Z-.07])G.hoop(x+"-tub-band-"+q,[0,q,0],ne*.83+ne*.17*(q-.04)/(Z-.04)+.006,.019,"iron","xz");N===0&&G.vessel(x+"-soap-crock",.07,.1,[ne*.48,.065,0],"clayLight"),v(x+"-tub-linen",D,X,O,24,36,(q,J)=>{const re=(q-.5)*.23,R=J*3,$=Math.sqrt(ne*ne-re*re),he=Math.sqrt((ne-.025)**2-re*re);let ye,Pe;if(R<1)Pe=Z-.14*(1-R),ye=he-.004-(1-R)*.012;else if(R<2)ye=he-.004+($-he+.008)*(R-1),Pe=Z+.003+.002*Math.sin((R-1)*Math.PI);else{Pe=Z-.24*(R-2);const fe=.019*Math.exp(-(((Pe-(Z-.07))/.035)**2));ye=$+.004-(R-2)*ne*.17*.24/(Z-.04)+fe}return[ye,Pe,re]},"linen"),G.line(x+"-wash-paddle",[ne*.25,.06,-ne*.2],[ne*.6,Z+.16,-ne*.35],.032,"oakLight"),i(x+"-tub",N,"furnishing")}function y(x,j,X,ce,N,U,k=0){X=c(k);const te=U>N?Math.PI/2:0;U>N&&([N,U]=[U,N]);const T=p(j,X,ce,te);v(x+"-woven-base",j,X+.006,ce,Math.ceil(N/.05),16,(D,O)=>[(D-.5)*N,0,(O-.5)*U],"linenDark",te,.006);for(const D of[-U/2+.024,U/2-.024])T.b(x+"-selvedge-"+D,[N,.002,.026],[0,.007,D],"linen");for(const D of[-N/2,N/2])for(let O=0;O<Math.floor(U/.02);O++)T.tube(x+"-fringe-"+D+"-"+O,[[D,.005,-U/2+.01+O*.02],[D+Math.sign(D)*.025,.004,-U/2+.014+O*.02],[D+Math.sign(D)*.047,.003,-U/2+.011+O*.02]],.002,"linen");i(x,k,"furnishing")}function A(x,j,X,ce,N=0,U=0){const k=p(j,X,ce,U);k.b(x+"-plate",[.07,.26,.015],[0,0,0],"iron",!0);for(const te of[-.095,.095])k.b(x+"-nail-"+te,[.02,.02,.016],[0,te,.006],"iron");k.line(x+"-bracket",[0,-.07,.004],[0,-.1,.16],.022,"iron"),k.line(x+"-stem",[0,-.1,.16],[0,.02,.16],.022,"iron"),k.vessel(x+"-drip-cup",.065,.025,[0,.01,.16],"iron"),k.cyl(x+"-candle",.023,.14,[0,.02,.16],"wax"),k.cyl(x+"-wick",.003,.016,[0,.16,.16],"charcoal",8),k.m(x+"-flame",s({profile:[{x:0,y:0},{x:.007,y:.004},{x:.013,y:.013},{x:.014,y:.023},{x:.011,y:.032},{x:.007,y:.043},{x:.003,y:.054},{x:0,y:.062}],segments:32}),[0,.167,.16],"flame"),i(x,N,"furnishing",{frontAngle:U})}function Me(x,j,X,ce,N=1){X=c(N);const U=p(j,X,ce),k=.6,te=.57;for(const D of[-.25,.25])for(const O of[-.23,.23])U.b(x+"-post-"+D+"-"+O,[.07,.43,.07],[D,.215,O],"oak",!0);for(const D of[-.276,.276])U.b(x+"-side-"+D,[.045,.35,.5],[D,.255,0],"oakLight");U.b(x+"-back",[.51,.35,.04],[0,.255,-.26],"oak"),U.b(x+"-removable-front",[.51,.36,.025],[0,.25,.26],"oakLight",!0),U.hoop(x+"-front-pull",[0,.3,.28],.035,.009,"iron"),U.line(x+"-front-pull-eye",[0,.331,.262],[0,.331,.283],.01,"iron");const T=Array.from({length:32},(D,O)=>({x:.15*Math.cos(O*Math.PI/16),y:.17*Math.sin(O*Math.PI/16)}));e(x+"-pierced-seat",o({outer:[{x:-k/2,y:-te/2},{x:k/2,y:-te/2},{x:k/2,y:te/2},{x:-k/2,y:te/2}],holes:[T],depth:.045}),[j,X+.4525,ce],"oakLight",l([1,0,0],Math.PI/2)),U.vessel(x+"-chamber-pot",.205,.32,[0,0,0],"clayLight",!1,"pail"),e(x+"-transport-lid",s({profile:[{x:0,y:-.006},{x:.205,y:-.006},{x:.205,y:.006},{x:0,y:.006}],segments:32}),U.point([0,.205,-.225]),"oakLight",l([1,0,0],Math.PI/2)),U.hoop(x+"-transport-lid-pull",[0,.215,-.2],.022,.007,"iron"),U.line(x+"-transport-lid-eye",[0,.234,-.229],[0,.234,-.198],.009,"iron"),U.b(x+"-raised-lid",[.38,.3,.035],[0,.635,-.255],"oak",!0),U.line(x+"-lid-pin",[-.16,.484,-.25],[.16,.484,-.25],.018,"iron"),i(x,N,"furnishing")}function ue(x,j,X,ce,N,U,k){const te=x.startsWith("kitchen"),T=te?Math.PI:0,D=.45,O=p(j,D,ce,T),G=1.02,ne=-k/2+.055;O.b(x+"-hearthstone",[N+.18,.08,k+.3],[0,.04,.06],"stoneDark",!0);for(const fe of[-N/2+.1,N/2-.1])for(let Ce=0;Ce<5;Ce++)O.b(x+"-jamb-"+fe+"-"+Ce,[.2,(G-.08)/5-.006,k],[fe,.08+(Ce+.5)*(G-.08)/5,0],Ce%2?"stone":"stoneLight",!0);for(const fe of[-N/2+.1,N/2-.1])for(let Ce=0;Ce<=5;Ce++){const C=Ce===0||Ce===5?.003:.006,S=.08+Ce*(G-.08)/5+(Ce===0?.0015:Ce===5?-.0015:0);O.b(x+"-jamb-bed-joint-"+fe+"-"+Ce,[.194,C,k-.006],[fe,S,0],"plaster")}O.b(x+"-fireback",[N-.4,G-.08,.11],[0,(G+.08)/2,ne],"charcoal"),O.b(x+"-lintel",[N,.15,.18],[0,G+.075,k/2-.09],"stoneDark",!0);const Z=1.95-D,q=(te?-1.57:-1.03)-ce,J=q*Math.cos(T),re=(fe,Ce,C,S)=>[[-fe/2,C,S-Ce/2],[fe/2,C,S-Ce/2],[fe/2,C,S+Ce/2],[-fe/2,C,S+Ce/2]],R=re(N,k,G,0),$=re(.9,.6,Z,J),he=re(N-.24,k-.2,G,0),ye=re(.66,.36,Z,J),Pe=[];for(let fe=0;fe<4;fe++){const Ce=(fe+1)%4;Pe.push([R[fe],R[Ce],$[Ce],$[fe]],[he[Ce],he[fe],ye[fe],ye[Ce]],[$[fe],$[Ce],ye[Ce],ye[fe]],[R[Ce],R[fe],he[fe],he[Ce]])}h(x+"-hollow-hood",Pe.map(fe=>fe.toReversed()),[j,D,ce],"plaster",O.r);for(const fe of[-N*.22,N*.22])O.line(x+"-andiron-leg-"+fe,[fe,.08,.14],[fe,.28,.14],.035,"iron"),O.line(x+"-andiron-foot-"+fe,[fe,.1,-.19],[fe,.1,.26],.035,"iron"),O.line(x+"-andiron-rest-"+fe,[fe,.2,-.18],[fe,.2,.2],.03,"iron");for(let fe=0;fe<3;fe++){const Ce=fe===1?[0,.3395,-.16]:[-N*.28,.2565,(fe-1)*.1],C=fe===1?[0,.3395,.16]:[N*.28,.2565,(fe-1)*.1];O.tube(x+"-log-"+fe,[Ce,C],.083,fe===1?"charcoal":"oak");for(let S=0;S<4;S++)O.tube(x+"-charred-bark-"+fe+"-"+S,[Ce.map((se,me)=>se+(me===1?.036:me===(fe===1?0:2)?(S-1.5)*.015:0)),C.map((se,me)=>se+(me===1?.036:me===(fe===1?0:2)?(S-1.5)*.015:0))],.012,"charcoal")}for(let fe=0;fe<23;fe++){const Ce=N*.52*(fe*.618%1-.5),C=.32*(fe*.414%1-.5);O.m(x+"-coal-"+fe,s({profile:[{x:0,y:0},{x:.022+fe%3*.007,y:0},{x:.027,y:.018},{x:0,y:.033}],segments:7}),[Ce,.08,C],fe%4?"charcoal":"ember")}for(let fe=0;fe<5;fe++){const Ce=(fe-2)*N*.095,C=-.035+fe%2*.085,S=.15+fe%3*.026;O.m(x+"-tongue-fuel-"+fe,s({profile:[{x:0,y:0},{x:.028,y:0},{x:.033,y:.01},{x:.024,y:.026},{x:0,y:.029}],segments:20}),[Ce,.08,C],"ember");const se=Array.from({length:8},(ee,Ie)=>{const Le=Ie/8,Be=.008*(1-Le)+.025*Math.sin(Le*Math.PI)**1.4;return Array.from({length:20},($e,Ne)=>[Ce+.024*Le*Le*Math.sin(fe*1.7)+Be*Math.cos(Ne*Math.PI/10),.095+S*Le,C+.012*Le*Le+Be*.65*Math.sin(Ne*Math.PI/10)])}),me=[se[0].toReversed()],Ae=[Ce+.024*Math.sin(fe*1.7),.095+S,C+.012];for(let ee=0;ee<7;ee++)for(let Ie=0;Ie<20;Ie++){const Le=(Ie+1)%20;me.push([se[ee][Ie],se[ee][Le],se[ee+1][Le]],[se[ee][Ie],se[ee+1][Le],se[ee+1][Ie]])}for(let ee=0;ee<20;ee++)me.push([se[7][ee],se[7][(ee+1)%20],Ae]);h(x+"-fire-tongue-"+fe,me,[j,D,ce],"flame",O.r)}if(te){O.line(x+"-crane-upright",[N*.31,.08,0],[N*.31,1.027,0],.035,"iron");for(const fe of[.18,.72])O.b(x+"-crane-anchor-"+fe,[.11,.06,.075],[N*.31,fe,0],"iron"),O.line(x+"-crane-fixing-"+fe,[N*.31,fe,0],[N/2-.12,fe,0],.025,"iron");O.line(x+"-crane-arm",[N*.31,.987,0],[0,.987,.04],.025,"iron");for(let fe=0;fe<7;fe++){const Ce=.981-fe*.037;O.tube(x+"-chain-link-"+fe,Array.from({length:20},(C,S)=>{const se=S*Math.PI/10;return fe%2?[.013*Math.cos(se),Ce+.021*Math.sin(se),.04]:[0,Ce+.021*Math.sin(se),.04+.013*Math.cos(se)]}),.005,"iron",!0)}O.hoop(x+"-bail",[0,.5765,.04],.17,.012,"iron","xy",0,Math.PI),O.vessel(x+"-cookpot",.17,.19,[0,.4,.04],"iron",!1,"pail");for(const fe of[-.17,.17])O.b(x+"-bail-ear-"+fe,[.025,.042,.023],[fe,.5755,.04],"iron")}i(x,0,"furnishing")}function I(x,j,X,ce=1){const N=p(j,c(ce),X);for(const U of[-.19,.19])for(const k of[-.16,.16])N.b(x+"-leg-"+U+"-"+k,[.06,.6,.06],[U,.3,k],"oak",!0);for(const U of[.15,.61])N.b(x+"-board-"+U,[.47,.04,.41],[0,U,0],"oakLight",!0);N.vessel(x+"-water-jug",.085,.23,[-.07,.63,-.05],"clay",!0),N.cyl(x+"-jug-lid",.061,.012,[-.07,.86,-.05],"oakLight"),N.vessel(x+"-cup",.042,.08,[.12,.63,.1],"clayLight",!1,"cup"),i(x,ce,"furnishing")}function ie(x,j,X){const ce=c(0),N=p(j,ce,X);for(const U of[-.39,.39])N.b(x+"-foot-"+U,[.08,.05,.44],[U,.025,0],"oak"),N.b(x+"-upright-"+U,[.045,1.16,.045],[U,.63,0],"oak");for(const U of[.47,.84,1.2])N.tube(x+"-drying-rail-"+U,[[-.39,U,0],[.39,U,0]],.024,"oak");for(const U of[-.2,.17])m(x+"-drying-cloth-"+U,j+U,ce+1.2,X,.25);N.line(x+"-broom-handle",[.48,.13,.03],[.48,1.3,.03],.025,"oak"),N.line(x+"-broom-holder-arm",[.39,.84,0],[.48,.84,.03],.018,"iron"),N.hoop(x+"-broom-holder",[.48,.84,.03],.016,.007,"iron","xz");for(let U=0;U<19;U++){const k=U*Math.PI*2/19;N.line(x+"-broom-straw-"+U,[.48+.065*Math.cos(k),.005,.03+.036*Math.sin(k)],[.48+.013*Math.cos(k),.28,.03+.013*Math.sin(k)],.006,"linenDark")}N.hoop(x+"-broom-binding",[.48,.22,.03],.023,.009,"linen","xz"),N.vessel(x+"-closed-water-pail",.18,.32,[-.62,0,.04],"oakLight",!1,"pail");for(const U of[.06,.28])N.hoop(x+"-water-band-"+U,[-.62,U,.04],.18*(.77+.23*U/.32)+.004,.012,"iron","xz");N.cyl(x+"-pail-lid",.18,.018,[-.62,.32,.04],"oakLight"),N.hoop(x+"-carry-bail",[-.62,.29,.04],.175,.012,"iron","xy",0,Math.PI),i(x,0,"furnishing")}return{bevel:f,at:p,cloth:g,table:P,bench:L,bed:F,chest:Q,shelf:H,cabinet:V,counter:le,washBasin:Te,rug:y,wallLamp:A,latrineUnit:Me,hearth:ue,nightStand:I,serviceTools:ie}}function rg({box:n,mesh:e,beam:t,finish:i,polyhedron:r,revolve:s,extrude:o,V:a,Q:l,bevel:u,registerMechanism:c}){const h=[-1.7,2.35],f=[1.65,3.65],p=[],v=(I,ie,x,j)=>p.push({id:I,material:ie,faces:x,grainAxis:j}),M=(I,ie,x)=>{for(const j of p)e(j.id,r(j.faces.map(X=>X.map(a))),[0,0,0],j.material,void 0,{grainAxis:j.grainAxis});p.length=0,i(I,ie,x)},m=I=>Math.sin(I*127.1+73.7)*43758.5453%1,g=(I,ie,x,j=1,X="stone")=>{const ce=[[-.45,.78],[0,1],[.43,.78]],N=ce.map(([k,te],T)=>Array.from({length:9},(D,O)=>{const G=O*Math.PI*2/9+j*.71,ne=1+m(j+O*13)*.18;return[ie[0]+Math.cos(G)*x[0]*te*ne/2,ie[1]+(k+m(j+O*5+T*31)*.06)*x[1],ie[2]+Math.sin(G)*x[2]*te*ne/2]})),U=[];for(let k=1;k<8;k++)U.push([N[0][0],N[0][k],N[0][k+1]],[N[2][0],N[2][k+1],N[2][k]]);for(let k=0;k<2;k++)for(let te=0;te<9;te++){const T=(te+1)%9;U.push([N[k][te],N[k+1][te],N[k+1][T]],[N[k][te],N[k+1][T],N[k][T]])}v(I,X,U)},P=(I,ie,x,j,X,ce="bark")=>{const N=x.map((q,J)=>q-ie[J]),U=Math.hypot(...N),k=N.map(q=>q/U),te=Math.abs(k[1])<.9?[k[2],0,-k[0]]:[0,k[2],-k[1]],T=Math.hypot(...te);for(let q=0;q<3;q++)te[q]/=T;const D=[k[1]*te[2]-k[2]*te[1],k[2]*te[0]-k[0]*te[2],k[0]*te[1]-k[1]*te[0]],O=(q,J)=>Array.from({length:9},(re,R)=>q.map(($,he)=>$+J*(te[he]*Math.cos(R*Math.PI*2/9)+D[he]*Math.sin(R*Math.PI*2/9)))),G=O(ie,j),ne=O(x,X),Z=[G.toReversed(),ne];for(let q=0;q<9;q++)Z.push([G[q],G[(q+1)%9],ne[(q+1)%9],ne[q]]);v(I,ce,Z,k)},L=(I,ie,x,j,X,ce=0,N="leaves")=>{const U=Math.cos(x),k=Math.sin(x),te=(G,ne,Z)=>[ie[0]+U*G-k*ne,ie[1]+Z+G*ce,ie[2]+k*G+U*ne],T=[[0,0],[.16,-.3],[.42,-.5],[.7,-.41],[.91,-.19],[1,0],[.91,.19],[.7,.41],[.42,.5],[.16,.3]].map(([G,ne])=>te(G*j,ne*X,.016*Math.sin(G*Math.PI)-j*.24*G*G)),D=te(j*.46,0,.018-j*.24*.46**2),O=[];for(let G=0;G<T.length;G++){const ne=(G+1)%T.length;O.push([T[G],T[ne],D])}v(I,N,O)};e("site-earth",o({outer:[{x:-11.5,y:-8.5},{x:11.5,y:-8.5},{x:11.5,y:10.5},{x:-11.5,y:10.5}],holes:[((I,ie,x,j=48)=>Array.from({length:j},(X,ce)=>({x:I+x*Math.cos(ce*2*Math.PI/j),y:ie+x*Math.sin(ce*2*Math.PI/j)})))(...h,1.3952380952380952)],depth:.6}),[0,-.3,0],"soil",l([1,0,0],Math.PI/2)),e("pond-excavation-bearing",s({profile:[{x:0,y:-.6},{x:1.3952380952380952,y:-.6},{x:1.3952380952380952,y:0},{x:1.3,y:-.4},{x:0,y:-.4}],segments:48}),[h[0],0,h[1]],"soil");for(let I=0;I<850;I++){const ie=-10.4+20.8*(I*.61803398875%1),x=-7.4+17*(I*.41421356237%1);if(!(Math.abs(ie)<7.9&&x<6.35||Math.abs(ie-.1)<.75&&x>4||Math.hypot(ie-h[0],x-h[1])<1.65))for(let j=0;j<3;j++)L("ground-grass-"+I+"-"+j,[ie,0,x],I+j*2.1,.12+I%5*.02,.017,1.1,"herbs")}M("site",-1,"site");const Q=[[-.15,-.1],[.95,-.1],[.95,4.275],[3.2,4.275],[3.2,5.125],[.95,5.125],[.65,9.4],[-.45,9.4],[-.15,5.125],[-3.2,5.125],[-3.2,4.275],[-.15,4.275]];e("garden-path-union",o({outer:Q.map(([I,ie])=>({x:I,y:ie})),depth:.036}),[0,.018,0],"gravel",l([1,0,0],Math.PI/2));for(let I=0;I<Q.length;I++){const ie=Q[I],x=Q[(I+1)%Q.length],j=Math.hypot(x[0]-ie[0],x[1]-ie[1]);if(!(j<1||Math.abs(ie[0]-x[0])>.001&&(Math.abs(ie[1])<.2||ie[1]>9.3)))for(let X=0;X<Math.floor(j/.28);X++){const ce=(X+.5)/Math.floor(j/.28),N=ie[0]+(x[0]-ie[0])*ce,U=ie[1]+(x[1]-ie[1])*ce;U<1.08||g("path-edge-"+I+"-"+X,[N,.064,U],[.24,.12,.24],I*100+X,X%3?"stone":"stoneLight")}}for(let I=0;I<1700;I++){const ie=-3.15+6.3*(I*.61803398875%1),x=.98+8.35*(I*.41421356237%1),j=x<=5.125?.3:.3*(9.4-x)/(9.4-5.125);(ie>-.43+j&&ie<.63+j||x>4.295&&x<5.105)&&g("gravel-"+I,[ie,.038,x],[.028+I%3*.009,.012,.024],I,I%4?"gravel":"stoneLight")}M("garden-paths",-1,"garden");for(const[I,ie,x,j,X]of[[0,1.95,1.9,1.8,1.3],[1,-1.5,5.55,1.3,.65]]){u("bed-earth-"+I,[j,.09,X],[ie,.045,x],"soil",void 0,.035);for(let ce=0;ce<22;ce++){const N=ie+j*(ce*.61803398875%1-.5)*.87,U=x+X*(ce*.41421356237%1-.5)*.83,k=.2+ce%5*.052,te=[N+.035,.09+k,U];P("herb-"+I+"-"+ce,[N,.09,U],te,.009,.003,"herbs");for(let T=1;T<=5;T++)for(const D of[-1,1])L("herb-leaf-"+I+"-"+ce+"-"+T+"-"+D,[N+T*.006,.09+k*T/6,U],ce*.9+T*.8+D*Math.PI/2,ce%3===1?.08:.11,ce%3===1?.068:.038,.1,ce%3?"herbs":"leafLight");if(ce%3===0)for(let T=0;T<4;T++){const D=[te[0]+Math.cos(T*1.7)*.024,te[1]+T*.015,te[2]+Math.sin(T*1.7)*.024];P("flower-pedicel-"+I+"-"+ce+"-"+T,te,D,.003,.002,"herbs"),g("herb-flower-"+I+"-"+ce+"-"+T,D,[.034,.038,.034],ce+T,"flower")}}}M("herb-beds",-1,"garden"),e("pond-lined-basin",s({profile:[{x:0,y:-.4},{x:1.3,y:-.4},{x:1.4,y:.02},{x:1.3,y:.04},{x:1.2,y:-.06},{x:1.03,y:-.36},{x:0,y:-.36}],segments:64}),[h[0],0,h[1]],"stoneDark",void 0,{projected:!0});for(let I=0;I<29;I++){const ie=I*Math.PI*2/29,x=1.3+m(I)*.025;g("pond-rim-"+I,[h[0]+x*Math.cos(ie),.063+m(I+1)*.017,h[1]+x*Math.sin(ie)],[.27+m(I+2)*.025,.17+m(I+3)*.055,.27+m(I+4)*.025],I,I%3?"stone":"stoneLight")}e("pond-water",s({profile:[{x:0,y:-.36},{x:1.03,y:-.36},{x:1.2,y:-.06},{x:1.215,y:-.045},{x:0,y:-.045}],segments:48}),[h[0],0,h[1]],"water");for(let I=0;I<18;I++){const ie=I*.45,x=.85+I%3*.08,j=h[0]+Math.cos(ie)*x,X=h[1]+Math.sin(ie)*x;if(I%2===0){P("pond-reed-root-"+I,[j,-.375,X],[j,-.07,X],.018,.012,"herbs");for(let ce=0;ce<4;ce++)L("pond-reed-"+I+"-"+ce,[j,-.07,X],ie+ce*.5,.32+ce%2*.13,.026,1.5,"herbs")}else{P("pond-lily-stalk-"+I,[j,-.375,X],[j,-.045,X],.005,.004,"herbs");const ce=[j,-.045,X],N=Array.from({length:18},(k,te)=>{const T=.25+te*(Math.PI*2-.5)/17;return[j+.069*Math.cos(T),-.044+.001*Math.sin(te),X+.061*Math.sin(T)]}),U=[];for(let k=0;k<17;k++)U.push([ce,N[k+1],N[k]]);v("pond-lily-"+I,"leafDark",U)}}for(let I=0;I<36;I++){const ie=I*.7,x=.25+I%9*.08;g("submerged-stone-"+I,[h[0]+Math.cos(ie)*x,-.33,h[1]+Math.sin(ie)*x],[.12,.06,.09],I,"stoneDark")}M("pond",-1,"garden");const H=[[f[0],-.02,f[1]],[f[0]-.06,1.1,f[1]+.02],[f[0]-.17,2.25,f[1]-.08],[f[0]-.06,3.45,f[1]+.04]],V=[.18,.127,.091,.036],le=H.map((I,ie)=>Array.from({length:9},(x,j)=>[I[0]+V[ie]*Math.cos(j*Math.PI*2/9),I[1],I[2]+V[ie]*Math.sin(j*Math.PI*2/9)])),Te=[le[0].toReversed(),le.at(-1)];for(let I=0;I<3;I++)for(let ie=0;ie<9;ie++){const x=(ie+1)%9;Te.push([le[I][ie],le[I][x],le[I+1][x]],[le[I][ie],le[I+1][x],le[I+1][ie]])}v("trunk-continuous","bark",Te.map(I=>I.toReversed()),[0,1,0]);const y=[f[0]+.19,4.3,f[1]-.09];P("trunk-leader",H[3],y,.036,.003);for(let I=0;I<10;I++){const ie=(I+.5)/10,x=H[3].map((j,X)=>j+(y[X]-j)*ie);L("leader-leaf-"+I,x,I*2.399963,.12,.065,-.2+I%4*.15)}for(let I=0;I<5;I++){const ie=I*1.27,x=.4+.11*(I%3),j=[f[0]+Math.cos(ie)*x*.48,.065,f[1]+Math.sin(ie)*x*.48],X=[f[0]+Math.cos(ie+.12)*x,-.018,f[1]+Math.sin(ie+.12)*x];P("root-neck-"+I,[f[0],.15,f[1]],j,.075,.038),P("root-tip-"+I,j,X,.038,.01)}for(let I=0;I<8;I++){const ie=I*2.399963,x=I<3?1:2,j=I<3?.15+I*.15:(I-3)*.15,X=H[x].map((U,k)=>U+(H[x+1][k]-U)*j),ce=[f[0]+Math.cos(ie)*(1.26+I%2*.1),3.3+I%3*.4,f[1]+Math.sin(ie)*(1.26+I%2*.1)],N=X.map((U,k)=>U+(ce[k]-U)*.48+(k===1?.06:k===2?.06*Math.sin(I):0));P("bough-base-"+I,X,N,.062-.003*I,.034),P("bough-tip-"+I,N,ce,.034,.003);for(let U=0;U<16;U++){const k=(U+.4)/16,te=U<7?X.map((G,ne)=>G+(N[ne]-G)*(U+.5)/7):N.map((G,ne)=>G+(ce[ne]-G)*(U-6.5)/9),T=ie+(U%2?1:-1)*(.7+U*.09),D=.22+.1*(1-k),O=[te[0]+Math.cos(T)*D,te[1]+.04+U%3*.06,te[2]+Math.sin(T)*D];P("twig-"+I+"-"+U,te,O,.01,.003);for(let G=0;G<13;G++){const ne=(G+.5)/13,Z=te.map((J,re)=>J+(O[re]-J)*ne),q=T+G*2.399963;L("apple-leaf-"+I+"-"+U+"-"+G,Z,q,.11+G%3*.017,.07,-.38+(I*3+U+G)%7*.12,["leaves","leafLight","leafDark"][(I+U+G)%3])}if((I+U)%5===0){const G=[O[0],O[1]-.025,O[2]];P("fruit-stalk-"+I+"-"+U,O,[G[0],G[1]-.014,G[2]],.003,.002),e("apple-"+I+"-"+U,s({profile:[{x:0,y:-.085},{x:.025,y:-.083},{x:.043,y:-.055},{x:.042,y:-.023},{x:.022,y:-.005},{x:0,y:-.012}],segments:20}),G,"appleRed")}}}M("apple-tree",-1,"garden");const A=(I,ie,x)=>{const j=Math.hypot(x[0]-ie[0],x[1]-ie[1]),X=(x[0]-ie[0])/j,ce=(x[1]-ie[1])/j,N=-ce,U=X,k=Math.ceil(j/.24);for(let te=0;te<=k;te++){const T=j*te/k;P(I+"-stake-"+te,[ie[0]+X*T,-.16,ie[1]+ce*T],[ie[0]+X*T,.72+te%3*.025,ie[1]+ce*T],.026,.017)}for(let te=0;te<8;te++)for(let T=0;T<k;T++){const D=j*T/k,O=j*(T+1)/k,G=(T+te)%2?1:-1;for(let ne=0;ne<6;ne++){const Z=q=>{const J=D+(O-D)*q,re=.027*G*Math.cos(Math.PI*q);return[ie[0]+X*J+N*re,.1+te*.073,ie[1]+ce*J+U*re]};P(I+"-withe-"+te+"-"+T+"-"+ne,Z(ne/6),Z((ne+1)/6),.013,.012,"bark")}}};A("fence-front-west",[-9,8.25],[-.55,8.25]),A("fence-front-east",[.75,8.25],[9,8.25]),A("fence-west",[-9,.15],[-9,8.25]),A("fence-east",[9,8.25],[9,.15]);for(const I of[-.55,.75])u("gate-post-"+I,[.11,.9,.11],[I,.45,8.25],"oak",void 0,.015);const Me=[-.49,0,8.25],ue=(I,ie,x)=>[Me[0]+I,ie,Me[2]+x];for(let I=0;I<7;I++)t("gate-leaf-upright-"+I,ue(.05+I*.18,.09,0),ue(.05+I*.18,.76,0),.037,"oak");for(const I of[.19,.61])t("gate-leaf-rail-"+I,ue(0,I,0),ue(1.18,I,0),.055,"oakLight");t("gate-leaf-brace",ue(.025,.18,.03),ue(1.16,.62,.03),.039,"oak");for(const I of[.19,.61]){e("gate-pintle-"+I,s({profile:[{x:0,y:0},{x:.017,y:0},{x:.017,y:.02},{x:.009,y:.02},{x:.009,y:.14},{x:0,y:.14}],segments:20}),ue(0,I-.07,0),"iron"),t("gate-fixed-anchor-"+I,[-.55,I-.06,8.25],ue(0,I-.06,0),.02,"iron"),e("gate-leaf-knuckle-"+I,s({profile:[{x:.01,y:0},{x:.017,y:0},{x:.017,y:.1},{x:.01,y:.1},{x:.01,y:0}],segments:20}),ue(0,I-.05,0),"iron"),t("gate-leaf-hinge-strap-"+I,ue(0,I,.016),ue(.3,I,.024),.018,"iron");for(const ie of[.05,.14,.25])u("gate-leaf-rivet-"+I+"-"+ie,[.013,.013,.03],ue(ie,I,.019),"ironWarm",void 0,.002)}t("gate-leaf-latch",ue(.99,.6,-.033),ue(1.23,.6,-.033),.02,"iron"),t("gate-leaf-latch-grip",ue(1.08,.6,-.034),ue(1.08,.55,-.045),.016,"iron"),n("gate-keeper",[.06,.06,.022],[.75,.6,8.215],"iron"),M("garden-fence",-1,"garden-boundary"),c({id:"garden-gate",parent:"garden-fence",prefix:"gate-leaf-",level:-1,pivot:Me,restAngle:0,axis:[0,1,0],travel:-Math.PI*.46,kind:"gate",default:1})}function sg(n){n.shadowMap.enabled=!0,n.localClippingEnabled=!0,n.shadowMap.type=xl,n.toneMapping=Ml,n.toneMappingExposure=1.05}function hl({shadows:n=!0,resolveTexture:e,geometryOnly:t=!1,instanceConsumer:i}={}){var rt,mt,oe;const r=d=>{const _=new ot(d);return{r:_.r,g:_.g,b:_.b,a:1,hex:null}},s=Object.entries({oak:"#574331",oakLight:"#6b523d",oakPale:"#755d46",oakGrain:"#4b3d2e",plaster:"#d3c2a3",stone:"#929085",stoneLight:"#aaa496",stoneDark:"#68645c",roof:"#74503a",roofLight:"#80563c",roofMuted:"#79543e",floor:"#a4957a",upper:"#896f51",iron:"#363532",ironWarm:"#6b5541",glass:"#a2b3ac",water:"#476f73",soil:"#655e42",herbs:"#657d48",leaves:"#7d854c",leafLight:"#7e874b",leafDark:"#4a6137",flower:"#a96f63",gravel:"#b4a58b",bed:"#8e8876",linen:"#bda986",linenDark:"#87775f",quiltRust:"#795447",quiltSage:"#69765c",appleRed:"#8d4535",clay:"#8d654d",clayLight:"#b89874",charcoal:"#302b25",leather:"#65483b",paper:"#cfbd92",wax:"#d8bc83",flame:"#ffbd46",ember:"#d86b22",proxy:"#a88b61"}).map(([d,_])=>({id:d,name:d,baseColor:r(_),roughness:["iron","ironWarm"].includes(d)?.46:d==="glass"?.18:d==="water"?.21:.88,metallic:["iron","ironWarm"].includes(d)?.65:0,opacity:d==="glass"?.35:d==="water"?.76:1,emissive:["flame","ember"].includes(d)?r(_):null,baseColorTexture:null,doubleSided:["herbs","leaves","leafLight","leafDark"].includes(d)})),o=d=>({x:d[0],y:d[1],z:d[2]}),a=(d,_)=>{const b=Math.sin(_/2);return{x:d[0]*b,y:d[1]*b,z:d[2]*b,w:Math.cos(_/2)}},l=(d,_={x:0,y:0,z:0,w:1})=>({translation:o(d),rotation:_,scale:{x:1,y:1,z:1}});let u=[];const c=[],h=[],f=[],p=[],v=[],M=(d,_,b,z="oak",B,pe)=>u.push({id:d,name:d,geometry:ul({type:"primitive",shape:{type:"box",width:_[0],height:_[1],depth:_[2]}},z,pe),material:z,attachedBone:null,transform:l(b,B)}),m=(d,_,b,z="plaster",B,pe)=>u.push({id:d,name:d,geometry:ul({type:"mesh",mesh:_},z,pe),material:z,attachedBone:null,transform:l(b,B)}),g=(d,_,b,z=.06,B="oak")=>{const pe=new ae(..._),_e=new ae(...b),Ee=_e.clone().sub(pe),ge=new Gt().setFromUnitVectors(new ae(0,1,0),Ee.clone().normalize());M(d,[z,Ee.length(),z],pe.add(_e).multiplyScalar(.5).toArray(),B,{x:ge.x,y:ge.y,z:ge.z,w:ge.w})},P=(d,_,b,z=.14,B="oak",pe=!0)=>{if(pe&&/^(rear-rafter|rear-tie|wing-rafter|wing-tie|valley)/.test(d)){let Se=0,Ue=1,ze=!0;for(const[Qe,Ze,Je]of[[0,te[0]-.15,te[1]+.15],[2,te[2]-.15,te[3]+.15]]){const nt=b[Qe]-_[Qe];if(Math.abs(nt)<1e-9)(_[Qe]<Ze||_[Qe]>Je)&&(ze=!1);else{const Oe=[(Ze-_[Qe])/nt,(Je-_[Qe])/nt].sort((je,Ke)=>je-Ke);Se=Math.max(Se,Oe[0]),Ue=Math.min(Ue,Oe[1])}}if(ze&&Se<Ue){const Qe=Ze=>_.map((Je,nt)=>Je+(b[nt]-Je)*Ze);Se>1e-4&&P(d+"-before",_,Qe(Se),z,B,!1),Ue<.9999&&P(d+"-after",Qe(Ue),b,z,B,!1);return}}if(/rail|guard-top|inner-turn-join|arrival-guard-join/.test(d)){const Se=Math.hypot(b[0]-_[0],b[2]-_[2]);if(Se>1e-6){const Ue=-(b[2]-_[2])/Se*z/2,ze=(b[0]-_[0])/Se*z/2,Qe=Oe=>[[Oe[0]+Ue,Oe[1]-z/2,Oe[2]+ze],[Oe[0]-Ue,Oe[1]-z/2,Oe[2]-ze],[Oe[0]-Ue,Oe[1]+z/2,Oe[2]-ze],[Oe[0]+Ue,Oe[1]+z/2,Oe[2]+ze]],Ze=Qe(_),Je=Qe(b),nt=[Ze.toReversed(),Je];for(let Oe=0;Oe<4;Oe++)nt.push([Ze[Oe],Ze[(Oe+1)%4],Je[(Oe+1)%4],Je[Oe]]);m(d,hn(nt.map(Oe=>Oe.map(o))),[0,0,0],B);return}}const _e=new ae(..._),Ee=new ae(...b),ge=Ee.clone().sub(_e),xe=new Gt().setFromUnitVectors(new ae(0,1,0),ge.clone().normalize());M(d,[z,ge.length(),z],_e.add(Ee).multiplyScalar(.5).toArray(),B,{x:xe.x,y:xe.y,z:xe.z,w:xe.w})};s.push({...s.find(d=>d.id==="oak"),id:"bark",name:"bark"});const L=tg(s);function F(d,_,b="frame",z={}){c.push({id:d,level:_,role:b,review:z,model:{id:d,name:d,origin:"generated",skeleton:null,materials:L,parts:u,asset:null,body:null}}),u=[]}function Q(d,_,b,z,B,pe,_e,Ee,ge="window"){const xe=u.filter(z);if(!xe.length)throw new Error("Empty moving assembly: "+d);u=u.filter(Je=>!z(Je));const Se=l(B,a([0,1,0],pe)),Ue=Je=>new dt().compose(new ae(Je.translation.x,Je.translation.y,Je.translation.z),new Gt(Je.rotation.x,Je.rotation.y,Je.rotation.z,Je.rotation.w),new ae(Je.scale.x,Je.scale.y,Je.scale.z)),ze=Ue(Se).invert(),Qe=xe.map(Je=>{const nt=new ae,Oe=new Gt,je=new ae;return ze.clone().multiply(Ue(Je.transform)).decompose(nt,Oe,je),{...Je,transform:{translation:o(nt.toArray()),rotation:{x:Oe.x,y:Oe.y,z:Oe.z,w:Oe.w},scale:o(je.toArray())}}}),Ze={kind:"revolute",axis:o(_e),pivot:o([0,0,0]),min:Math.min(0,Ee),max:Math.max(0,Ee)};return c.push({id:d,level:b,role:ge,parent:_,review:{frontAngle:pe},articulation:{rest:Se,motion:Ze,closed:0,open:Ee,default:0},model:{id:d,name:d,origin:"generated",skeleton:null,materials:L,parts:Qe,asset:null,body:null}}),{id:d,element:d,motion:Ze}}const{bevel:H,at:V,table:le,bench:Te,hearth:y,counter:A,shelf:Me,bed:ue,chest:I,washBasin:ie,rug:x,cabinet:j,wallLamp:X,latrineUnit:ce,nightStand:N,serviceTools:U}=ig({box:M,mesh:m,beam:g,finish:F,polyhedron:hn,revolve:Zn,extrude:Ar,V:o,Q:a,registerMechanism:d=>v.push(d)}),k=(d,_,b,z,B)=>p.push({id:d,label:_,level:b,bounds:z,door:B}),te=[-6.5,-5.6,-1.9,-.7];k("hall","생활 홀",0,[-7.38,-4.72,-1.2,5.75],[-4.6,3.85]),k("kitchen","주방",0,[-7.35,-3.4,-5.25,-1.48],[-3.95,-1.36]),k("pantry","식료실",0,[-3.2,-1.6,-5.25,-1.48],[-2.4,-1.36]),k("ledger","서재·장부실",0,[3.2,7.35,-5.25,-1.48],[3.95,-1.36]),k("service","저장·세척실",0,[4.72,7.35,-1.2,5.75],[4.6,3.85]),k("entrance","현관·계단 하부",0,[-1.4,3,-5.25,-1.48],[.8,-1.36]),k("gallery-west","서쪽 회랑",0,[-4.48,-3.25,0,5.75],[-3.85,5.75]),k("gallery-rear","뒤쪽 회랑",0,[-4.48,4.48,-1.24,0],[0,0]),k("gallery-east","동쪽 회랑",0,[3.25,4.48,0,5.75],[3.85,5.75]),k("master","주침실",1,[-7.35,-3.35,.15,5.75],[-4.45,.05]),k("child-west","작은 침실 서쪽",1,[-7.35,-1.45,-5.25,-1.85],[-4.45,-1.75]),k("child-east","작은 침실 동쪽",1,[3.1,7.35,-5.25,-1.85],[4.45,-1.75]),k("washroom","공동 세척·측간실",1,[3.35,4.9,.15,5.75],[4.1,.05]),k("storage","공용 수납",1,[5.1,7.35,.15,5.75],[5.75,.05]),k("corridor","2층 일자 복도",1,[-5.6,6.4,-1.65,-.15],[2.4,-1.65]),k("landing","2층 계단참",1,[1.8,3,-5.25,-1.65],[2.4,-1.65]);for(const d of p){const[_,b,z,B]=d.bounds;d.polygon=[[_,z],[b,z],[b,B],[_,B]]}p.find(d=>d.id==="master").polygon=[[-7.35,-1.65],[-6.62,-1.65],[-6.62,-.58],[-5.8,-.58],[-5.8,.15],[-3.35,.15],[-3.35,5.75],[-7.35,5.75]],p.find(d=>d.id==="storage").polygon=[[6.6,-1.65],[7.35,-1.65],[7.35,5.75],[5.1,5.75],[5.1,.15],[6.6,.15]],p.find(d=>d.id==="landing").polygon=[[1.8,-5.25],[3,-5.25],[3,-1.75],[-1.3,-1.75],[-1.3,-2.6],[0,-2.6],[0,-3.94],[1.8,-3.94]];const T=[.45,3.33],D=2.66;function O(d,_,b,z,B=[],pe=!1){var K;const _e=T[z],Ee=b[0]-_[0],ge=b[1]-_[1],xe=Math.hypot(Ee,ge),Se=-Math.atan2(ge,Ee),Ue=a([0,1,0],Se),ze=(w,W,Y=0)=>[_[0]+Ee*w/xe+Math.sin(Se)*Y,W,_[1]+ge*w/xe+Math.cos(Se)*Y],Qe=B.map(w=>[w.at-w.w/2,w.at+w.w/2,w.sill||0,(w.sill||0)+w.h]),Ze=[[0,.16],[xe-.16,xe]],Je=Math.ceil(xe/1.5);for(let w=1;w<Je;w++){const W=xe*w/Je;B.some(Y=>Math.abs(W-Y.at)<Y.w/2+.32)||Ze.push([W-.08,W+.08])}for(const w of B)Ze.push([w.at-w.w/2-.16,w.at-w.w/2],[w.at+w.w/2,w.at+w.w/2+.16]);const nt=Math.abs(Ee)>Math.abs(ge)?[te[0]-_[0],te[1]-_[0]].map(w=>w*Math.sign(Ee)).sort((w,W)=>w-W):[te[2]-_[1],te[3]-_[1]].map(w=>w*Math.sign(ge)).sort((w,W)=>w-W),Oe=Math.abs(Ee)>Math.abs(ge)?_[1]>=te[2]&&_[1]<=te[3]:_[0]>=te[0]&&_[0]<=te[1],je=z===0?1.95-_e:0,Ke=[...new Set([0,xe,...Qe.flatMap(w=>w.slice(0,2)),...Ze.flat(),...Oe?[nt[0]-.12,...nt,nt[1]+.12]:[]].filter(w=>w>=0&&w<=xe))].sort((w,W)=>w-W),pt=[...new Set([0,.2,D-.28,D,...Qe.flatMap(w=>[w[2],w[3],w[3]+.18,...w[2]>0?[w[2]-.12]:[]]),...Oe?[je]:[]].filter(w=>w>=0&&w<=D))].sort((w,W)=>w-W),Mt=Ke.slice(0,-1).map((w,W)=>pt.slice(0,-1).map((Y,we)=>{const ve=(w+Ke[W+1])/2,de=(Y+pt[we+1])/2;return Qe.some(De=>ve>De[0]&&ve<De[1]&&de>De[2]&&de<De[3])||Oe&&ve>nt[0]&&ve<nt[1]&&de>=je?null:Oe&&ve>nt[0]-.12&&ve<nt[1]+.12?"stone":Ke[W+1]-w<.065&&Ze.some(De=>Math.abs(De[1]-w)<1e-7||Math.abs(De[0]-Ke[W+1])<1e-7)||de<.2||de>D-.28||Ze.some(De=>ve>De[0]&&ve<De[1])||Qe.some(De=>ve>=De[0]&&ve<=De[1]&&(de>=De[3]&&de<De[3]+.18||De[2]>0&&de>De[2]-.12&&de<De[2]))?"oak":"plaster"})),gt={oak:[],plaster:[],stone:[]},Ye=[],ct=w=>w==="plaster"?.1:.12;for(let w=0;w<Ke.length-1;w++)for(let W=0;W<pt.length-1;W++){const Y=Mt[w][W];if(!Y)continue;const we=Ke[w],ve=Ke[w+1],de=pt[W],be=pt[W+1],De=ct(Y),ke=(st,We,Xe)=>ze(st,_e+We,d==="outer-west-0"&&st>=2.93-1e-8&&st<=4.195+1e-8&&Math.abs(Xe-.1)<1e-8?Xe-.045:Xe),Re=(we+ve)/2,et=Ze.some(st=>Re>=st[0]&&Re<=st[1])&&de>=.2&&be<=D-.28,He={grainAxis:et?[0,1,0]:[Ee/xe,0,ge/xe],origin:ze(et?(we+ve)/2:0,_e,0)},ft=st=>{gt[Y].push(st),Y==="oak"&&Ye.push({...He,count:st.length})};ft([ke(we,de,De),ke(ve,de,De),ke(ve,be,De),ke(we,be,De)]),ft([ke(ve,de,-De),ke(we,de,-De),ke(we,be,-De),ke(ve,be,-De)]);for(const[st,We,Xe,vt]of[[w-1,W,[we,de],[we,be]],[w+1,W,[ve,be],[ve,de]],[w,W-1,[ve,de],[we,de]],[w,W+1,[we,be],[ve,be]]]){const lt=(K=Mt[st])==null?void 0:K[We];if(lt&&ct(lt)>=De)continue;const It=lt?[[-De,-ct(lt)],[ct(lt),De]]:[[-De,De]];for(const[Zt,yt]of It)ft([ke(...Xe,Zt),ke(...vt,Zt),ke(...vt,yt),ke(...Xe,yt)].reverse())}}for(const[w,W]of Object.entries(gt))W.length&&m(d+"-"+w,hn(W.map(Y=>Y.map(o))),[0,0,0],w,void 0,{faceFrames:w==="oak"?Ye:void 0});const E=Ze.map(w=>[Math.max(0,w[0]),Math.min(xe,w[1])]).sort((w,W)=>w[0]-W[0]);if(pe)for(let w=0;w<E.length-1;w++){const W=E[w][1],Y=E[w+1][0];if(!(Y-W<.65||Qe.some(we=>Y>we[0]&&W<we[1])||Oe&&Y>nt[0]-.12&&W<nt[1]+.12))for(const we of[-1,1]){const de=D-.27,be=(Y-W)/(de-.19),De=.035*Math.sqrt(1+be*be),ke=[[W-De,.19],[W+De,.19],[Y+De,de],[Y-De,de]],Re=[],et=d==="outer-west-0"&&w===3&&we===1?.045:0;if(et&&Math.abs(W-2.93)+Math.abs(Y-4.195)>1e-7)throw new Error("Hall flush brace bay changed");const He=ke.map(([st,We])=>ze(st,_e+We,we*.165-et)),ft=ke.map(([st,We])=>ze(st,_e+We,we*.11-et));Re.push(He,ft.toReversed());for(let st=0;st<4;st++)Re.push([He[st],ft[st],ft[(st+1)%4],He[(st+1)%4]]);m(d+"-brace-"+w+"-"+we,hn(Re.map(st=>st.map(o))),[0,0,0],"oak",void 0,{grainAxis:[Ee/xe*(Y-W),de-.19,ge/xe*(Y-W)],origin:ze(W,_e+.19,we*.1375-et)});for(const[st,We]of[[W,.23],[Y,D-.31]])M(d+"-brace-peg-"+w+"-"+we+"-"+We,[.02,.02,.014],ze(st,_e+We,we*.167-et),"oakLight",Ue)}}for(const w of B){const W=_e+(w.sill||0),Y=W+w.h;if(w.sill){const we=w.id==="ww-a-0"||w.id==="ww-b-0";M(w.id+"-sill-lip",[w.w+.28,.06,we?.27:.3],ze(w.at,W-.07,we?-.015:0),"oak",Ue),M(w.id+"-jamb-left",[.07,w.h+.18,.08],ze(w.at-w.w/2-.035,(W+Y)/2),"oak",Ue),M(w.id+"-jamb-right",[.07,w.h+.18,.08],ze(w.at+w.w/2+.035,(W+Y)/2),"oak",Ue),M(w.id+"-lintel",[w.w+.14,.08,.08],ze(w.at,Y+.04),"oak",Ue),M(w.id+"-mullion",[.042,w.h,.045],ze(w.at,(W+Y)/2),"oak",Ue);const ve=[];for(const de of[-1,1]){const be=w.id+"-casement-"+de,De=w.w/2-.034,ke=w.at+de*(w.w/2-.006),Re=ke-de*De,et=(ke+Re)/2;M(be+"-glass",[De-.028,w.h-.028,.016],ze(et,(W+Y)/2),"glass",Ue);for(const We of[ke-de*.014,Re+de*.014])M(be+"-stile-"+We,[.028,w.h,.044],ze(We,(W+Y)/2,.01),"oak",Ue);for(const We of[W+.015,Y-.015])M(be+"-rail-"+We,[De,.03,.044],ze(et,We,.01),"oak",Ue);M(be+"-transom",[De-.028,.025,.03],ze(et,W+w.h*.58,.01),"oak",Ue);const He=Math.min(ke,Re)+.014,ft=Math.max(ke,Re)-.014;for(const We of[-1.6,1.6])for(let Xe=Math.floor(Math.min(0,-We*w.w)/.225);Xe<=Math.ceil(Math.max(w.h,w.h-We*w.w)/.225);Xe++){const vt=Xe*.225,lt=[],It=He-w.at+w.w/2,Zt=ft-w.at+w.w/2;for(const yt of[It,Zt]){const Bt=We*yt+vt;Bt>=.014&&Bt<=w.h-.014&&lt.push([yt,Bt])}for(const yt of[.014,w.h-.014]){const Bt=(yt-vt)/We;Bt>It&&Bt<Zt&&lt.push([Bt,yt])}if(lt.length===2){const yt=lt.sort((Bt,St)=>Bt[1]-St[1]);for(const[Bt,St,un]of[[0,.014,w.h*.58-.0125],[1,w.h*.58+.0125,w.h-.014]]){const Wn=Math.max(St,yt[0][1]),Dt=Math.min(un,yt[1][1]);Dt>Wn&&g(be+"-lead-"+We+"-"+Xe+"-"+Bt,ze(w.at-w.w/2+(Wn-vt)/We,W+Wn,.01),ze(w.at-w.w/2+(Dt-vt)/We,W+Dt,.01),.0055,"iron")}}}for(const We of[W+.18,Y-.18]){M(be+"-hinge-strap-"+We,[.028,.027,.009],ze(ke-de*.011,We,.0365),"iron",Ue),m(be+"-hinge-knuckle-"+We,Zn({profile:[{x:.006,y:0},{x:.011,y:0},{x:.011,y:.042},{x:.006,y:.042},{x:.006,y:0}],segments:20}),ze(ke,We-.021,.04),"iron"),m(w.id+"-fixed-hinge-pin-"+de+"-"+We,Zn({profile:[{x:0,y:0},{x:.011,y:0},{x:.011,y:.006},{x:.0055,y:.006},{x:.0055,y:.057},{x:0,y:.057}],segments:20}),ze(ke,We-.027,.04),"iron");const Xe=We<W+w.h/2?W-.045:Y+.045;M(w.id+"-fixed-hinge-strap-"+de+"-"+We,[.092,.018,.014],ze(ke+de*.038,Xe,.04),"iron",Ue),m(w.id+"-fixed-hinge-stem-"+de+"-"+We,Zn({profile:[{x:0,y:0},{x:.0055,y:0},{x:.0055,y:Math.abs(We-Xe)},{x:0,y:Math.abs(We-Xe)}],segments:20}),ze(ke,Math.min(We,Xe),.04),"iron");for(const vt of[ke-de*.007,ke-de*.019])M(be+"-hinge-rivet-"+We+"-"+vt,[.006,.008,.013],ze(vt,We,.037),"ironWarm",Ue)}M(be+"-catch-plate",[.022,.07,.01],ze(Re+de*.014,W+.46,.037),"iron",Ue),g(be+"-catch-handle",ze(Re+de*.014,W+.46,.039),ze(Re+de*.014,W+.5,.061),.01,"iron");const st=Q(be,d,z,We=>We.id.startsWith(be+"-"),ze(ke,W,.04),Se+(de===1?Math.PI:0),[0,1,0],de*Math.PI*.42);ve.push({...st,width:De,height:w.h})}w.operation={panels:ve,states:[{id:"closed",panels:ve.map(de=>({panel:de.id,value:0}))},{id:"vent",panels:ve.map(de=>({panel:de.id,value:(de.motion.min+de.motion.max)/3}))},{id:"open",panels:ve.map(de=>({panel:de.id,value:de.motion.min+de.motion.max}))}],state:"closed",hardware:[{id:w.id+"-fixed-frame",kind:"frame-and-pintles",element:d}]}}else{const we=ze(w.at-w.w/2+.004,W+.02,-.031),ve=w.id+"-leaf",de=u;u=[];const be=w.w-.035,De=w.h-.055;for(let He=0;He<6;He++)H(ve+"-plank-"+He,[be/6-.0015,De,.048],[(He+.5)*be/6,De/2,0],He%3?"oak":"oakLight",void 0,.003);M(ve+"-tongue-rebates",[be-.008,De-.008,.014],[be/2,De/2,0],"oak");for(const He of[.22,De-.22])H(ve+"-rail-"+He,[be-.05,.12,.038],[be/2,He,.043],"oakLight",void 0,.006);g(ve+"-rising-brace",[.09,.282,.043],[be-.09,De-.282,.043],.046,"oakLight");const ke=V(0,0,0);for(const He of[.22,De-.22]){M(ve+"-strap-"+He,[be*.7,.055,.01],[be*.35,He,-.03],"iron"),m(ve+"-hinge-knuckle-"+He,Zn({profile:[{x:.008,y:0},{x:.022,y:0},{x:.022,y:.13},{x:.008,y:.13},{x:.008,y:0}],segments:24}),[.004,He-.065,-.031],"iron");for(let ft=0;ft<5;ft++)M(ve+"-strap-rivet-"+He+"-"+ft,[.018,.018,.024],[.09+ft*be*.12,He,-.032],"iron")}const Re=De*.52;if(M(ve+"-latch-plate",[.07,.16,.012],[be-.14,Re,-.031],"iron"),M(ve+"-latch-bar",[.24,.028,.018],[be-.095,Re,-.049],"iron"),M(ve+"-latch-pivot",[.018,.018,.02],[be-.19,Re,-.061],"ironWarm"),ke.hoop(ve+"-ring-handle",[be-.14,Re-.064,-.068],.045,.01,"iron"),ke.tube(ve+"-ring-eye",[[be-.14,Re-.019,-.03],[be-.14,Re-.019,-.072]],.012,"iron"),M(ve+"-reverse-handle-plate",[.06,.16,.011],[be-.14,Re,.031],"iron"),g(ve+"-through-spindle",[be-.14,Re,-.055],[be-.14,Re,.057],.012,"iron"),ke.hoop(ve+"-reverse-ring",[be-.14,Re-.064,.062],.045,.01,"iron"),ke.tube(ve+"-reverse-eye",[[be-.14,Re-.019,.03],[be-.14,Re-.019,.066]],.012,"iron"),M(ve+"-thumb-lift",[.065,.016,.047],[be-.115,Re+.037,.049],"iron"),w.id==="wash-door"){M(ve+"-privacy-bolt",[.22,.023,.021],[be-.06,Re+.18,.045],"iron");for(const He of[be-.13,be-.015])M(ve+"-bolt-guide-back-"+He,[.027,.052,.0095],[He,Re+.18,.02875],"iron"),M(ve+"-bolt-guide-bottom-"+He,[.027,.012,.044],[He,Re+.18-.0175,.046],"iron"),M(ve+"-bolt-guide-top-"+He,[.027,.012,.044],[He,Re+.18+.0195,.046],"iron"),M(ve+"-bolt-guide-front-"+He,[.027,.052,.012],[He,Re+.18,.068],"iron");g(ve+"-bolt-knob",[be-.09,Re+.18,.06],[be-.09,Re+.21,.084],.012,"iron")}for(const He of[Re-.055,Re+.055])M(ve+"-latch-rivet-"+He,[.013,.013,.024],[be-.14,He,-.033],"iron");for(const He of u)He.transform.translation.x-=.004,He.transform.translation.z+=.031;F(ve,z,"door"),u=de;for(const He of[.22,De-.22])M(w.id+"-jamb-strap-"+He,[.13,.055,.012],ze(w.at-w.w/2-.085,W+.02+He,-.03),"iron",Ue),g(w.id+"-pintle-drop-"+He,ze(w.at-w.w/2-.026,W+.02+He,-.031),ze(w.at-w.w/2-.026,W+.02+He-.07,-.031),.012,"iron"),g(w.id+"-pintle-arm-"+He,ze(w.at-w.w/2-.026,W+.02+He-.07,-.031),ze(w.at-w.w/2+.004,W+.02+He-.07,-.031),.01,"iron"),m(w.id+"-pintle-"+He,Zn({profile:[{x:0,y:0},{x:.022,y:0},{x:.022,y:.01},{x:.0075,y:.01},{x:.0075,y:.15},{x:0,y:.15}],segments:24}),ze(w.at-w.w/2+.004,W+.02+He-.075,-.031),"iron");M(w.id+"-keeper",[.06,.08,.018],ze(w.at+w.w/2+.02,W+.02+Re,-.04),"iron",Ue),w.id==="wash-door"&&M(w.id+"-privacy-keeper",[.055,.05,.024],ze(w.at+w.w/2+.013,W+.02+Re+.18,.044),"iron",Ue),c.at(-1).pose={pivot:we,closedAngle:Se,angle:Se+(["master-door","wash-door","storage-door"].includes(w.id)?-1:1)*Math.PI/2};const et=c.at(-1).pose.angle-Se;w.operation={panels:[{id:ve,element:ve,width:be,height:De,motion:{kind:"revolute",axis:o([0,1,0]),pivot:o([0,0,0]),min:Math.min(0,et),max:Math.max(0,et)}}],states:[{id:"closed",panels:[{panel:ve,value:0}]},{id:"open",panels:[{panel:ve,value:et}]}],state:"open",hardware:[{id:w.id+"-fixed-jamb",kind:"pintles-and-keeper",element:d}]},f.push({id:w.id,level:z,eye:ze(w.at,_e+1.6),a:_,b,width:w.w,height:w.h})}}h.push({id:d,a:_,b,level:z,openings:B,exterior:pe,owner:d,faces:["inside","outside","top","bottom","ends","opening-reveals"]}),F(d,z,"wall",{frontAngle:Se})}const G=(d,_,b=.78)=>({id:d,at:_,w:b,h:1.12,sill:.95}),ne=(d,_,b=.95)=>({id:d,at:_,w:b,h:2.12});for(let d=0;d<2;d++)O("outer-north-"+d,[-7.6,-5.4],[7.6,-5.4],d,[G("nw-"+d,2.2),G("nc-"+d,5.1),G("ne-"+d,12.6)],!0),O("outer-west-"+d,[-7.5,6],[-7.5,-5.4],d,[G("ww-a-"+d,2.1),G("ww-b-"+d,5.1),G("ww-c-"+d,9.2)],!0),O("outer-east-"+d,[7.5,-5.4],[7.5,6],d,[G("ew-a-"+d,2),G("ew-b-"+d,6.4),G("ew-c-"+d,9.3)],!0),O("gable-west-"+d,[-7.6,5.9],[-3.25,5.9],d,[G("sw-"+d,2)],!0),O("gable-east-"+d,[3.25,5.9],[7.6,5.9],d,[G("se-"+d,2.1)],!0),d===1&&(O("court-west-upper",[-3.35,5.9],[-3.35,0],d,[G("cw-a",1.8),G("cw-b",4.5)],!0),O("court-east-upper",[3.35,0],[3.35,5.9],d,[G("ce-a",1.5),G("ce-b",4.5)],!0),O("court-rear-upper",[-3.25,-.1],[3.25,-.1],d,[G("cr-a",1.25),G("cr-b",5.25)],!0));O("hall-gallery",[-4.6,5.8],[-4.6,-1.36],0,[ne("hall-door",1.95,1.05),G("hall-court-window",4.8)]),O("service-gallery",[4.6,-1.36],[4.6,5.8],0,[ne("service-door",5.21),G("service-court-window",2.16)]),O("kitchen-front",[-7.4,-1.36],[-3.3,-1.36],0,[ne("kitchen-door",3.45)]),O("pantry-front",[-3.3,-1.36],[-1.5,-1.36],0,[ne("pantry-door",.9,.9)]),O("ledger-front",[3.1,-1.36],[7.4,-1.36],0,[ne("ledger-door",.85)]),O("kitchen-pantry",[-3.3,-5.3],[-3.3,-1.36],0),O("pantry-entrance",[-1.5,-5.3],[-1.5,-1.36],0),O("entrance-ledger",[3.1,-5.3],[3.1,-1.36],0),O("entrance-front",[-1.5,-1.36],[3.1,-1.36],0,[ne("entrance-door",2.3,1.2)]),O("child-west-front",[-7.4,-1.75],[-1.4,-1.75],1,[ne("child-west-door",2.95)]),O("child-west-stair",[-1.4,-5.3],[-1.4,-1.75],1),O("child-east-front",[3.1,-1.75],[7.4,-1.75],1,[ne("child-east-door",1.35)]),O("child-east-stair",[3.1,-5.3],[3.1,-1.75],1),O("master-front",[-5.7,.05],[-3.35,.05],1,[ne("master-door",1.25)]),O("corridor-west-end",[-5.7,-1.65],[-5.7,.05],1),O("wash-front",[3.35,.05],[5,.05],1,[ne("wash-door",.75,.9)]),O("storage-front",[5,.05],[6.5,.05],1,[ne("storage-door",.75,.9)]),O("corridor-east-end",[6.5,.05],[6.5,-1.65],1),O("wash-storage",[5,.05],[5,5.8],1),O("wash-screen",[3.45,2.6],[4.1,2.6],1);const Z=(d,_)=>d>=-7.6&&d<=7.6&&_>=-5.5&&_<=6&&!(Math.abs(d)<3.25&&_>0),q=[[-1.4,0,-5.35,-2.6],[0,1.8,-5.35,-3.94]];function J(d,_,b,z=!1,B="upper"){const pe=[[-7.6,-5.5],[7.6,-5.5],[7.6,6],[3.25,6],[3.25,0],[-3.25,0],[-3.25,6],[-7.6,6]],_e=[];if(z&&_e.push([[-1.4,-5.35],[1.8,-5.35],[1.8,-3.94],[0,-3.94],[0,-2.6],[-1.4,-2.6]]),_>3){const[ge,xe,Se,Ue]=te;_e.push([[ge,Se],[xe,Se],[xe,Ue],[ge,Ue]])}const Ee=d==="ground-floor"||d==="upper-floor"?.006:0;if(m(d+"-solid",Ar({outer:pe.map(([ge,xe])=>({x:ge,y:xe})),holes:_e.map(ge=>ge.map(([xe,Se])=>({x:xe,y:Se}))),depth:b-Ee}),[0,_-(b+Ee)/2,0],B,a([1,0,0],Math.PI/2)),d==="ground-floor"||d==="upper-floor"){const ge=d==="ground-floor";for(let xe=0,Se=-5.49;Se<5.999;Se+=ge?.52:.24,xe++){const Ue=Math.min(ge?.52:.24,6-Se),ze=xe%3*.43;for(let Qe=0,Ze=-7.6-ze;Ze<7.6;Ze+=ge?.74:1.72,Qe++){const Je=Math.min(7.6,Ze+(ge?.74:1.72)),nt=Math.max(-7.6,Ze),Oe=[nt,Je],je=[Se,Se+Ue];for(const Ke of[-3.25,3.25,..._e.flat().map(pt=>pt[0])])Ke>nt&&Ke<Je&&Oe.push(Ke);for(const Ke of[0,..._e.flat().map(pt=>pt[1])])Ke>Se&&Ke<Se+Ue&&je.push(Ke);Oe.sort((Ke,pt)=>Ke-pt),je.sort((Ke,pt)=>Ke-pt);for(let Ke=0;Ke<Oe.length-1;Ke++)for(let pt=0;pt<je.length-1;pt++){const Mt=Oe[Ke],gt=Oe[Ke+1],Ye=je[pt],ct=je[pt+1],E=(Mt+gt)/2,K=(Ye+ct)/2;!Z(E,K)||_e.some(w=>E>Math.min(...w.map(W=>W[0]))&&E<Math.max(...w.map(W=>W[0]))&&K>Math.min(...w.map(W=>W[1]))&&K<Math.max(...w.map(W=>W[1]))&&(()=>{let W=!1;for(let Y=0,we=w.length-1;Y<w.length;we=Y++)w[Y][1]>K!=w[we][1]>K&&E<(w[we][0]-w[Y][0])*(K-w[Y][1])/(w[we][1]-w[Y][1])+w[Y][0]&&(W=!W);return W})())||gt-Mt<.012||ct-Ye<.012||M(d+"-finish-"+xe+"-"+Qe+"-"+Ke+"-"+pt,[gt-Mt-.004,.006,ct-Ye-.003],[E,_-.003,K],ge?(Qe+xe)%3?"floor":"stoneLight":(Qe+xe)%4?"upper":"oakPale")}}}}F(d,_<1?0:1,"slab")}J("foundation",.38,.38,!1,"stone");const re=[[-7.6,-5.5],[7.6,-5.5],[7.6,6],[3.25,6],[3.25,0],[-3.25,0],[-3.25,6],[-7.6,6]];for(let d=0;d<re.length;d++){const _=re[d],b=re[(d+1)%re.length],z=Math.hypot(b[0]-_[0],b[1]-_[1]),B=-Math.atan2(b[1]-_[1],b[0]-_[0]);for(let pe=0;pe<2;pe++)for(let _e=0,Ee=-.31*(pe%2);Ee<z;Ee+=.63,_e++){const ge=Math.max(.015,Ee),xe=Math.min(z-.015,Ee+.618);if(xe-ge<.02)continue;const Se=(ge+xe)/2,Ue=_[0]+(b[0]-_[0])*Se/z,ze=_[1]+(b[1]-_[1])*Se/z;H("foundation-block-"+d+"-"+pe+"-"+_e,[xe-ge,.178,.13],[Ue,pe*.19+.094,ze],(pe+_e)%3?"stone":"stoneLight",a([0,1,0],B),.016)}}F("foundation-masonry",0,"masonry"),J("ground-floor",.45,.07,!1,"floor"),J("upper-floor",3.33,.22,!0),J("upper-ceiling",6.12,.13,!1,"plaster");for(const d of[-3.29,3.29])for(let _=0;_<5;_++){const b=_*1.45;M("pier-"+d+"-"+_,[.18,.6,.18],[d,.3,b],"stone"),M("gallery-post-"+d+"-"+_,[.14,2.51,.14],[d,1.855,b]),_<4&&P("brace-"+d+"-"+_,[d,2.68,b],[d,3.05,b+.38],.1)}for(const d of[-2.1,-.9,2.1])M("rear-pier-"+d,[.18,.6,.18],[d,.3,-.05],"stone"),M("rear-post-"+d,[.14,2.51,.14],[d,1.855,-.05]),P("rear-brace-"+d,[d,2.65,-.05],[d-.38,3.02,-.05],.1);for(const d of[-3.35,3.35])M("gallery-long-beam-"+d,[.22,.22,5.89],[d,3.11,3.055]);M("gallery-rear-beam",[6.92,.22,.22],[0,3.11,0]),F("gallery-frame",0);for(let d=0;d<2;d++)for(let _=-4.98;_<5.9;_+=.6){const b=_<0?[[-7.4,7.4]]:[[-7.4,-3.35],[3.35,7.4]];for(const[z,B]of b){const pe=d?[-4.5,0,5.5]:[-5.3,5.5],_e=[...d===0?q:[],te,...pe.map(ge=>[ge-.01,ge+.01,-5.4,d?-.1:-1.3])];let Ee=[z,B];for(const ge of _e)_>ge[2]-.1&&_<ge[3]+.1&&Ee.push(Math.max(z,ge[0]-.1),Math.min(B,ge[1]+.1));Ee=Ee.filter(ge=>ge>=z&&ge<=B).sort((ge,xe)=>ge-xe);for(let ge=0;ge<Ee.length-1;ge++){const xe=(Ee[ge]+Ee[ge+1])/2;_e.some(Se=>xe>Se[0]-.1&&xe<Se[1]+.1&&_>Se[2]-.1&&_<Se[3]+.1)||Ee[ge+1]-Ee[ge]>.01&&M("joist-"+d+"-"+_+"-"+ge,[Ee[ge+1]-Ee[ge],.19,.14],[xe,d?5.895:3.015,_])}}}for(const d of[-5.3,5.5])M("rear-floor-bearer-"+d,[.22,.28,4.1],[d,2.97,-3.35]);for(const d of[-4.5,0,5.5])M("ceiling-bearer-"+d,[.22,.28,5.3],[d,5.85,-2.75]);for(const d of[3.015,5.895]){for(const _ of[te[0]-.1,te[1]+.1])M("shaft-trimmer-"+d+"-"+_,[.2,.19,1.6],[_,d,-1.3]);for(const _ of[te[2]-.1,te[3]+.1])M("shaft-header-"+d+"-"+_,[.9,.19,.2],[-6.05,d,_])}for(const[d,_,b]of[["void-south",[-1.4,3,-2.51],[.09,3,-2.51]],["void-inner",[.09,3,-2.6],[.09,3,-3.85]],["void-upper",[0,3,-3.85],[1.89,3,-3.85]],["void-arrival",[1.89,3,-3.94],[1.89,3,-5.3]]]){const z=Math.abs(b[0]-_[0]),B=Math.abs(b[2]-_[2]);M(d,[z||.18,.22,B||.18],[(_[0]+b[0])/2,3,(_[2]+b[2])/2])}F("floor-joists",-1);for(let d=0;d<7;d++)M("lower-tread-"+d,[1.24,.07,.26],[-.66,.45+.18*(d+1)-.035,-2.17-.26*(d+.5)]);M("turn-landing",[1.24,.12,1.24],[-.66,1.83,-4.61]);for(let d=0;d<7;d++){const _=-.04+.26*(d+.5);M("upper-tread-"+d,[d===6?.28:.26,.07,1.24],[_+(d===6?.01:0),.45+.18*(9+d)-.035,-4.61])}function R(d){const _=[];for(let b=0;b<7;b++){const z=(d?2:.56)+.18*b;_.push({x:.26*b,y:z},{x:d&&b===6?1.84:.26*(b+1),y:z})}return d?_.push({x:1.84,y:2.86},{x:0,y:1.77}):_.push({x:1.82,y:1.77},{x:1.95,y:1.77},{x:1.95,y:1.51},{x:.26,y:.45},{x:0,y:.45}),Ar({outer:_,holes:[],depth:.14})}for(const d of[-1.2,-.12])m("lower-stringer-"+d,R(!1),[d,0,-2.17],"oak",a([0,1,0],Math.PI/2));for(const d of[-5.15,-4.07])m("upper-stringer-"+d,R(!0),[-.04,0,d],"oak");for(const d of[-1.2,-.12])for(const _ of[-5.15,-4.07])M("turn-support-"+d+"-"+_,[.14,1.32,.14],[d,1.11,_]);function $(d,_,b,z,B){M(d,[.045,B-z,.045],[_,(z+B)/2,b])}for(const[d,_]of[["outer",-1.25],["inner",-.07]]){for(let b=0;b<7;b++){const z=-2.3-b*.26,B=.63+b*.18;$("lower-"+d+"-"+b,_,z,B,B+.92)}$("lower-"+d+"-turn",_,-4.12,1.89,2.81),P("lower-"+d+"-rail",[_,1.55,-2.3],[_,2.81,-4.12],.065)}for(const[d,_]of[["outer",-5.2],["inner",-4.02]]){for(let b=0;b<7;b++){const z=-.04+.26*(b+.5)+(b===6?.01:0),B=2.07+b*.18,pe=2.81+(z+.04)*1.44/1.84;$("upper-"+d+"-"+b,z,_,B,pe)}$("upper-"+d+"-turn",-.04,_,1.89,2.81),$("upper-"+d+"-arrival",1.84,_,3.33,4.28),P("upper-"+d+"-rail",[-.04,2.81,_],[1.8,4.25,_],.065),P("upper-"+d+"-arrival-rail",[1.8,4.25,_],[1.84,4.28,_],.065)}P("turn-handrail",[-1.25,2.81,-4.12],[-1.25,2.81,-5.2],.065),P("turn-back-handrail",[-1.25,2.81,-5.2],[-.04,2.81,-5.2],.065);for(let d=1;d<=8;d++)$("turn-side-infill-"+d,-1.25,-4.12-d*1.08/8,1.89,2.81),$("turn-back-infill-"+d,-1.25+d*1.21/8,-5.2,1.89,2.81);for(const[d,_]of[[[-1.35,3.33,-2.56],[.04,3.33,-2.56]],[[.04,3.33,-2.56],[.04,3.33,-3.9]],[[.04,3.33,-3.9],[1.84,3.33,-3.9]]]){P("guard-foot-"+d,d.map((z,B)=>B===1?z+.04:z),_.map((z,B)=>B===1?z+.04:z),.08),P("guard-top-"+d,d.map((z,B)=>B===1?z+.95:z),_.map((z,B)=>B===1?z+.95:z),.065);const b=Math.ceil(Math.hypot(_[0]-d[0],_[2]-d[2])/.13);for(let z=0;z<=b;z++)M("guard-"+d+"-"+z,[.035,.95,.035],[d[0]+(_[0]-d[0])*z/b,3.805,d[2]+(_[2]-d[2])*z/b])}M("inner-turn-join",[.065,.065,.1325],[-.07,2.81,-4.05375]),P("arrival-guard-join",[1.84,4.28,-4.02],[1.84,4.28,-3.9],.065),F("central-stair",-1,"stair");const he=(d,_)=>{const b=[];if(_<=.3&&_>=-5.85&&Math.abs(d)<=7.95&&b.push(6.2+1.1*Math.min(_+5.85,.3-_)),_>=-2.775&&_<=6.35)for(const z of[-1,1]){const B=d*z;B>=2.9&&B<=7.95&&b.push(6.2+1.1*Math.min(B-2.9,7.95-B))}return b.length?Math.max(...b):null};function ye(d,_,b,z){const B=[];for(let pe=0;pe<d.length;pe++){const _e=d[pe],Ee=d[(pe+1)%d.length],ge=z?_e[_]<=b:_e[_]>=b,xe=z?Ee[_]<=b:Ee[_]>=b;if(ge&&B.push(_e),ge!==xe){const Se=(b-_e[_])/(Ee[_]-_e[_]);B.push([_e[0]+Se*(Ee[0]-_e[0]),_e[1]+Se*(Ee[1]-_e[1])])}}return B}function Pe(d){const _=d.flat(),b=[],z=(xe,Se)=>Math.hypot(...xe.map((Ue,ze)=>Ue-Se[ze]))<1e-9,B=(xe,Se,Ue=!1)=>{const ze=Ue?[0,2]:[0,1,2],Qe=ze.map(nt=>Se[nt]-xe[nt]),Ze=Qe.reduce((nt,Oe)=>nt+Oe*Oe,0),Je=[0,1];if(Ze<1e-18)return Je;for(const nt of _){const Oe=ze.reduce((je,Ke,pt)=>je+(nt[Ke]-xe[Ke])*Qe[pt],0)/Ze;Oe>1e-9&&Oe<1-1e-9&&Math.hypot(...ze.map((je,Ke)=>nt[je]-xe[je]-Oe*Qe[Ke]))<1e-9&&Je.push(Oe)}return Je.sort((nt,Oe)=>nt-Oe).filter((nt,Oe,je)=>Oe===0||nt-je[Oe-1]>1e-9)},pe=(xe,Se,Ue)=>xe.map((ze,Qe)=>ze+(Se[Qe]-ze)*Ue);for(const xe of d)if(xe.length===4&&Math.hypot(xe[0][0]-xe[1][0],xe[0][2]-xe[1][2])<1e-9&&Math.hypot(xe[2][0]-xe[3][0],xe[2][2]-xe[3][2])<1e-9){const Se=B(xe[0],xe[3],!0);for(let Ue=0;Ue<Se.length-1;Ue++)b.push([pe(xe[0],xe[3],Se[Ue]),pe(xe[1],xe[2],Se[Ue]),pe(xe[1],xe[2],Se[Ue+1]),pe(xe[0],xe[3],Se[Ue+1])])}else{const Se=xe.flatMap((ze,Qe)=>{const Ze=xe[(Qe+1)%xe.length];return B(ze,Ze).slice(0,-1).map(Je=>pe(ze,Ze,Je))}),Ue=[0,1,2].map(ze=>xe.reduce((Qe,Ze)=>Qe+Ze[ze],0)/xe.length);for(let ze=0;ze<Se.length;ze++)z(Se[ze],Se[(ze+1)%Se.length])||b.push([Ue,Se[ze],Se[(ze+1)%Se.length]])}const _e=new Map,Ee=new Set,ge=xe=>xe.map((Se,Ue)=>xe.slice(Ue).concat(xe.slice(0,Ue)).join("|")).sort()[0];for(let xe=0;xe<b.length;xe++){const Se=b[xe].map(Ze=>Ze.map(Je=>Math.round(Je*1e9)||0).join(",")),Ue=ge(Se),ze=ge([...Se].reverse()),Qe=_e.get(ze);Qe!==void 0?(Ee.add(xe),Ee.add(Qe),_e.delete(ze)):_e.set(Ue,xe)}return b.filter((xe,Se)=>!Ee.has(Se))}function fe(d,_,b){const[z,B,pe,_e]=te,Ee=Math.max(..._.map(Ye=>Ye[0]))>z&&Math.min(..._.map(Ye=>Ye[0]))<B&&Math.max(..._.map(Ye=>Ye[1]))>pe&&Math.min(..._.map(Ye=>Ye[1]))<_e,ge=Ee?ye(ye(_,0,z,!1),0,B,!0):[],xe=Ye=>Ye.reduce((ct,E,K)=>{const w=Ye[(K+1)%Ye.length];return ct+E[0]*w[1]-w[0]*E[1]},0),Se=(Ee?[ye(_,0,z,!0),ye(_,0,B,!1),ye(ge,1,pe,!0),ye(ge,1,_e,!1)]:[_]).filter(Ye=>Ye.length>=3&&Math.abs(xe(Ye))>1e-5),Ue=[],ze=Se.flat(),Qe=(Ye,ct,E)=>Math.abs((Ye[0]-ct[0])*(E[1]-ct[1])-(Ye[1]-ct[1])*(E[0]-ct[0]))<1e-7&&(Ye[0]-ct[0])*(Ye[0]-E[0])+(Ye[1]-ct[1])*(Ye[1]-E[1])<1e-7;for(const Ye of Se){const ct=Ds({outer:Ye.map(([K,w])=>({x:K,y:w}))});for(let K=0;K<ct.triangles.length;K+=3){const w=ct.triangles.slice(K,K+3).reverse().map(W=>{const Y=ct.points[W];return[Y.x,b(Y.x,Y.y),Y.y]});Ue.push(w,w.map(W=>[W[0],W[1]-.16,W[2]]).reverse())}const E=xe(Ye)>0?[...Ye].reverse():Ye;for(let K=0;K<E.length;K++){const w=E[K],W=E[(K+1)%E.length],Y=(W[0]-w[0])**2+(W[1]-w[1])**2;if(Y<1e-12)continue;const we=[...new Set([0,1,...ze.filter(de=>Qe(de,w,W)).map(de=>((de[0]-w[0])*(W[0]-w[0])+(de[1]-w[1])*(W[1]-w[1]))/Y)])].sort((de,be)=>de-be),ve=de=>[w[0]+(W[0]-w[0])*de,w[1]+(W[1]-w[1])*de];for(let de=0;de<we.length-1;de++){if(we[de+1]-we[de]<1e-8)continue;const be=ve(we[de]),De=ve(we[de+1]),ke=ve((we[de]+we[de+1])/2);if(Se.some(He=>He!==Ye&&He.some((ft,st)=>Qe(ke,ft,He[(st+1)%He.length]))))continue;const Re=[be[0],b(...be),be[1]],et=[De[0],b(...De),De[1]];Ue.push([Re,[Re[0],Re[1]-.16,Re[2]],[et[0],et[1]-.16,et[2]],et])}}}m(d,hn(Ue.map(Ye=>Ye.map(o))),[0,0,0],"roof");const Ze={roof:[],roofLight:[],roofMuted:[]},Je=d.startsWith("rear"),nt=[];for(const Ye of Se){const ct=Ds({outer:Ye.map(([E,K])=>({x:E,y:K}))});for(let E=0;E<ct.triangles.length;E+=3)nt.push(ct.triangles.slice(E,E+3).map(K=>[ct.points[K].x,ct.points[K].y]))}const Oe=Math.min(..._.map(Ye=>Ye[0])),je=Math.max(..._.map(Ye=>Ye[0])),Ke=Math.min(..._.map(Ye=>Ye[1])),pt=Math.max(..._.map(Ye=>Ye[1])),Mt=Je?.27:.225,gt=Je?.225:.27;for(let Ye=0;Ye<Math.ceil((pt-Ke)/gt)+1;Ye++)for(let ct=0;ct<Math.ceil((je-Oe)/Mt)+1;ct++){const E=Oe+ct*Mt-(Je?Ye%2*Mt/2:0),K=Ke+Ye*gt-(Je?0:ct%2*gt/2),w=["roof","roofMuted","roofLight"][Math.floor(Math.abs(Math.sin(ct*12.9898+Ye*78.233)*43758.5453)%1*3)],W=Je?b(E,K+gt)>b(E,K):b(E+Mt,K)>b(E,K),Y=(ve,de)=>{const be=Je?(de-K)/gt:(ve-E)/Mt;return b(ve,de)+.025+.016*(W?1-be:be)},we=[];for(const ve of nt){let de=ye(ye(ye(ye(ve,0,E+.002,!1),0,E+Mt-.002,!0),1,K+.002,!1),1,K+gt-.002,!0);if(de=de.filter((Re,et)=>Math.hypot(Re[0]-de[(et+de.length-1)%de.length][0],Re[1]-de[(et+de.length-1)%de.length][1])>1e-9),de.length<3||Math.abs(xe(de))<1e-8)continue;xe(de)>0&&de.reverse();const be=de.map(Re=>[Re[0],Y(...Re),Re[1]]),De=be.map(Re=>[Re[0],Re[1]-.028,Re[2]]),ke=we;ke.push(be,De.toReversed());for(let Re=0;Re<de.length;Re++)ke.push([be[Re],De[Re],De[(Re+1)%de.length],be[(Re+1)%de.length]])}Ze[w].push(...Pe(we))}for(const[Ye,ct]of Object.entries(Ze))ct.length&&m(d+"-tiles-"+Ye,hn(ct.map(E=>E.map(o))),[0,0,0],Ye)}fe("rear-north",[[-7.95,-5.85],[7.95,-5.85],[7.95,-2.775],[-7.95,-2.775]],(d,_)=>6.2+1.1*(_+5.85)),fe("rear-south",[[-7.95,-2.775],[7.95,-2.775],[7.95,.3],[5.425,-2.225],[2.9,.3],[-2.9,.3],[-5.425,-2.225],[-7.95,.3]],(d,_)=>6.53-1.1*_);for(const d of[-1,1])fe("wing-inner-"+d,[[2.9,.3],[5.425,-2.225],[5.425,6.35],[2.9,6.35]].map(([_,b])=>[_*d,b]),_=>6.2+1.1*(Math.abs(_)-2.9)),fe("wing-outer-"+d,[[5.425,-2.225],[7.95,.3],[7.95,6.35],[5.425,6.35]].map(([_,b])=>[_*d,b]),_=>6.2+1.1*(7.95-Math.abs(_)));for(let d=0,_=-7.92;_<7.92;_+=.31,d++){const b=_,z=Math.min(7.95,_+.3),B=-2.775,pe=9.5825,_e=Se=>[[Se,pe-.12,B-.16],[Se,pe+.035,B],[Se,pe-.12,B+.16],[Se,pe-.155,B+.16],[Se,pe-.004,B],[Se,pe-.155,B-.16]],Ee=_e(b),ge=_e(z),xe=[];for(const Se of[[0,1,4,5],[1,2,3,4]])xe.push(Se.map(Ue=>Ee[Ue]).reverse(),Se.map(Ue=>ge[Ue]));for(let Se=0;Se<Ee.length;Se++)xe.push([Ee[Se],Ee[(Se+1)%Ee.length],ge[(Se+1)%Ee.length],ge[Se]]);m("rear-ridge-tile-"+d,hn(xe.map(Se=>Se.map(o))),[0,0,0],"roofMuted")}for(const d of[-1,1])for(let _=0,b=-2.18;b<6.35;b+=.31,_++){const z=b,B=Math.min(6.35,b+.3),pe=d*5.425,_e=8.9775,Ee=Ue=>[[pe-.16,_e-.12,Ue],[pe,_e+.035,Ue],[pe+.16,_e-.12,Ue],[pe+.16,_e-.155,Ue],[pe,_e-.004,Ue],[pe-.16,_e-.155,Ue]],ge=Ee(z),xe=Ee(B),Se=[];for(const Ue of[[0,1,4,5],[1,2,3,4]])Se.push(Ue.map(ze=>ge[ze]),Ue.map(ze=>xe[ze]).reverse());for(let Ue=0;Ue<ge.length;Ue++)Se.push([ge[Ue],xe[Ue],xe[(Ue+1)%ge.length],ge[(Ue+1)%ge.length]]);m("wing-ridge-tile-"+d+"-"+_,hn(Se.map(Ue=>Ue.map(o))),[0,0,0],"roofMuted")}F("roof-envelope",2,"roof"),P("rear-ridge",[-7.5,9.3,-2.775],[7.5,9.3,-2.775],.22);for(let d=-7.3,_=0;d<=7.31;d+=.73,_++){if(P("rear-rafter-n-"+_,[d,he(d,-5.5)-.28,-5.5],[d,9.3,-2.775],.14),Math.abs(d)<2.85)P("rear-rafter-s-"+_,[d,9.3,-2.775],[d,he(d,0)-.28,0],.14);else{const b=Math.abs(d),z=b<=5.425?3.2-b:b-7.65;P("rear-rafter-s-"+_,[d,9.3,-2.775],[d,he(d,z)-.28,z],.14)}_%3===0&&(P("rear-tie-"+_,[d,6.03,-5.4],[d,6.03,0],.23),P("rear-king-"+_,[d,6.03,-2.775],[d,9.3,-2.775],.15))}for(const d of[-1,1]){P("wing-ridge-"+d,[d*5.425,8.6975,-2.225],[d*5.425,8.6975,6],.22);for(const _ of[2.9,7.95])P("valley-"+d+"-"+_,[d*_,5.92,.3],[d*5.425,8.6975,-2.225],.22);for(let _=0,b=-1.9;b<.3;b+=.55,_++){const z=b+2.225,B=5.425-z,pe=5.425+z;P("wing-rafter-jack-in-"+d+"-"+_,[d*B,he(d*B,b)-.28,b],[d*5.425,8.6975,b],.14),P("wing-rafter-jack-out-"+d+"-"+_,[d*5.425,8.6975,b],[d*pe,he(d*pe,b)-.28,b],.14)}for(let _=.4,b=0;_<6.01;_+=.7,b++)P("wing-rafter-in-"+d+"-"+b,[d*3.25,6.285,_],[d*5.425,8.6975,_],.14),P("wing-rafter-out-"+d+"-"+b,[d*5.425,8.6975,_],[d*7.6,6.285,_],.14),b%3===0&&(P("wing-tie-"+d+"-"+b,[d*3.25,6.03,_],[d*7.6,6.03,_],.23),P("wing-king-"+d+"-"+b,[d*5.425,6.03,_],[d*5.425,8.6975,_],.15))}for(const d of[te[0]-.15,te[1]+.15]){const _=te[2]-.15,b=te[3]+.15;P("shaft-roof-trimmer-"+d,[d,he(d,_)-.28,_],[d,he(d,b)-.28,b],.18)}for(const d of[te[2]-.15,te[3]+.15]){const _=te[0]-.15,b=te[1]+.15;P("shaft-roof-header-"+d,[_,he(_,d)-.28,d],[b,he(b,d)-.28,d],.18)}F("roof-frame",2,"roof-frame");function Ce(d,_,b,z){const B=b[0]-_[0],pe=b[1]-_[1],_e=Math.hypot(B,pe),Ee=-pe/_e*.1,ge=B/_e*.1,xe=Math.ceil(_e/1.3),Se=Array.from({length:xe+1},(Oe,je)=>[Math.max(0,je/xe-.06/_e),Math.min(1,je/xe+.06/_e)]),Ue=[...new Set([0,1,...z,...Se.flat()])].sort((Oe,je)=>Oe-je),ze={oak:[],plaster:[]},Qe=[],Ze=(Oe,je,Ke=0)=>{const pt=_[0]+B*Oe+Ee*je,Mt=_[1]+pe*Oe+ge*je;return[pt,he(pt,Mt)-.18-Ke,Mt]},Je=(Oe,je)=>{const Ke=Ze(Oe,je);return Ke[1]=6.1,Ke},nt=(Oe,je,Ke=[0,1,0])=>{const pt=je.length===4?[[je[0],je[1],je[2]],[je[0],je[2],je[3]]]:[je];for(const Mt of pt)ze[Oe].push(Mt),Oe==="oak"&&Qe.push({count:Mt.length,grainAxis:Ke,origin:[_[0],6.1,_[1]]})};for(let Oe=0;Oe<Ue.length-1;Oe++){const je=Ue[Oe],Ke=Ue[Oe+1];if(Ke-je<1e-8)continue;const pt=(je+Ke)/2,Mt=Se.some(([gt,Ye])=>pt>gt&&pt<Ye)?"oak":"plaster";for(const gt of[-1,1]){const Ye=[Je(je,gt),Je(Ke,gt),Ze(Ke,gt,.16),Ze(je,gt,.16)],ct=[Ze(je,gt,.16),Ze(Ke,gt,.16),Ze(Ke,gt),Ze(je,gt)];nt(Mt,gt===1?Ye:Ye.toReversed()),nt("oak",gt===1?ct:ct.toReversed(),Ze(Ke,gt).map((E,K)=>E-Ze(je,gt)[K]))}nt("oak",[Ze(je,1),Ze(Ke,1),Ze(Ke,-1),Ze(je,-1)],Ze(Ke,1).map((gt,Ye)=>gt-Ze(je,1)[Ye])),nt(Mt,[Je(Ke,1),Je(je,1),Je(je,-1),Je(Ke,-1)])}for(const Oe of[0,1]){const je=[Je(Oe,1),Ze(Oe,1),Ze(Oe,-1),Je(Oe,-1)];nt("oak",Oe===0?je:je.toReversed())}for(const[Oe,je]of Object.entries(ze))je.length&&m(d+"-"+Oe,hn(je.map(Ke=>Ke.map(o))),[0,0,0],Oe,void 0,{faceFrames:Oe==="oak"?Qe:void 0})}for(const d of[-1,1])Ce("front-gable-"+d,[d*3.25,5.9],[d*7.6,5.9],[0,.5,1]);F("gable-fill",2,"roof");for(const[d,_,b]of[["attic-north",[-7.6,-5.4],[7.6,-5.4]],["attic-west",[-7.5,-5.4],[-7.5,5.8]],["attic-east",[7.5,-5.4],[7.5,5.8]],["attic-court-west",[-3.35,-.1],[-3.35,5.9]],["attic-court-east",[3.35,-.1],[3.35,5.9]],["attic-court-rear",[-3.25,-.1],[3.25,-.1]]]){const z=b[0]-_[0],B=b[1]-_[1],pe=[0,1];if(Math.abs(B)>.001)for(const _e of[-2.775,3.2-Math.abs(_[0]),Math.abs(_[0])-7.65]){const Ee=(_e-_[1])/B;Ee>0&&Ee<1&&pe.push(Ee)}if(Math.abs(z)>.001)for(const _e of[-7.95,-5.425,-2.9,2.9,5.425,7.95]){const Ee=(_e-_[0])/z;Ee>0&&Ee<1&&pe.push(Ee)}Ce(d,_,b,[...new Set(pe)].sort((_e,Ee)=>_e-Ee)),F(d,2,"roof")}for(const[d,_,b,z,B]of[["west",-6.44,-1.3,.12,1.2],["east",-5.66,-1.3,.12,1.2],["north",-6.05,-1.84,.66,.12],["south",-6.05,-.76,.66,.12],["divider",-6.05,-1.3,.66,.12]])M("flue-"+d,[z,7.75,B],[_,5.825,b],"stone");for(const[d,_,b,z,B]of[["west",-6.44,-1.3,.2,1.36],["east",-5.66,-1.3,.2,1.36],["north",-6.05,-1.88,.58,.2],["south",-6.05,-.72,.58,.2],["divider",-6.05,-1.3,.58,.16]])H("flue-cap-"+d,[z,.16,B],[_,9.7,b],"stone",void 0,.012);for(let d=0,_=1.96;_<9.6;_+=.24,d++)for(const[b,z,B]of[["west",[-6.507,-1.9],[-6.507,-.7]],["east",[-5.593,-.7],[-5.593,-1.9]],["north",[-5.6,-1.907],[-6.5,-1.907]],["south",[-6.5,-.693],[-5.6,-.693]]]){const pe=Math.hypot(B[0]-z[0],B[1]-z[1]),_e=-Math.atan2(B[1]-z[1],B[0]-z[0]);for(let Ee=0,ge=-.19*(d%2);ge<pe;ge+=.39,Ee++){const xe=Math.max(.007,ge),Se=Math.min(pe-.007,ge+.382);if(Se-xe<.02)continue;const Ue=(xe+Se)/2;H("chimney-ashlar-"+b+"-"+d+"-"+Ee,[Se-xe,Math.min(.23,9.62-_),.02],[z[0]+(B[0]-z[0])*Ue/pe,_+Math.min(.23,9.62-_)/2,z[1]+(B[1]-z[1])*Ue/pe],(Ee+d)%3?"stone":"stoneLight",a([0,1,0],_e),.004)}}F("chimney",-1,"service-shaft"),le("hall-table",-6.57,.45,2.35,2.25,.8,0,Math.PI/2),Te("hall-bench-west",-7.22,.45,2.35,2.12,.31,0,Math.PI/2),Te("hall-bench-east",-6.01,.45,2.35,2.12,.31,0,Math.PI/2),I("hall-chest",-6.72,.45,5.3,1,.45,0,Math.PI),x("hall-rug",-6.55,.45,2.35,1.66,2.55,0),y("hall-hearth",-6.05,.45,-.78,1.45,1.55,.85),A("kitchen-counter",-5.8,.44,-4.65,2.5,.65),y("kitchen-hearth",-6.05,.45,-1.98,1.2,1.35,.85),Me("pantry-shelves",-2.93,1.3,-3.6,.42,1.7,2.5),le("ledger-desk",5.6,.42,-3.6,1.5,.75),Te("ledger-seat",5.6,.4,-2.7,.5,.5,0,Math.PI,!0),j("ledger-bookcase",3.85,.45,-5,1.15,1.5,.35,0,0,"books"),I("ledger-lockbox",6.6,.45,-1.9,.85,.45,0),ie("service-washbench",6.85,.45,2.5,0),ue("master-bed",-5.4,3.33,3.8,2.05,1.6),I("master-chest",-6.65,3.38,1.5,1.1,.5),ue("child-west-bed",-5.8,3.33,-4.5,2.05,.95),ue("child-east-bed",5.25,3.33,-4.5,2.05,.95),I("child-west-chest",-6.4,3.33,-2.38,.9,.44,1),I("child-east-chest",3.67,3.33,-3.1,.75,.44,1),le("child-west-desk",-3.15,3.33,-2.55,1.35,.55,1),Te("child-west-stool",-3.15,3.33,-3.15,.42,.42,1),le("child-east-desk",6.45,3.33,-2.55,1.35,.55,1),Te("child-east-stool",6.45,3.33,-3.15,.42,.42,1),j("master-cabinet",-3.73,3.33,2.8,.72,1.45,.38,1,-Math.PI/2,"clothes"),N("master-nightstand",-6.84,4.68,1),Te("master-seat",-3.9,3.33,5.25,.52,.43,1,Math.PI/2,!0),ie("wash-basin",3.74,3.33,1.75),ce("latrine",3.88,3.33,3.1),Me("storage-shelves",5.35,3.33,3.25,.4,1.6,3.6,1),I("storage-chest",6.65,3.36,4.9,.85,.6),Te("gallery-west-bench",-3.85,0,6.55,1.12,.27,-1),Te("gallery-east-bench",3.85,0,6.55,1.12,.27,-1),Te("gallery-rear-bench",-2,0,6.55,1.05,.25,-1),j("gallery-rear-cabinet",.8,.45,-3.4,.62,1.05,.27,0),x("upper-corridor-runner",.38,3.33,-.9,10.35,.64,1),x("landing-runner",2.4,3.33,-3.48,.64,2.2,1),I("landing-chest",.8,.45,-4.65,.62,.42,0),Te("entrance-bench",2.72,.42,-2.55,1.1,.28,0,Math.PI/2),j("entrance-cabinet",2.48,.76,-4.55,.52,.95,.34,0,0,"shoes"),j("service-cabinet",6.22,.8,5.32,.7,1.25,.36,0,Math.PI,"linen"),U("service-drying-rack",5.5,4.8);for(const[d,_,b,z,B,pe]of[["hall-lamp",-7.3725,2.27,1.725,0,Math.PI/2],["kitchen-lamp",-4.93,1.92,-5.2725,0,0],["ledger-lamp",-7.6+15.2*10/11,1.92,-5.2725,0,0],["master-lamp",-3.4775,5.08,2.95,1,-Math.PI/2],["corridor-lamp",-.65,5.08,-.2275,1,Math.PI],["landing-lamp",2.9725,5.08,-5.3+3.55*2/3,1,-Math.PI/2]])X(d,_,b,z,B,pe);rg({box:M,mesh:m,beam:g,finish:F,polyhedron:hn,revolve:Zn,extrude:Ar,V:o,Q:a,bevel:H,registerMechanism:d=>v.push(d)});const C=[[0,0],[1.02,0],[1.02,.15],[.68,.15],[.68,.3],[.34,.3],[.34,.45],[0,.45]],S=Ds({outer:C.map(([d,_])=>({x:d,y:_}))}),se=[];for(let d=0;d<S.triangles.length;d+=3){const _=S.triangles.slice(d,d+3).map(b=>S.points[b]);se.push(_.map(b=>[-.6,b.y,b.x]),_.toReversed().map(b=>[.6,b.y,b.x]))}for(let d=0;d<C.length;d++){const _=C[d],b=C[(d+1)%C.length];se.push([[-.6,_[1],_[0]],[.6,_[1],_[0]],[.6,b[1],b[0]],[-.6,b[1],b[0]]])}for(let d=0;d<3;d++)for(let _=0;_<3;_++){const b=.45-d*.15;H("entry-step-stone-"+d+"-"+_,[.397,b,.338],[-.4+_*.4,b/2,.17+d*.34],(d+_)%3?"stone":"stoneLight",void 0,.006)}F("entry-steps",0,"stair");for(const d of v){const _=c.find(z=>z.id===d.parent);if(!_)throw new Error("Missing mechanism owner: "+d.parent);const b=u;u=_.model.parts,Q(d.id,d.parent,d.level,z=>z.id.startsWith(d.prefix),d.pivot,d.restAngle,d.axis,d.travel,d.kind),_.model.parts=u,u=b,d.default!==void 0&&(c.at(-1).articulation.default=d.default)}{const d=c.find(B=>B.id==="wash-door-leaf"),_=u;u=d.model.parts,Q("wash-door-privacy-bolt",d.id,1,B=>B.id===d.id+"-privacy-bolt"||B.id===d.id+"-bolt-knob",[.865-.17-.004,2.065*.52+.18-.0115,.076],0,[1,0,0],-.105,"sliding-bolt"),d.model.parts=u,u=_;const b=c.at(-1).articulation;b.motion={kind:"prismatic",axis:o([1,0,0]),min:-.105,max:0},b.relativeToParent=!0,b.default=1,h.flatMap(B=>B.openings).find(B=>B.id==="wash-door").operation.hardware.push({id:"wash-door-privacy-bolt",kind:"sliding-privacy-bolt",element:"wash-door-privacy-bolt"})}if(t)return{entries:c,rooms:p,boundaries:h,portals:f,holes:q,chimneyCut:te};const me=new Bm;me.background=new ot("#ded9cf");const Ae=new Qt(46.83,1.5,.025,120);me.add(new jm("#edf2f5","#827764",1.1));const ee=new $a("#fff1df",2.6);ee.position.set(-12,18,10),ee.castShadow=!0,ee.shadow.mapSize.set(4096,4096),Object.assign(ee.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:.1,far:55}),ee.shadow.normalBias=.025,ee.shadow.bias=-1e-4,me.add(ee),me.add(ee.target);const Ie=new $a("#fff8ed",.5);me.add(Ie),me.add(Ie.target);const Le=new Map;for(const d of c){const{object:_}=i?i.build(d):Wr(d.model,e);_.name=d.id,d.pose&&(_.position.set(...d.pose.pivot),_.rotation.y=d.pose.angle),_.traverse(b=>{var z;b.isMesh&&(b.castShadow=!0,b.receiveShadow=!0,((z=d.model.parts.find(B=>B.name===b.name))==null?void 0:z.material)==="glass"&&(b.material=b.material.clone(),b.material.transparent=!0,b.material.opacity=.35,b.material.depthWrite=!1,b.castShadow=!1))}),me.add(_),Le.set(d.id,_)}function Be(d,_){const b=d.articulation,z=Le.get(d.id),B=b.rest,pe=new ae(b.motion.axis.x,b.motion.axis.y,b.motion.axis.z).normalize(),_e=b.closed+(b.open-b.closed)*_,Ee=new ae(B.translation.x,B.translation.y,B.translation.z),ge=new Gt(B.rotation.x,B.rotation.y,B.rotation.z,B.rotation.w),xe=new ae(B.scale.x,B.scale.y,B.scale.z);b.motion.kind==="revolute"?ge.multiply(new Gt().setFromAxisAngle(pe,_e)):Ee.addScaledVector(pe.applyQuaternion(ge),_e);const Se=new dt().compose(Ee,ge,xe);if(b.relativeToParent){const Ue=Le.get(d.parent);Ue.updateMatrixWorld(!0),Se.premultiply(Ue.matrixWorld)}Se.decompose(z.position,z.quaternion,z.scale)}const $e=(d,_)=>{if(d===_)return!0;const b=c.find(z=>z.id===d);return!!(b!=null&&b.parent&&$e(b.parent,_))},Ne=d=>{const _=new pn;for(const b of c)$e(b.id,d)&&_.union(new pn().setFromObject(Le.get(b.id)));return _};for(const d of c)d.articulation&&Be(d,d.articulation.default);const Fe=[{id:"01-whole-south-east",eye:[20,13,23],at:[0,3,0]},{id:"02-whole-south-west",eye:[-20,13,23],at:[0,3,0]},{id:"03-whole-north-east",eye:[20,12,-23],at:[0,3,0]},{id:"04-whole-north-west",eye:[-20,12,-23],at:[0,3,0]},{id:"exterior-south",eye:[0,6,27],at:[0,3,0]},{id:"exterior-north",eye:[0,6,-27],at:[0,3,0]},{id:"exterior-west",eye:[-27,6,0],at:[0,3,0]},{id:"exterior-east",eye:[27,6,0],at:[0,3,0]},{id:"roof-overhead",eye:[0,27,3],at:[0,0,0]},{id:"ground-plan",eye:[0,26,0],at:[0,0,0],cut:"ground",plan:!0},{id:"upper-plan",eye:[0,27,0],at:[0,3.33,0],cut:"upper",plan:!0},{id:"stair-section-west",eye:[-7.5,3.5,-3.7],at:[.4,1.9,-3.7],cut:"stair"},{id:"stair-section-south",eye:[.3,3.5,4],at:[.3,1.9,-3.7],cut:"stair"},{id:"frame-axonometric",eye:[19,19,21],at:[0,2,0],cut:"frame"},{id:"reference-exterior",eye:[16,7.5,20],at:[0,4,0]},{id:"reference-courtyard",eye:[.2,1.75,7.7],at:[0,2.5,-.6]},{id:"garden-south",eye:[0,1.6,6.6],at:[0,1.5,.1]},{id:"garden-reverse",eye:[0,2,-.8],at:[0,1.3,5.5]},{id:"stair-start",eye:[-.7,2.05,-1.6],at:[-.7,2,-4.8]},{id:"stair-turn",eye:[-.7,3.49,-4.7],at:[2.5,3.6,-4.7]},{id:"stair-top-return",eye:[2.35,4.93,-4.7],at:[-.7,2.4,-4.7]},{id:"landing-to-corridor",eye:[2.35,4.93,-3.4],at:[-1,4.6,-.9]},{id:"gallery-turn-west",eye:[-3.9,2.05,-.65],at:[-3.85,1.6,5.4]},{id:"gallery-turn-east",eye:[3.9,2.05,-.65],at:[3.85,1.6,5.4]},{id:"corridor-west-to-east",eye:[-5.1,4.93,-.9],at:[5.9,4.7,-.9]},{id:"corridor-east-to-west",eye:[6,4.93,-.9],at:[-5.1,4.7,-.9]}];for(const d of p){const[_,b,z,B]=d.bounds,pe=T[d.level]+1.6,_e=[(_+b)/2,pe,(z+B)/2];for(const[Ee,ge,xe]of[["north",0,-1],["east",1,0],["south",0,1],["west",-1,0]])Fe.push({id:d.id+"--"+Ee,eye:_e,at:[_e[0]+ge,pe,_e[2]+xe],room:d.id});for(const[Ee,ge,xe]of[["corner-a",_+.25,z+.25],["corner-b",b-.25,B-.25],["corner-c",_+.25,B-.25],["corner-d",b-.25,z+.25]])Fe.push({id:d.id+"--"+Ee,eye:[ge,pe,xe],at:[_e[0],pe-.3,_e[2]],room:d.id});Fe.push({id:d.id+"--threshold",eye:[d.door[0],pe,d.door[1]],at:[_e[0],pe-.25,_e[2]],room:d.id})}for(const d of p.filter(_=>_.polygon.length>4)){const _=b=>{let z=!1;for(let B=0,pe=d.polygon.length-1;B<d.polygon.length;pe=B++){const _e=d.polygon[B],Ee=d.polygon[pe];_e[1]>b[1]!=Ee[1]>b[1]&&b[0]<(Ee[0]-_e[0])*(b[1]-_e[1])/(Ee[1]-_e[1])+_e[0]&&(z=!z)}return z};for(let b=0;b<d.polygon.length;b++){const z=d.polygon[b],B=d.polygon[(b+d.polygon.length-1)%d.polygon.length],pe=d.polygon[(b+1)%d.polygon.length];let _e=(B[0]-z[0])/Math.hypot(B[0]-z[0],B[1]-z[1])+(pe[0]-z[0])/Math.hypot(pe[0]-z[0],pe[1]-z[1]),Ee=(B[1]-z[1])/Math.hypot(B[0]-z[0],B[1]-z[1])+(pe[1]-z[1])/Math.hypot(pe[0]-z[0],pe[1]-z[1]);_([z[0]+_e*.22,z[1]+Ee*.22])||(_e=-_e,Ee=-Ee);const ge=[z[0]+_e*.22,T[d.level]+1.6,z[1]+Ee*.22];Fe.push({id:d.id+"--polygon-corner-"+b,room:d.id,eye:ge,at:[ge[0]+_e,ge[1]-.2,ge[2]+Ee]})}}for(const d of p){const[_,b,z,B]=d.bounds,pe=T[d.level]+1.6,_e=[(_+b)/2,pe,(z+B)/2];if(!d.id.startsWith("gallery")&&d.id!=="landing"&&d.id!=="corridor"){const Ee=_e[0]-d.door[0],ge=_e[2]-d.door[1],xe=Math.hypot(Ee,ge);Fe.push({id:d.id+"--inside-entry",eye:[d.door[0]+Ee/xe*.65,pe,d.door[1]+ge/xe*.65],at:[_e[0],pe-.4,_e[2]],room:d.id})}}Fe.push({id:"storage--nook-in",eye:[6.92,4.93,-1.15],at:[6.92,4.55,2.5],room:"storage"},{id:"storage--nook-return",eye:[6.92,4.93,1.4],at:[6.92,4.5,-1.5],room:"storage"},{id:"master--shaft-clear",eye:[-6.98,4.93,-1.1],at:[-6.6,4.45,.7],room:"master"},{id:"pantry--aisle-high",eye:[-2.2,2.85,-4.8],at:[-2.7,1.15,-2],room:"pantry"},{id:"hall--hearth-clear",eye:[-5.1,2.35,1],at:[-6.3,1.2,-.5],room:"hall"},{id:"kitchen--working-clear",eye:[-4.1,2.35,-2.7],at:[-6.2,1.2,-3.7],room:"kitchen"},{id:"washroom--screen-front",eye:[4.55,5.2,.5],at:[3.8,4,1.5],room:"washroom"},{id:"washroom--screen-back",eye:[4.55,5.2,4.8],at:[3.85,4,2.1],room:"washroom"},{id:"storage--aisle-high",eye:[5.5,5.65,1],at:[6.5,4.2,4.5],room:"storage"},{id:"gallery--entry-approach",eye:[.8,2.05,-.1],at:[.8,1.9,-2.5],room:"gallery-rear"},{id:"stair--lower-inner",eye:[1.6,2.2,-2],at:[-.7,1.5,-3.7],room:"entrance"},{id:"stair--landing-high",eye:[-.7,4.3,-4.7],at:[2.1,3.2,-4.7],room:"entrance"});for(const d of Fe)d.id==="kitchen--inside-entry"&&(d.eye=[-4,2.05,-2.6],d.at=[-5.8,1.6,-3.8]),d.id==="master--inside-entry"&&(d.eye=[-4.45,4.93,1.3],d.at=[-5.4,4.4,3.8]);const tt={"ledger--corner-a":[4.8,2.05,-4.85],"service--threshold":[4.95,2.05,4],"gallery-rear--threshold":[.35,2.05,-.35],"hall--corner-a":[-6.98,2.05,.15],"hall--corner-d":[-4.94,2.05,.2],"pantry--corner-a":[-2.48,2.05,-4.95],"pantry--corner-c":[-2.47,2.05,-1.7],"entrance--corner-a":[-1.08,2.05,-1.85],"master--corner-d":[-4.08,4.93,.6],"master--threshold":[-4.46,4.93,.85],"master--polygon-corner-0":[-6.97,4.93,-.42],"master--polygon-corner-5":[-4,4.93,.7],"storage--corner-a":[5.9,4.93,.48],"storage--corner-c":[5.9,4.93,5.4],"storage--polygon-corner-0":[6.78,4.93,-1.25],"storage--polygon-corner-1":[7.16,4.93,-1.25],"storage--polygon-corner-3":[5.9,4.93,5.35],"storage--polygon-corner-4":[5.75,4.93,.65],"storage--aisle-high":[6.1,5.65,.65],"landing--corner-b":[2.36,4.93,-2.1],"landing--polygon-corner-2":[2.42,4.93,-2.08]};for(const d of Fe){if(tt[d.id]){d.eye=tt[d.id];const _=p.find(_e=>_e.id===d.room),[b,z,B,pe]=_.bounds;d.at=[(b+z)/2,T[_.level]+.95,(B+pe)/2]}if((rt=d.room)!=null&&rt.startsWith("gallery")&&/--(north|east|south|west)$/.test(d.id)){const _=p.find(Ee=>Ee.id===d.room),[b,z,B,pe]=_.bounds,_e=d.id.split("--")[1];if(d.room==="gallery-rear")d.eye=[.32,2.05,-.55],d.at=_e==="east"?[4,1.65,-.55]:_e==="west"?[-4,1.65,-.55]:_e==="north"?[.8,1.75,-1.3]:[.32,1.4,1.3];else{const Ee=(b+z)/2;d.eye=[Ee,2.05,2.25],d.at=_e==="north"?[Ee,1.7,-.5]:_e==="south"?[Ee,1.7,5.8]:[_e==="east"?z:b,1.4,3.9]}}if(d.room==="washroom"&&/--(north|east|south|west)$/.test(d.id)){const _=d.id.split("--")[1];d.eye=[4.48,4.93,_==="north"?1.7:3.85],d.at=_==="north"?[3.8,4.08,.8]:_==="south"?[3.8,3.95,4.8]:_==="east"?[4.85,4.02,3.1]:[3.8,3.85,3.1]}d.id==="corridor--south"&&(d.eye=[.35,4.93,-1.1],d.at=[2.5,4.05,-.08]),d.id==="landing--east"&&(d.eye=[2.3,4.93,-3.3],d.at=[2.8,3.95,-2.02])}for(const d of[...Fe])if(d.room&&/--(north|east|south|west)$/.test(d.id)){const _=p.find(Se=>Se.id===d.room),[b,z,B,pe]=_.bounds,_e=T[_.level]+1.6,Ee=d.id.split("--")[1],ge=[(b+z)/2,_e,(B+pe)/2],xe={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]}[Ee];(d.eye.some((Se,Ue)=>Se!==ge[Ue])||Math.abs(d.at[1]-_e)>1e-4)&&Fe.push({...d,id:d.id+"-working-detail"}),d.eye=ge,d.at=[ge[0]+xe[0],_e,ge[2]+xe[1]]}for(const[d,_]of[["hall","hall-door"],["kitchen","kitchen-door"],["pantry","pantry-door"],["ledger","ledger-door"],["service","service-door"],["entrance","entrance-door"],["master","master-door"],["child-west","child-west-door"],["child-east","child-east-door"],["washroom","wash-door"],["storage","storage-door"]]){const b=p.find(Se=>Se.id===d),z=f.find(Se=>Se.id===_),B=Fe.find(Se=>Se.id===d+"--inside-entry"),pe=T[b.level]+1.6,_e=d==="washroom"?[4.53,pe,2.1]:d==="entrance"?[2.24,pe,-2.12]:(B==null?void 0:B.eye)||[(b.bounds[0]+b.bounds[1])/2,pe,(b.bounds[2]+b.bounds[3])/2],Ee=[_e[0]-z.eye[0],_e[2]-z.eye[2]],ge=Math.hypot(...Ee),xe=ge<3.15?[z.eye[0]+Ee[0]*3.15/ge,pe,z.eye[2]+Ee[1]*3.15/ge]:_e;for(const Se of[0,.5,1])Fe.push({id:d+"--door-sweep-"+Se,room:d,eye:xe,at:[z.eye[0],T[b.level]+1.05,z.eye[2]],doorOpen:Se})}for(const[d,_,b,z]of[["hall--aisle-length","hall",[-5.302,2.05,3.68],[-5.302,1.25,.85]],["hall--west-seat-end","hall",[-7,2.05,3.85],[-7,1.1,2.35]],["ledger--bookcase-front","ledger",[4.25,2.05,-3.9],[3.85,1.35,-5]],["entrance--understair-storage","entrance",[1.72,2.05,-2.9],[.8,1.05,-4.3]],["gallery-west--clear-lane","gallery-west",[-3.91,2.05,5.52],[-3.91,1.2,.1]],["gallery-east--clear-lane","gallery-east",[3.91,2.05,5.52],[3.91,1.2,.1]],["gallery-rear--clear-lane","gallery-rear",[-3.9,2.05,-.69],[3.9,1.3,-.69]],["washroom--basin-workspace","washroom",[4.47,4.93,.65],[3.9,4.1,1.7]],["garden--seating-return",null,[-.1,1.6,9.3],[-2.1,.8,6.55]]])Fe.push({id:d,room:_,eye:b,at:z});for(const d of c){const _=(((mt=d.pose)==null?void 0:mt.closedAngle)??((oe=d.review)==null?void 0:oe.frontAngle)??0)*180/Math.PI;for(const[b,z,B]of[["front",0,0],["right",90,0],["rear",180,0],["left",270,0],["top",0,85],["bottom",0,-85],["oblique-a",40,30],["oblique-b",220,30]])Fe.push({id:d.id+"--"+b,object:d.id,az:z+_,el:B,neutral:!0});if(d.articulation)for(const b of[0,.5,1])for(const[z,B]of[["a",40],["b",220]])Fe.push({id:d.id+"--operation-"+b+"-"+z,object:d.parent,focus:d.id,operation:{element:d.id,fraction:b},az:(z==="a"?40:140)+_,el:20,connectionOnly:d.role==="window"}),Fe.push(d.id==="hall-chest-lid"?{id:d.id+"--operation-"+b+"-"+z+"-context",room:"hall",eye:z==="a"?[-6.1,2.05,4.3]:[-6.95,2.05,4.3],at:[-6.72,1.05,5.3],operation:{element:d.id,fraction:b}}:d.id==="ww-c-0-casement--1"&&z==="a"?{id:d.id+"--operation-"+b+"-"+z+"-context",room:"kitchen",eye:[-5.9,2.05,-3.75],at:[-7.35,1.96,-2.96],operation:{element:d.id,fraction:b}}:{id:d.id+"--operation-"+b+"-"+z+"-context",object:d.id,context:!0,operation:{element:d.id,fraction:b},az:B,el:20})}const it={purpose:"whole manor scratch frame; not formal compiler topology",rooms:p,boundaries:h,portals:f,entries:c.map(({model:d,..._})=>({..._,parts:d.parts.map(b=>b.id)})),area:{footprint:135.8,upperOpening:q.reduce((d,_)=>d+(_[1]-_[0])*(_[3]-_[2]),0),servicePenetration:(te[1]-te[0])*(te[3]-te[2])},holes:q,chimneyCut:te};n===!1&&(ee.castShadow=!1);function Ge(d){var b,z;const _=Fe[d];for(const B of c){const pe=Le.get(B.id);B.pose&&(pe.rotation.y=_.neutral||_.room&&_.id.includes("corner")||_.operation&&$e(_.operation.element,B.id)?B.pose.closedAngle:B.pose.angle),B.articulation&&Be(B,((b=_.operation)==null?void 0:b.element)===B.id?_.operation.fraction:_.neutral?0:B.articulation.default),pe.visible=_.context||!_.object||$e(B.id,_.object),_.connectionOnly&&B.id===_.object&&(pe.visible=!1),_.cut==="ground"&&(pe.visible=B.level<=0&&B.id!=="floor-joists"),_.cut==="upper"&&(pe.visible=B.level===1&&B.id!=="upper-ceiling"||B.id==="central-stair"||B.id==="chimney"),_.cut==="frame"&&(pe.visible=B.id!=="roof-envelope"&&B.id!=="upper-ceiling"),_.cut==="stair"&&(pe.visible=["central-stair","upper-floor","ground-floor","foundation","floor-joists"].includes(B.id)),pe.traverse(_e=>{if(_e.isMesh){const Ee=Array.isArray(_e.material)?_e.material:[_e.material];for(const ge of Ee)ge.clippingPlanes=_.cut==="stair"&&(B.role==="slab"||B.id==="floor-joists")?[_.id.endsWith("west")?new on(new ae(1,0,0),1.4):new on(new ae(0,0,-1),-2.2)]:[],B.id==="chimney"&&["ground","upper"].includes(_.cut)&&(ge.clippingPlanes=[new on(new ae(0,-1,0),_.cut==="ground"?3.11:6.12),..._.cut==="upper"?[new on(new ae(0,1,0),-3.33)]:[]])}})}if(_.doorOpen!==void 0)for(const B of c)B.pose&&(Le.get(B.id).rotation.y=B.pose.closedAngle+(B.pose.angle-B.pose.closedAngle)*_.doorOpen);if(_.doorOpen!==void 0)for(const B of c)(z=B.articulation)!=null&&z.relativeToParent&&Be(B,B.articulation.default);if(Ae.up.set(0,1,0),Ae.fov=2*Math.atan(Math.tan(Math.PI/6)/Ae.aspect)*180/Math.PI,_.plan&&Ae.up.set(0,0,-1),_.object){const B=Ne(_.focus??_.object);_.focus&&B.expandByScalar(.07);const pe=B.getCenter(new ae),_e=_.az*Math.PI/180,Ee=_.el*Math.PI/180,ge=new ae(Math.sin(_e)*Math.cos(Ee),Math.sin(Ee),Math.cos(_e)*Math.cos(Ee)),xe=new ae().crossVectors(new ae(0,1,0),ge).normalize(),Se=new ae().crossVectors(ge,xe).normalize(),Ue=Math.tan(Ae.fov*Math.PI/360),ze=Ue*Ae.aspect;let Qe=.1;for(const Ze of[B.min.x,B.max.x])for(const Je of[B.min.y,B.max.y])for(const nt of[B.min.z,B.max.z]){const Oe=new ae(Ze,Je,nt).sub(pe);Qe=Math.max(Qe,Oe.dot(ge)+1.12*Math.max(Math.abs(Oe.dot(xe))/ze,Math.abs(Oe.dot(Se))/Ue))}Ae.position.copy(pe).addScaledVector(ge,Qe),Ae.lookAt(pe)}else Ae.position.set(..._.eye),Ae.lookAt(..._.at);return Ie.visible=!!(_.object||_.room||_.id.includes("stair")||_.id.includes("corridor")||_.id.includes("landing")),Ie.position.copy(Ae.position),Ie.target.position.copy(_.object?Ne(_.focus??_.object).getCenter(new ae):new ae(..._.at)),Ae.updateProjectionMatrix(),i&&(me.updateMatrixWorld(!0),Ae.updateMatrixWorld(!0),i.update(Ae)),_}const at=new ae(0,3,0);return Ge(0),{scene:me,camera:Ae,views:Fe,objects:Le,entries:c,inspection:Ie,applyView:Ge,manifest:it,target:at,setArticulation:Be,configureRenderer:sg,update(){Ie.position.copy(Ae.position),Ie.target.position.copy(at)}}}const fl=()=>({translation:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1}}),Cr=n=>({x:n.x,y:n.y,z:n.z});function og(n){const e=[],t=[],i=[],r=new Map,s=[];for(const l of n){const u=new Map;for(const[c,h]of l.model.parts.entries()){const f=h.geometry.type==="mesh"?h.geometry.mesh:null;if(!f||f.skin||h.attachedBone!==null){i.push({entry:l.id,part:h.id,partIndex:c});continue}const p=[1/0,1/0,1/0],v=[-1/0,-1/0,-1/0];for(let y=0;y<f.positions.length;y++)p[y%3]=Math.min(p[y%3],f.positions[y]),v[y%3]=Math.max(v[y%3],f.positions[y]);const M=p.map((y,A)=>(y+v[A])/2),m={...f,positions:f.positions.map((y,A)=>y-M[A%3])},g=l.model.materials.find(y=>y.id===h.material),P=JSON.stringify([m,g]);let L=r.get(P);if(!L){const y="manor-prototype-"+String(e.length).padStart(5,"0");L={id:y,bounds:{min:Cr(new ae(...p.map((A,Me)=>A-M[Me]))),max:Cr(new ae(...v.map((A,Me)=>A-M[Me])))},model:{id:y,name:y,origin:"generated",skeleton:null,materials:[g],parts:[{...h,id:"member",name:"member",geometry:{type:"mesh",mesh:m},transform:fl()}],asset:null,body:null}},r.set(P,L),e.push(L)}const F=h.transform??fl(),Q=new dt().compose(new ae(F.translation.x,F.translation.y,F.translation.z),new Gt(F.rotation.x,F.rotation.y,F.rotation.z,F.rotation.w),new ae(F.scale.x,F.scale.y,F.scale.z)).multiply(new dt().makeTranslation(...M)),H=new ae,V=new Gt,le=new ae;Q.decompose(H,V,le);const Te={id:h.id+"@"+c,translation:Cr(H),rotation:{x:V.x,y:V.y,z:V.z,w:V.w},scale:Cr(le)};u.has(L.id)||u.set(L.id,[]),u.get(L.id).push(Te),s.push({entry:l.id,part:h.id,partIndex:c,prototype:L.id,transform:Te})}for(const[c,h]of u){const f=e.find(v=>v.id===c).model.materials[0],p=f.baseColor;t.push({entry:l.id,definition:{id:l.id+"--"+c,modelRecipe:c,count:h.length,layout:{kind:"explicit",transforms:h},anchor:{x:0,y:0,z:0},facingDeg:0,seed:1902,variation:{scale:{min:1,max:1},palette:["#"+new ot(p.r,p.g,p.b).getHexString()],traits:[]}}})}}const o=new Map;for(const l of s)o.set(l.prototype,(o.get(l.prototype)??0)+1);const a=new Set([...o].filter(([,l])=>l>1).map(([l])=>l));for(const l of s)a.has(l.prototype)||i.push({entry:l.entry,part:l.part,partIndex:l.partIndex});return{prototypes:e.filter(l=>a.has(l.id)),sets:t.filter(l=>a.has(l.definition.modelRecipe)),singletons:i,partBindings:s.filter(l=>a.has(l.prototype))}}const dl=1024,pc=["x","y","z"],pl=n=>{const e={x:1/0,y:1/0,z:1/0},t={x:-1/0,y:-1/0,z:-1/0},i={x:0,y:0,z:0};return n.forEach((r,s)=>{for(const o of pc){const a=r.translation[o];e[o]=Math.min(e[o],a),t[o]=Math.max(t[o],a),i[o]=i[o]*(s/(s+1))+a/(s+1)}}),{bounds:{min:e,max:t},centroid:i}},ag=n=>Math.max(.01,Math.hypot(...pc.map(e=>Math.max(Math.abs(n.min[e]),Math.abs(n.max[e])))));function lg(n,e){const{transforms:t}=n.layout,i=[];for(let s=0;s<n.count;s+=dl){const o=Math.min(dl,n.count-s);i.push({index:i.length,start:s,count:o,...pl(t.slice(s,s+o))})}const r=[{tier:"near",maxDistance:null,recipe:n.modelRecipe,model:rc(n.modelRecipe)}];return{version:1,id:n.id,count:n.count,modelRecipe:n.modelRecipe,layout:n.layout,route:null,anchor:n.anchor,facingDeg:n.facingDeg,seed:n.seed,variation:n.variation,...pl(t),projectionRadius:e,chunks:i,lod:r}}function cg(n){const e=og(n),t=new Map;for(const i of e.prototypes)t.set(i.id,ag(i.bounds)),i.model.id=rc(i.id);return{...e,sets:e.sets.map(i=>({...i,compiled:lg(i.definition,t.get(i.definition.modelRecipe))}))}}function ug(n,e){const t=new Map(n.prototypes.map(a=>[a.model.id,a.model])),i=new Map(n.prototypes.map(a=>[a.model.id,Wr(a.model,e)])),r=new Map;for(const a of n.sets)r.has(a.entry)||r.set(a.entry,[]),r.get(a.entry).push(a);const s=[];let o=0;return{build(a){const l=new ri;l.name=a.id;for(const c of r.get(a.id)??[]){const h=q0({instanceSet:c.compiled,models:t,prototypeObjects:i});l.add(h.object),s.push(h),o+=c.compiled.count}const u=new Set(n.singletons.filter(c=>c.entry===a.id).map(c=>c.partIndex));return u.size&&l.add(Wr({...a.model,parts:a.model.parts.filter((c,h)=>u.has(h))},e).object),{object:l}},update(a,l=1024){for(const u of s)u.update(a,l)},stats(){return{prototypes:t.size,instanceSets:s.length,drawnInstances:o,gpuInstancedMeshes:s.reduce((a,l)=>(l.object.traverse(u=>{u.isInstancedMesh&&a++}),a),0)}}}}const ml={"assets/textures/manor/oak-albedo-v1.png":new URL(""+new URL("oak-albedo-v1-Cqbj0niT.png",import.meta.url).href,import.meta.url).href,"assets/textures/manor/limestone-albedo-v1.png":new URL(""+new URL("limestone-albedo-v1-Cgf_arJh.png",import.meta.url).href,import.meta.url).href,"assets/textures/manor/lime-plaster-albedo-v1.png":new URL(""+new URL("lime-plaster-albedo-v1-D1fYnT5c.png",import.meta.url).href,import.meta.url).href,"assets/textures/manor/terracotta-albedo-v1.png":new URL(""+new URL("terracotta-albedo-v1-By3kfZ1o.png",import.meta.url).href,import.meta.url).href,"assets/textures/manor/linen-albedo-v1.png":new URL(""+new URL("linen-albedo-v1-JYGz-mUD.png",import.meta.url).href,import.meta.url).href,"assets/textures/manor/apple-bark-albedo-v1.png":new URL(""+new URL("apple-bark-albedo-v1-ClEyDPCq.png",import.meta.url).href,import.meta.url).href,"assets/textures/manor/garden-soil-albedo-v1.png":new URL(""+new URL("garden-soil-albedo-v1-D2kB78t7.png",import.meta.url).href,import.meta.url).href};async function hg({report:n=()=>{},...e}={}){await n("Decoding textures");const t=new $m,i=new N0(r=>{const s=ml[r];if(!s)throw new Error("Unresolved manor texture: "+r);return t.loadAsync(s)});try{await i.prime(eg()),await n("Deriving shared prototypes");const r=cg(hl({geometryOnly:!0}).entries),s=ug(r,i.resolve);await n("Building the manor");const o=hl({...e,geometryOnly:!1,resolveTexture:i.resolve,instanceConsumer:s});if(o.scene===void 0)throw new Error("Textured manor preview requires the visual scene capability; geometry-only output cannot be displayed.");const a=o.update;return o.update=()=>{a(),s.update(o.camera)},{...o,followLighting:a,instanceConsumer:s,instanceState:s.stats(),textureState:{ready:!0,decoded:i.size,assets:Object.keys(ml)},disposeTextures:()=>i.dispose()}}catch(r){throw await i.dispose(),r}}const fg=(n,e,t)=>{const i=n.toFixed(2),r=Math.max(...e,0);let s=!1,o=0,a=0,l=0;for(const c of e){if(s===!1&&c===r){s=!0;continue}o+=c,a+=Math.min(c,t),l+=1}if(o<=0)return`${i}m/s`;const u=(n*(a/o)).toFixed(2);return u===i?`${i}m/s`:`${i}m/s (flying ${u}m/s at ${(l/o).toFixed(1)}fps)`},dg=n=>{const e=new Set,t=n.items.map(g=>{if(g.id.length===0||e.has(g.id))throw new Error("Preview navigation requires unique, nonempty item IDs.");return e.add(g.id),{...g,search:[g.id,g.label,g.group??"",...g.keywords??[]].join(" ").normalize("NFKC").toLowerCase()}}),i=new AbortController,r=document.createElement("section");r.id="preview-navigation",r.setAttribute("aria-label","Scene navigation");const s=document.createElement("div");s.className="preview-navigation-heading";const o=document.createElement("strong");o.textContent="Scene navigation";const a=document.createElement("button");a.type="button",a.textContent="Collapse",a.setAttribute("aria-expanded","true"),a.setAttribute("aria-controls","preview-navigation-content"),s.append(o,a);const l=document.createElement("div");l.id="preview-navigation-content";const u=document.createElement("label");u.textContent="Search rooms, objects, or views";const c=document.createElement("input");c.type="search",c.placeholder="Name, group, or keyword",c.autocomplete="off",u.append(c);const h=document.createElement("label");h.textContent="View";const f=document.createElement("select");h.append(f);const p=document.createElement("button");p.type="button",p.textContent="Go to view";const v=document.createElement("div");v.className="preview-navigation-count",v.setAttribute("role","status"),l.append(u,h,p,v),r.append(s,l);let M="";const m=()=>{const g=c.value.normalize("NFKC").toLowerCase().trim().split(/\s+/).filter(Boolean),P=t.filter(Q=>g.every(H=>Q.search.includes(H))),L=new Option(P.length===0?"No matching views":"Choose a view","");L.disabled=!0,f.replaceChildren(L);const F=new Map;for(const Q of P){const H=new Option(Q.label,Q.id);if(Q.group===void 0||Q.group.length===0)f.append(H);else{let V=F.get(Q.group);V===void 0&&(V=document.createElement("optgroup"),V.label=Q.group,F.set(Q.group,V),f.append(V)),V.append(H)}}f.value=P.some(Q=>Q.id===M)?M:"",f.disabled=P.length===0,p.disabled=f.value.length===0,v.textContent=`${P.length} of ${t.length} views`};return c.addEventListener("input",m,{signal:i.signal}),f.addEventListener("change",()=>{M=f.value,p.disabled=!1,n.apply(M)},{signal:i.signal}),p.addEventListener("click",()=>n.apply(f.value),{signal:i.signal}),a.addEventListener("click",()=>{l.hidden=!l.hidden,a.textContent=l.hidden?"Expand":"Collapse",a.setAttribute("aria-expanded",String(!l.hidden))},{signal:i.signal}),m(),document.body.append(r),()=>{i.abort(),r.remove()}},Pr=new ot(16777215),pg=n=>{var t;const e=n.map??null;return JSON.stringify([n.type,e===null?null:[e.source.uuid,e.repeat.toArray(),e.offset.toArray(),e.rotation,e.wrapS,e.wrapT,e.colorSpace,e.minFilter,e.magFilter],n.transparent,n.opacity,n.side,n.depthWrite,n.alphaTest,n.roughness,n.metalness,(t=n.emissive)==null?void 0:t.getHex(),n.emissiveIntensity])},gl=(n,e,t)=>{const i=new gn;i.setAttribute("position",n.getAttribute("position").clone()),n.hasAttribute("normal")&&i.setAttribute("normal",n.getAttribute("normal").clone()),n.hasAttribute("uv")&&i.setAttribute("uv",n.getAttribute("uv").clone()),n.index!==null&&i.setIndex(n.index.clone()),i.applyMatrix4(e),i.hasAttribute("normal")||i.computeVertexNormals();const r=i.getAttribute("position").count,s=new Float32Array(r*3);for(let o=0;o<r;++o)t.toArray(s,o*3);return i.setAttribute("color",new Yt(s,3)),i},mg=n=>{const e=n.some(i=>i.hasAttribute("uv")),t=n.every(i=>i.index!==null);for(const[i,r]of n.entries())e&&!r.hasAttribute("uv")&&r.setAttribute("uv",new Yt(new Float32Array(r.getAttribute("position").count*2),2)),!t&&r.index!==null&&(n[i]=r.toNonIndexed())},mc=n=>n.isMesh===!0,gg=n=>n.isInstancedMesh===!0,_g=n=>Array.isArray(n)?n.length===1?n[0]:null:n,xg=n=>{var a;n.updateMatrixWorld(!0);const e=n.matrixWorld.clone().invert(),t=new Map,i=[],r=new dt,s=new ot,o=(l,u)=>{const c=pg(l);let h=t.get(c);h===void 0&&(h={material:l,geometries:[]},t.set(c,h)),h.geometries.push(u)};if(n.traverse(l=>{if(!mc(l)||l===n)return;const u=_g(l.material);if(u===null)return;const c=l.geometry;if(c.morphAttributes.position!==void 0||Object.keys(c.morphAttributes).length!==0||l.isSkinnedMesh===!0)return;const h=e.clone().multiply(l.matrixWorld);if(gg(l))for(let f=0;f<l.count;++f)l.getMatrixAt(f,r),l.instanceColor!==null?l.getColorAt(f,s):s.copy(Pr),o(u,gl(c,h.clone().multiply(r),s.clone().multiply(u.color??Pr)));else o(u,gl(c,h,u.color??Pr));i.push(l)}),i.length!==0){for(const l of i)l.removeFromParent();for(const[l,u]of t){mg(u.geometries);const c=lc(u.geometries,!1);if(c===null)throw new Error(`Manor entry "${n.name}" could not merge ${l}.`);const h=u.material.clone();(a=h.color)==null||a.copy(Pr),h.vertexColors=!0;const f=new Xt(c,h);f.name=`${n.name}:baked`,f.castShadow=!0,f.receiveShadow=!0,n.add(f)}}},vg=n=>{const e=()=>{let i=0;for(const r of n.values())r.traverse(s=>{mc(s)&&(i+=1)});return i},t=e();for(const i of n.values())xg(i);return{before:t,after:e()}},gc="view",Mg=[{id:"01-whole-south-east",label:"Whole manor"},{id:"reference-exterior",label:"Exterior"},{id:"reference-courtyard",label:"Courtyard"},{id:"garden-south",label:"Garden"},{id:"hall--corner-b",label:"Great hall"},{id:"kitchen--corner-b",label:"Kitchen"},{id:"entrance--corner-a",label:"Entrance"},{id:"master--corner-a",label:"Master chamber"},{id:"stair-turn",label:"Stair"},{id:"corridor-west-to-east",label:"Upper corridor"},{id:"ground-plan",label:"Ground plan"},{id:"upper-plan",label:"Upper plan"},{id:"frame-axonometric",label:"Timber frame"},{id:"roof-overhead",label:"Roof"}],mn=n=>{const e=document.querySelector(n);if(e===null)throw new Error(`The manor page is missing its ${n} element.`);return e},Tt=mn("#view"),yg=mn("#status"),bo=mn("#loading"),_c=mn("#phase"),Sg=mn("#featured"),Bo=mn("#panel"),bg=mn("#scene"),Eo=mn("#panel-toggle"),xc=n=>{Bo.classList.toggle("collapsed",n),Eo.textContent=n?"Show":"Hide",Eo.setAttribute("aria-expanded",String(!n))};xc(window.matchMedia("(max-width: 720px)").matches);Eo.addEventListener("click",()=>xc(!Bo.classList.contains("collapsed")));const Eg=n=>{bo.hidden=!1,bo.classList.add("failed"),_c.textContent=`The manor could not be built.
`+(n instanceof Error?n.message:String(n))},wg=()=>new Promise(n=>{requestAnimationFrame(()=>setTimeout(n,0))}),Tg=()=>new URLSearchParams(window.location.search).get(gc),Ag=n=>{const e=new URL(window.location.href);e.searchParams.set(gc,n),window.history.replaceState(null,"",e)},Rg=(n,e)=>{const t=new Map(n.views.map((o,a)=>[o.id,a])),i=new Map;for(const o of Mg){if(!t.has(o.id))continue;const a=document.createElement("button");a.type="button",a.textContent=o.label,a.addEventListener("click",()=>e(o.id)),i.set(o.id,a),Sg.append(a)}const r=new Map(n.manifest.rooms.map(o=>[o.id,o.label])),s=dg({items:n.views.map(o=>({id:o.id,label:o.id,group:r.get(o.room??"")??o.object??"Views",keywords:[o.room??"",o.object??""]})),apply:e});return Bo.insertBefore(mn("#preview-navigation"),mn("#keys")),{removeNavigation:s,highlight:o=>{for(const[a,l]of i)l.setAttribute("aria-current",String(a===o))}}},Cg=async()=>{const n=async T=>{_c.textContent=T,await wg()},e=await hg({report:n});await n("Merging draw batches");const t=vg(e.objects),{scene:i,camera:r}=e,s=new Map(e.views.map((T,D)=>[T.id,D])),o=T=>{const D=s.get(T);if(D===void 0)throw new Error(`Unknown manor view: ${T}`);e.applyView(D),e.target.copy(e.inspection.target.position),Ag(T),a.highlight(T)},a=Rg(e,o),l=Tg();o(l!==null&&s.has(l)?l:e.views[0].id);const u=new AbortController,c=new Set,h=new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowLeft","ArrowDown","ArrowRight","Space","KeyC","ShiftLeft","ShiftRight"]),f=T=>T instanceof Element&&T.closest("input, textarea, select, button, [contenteditable]")!==null,p=ei.degToRad(89),v=new cn(0,0,0,"YXZ"),M=new ae,m=new ae,g=new ae(0,1,0),P=new ae;r.lookAt(e.target);let L=Math.max(e.target.distanceTo(r.position),.001);const F=e.target.clone(),Q=r.position.clone(),H=r.quaternion.clone(),V=()=>{Q.copy(r.position),H.copy(r.quaternion),F.copy(e.target)},le=()=>{const T=!e.target.equals(F);!T&&r.position.equals(Q)&&r.quaternion.equals(H)||(c.clear(),T&&r.lookAt(e.target),L=Math.max(e.target.distanceTo(r.position),.001),V())},Te=()=>{e.target.copy(r.position).addScaledVector(r.getWorldDirection(M),L),V()},y=(T,D)=>{le(),v.setFromQuaternion(r.quaternion,"YXZ"),v.y-=T*.0025,v.x=ei.clamp(v.x-D*.0025,-p,p),v.z=0,r.up.copy(g),r.quaternion.setFromEuler(v),Te()},A=(T,D)=>Number(T.some(O=>c.has(O)))-Number(D.some(O=>c.has(O)));let Me=0,ue=4,I=0,ie=0,x=!1,j="";const X=[],ce=V0(Tt,i,r,T=>{const D=Math.max(T-Me,0),O=Math.min(D,.1);Me=T,X.push(D)>15&&X.shift(),(Tt.clientWidth!==I||Tt.clientHeight!==ie)&&(I=Tt.clientWidth,ie=Tt.clientHeight,ce.renderer.setSize(Math.max(I,1),Math.max(ie,1),!1),r.aspect=Math.max(I,1)/Math.max(ie,1),r.updateProjectionMatrix()),le();const G=document.pointerLockElement===Tt,ne=c.has("ShiftLeft")||c.has("ShiftRight"),Z=ue*(ne?4:1);return G&&(r.getWorldDirection(M),m.set(1,0,0).applyQuaternion(r.quaternion),P.set(0,0,0).addScaledVector(M,A(["KeyW","ArrowUp"],["KeyS","ArrowDown"])).addScaledVector(m,A(["KeyD","ArrowRight"],["KeyA","ArrowLeft"])).addScaledVector(g,A(["Space"],["KeyC"])),P.lengthSq()!==0&&r.position.addScaledVector(P.normalize(),Z*O)),Te(),e.followLighting(),v.setFromQuaternion(r.quaternion,"YXZ"),yg.textContent=`x=${r.position.x.toFixed(2)} y=${r.position.y.toFixed(2)} z=${r.position.z.toFixed(2)} · yaw=${ei.radToDeg(v.y).toFixed(1)}° pitch=${ei.radToDeg(v.x).toFixed(1)}° · fov=${r.fov.toFixed(1)}° · speed=${fg(Z,X,.1)}
`+(G?"Mouse look · Esc releases":j||"Click the view to fly"),!1},{pixelRatio:Math.min(window.devicePixelRatio,1.5)});ce.renderer.setClearColor(1841688,1),e.configureRenderer(ce.renderer);const N=new Intl.NumberFormat("en-US");bg.textContent=`${N.format(e.instanceState.prototypes)} shared prototypes placed ${N.format(e.instanceState.drawnInstances)} times · ${N.format(t.before)} authored meshes drawn as ${N.format(t.after)} · ${N.format(e.views.length)} authored views`,bo.hidden=!0,Tt.focus();const U=()=>{c.clear(),u.abort(),a.removeNavigation(),document.pointerLockElement===Tt&&document.exitPointerLock(),ce.stop(),e.disposeTextures()};window.addEventListener("pagehide",U,{once:!0}),window.addEventListener("keydown",T=>{if(T.code==="Escape"){c.clear(),document.pointerLockElement===Tt&&document.exitPointerLock();return}if(T.defaultPrevented||document.pointerLockElement!==Tt||f(T.target)){c.clear();return}T.code==="KeyQ"||T.code==="KeyE"?(T.repeat||(ue=ei.clamp(T.code==="KeyQ"?ue/1.5:ue*1.5,.1,100)),T.preventDefault()):h.has(T.code)&&(c.add(T.code),T.preventDefault())},{signal:u.signal}),window.addEventListener("keyup",T=>c.delete(T.code),{signal:u.signal}),window.addEventListener("focusin",T=>{c.clear(),f(T.target)&&document.pointerLockElement===Tt&&document.exitPointerLock()},{signal:u.signal}),window.addEventListener("blur",()=>{c.clear(),document.pointerLockElement===Tt&&document.exitPointerLock()},{signal:u.signal}),document.addEventListener("pointerlockchange",()=>{c.clear(),j=""},{signal:u.signal});const k=T=>{x=!1,j="Mouse look was not acquired. Click to retry. "+(T instanceof Error?T.message:String(T))};Tt.addEventListener("click",T=>{if(T.pointerType!=="touch"&&!(x||document.pointerLockElement===Tt)){Tt.focus(),x=!0;try{Promise.resolve(Tt.requestPointerLock()).then(()=>{x=!1}).catch(k)}catch(D){k(D)}}},{signal:u.signal}),document.addEventListener("pointerlockerror",()=>k("The browser refused pointer lock."),{signal:u.signal}),window.addEventListener("mousemove",T=>{document.pointerLockElement===Tt&&y(T.movementX,T.movementY)},{signal:u.signal});let te=null;Tt.addEventListener("pointerdown",T=>{T.pointerType!=="touch"||te!==null||(te={id:T.pointerId,x:T.clientX,y:T.clientY})},{signal:u.signal}),Tt.addEventListener("pointermove",T=>{te===null||T.pointerId!==te.id||(y((T.clientX-te.x)*2,(T.clientY-te.y)*2),te={id:te.id,x:T.clientX,y:T.clientY})},{signal:u.signal});for(const T of["pointerup","pointercancel"])Tt.addEventListener(T,D=>{te!==null&&D.pointerId===te.id&&(te=null)},{signal:u.signal});Tt.addEventListener("wheel",T=>{T.preventDefault(),r.fov=ei.clamp(r.fov*Math.exp(T.deltaY*.001),5,110),r.updateProjectionMatrix()},{passive:!1,signal:u.signal})};Cg().catch(Eg);
