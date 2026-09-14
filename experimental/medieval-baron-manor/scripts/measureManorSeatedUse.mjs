import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { createManorScene } from "../src/models/manor.js";

// Finite source-surface diagnostic. Candidate changes are confined to this
// process. The four conservative body boxes are the current seated-use canon;
// they are not an anatomical model and are never shrunk to fit furniture.
const candidate = process.argv.includes("--candidate-west-six");
const endCandidate = process.argv.includes("--candidate-four-plus-two");
const westFlush = process.argv.includes("--candidate-west-flush");
const revised = candidate || endCandidate;
assert.ok(!westFlush || !revised, "Choose one candidate recipe");
const flushResult = westFlush ? await (await import("./manorWestSeatingCandidate.mjs")).createWestSeatingCandidate() : null;
const source = flushResult?.source ?? createManorScene({ shadows: false });
const windowArgument = process.argv.find(value => value.startsWith("--window-fraction="));
const windowFraction = windowArgument ? Number(windowArgument.split("=")[1]) : null;
if (windowFraction !== null) {
  assert.ok(Number.isFinite(windowFraction) && windowFraction >= 0 && windowFraction <= 1);
  const leaves = source.entries.filter(entry => /^ww-[ab]-0-casement-/.test(entry.id));
  assert.equal(leaves.length, 4);
  for (const entry of leaves) source.setArticulation(entry, windowFraction);
}
source.scene.updateMatrixWorld(true);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceInputs = Object.fromEntries([
  "src/models/manor.js", "src/models/manor-craft.js", "src/models/manor-garden.js",
  "src/materials/manor.js", "docs/settings/002-household.md", "scripts/measureManorSeatedUse.mjs",
].map(path => [path, digest(readFileSync(path))]));
if (revised) assert.equal(sourceInputs["src/models/manor-craft.js"],
  "4083e393a06df34086d8aa5f1068fc61f4884ccfc9257fe14e78b05da5f9c387",
  "These exploratory transforms were defined against the pre-table-revision source. Do not apply them twice to the adopted production geometry.");
