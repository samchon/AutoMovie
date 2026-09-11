import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createManorScene } from "../src/models/manor.js";
import { applyManorStairCandidate } from "./manorStairCandidate.mjs";

// These flat-floor routes stop in front of the first riser. They do not model
// the subsequent foot lift or prove the body can traverse the entire stair.
const source = createManorScene({ shadows: false });
const candidate = process.argv.includes("--candidate-notched-supports");
const stairDigest = () => createHash("sha256").update(JSON.stringify(source.entries.find(entry => entry.id === "central-stair").model)).digest("hex");
const originalStairDigest = stairDigest();
if (candidate) applyManorStairCandidate(source);
const door = source.entries.find(entry => entry.id === "entrance-door-leaf");
assert.ok(door?.pose);
const routes = [
  { id: "gallery-to-interior-parking", points: [[0.85, -0.60], [0.85, -1.95], [1.85, -2.05]] },
  { id: "interior-parking-to-first-riser", points: [[1.85, -2.05], [0.85, -1.825], [-0.66, -1.825]] },
];
const clip = (polygon, y, sign) => polygon.flatMap((a, i) => {
  const b = polygon[(i + 1) % polygon.length], da = sign * (a[1] - y), db = sign * (b[1] - y);
  const out = da >= 0 ? [a] : [];
  if ((da >= 0) !== (db >= 0)) out.push(a.map((v, k) => v + (b[k] - v) * da / (da - db)));
  return out;
});
const pointSegment = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const segmentDistance = (a, b, c, d) => {
  const cross = (u, v) => u[0] * v[1] - u[1] * v[0];
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], q = [c[0] - a[0], c[1] - a[1]], den = cross(r, s);
  if (Math.abs(den) > 1e-15) { const t = cross(q, s) / den, u = cross(q, r) / den; if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0; }
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
};
const pointPolygon = (point, polygon) => {
  let inside = false, distance = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    distance = Math.min(distance, pointSegment(point, a, b));
  }
  return inside ? 0 : distance;
};
assert.equal(segmentDistance([0, 0], [2, 0], [1, -1], [1, 1]), 0);
assert.equal(segmentDistance([0, 0], [1, 0], [0, 2], [1, 2]), 2);
assert.equal(pointPolygon([0.2, 0.2], [[0, 0], [1, 0], [0, 1]]), 0);
const results = [];
for (const fraction of [1, 0]) {
  const leaf = source.objects.get(door.id);
  leaf.position.set(...door.pose.pivot);
  leaf.rotation.y = door.pose.closedAngle + fraction * (door.pose.angle - door.pose.closedAngle);
  source.scene.updateMatrixWorld(true);
  const polygons = [];
  source.scene.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry, position = geometry.attributes.position, index = geometry.index;
    const count = index?.count ?? position.count;
    for (let i = 0; i < count; i += 3) {
      const triangle = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(object.matrixWorld).toArray());
      if (Math.max(...triangle.map(p => p[0])) < -1.5 || Math.min(...triangle.map(p => p[0])) > 2 || Math.max(...triangle.map(p => p[2])) < -3 || Math.min(...triangle.map(p => p[2])) > 0) continue;
      const clipped = clip(clip(triangle, 0.46, 1), 2.30, -1);
      if (clipped.length) polygons.push({ part: object.name, polygon: clipped.map(p => [p[0], p[2]]) });
    }
  });
  for (const route of routes) {
    let minimum = Infinity, nearest = null; const contacts = new Set();
    for (let i = 0; i < route.points.length - 1; i++) for (const item of polygons) {
      const a = route.points[i], b = route.points[i + 1];
      let distance = Math.min(pointPolygon(a, item.polygon), pointPolygon(b, item.polygon));
      for (let j = 0; j < item.polygon.length; j++) distance = Math.min(distance, segmentDistance(a, b, item.polygon[j], item.polygon[(j + 1) % item.polygon.length]));
      if (distance < minimum) { minimum = distance; nearest = { part: item.part, segment: i }; }
      if (distance < 0.325 - 1e-7) contacts.add(item.part);
    }
    results.push({ fraction, ...route, triangles: polygons.length, minimumCenterDistance: minimum, nearest, contactedParts: [...contacts].sort() });
  }
}
// A complete circular bound encloses every point of this rigid leaf throughout
// its quarter turn. Being outside it proves no leaf/body overlap at this one
// parking point; it does not make the latch reachable from that point.
let leafRadius = 0;
source.objects.get(door.id).traverse(object => {
  if (!object.isMesh) return;
  const attribute = object.geometry.attributes.position;
  for (let i = 0; i < attribute.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(attribute, i).applyMatrix4(object.matrixWorld);
    leafRadius = Math.max(leafRadius, Math.hypot(point.x - door.pose.pivot[0], point.z - door.pose.pivot[2]));
  }
});
const parkingPivotDistance = Math.hypot(1.85 - door.pose.pivot[0], -2.05 - door.pose.pivot[2]);
console.log(JSON.stringify({
  basis: candidate ? "in-memory stair candidate" : "current production geometry", originalStairDigest, measuredStairDigest: stairDigest(),
  sourceInputs: Object.fromEntries(["src/models/manor.js", "src/models/manor-craft.js", "src/models/manor-garden.js", "src/materials/manor.js", "scripts/measureManorEntranceRoutes.mjs", "scripts/manorStairCandidate.mjs"].map(path => [path, createHash("sha256").update(readFileSync(path)).digest("hex")])),
  body: { diameter: 0.65, height: 1.85, floor: 0.45, floorContactSlack: 0.01 }, results,
  parkedBodyVersusCompleteLeafSweep: { parking: [1.85, -2.05], leafRadius, parkingPivotDistance, separatingGap: parkingPivotDistance - 0.325 - leafRadius },
  limits: "Exact segment-to-clipped-triangle projection for the declared fixed-door, flat-floor body slab. Contact rejects only that route and state. Does not prove no alternate route exists, floor support, door actuation, handle reach, loaded transit, or the first-riser transition.",
}, null, 2));
