import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { tessellateToMesh, transformAutoMovieMesh } from '@automovie/engine';
import { createManorScene } from '../src/models/manor.js';

// Source geometry, including invisible parts. This checks one separation axis
// over the entire two-leaf rotation interval, not merely sampled poses.
const source = createManorScene({ shadows: false });
source.scene.updateMatrixWorld(true);
let maximumZ = -Infinity, witness = null, vertices = 0;
for (const id of ['nw-0-casement--1', 'nw-0-casement-1']) {
  const entry = source.entries.find(entry => entry.id === id);
  const { rest, motion } = entry.articulation;
  assert.deepEqual(motion.axis, { x: 0, y: 1, z: 0 });
  assert.deepEqual(motion.pivot, { x: 0, y: 0, z: 0 });
  assert.deepEqual(rest.scale, { x: 1, y: 1, z: 1 });
  assert.equal(rest.rotation.x, 0); assert.equal(rest.rotation.z, 0);
  const yaw = 2 * Math.atan2(rest.rotation.y, rest.rotation.w);
  const lo = yaw + motion.min, hi = yaw + motion.max;
  for (const part of entry.model.parts) {
    const geometry = part.geometry.type === 'primitive' ? tessellateToMesh(part.geometry.shape) : part.geometry.mesh;
    const mesh = transformAutoMovieMesh(geometry, part.transform);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      vertices++;
      const x = mesh.positions[i], z = mesh.positions[i + 2];
      // z(theta) = hingeZ - x sin(theta) + z cos(theta).
      const critical = Math.atan2(-x, z), angles = [lo, hi];
      for (let k = Math.ceil((lo - critical) / Math.PI); k <= Math.floor((hi - critical) / Math.PI); k++) angles.push(critical + k * Math.PI);
      for (const angle of angles) {
        const value = rest.translation.z - x * Math.sin(angle) + z * Math.cos(angle);
        if (value > maximumZ) { maximumZ = value; witness = { id, part: part.id, vertex: i / 3, angle }; }
      }
    }
  }
}
const meshes = [];
source.scene.traverse(object => { if (object.isMesh) { object.material.side = THREE.DoubleSide; meshes.push(object); } });
const counter = meshes.filter(mesh => mesh.name.startsWith('kitchen-counter-'));
const bounds = mesh => new THREE.Box3().setFromObject(mesh);
const counterMinimumZ = Math.min(...counter.map(mesh => bounds(mesh).min.z));
const separation = counterMinimumZ - maximumZ;
assert.ok(vertices > 0 && Number.isFinite(separation) && separation > .04);
const feet = counter.filter(mesh => mesh.name.startsWith('kitchen-counter-leg-'));
const floor = meshes.filter(mesh => mesh.name.startsWith('ground-floor-finish'));
assert.equal(feet.length, 4); assert.ok(floor.length > 0);
const footGaps = [];
for (const foot of feet) {
  const box = bounds(foot);
  for (const u of [.05, .5, .95]) for (const v of [.05, .5, .95]) {
    const origin = new THREE.Vector3(box.min.x + u * (box.max.x - box.min.x), box.min.y + .03, box.min.z + v * (box.max.z - box.min.z));
    const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, .06).intersectObjects(floor, false)[0];
    assert.ok(hit, 'Foot support ray must hit the finish'); footGaps.push(box.min.y - hit.point.y);
  }
}
const pitcher = counter.filter(mesh => mesh.name === 'kitchen-counter-pitcher');
const cap = counter.find(mesh => mesh.name === 'kitchen-counter-water-jug-cover-cap');
assert.equal(pitcher.length, 1); assert.ok(cap);
const capBox = bounds(cap), center = capBox.getCenter(new THREE.Vector3()), rimGaps = [];
for (let i = 0; i < 24; i++) {
  const angle = (i + .5) * Math.PI / 12;
  const origin = new THREE.Vector3(center.x + .066 * Math.cos(angle), capBox.min.y + .02, center.z + .066 * Math.sin(angle));
  const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, .04).intersectObjects(pitcher, false)[0];
  assert.ok(hit, 'The cap must bear on the ceramic neck'); rimGaps.push(capBox.min.y - hit.point.y);
}
assert.ok([...footGaps, ...rimGaps].every(gap => Math.abs(gap) < 1e-6));
console.log(JSON.stringify({
  basis: Object.fromEntries(['src/models/manor.js', 'src/models/manor-craft.js', 'scripts/verifyManorKitchenPlacement.mjs'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
  vertices, maximumZ, witness, counterMinimumZ, separation,
  footSamples: footGaps.length, maxFootGap: Math.max(...footGaps.map(Math.abs)),
  rimSamples: rimGaps.length, maxRimGap: Math.max(...rimGaps.map(Math.abs)),
  limits: 'Continuous north-window/counter separation and finite support contacts only. No fluid seal, lifting, lid removal, full cooking task, or complete household transport verdict.',
}, null, 2));