const surfaces = [];
source.scene.traverse(object => {
  if (!object.isMesh) return;
  const attr = object.geometry.getAttribute("position"), index = object.geometry.index;
  const vertices = Array.from({ length: attr.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(attr, i).applyMatrix4(object.matrixWorld));
  const bounds = new THREE.Box3().setFromPoints(vertices), center = bounds.getCenter(new THREE.Vector3());
  if (bounds.max.x < -7.7 || bounds.min.x > -4.3 || bounds.max.z < -1 || bounds.min.z > 5.8 || bounds.min.y > 2.5) return;
  if (revised) for (const point of vertices) {
    const id = object.name;
    if (id.startsWith("hall-bench-")) {
      if (candidate && id.startsWith("hall-bench-west")) point.x -= 0.06;
      if (candidate && id.includes("-leg-")) point.y = 0.456 + (point.y - 0.456) * 0.385 / 0.405;
      if (candidate && /-seat-board-|-seat-rail-|-end-rail-/.test(id)) point.y -= 0.02;
    }
    if (id.startsWith("hall-table-")) {
      if (id.includes("-leg-")) {
        point.x = center.x + (point.x - center.x) * 0.10 / 0.12;
        point.z = center.z + (point.z - center.z) * 0.10 / 0.12;
      }
      if (/-leg-|-apron-end-|-end-stretcher-|-joint-peg-/.test(id)) point.z += Math.sign(center.z - 2.35) * 0.08;
      if (/-apron-long-|-long-stretcher/.test(id)) point.z = 2.35 + (point.z - 2.35) * ((bounds.max.z - bounds.min.z + 0.16) / (bounds.max.z - bounds.min.z));
      if (/-stretcher/.test(id)) point.y += endCandidate ? 0.425 : 0.40;
      if (endCandidate && /-apron-/.test(id)) point.y = 1.166 + (point.y - 1.166) * .11 / .13;
    }
    if (id.startsWith("hall-lamp-")) point.y += 0.35;
  }
  const triangles = [];
  for (let i = 0; i < (index?.count ?? attr.count); i += 3)
    triangles.push(new THREE.Triangle(...[0, 1, 2].map(j => vertices[index ? index.getX(i + j) : i + j])));
  surfaces.push({ id: object.name, bounds: new THREE.Box3().setFromPoints(vertices), triangles });
});
const seatHeight = candidate ? 0.886 : 0.906;
const currentWestX = new THREE.Box3().setFromObject(source.objects.get("hall-bench-west")).getCenter(new THREE.Vector3()).x;
const seats = endCandidate ? [
  { id: "west-0", side: "west", x: -7.16, z: 1.588 },
  { id: "west-1", side: "west", x: -7.16, z: 2.604 },
  { id: "east-0", side: "east", x: -6.01, z: 2.096 },
  { id: "east-1", side: "east", x: -6.01, z: 3.112 },
  { id: "north-end", x: -6.98, z: .56, direction: [.537, .843] },
  { id: "south-end", x: -6.72, z: 4.10, direction: [0, -1] },
] : ["west", "east"].flatMap(side => [1.60, 2.35, 3.10].map((z, i) => ({
  id: side + "-" + i, side, x: side === "west" ? (candidate || westFlush ? -7.22 : currentWestX) : -6.01, z,
})));
const boxes = seats.flatMap(seat => [
  ["pelvis", 0.50, -0.15, 0.15, seatHeight, seatHeight + 0.20],
  ["thigh-knee", 0.50, 0, 0.45, seatHeight, seatHeight + 0.14],
  ["lower-leg-foot", 0.50, 0.25, 0.60, 0.456, seatHeight + 0.14],
  ["upper-body-head", 0.65, -0.15, 0.15, seatHeight + 0.20, seatHeight + 1.10],
].map(([part, width, s0, s1, y0, y1]) => {
  const direction = new THREE.Vector2(...(seat.direction ?? [seat.side === "west" ? 1 : -1, 0])).normalize();
  // Body-local X is forward and Z is parallel to its seat. The local frame is
  // orthonormal; every mesh triangle is transformed into it for the SAT check.
  const matrix = new THREE.Matrix4().makeBasis(new THREE.Vector3(direction.x, 0, direction.y), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-direction.y, 0, direction.x));
  matrix.setPosition(seat.x, 0, seat.z);
  const localBox = new THREE.Box3(new THREE.Vector3(s0, y0, -width / 2), new THREE.Vector3(s1, y1, width / 2));
  return { seat: seat.id, part, localBox, matrix, inverse: matrix.clone().invert(), box: localBox.clone().applyMatrix4(matrix) };
}));
// Interior checks exclude only exact boundary contact. This numerical epsilon
// is not a clearance waiver; minimum geometric separations remain reportable.
const inside = box => box.clone().expandByScalar(-1e-6);
const contacts = boxes.flatMap(row => {
  const box = inside(row.localBox);
  return surfaces.filter(surface => row.box.intersectsBox(surface.bounds) && surface.triangles.some(triangle => box.intersectsTriangle(new THREE.Triangle(...[triangle.a, triangle.b, triangle.c].map(p => p.clone().applyMatrix4(row.inverse))))))
    .map(surface => ({ seat: row.seat, bodyPart: row.part, sourcePart: surface.id }));
});
const simultaneous = [];
for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
  const a = boxes[i], b = boxes[j];
  if (a.seat === b.seat || !inside(a.box).intersectsBox(inside(b.box))) continue;
  simultaneous.push({ a: a.seat + "/" + a.part, b: b.seat + "/" + b.part, overlap: a.box.clone().intersect(b.box).getSize(new THREE.Vector3()).toArray() });
}
assert.equal(boxes.length, 24);
assert.equal(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)).intersectsTriangle(new THREE.Triangle(new THREE.Vector3(-1, .5, .5), new THREE.Vector3(2, .5, .5), new THREE.Vector3(.5, 2, .5))), true);
const westBenchWall = surfaces.filter(s => s.id.startsWith("hall-bench-west")).flatMap(bench => surfaces
  .filter(wall => wall.id.startsWith("outer-west-0") && bench.bounds.intersectsBox(wall.bounds) && wall.triangles.some(triangle => inside(bench.bounds).intersectsTriangle(triangle)))
  .map(wall => ({ bench: bench.id, wall: wall.id, benchBounds: [bench.bounds.min.toArray(), bench.bounds.max.toArray()] })));
console.log(JSON.stringify({ basis: westFlush ? "in-memory west-flush candidate; no production mutation" : candidate ? "in-memory west-six candidate; no production mutation" : endCandidate ? "in-memory four-plus-two candidate; end-seat support is not yet modeled" : "current source", sourceInputs, alternateRecipe: flushResult ? { basis: flushResult.basis, candidate: flushResult.candidate } : null,
  candidateParameters: candidate ? { westBenchShift: -0.06, benchSeatLowering: .02, tableLegSquare: .10, tableEndRowsOut: .08, tableStretchersRaise: .40, lampRaise: .35 } : endCandidate ? { tableLegSquare: .10, tableEndRowsOut: .08, tableStretchersRaise: .425, apronHeight: .11, lampRaise: .35, endSeatFurniture: "not modeled" } : null,
  seats, seatHeight, finishFloor: .456, windowFraction, contacts, simultaneous, westBenchWall,
  limits: "Finite stationary box/surface intersections. A box wholly enclosed in a solid may lack a surface crossing. Bench-wall checks use each bench part's union box, so require actual triangle-pair adjudication. No sitting transition, sequential access, support, strength, or whole-room verdict.",
}, null, 2));
