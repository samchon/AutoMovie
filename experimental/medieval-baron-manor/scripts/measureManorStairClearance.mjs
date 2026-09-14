import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { applyManorStairCandidate } from "./manorStairCandidate.mjs";
import { createManorScene } from "../src/models/manor.js";

// A source diagnostic. The optional candidate exists only in this process;
// neither the production source nor a derived artifact is rewritten.
const candidate = process.argv.includes("--candidate-notched-supports");
const source = createManorScene({ shadows: false });
const stair = source.entries.find(entry => entry.id === "central-stair");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceInputs = Object.fromEntries([
  "src/models/manor.js", "src/models/manor-craft.js", "src/models/manor-garden.js",
  "src/materials/manor.js", "scripts/measureManorStairClearance.mjs", "scripts/manorStairCandidate.mjs",
].map(path => [path, digest(readFileSync(path))]));
const originalStairDigest = digest(JSON.stringify(stair.model));
if (candidate) applyManorStairCandidate(source);
source.scene.updateMatrixWorld(true);
const meshes = [];
source.scene.traverse(object => { if (object.isMesh) meshes.push(object); });
const cast = (point, direction, distance = 10, selected = meshes) => new THREE.Raycaster(new THREE.Vector3(...point), new THREE.Vector3(...direction), 0, distance).intersectObjects(selected, false)[0];
const widths = [], headroom = [], support = [];
for (const flight of ["lower", "upper"]) for (let i = 0; i < 7; i++) {
  const lower = flight === "lower";
  const y = 0.45 + 0.18 * (lower ? i + 1 : i + 9);
  const center = lower ? [-0.66, y, -2.30 - i * 0.26] : [-0.04 + 0.26 * (i + 0.5) + (i === 6 ? 0.01 : 0), y, -4.61];
  // Five longitudinal stations include the trailing edges where a straight
  // inclined stringer rises above the flat tread. Three body heights include
  // the handrail, which must not be omitted from usable-width measurement.
  for (const shift of [-0.125, -0.11, 0, 0.11, 0.125]) for (const height of [0.03, 0.45, 0.92]) {
    const point = [...center]; point[lower ? 2 : 0] += shift; point[1] += height;
    const axis = lower ? [1, 0, 0] : [0, 0, 1];
    const left = cast(point, axis.map(value => -value), 3), right = cast(point, axis, 3);
    widths.push({ flight, i, shift, height,
      obstructionSpan: left && right ? left.distance + right.distance : null,
      spanLowerBound: (left?.distance ?? 3) + (right?.distance ?? 3),
      leftDistance: left?.distance ?? null, rightDistance: right?.distance ?? null,
      left: left?.object.name, right: right?.object.name });
  }
  for (const cross of [-0.55, 0, 0.55]) for (const shift of [-0.125, 0, 0.125]) {
    const point = [...center]; point[lower ? 0 : 2] += cross; point[lower ? 2 : 0] += shift; point[1] += 0.0001;
    const hit = cast(point, [0, 1, 0]);
    headroom.push({ flight, i, cross, shift, height: hit ? hit.distance + 0.0001 : null, heightLowerBound: (hit?.distance ?? 10) + 0.0001, part: hit?.object.name });
  }
  const stringers = meshes.filter(mesh => mesh.name.startsWith(flight + "-stringer-"));
  for (const side of lower ? [-1.20, -0.12] : [-5.15, -4.07]) for (const shift of [-0.11, 0, 0.11]) {
    const point = [...center]; point[lower ? 0 : 2] = side; point[lower ? 2 : 0] += shift; point[1] -= 0.07 - 0.001;
    const hit = cast(point, [0, -1, 0], 1, stringers);
    support.push({ flight, i, side, shift, gap: hit ? hit.distance - 0.001 : null, part: hit?.object.name });
  }
}
assert.equal(widths.length, 210); assert.equal(headroom.length, 126); assert.equal(support.length, 84);
const measuredWidths = widths.filter(row => row.obstructionSpan !== null);
const measuredHeights = headroom.filter(row => row.height !== null);
console.log(JSON.stringify({
  basis: candidate ? "in-memory notched-support candidate; production bytes unchanged" : "current production source geometry",
  sourceInputs, originalStairDigest, measuredStairDigest: digest(JSON.stringify(stair.model)),
  widths: { count: widths.length, measuredCount: measuredWidths.length,
    minimumMeasuredObstructionSpan: measuredWidths.length ? Math.min(...measuredWidths.map(row => row.obstructionSpan)) : null,
    below110: measuredWidths.filter(row => row.obstructionSpan < 1.10 - 1e-6),
    rangeLimited: widths.filter(row => row.obstructionSpan === null) },
  headroom: { count: headroom.length, measuredCount: measuredHeights.length,
    minimumMeasuredHeight: measuredHeights.length ? Math.min(...measuredHeights.map(row => row.height)) : null,
    below205: measuredHeights.filter(row => row.height < 2.05 - 1e-6),
    rangeLimited: headroom.filter(row => row.height === null) },
  treadSupport: { count: support.length, missingOrGap: support.filter(row => row.gap === null || Math.abs(row.gap) > 1e-6) },
  limits: "Finite section/ray diagnostic. A range-limited ray states only a lower bound, not a measured boundary. Obstruction span is not usable width without continuous tread support. Does not prove continuous body sweep, riser transitions, landing approach, structural strength, joints, or door operation.",
}, null, 2));
