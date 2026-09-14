import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createManorScene } from '../src/models/manor.js';

const source = createManorScene({ shadows: false });
source.scene.updateMatrixWorld(true);
const meshes = [];
source.scene.traverse(object => { if (object.isMesh) { object.material.side = THREE.DoubleSide; meshes.push(object); } });
const get = name => { const result = meshes.find(mesh => mesh.name === name); assert.ok(result, name); return result; };
const bounds = object => new THREE.Box3().setFromObject(object);
const feet = meshes.filter(mesh => mesh.name.startsWith('hall-bench-west-leg-'));
const rug = meshes.filter(mesh => mesh.name.startsWith('hall-rug-'));
const seats = meshes.filter(mesh => mesh.name.startsWith('hall-bench-west-seat-board-'));
assert.equal(feet.length, 4);
const samples = [];
for (const foot of feet) {
  const box = bounds(foot);
  for (const u of [.05, .5, .95]) for (const v of [.05, .5, .95]) {
    const x = box.min.x + u * (box.max.x - box.min.x), z = box.min.z + v * (box.max.z - box.min.z);
    const down = new THREE.Raycaster(new THREE.Vector3(x, box.min.y + .03, z), new THREE.Vector3(0, -1, 0), 0, .06).intersectObjects(rug, false)[0];
    const up = new THREE.Raycaster(new THREE.Vector3(x, box.max.y - .03, z), new THREE.Vector3(0, 1, 0), 0, .06).intersectObjects(seats, false)[0];
    assert.ok(down && up, 'Measure both contacts; a ray miss is not clearance');
    assert.equal(down.object.name, 'hall-rug-woven-base');
    samples.push({ floorGap: box.min.y - down.point.y, seatGap: up.point.y - box.max.y });
  }
}
assert.ok(samples.every(row => Math.abs(row.floorGap) < 1e-6 && Math.abs(row.seatGap) < 1e-6));
const plaster = get('outer-west-0-plaster'), timber = get('outer-west-0-oak'), brace = get('outer-west-0-brace-3-1');
const vertices = object => Array.from({ length: object.geometry.getAttribute('position').count }, (_, i) => new THREE.Vector3().fromBufferAttribute(object.geometry.getAttribute('position'), i).applyMatrix4(object.matrixWorld));
const key = point => point.toArray().map(value => value.toFixed(6)).join(',');
const timberPoints = new Set(vertices(timber).map(key));
const edge = vertices(plaster).filter(point => Math.abs(point.x + 7.445) < 1e-6 &&
  (Math.abs(point.z - 1.805) < 1e-6 || Math.abs(point.z - 3.070) < 1e-6 || Math.abs(point.y - .650) < 1e-6 || Math.abs(point.y - 2.830) < 1e-6));
assert.ok(edge.length > 0);
const unmatched = [...new Set(edge.filter(point => !timberPoints.has(key(point))).map(key))];
assert.equal(unmatched.length, 0, 'Recessed infill front and timber returns share their edge vertices');
const braceBox = bounds(brace);
assert.ok(Math.abs(braceBox.max.x + 7.38) < 1e-6 && Math.abs(braceBox.min.x + 7.435) < 1e-6);
const u = (2.93 + 4.195) / 2, z = 6 - u, y = .45 + (.19 + 2.39) / 2;
const ray = new THREE.Raycaster(new THREE.Vector3(-7.2, y, z), new THREE.Vector3(-1, 0, 0), 0, .5);
const rayFaces = [...new Set(ray.intersectObjects([brace, plaster], false).map(hit => hit.point.x.toFixed(6)))].map(Number).sort((a, b) => b - a);
assert.deepEqual(rayFaces, [-7.38, -7.435, -7.445, -7.6]);
const sillBounds = ['ww-a-0-sill-lip', 'ww-b-0-sill-lip'].map(id => ({ id, box: bounds(get(id)) }));
assert.ok(sillBounds.every(({ box }) => Math.abs(box.min.x + 7.65) < 1e-6 && Math.abs(box.max.x + 7.38) < 1e-6));
console.log(JSON.stringify({
  basis: Object.fromEntries(['src/models/manor.js', 'src/models/manor-craft.js', 'scripts/verifyManorWestSeatingJoints.mjs'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
  supportSamples: samples.length, maxFloorGap: Math.max(...samples.map(row => Math.abs(row.floorGap))), maxSeatGap: Math.max(...samples.map(row => Math.abs(row.seatGap))),
  sharedInfillEdgeVertices: new Set(edge.map(key)).size, unmatched, rayFaces, braceBox, sillBounds,
  limits: 'Finite support and shared-edge observations; no structural strength, sequential seated access, or whole-wall watertightness verdict.',
}, null, 2));
