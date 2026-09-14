import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createManorScene } from '../src/models/manor.js';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const source = createManorScene({ shadows: false });
source.scene.updateMatrixWorld(true);
const meshes = [];
source.scene.traverse(object => { if (object.isMesh) { object.material.side = THREE.DoubleSide; meshes.push(object); } });
const matching = suffix => meshes.filter(object => object.name.startsWith('hall-table-' + suffix));
const legs = matching('leg-'), tops = matching('top-plank-'), aprons = matching('apron-end-');
assert.equal(legs.length, 4);
assert.equal(aprons.length, 2);
assert.equal(matching('end-stretcher-').length, 0, 'The raised end joint has one receiving member');
const middle = new THREE.Box3().setFromObject(matching('long-stretcher')[0]);
const endBounds = aprons.map(object => ({ id: object.name, box: new THREE.Box3().setFromObject(object) })).sort((a, b) => a.box.min.z - b.box.min.z);
const endGaps = [middle.min.z - endBounds[0].box.max.z, endBounds[1].box.min.z - middle.max.z];
assert.ok(endGaps.every(gap => Math.abs(gap) < 1e-6));
for (const { box } of endBounds) {
  assert.ok(box.min.x <= middle.min.x && box.max.x >= middle.max.x);
  assert.ok(box.min.y <= middle.min.y && box.max.y >= middle.max.y);
  assert.ok(box.min.y >= 1.056 - 1e-6);
}
const rugs = meshes.filter(object => object.name.startsWith('hall-rug-'));
const samples = [];
for (const object of legs) {
  const box = new THREE.Box3().setFromObject(object);
  for (const u of [.1, .5, .9]) for (const v of [.1, .5, .9]) {
    const x = box.min.x + u * (box.max.x - box.min.x), z = box.min.z + v * (box.max.z - box.min.z);
    const floor = new THREE.Raycaster(new THREE.Vector3(x, box.min.y + .03, z), new THREE.Vector3(0, -1, 0), 0, .06).intersectObjects(rugs, false)[0];
    const top = new THREE.Raycaster(new THREE.Vector3(x, box.max.y - .03, z), new THREE.Vector3(0, 1, 0), 0, .06).intersectObjects(tops, false)[0];
    assert.ok(floor && top, 'Both support contacts must be measured');
    samples.push({ footGap: box.min.y - floor.point.y, topGap: top.point.y - box.max.y });
  }
}
assert.equal(samples.length, 36);
assert.ok(samples.every(row => Math.abs(row.footGap) < 1e-6 && Math.abs(row.topGap) < 1e-6));
console.log(JSON.stringify({
  basis: Object.fromEntries(['src/models/manor.js', 'src/models/manor-craft.js', 'scripts/verifyManorHallTableJoints.mjs'].map(path => [path, digest(readFileSync(path))])),
  tableParts: source.entries.find(entry => entry.id === 'hall-table').model.parts.length,
  nonTableEntriesDigest: digest(JSON.stringify(source.entries.filter(entry => entry.id !== 'hall-table'))),
  endGaps, endBounds, middle, supportSamples: samples.length,
  maxFootGap: Math.max(...samples.map(row => Math.abs(row.footGap))), maxTopGap: Math.max(...samples.map(row => Math.abs(row.topGap))),
  limits: 'Finite join-face and support observations; no strength, seating transition, or rendered verdict.',
}, null, 2));
