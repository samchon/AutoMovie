// Host adapter for the textured manor. It decodes the seven albedo textures
// once, derives the shared prototype inventory in the page, and hands both to
// the visual scene. The formal asset string stays in each material binding;
// only its URL is resolved here, so the module runs from any bundler root.
import {TextureLoader} from 'three';
import {AutoMovieTextureCache} from '@automovie/viewer';
import {manorTextureBindings} from '../materials/manor.js';
import {createManorScene} from '../models/manor.js';
import {deriveManorInstanceInventory} from './manor-inventory.js';
import {createManorInstanceConsumer} from './manor-viewer.js';

const urls={
 'assets/textures/manor/oak-albedo-v1.png':new URL('../../assets/textures/manor/oak-albedo-v1.png',import.meta.url).href,
 'assets/textures/manor/limestone-albedo-v1.png':new URL('../../assets/textures/manor/limestone-albedo-v1.png',import.meta.url).href,
 'assets/textures/manor/lime-plaster-albedo-v1.png':new URL('../../assets/textures/manor/lime-plaster-albedo-v1.png',import.meta.url).href,
 'assets/textures/manor/terracotta-albedo-v1.png':new URL('../../assets/textures/manor/terracotta-albedo-v1.png',import.meta.url).href,
 'assets/textures/manor/linen-albedo-v1.png':new URL('../../assets/textures/manor/linen-albedo-v1.png',import.meta.url).href,
 'assets/textures/manor/apple-bark-albedo-v1.png':new URL('../../assets/textures/manor/apple-bark-albedo-v1.png',import.meta.url).href,
 'assets/textures/manor/garden-soil-albedo-v1.png':new URL('../../assets/textures/manor/garden-soil-albedo-v1.png',import.meta.url).href,
};
// `report` names each phase before it starts and may return a promise so a host
// can paint the message; the geometry work between two reports is synchronous.
export async function createTexturedManorScene({report=()=>undefined,...options}={}){
 await report('Decoding textures');
 const loader=new TextureLoader(),cache=new AutoMovieTextureCache(asset=>{
  const url=urls[asset];if(!url)throw new Error('Unresolved manor texture: '+asset);return loader.loadAsync(url);
 });
 try{
  await cache.prime(manorTextureBindings());
  await report('Deriving shared prototypes');
  const inventory=deriveManorInstanceInventory(createManorScene({geometryOnly:true}).entries);
  const consumer=createManorInstanceConsumer(inventory,cache.resolve);
  await report('Building the manor');
  // This adapter owns a visual scene, never the geometry-only measurement branch.
  const manor=createManorScene({...options,geometryOnly:false,resolveTexture:cache.resolve,instanceConsumer:consumer});
  if(manor.scene===undefined)throw new Error('Textured manor preview requires the visual scene capability; geometry-only output cannot be displayed.');
  // `update` keeps the preview contract: lighting follow plus instance
  // resolution. Both halves stay reachable for a host that draws the sets its
  // own way and only needs the light to follow the eye.
  const followLighting=manor.update;manor.update=()=>{followLighting();consumer.update(manor.camera);};
  return {...manor,followLighting,instanceConsumer:consumer,instanceState:consumer.stats(),textureState:{ready:true,decoded:cache.size,assets:Object.keys(urls)},disposeTextures:()=>cache.dispose()};
 }catch(error){await cache.dispose();throw error;}
}
