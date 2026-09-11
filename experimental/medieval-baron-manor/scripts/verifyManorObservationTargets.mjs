import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createManorScene } from '../src/models/manor.js';

const source = createManorScene({ shadows: false });
const findings = [];
for (let i = 0; i < source.views.length; i++) {
  const view = source.views[i];
  if (!view.focus) continue;
  source.applyView(i); source.scene.updateMatrixWorld(true); source.camera.updateMatrixWorld(true);
  const target = new THREE.Box3().setFromObject(source.objects.get(view.focus)).getCenter(new THREE.Vector3());
  const expected = target.clone().sub(source.camera.position).normalize();
  const actual = source.inspection.target.position.clone().sub(source.camera.position).normalize();
  findings.push({ id: view.id, angularError: expected.angleTo(actual) });
}
assert.equal(findings.length, 438);
assert.ok(findings.every(row => Number.isFinite(row.angularError) && row.angularError < 1e-6));
const meshes = [];
source.scene.traverse(object => { if (object.isMesh) { object.material.side = THREE.DoubleSide; meshes.push(object); } });
const context = [];
for (const fraction of [0, .5, 1]) {
  const id = `ww-c-0-casement--1--operation-${fraction}-a-context`;
  source.applyView(source.views.findIndex(view => view.id === id));
  source.scene.updateMatrixWorld(true); source.camera.updateMatrixWorld(true);
  const targetObject = source.objects.get('ww-c-0-casement--1');
  const target = new THREE.Box3().setFromObject(targetObject).getCenter(new THREE.Vector3());
  const direction = target.clone().sub(source.camera.position);
  const hits = new THREE.Raycaster(source.camera.position, direction.clone().normalize(), 0, direction.length()).intersectObjects(meshes, false);
  const occluders = hits.filter(hit => !hit.object.name.startsWith('ww-c-0-casement--1'));
  assert.equal(occluders.length, 0, 'The selected leaf center must not be behind the chimney');
  assert.equal(source.camera.position.y, 2.05);
  context.push({ id, eye: source.camera.position.toArray(), target: target.toArray(), centerNdc: target.project(source.camera).toArray(), occluders: [] });
}
console.log(JSON.stringify({
  basis: Object.fromEntries(['src/models/manor.js', 'scripts/verifyManorObservationTargets.mjs'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
  focusedViews: findings.length, maxAngularError: Math.max(...findings.map(row => row.angularError)), context,
  limits: 'Numerical target consistency and three center rays. Does not establish full object framing, all sight lines, a reachable observer body, or rendered visibility; direct images remain required.',
}, null, 2));
