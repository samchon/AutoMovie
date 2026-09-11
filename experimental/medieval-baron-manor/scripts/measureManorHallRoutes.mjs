import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tessellateToMesh, transformAutoMovieMesh } from "@automovie/engine";
import { createManorScene } from "../src/models/manor.js";

// Source-state diagnostic, independent of a camera or a visibility filter.
// Each triangle is clipped to the standing body's vertical slab, projected to
// XZ, and compared with the complete route segments. No wall or furniture union
// box is filled in. Floor support and door travel remain separate questions.
const inventoryBytes = readFileSync("automovie/derived/manor/instances-v23-critical.json");
const inventory = JSON.parse(inventoryBytes);
for (const [file, digest] of Object.entries(inventory.inputs))
  assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), digest, "Stale source transforms: " + file);
const source = createManorScene({ geometryOnly: true });
const body = { diameter: 0.65, floor: 0.45, height: 1.85, floorContactSlack: 0.01 };
const kitchen = process.argv.includes('--kitchen');
const routes = kitchen ? [
  { id: "kitchen-water-transport", diameter: .80, points: [[-3.90, -.50], [-3.90, -2.60], [-4.20, -3.875], [-5.80, -3.875]] },
  { id: "kitchen-working-depth", diameter: .90, points: [[-6.50, -3.875], [-4.90, -3.875]] },
] : [
  { id: "gallery-to-hall-south-seat-end", points: [[-3.85, 0.5], [-3.85, 3.85], [-6.10, 3.85], [-6.10, 4.65], [-7.00, 4.65]] },
  { id: "hall-south-to-west-bench-end", points: [[-7.00, 4.65], [-7.00, 3.85]] },
  { id: "gallery-to-east-bench-end", points: [[-3.85, 3.85], [-5.98, 3.85]] },
  { id: "hall-east-aisle-to-north-bench-end", points: [[-5.30, 3.85], [-5.30, 0.85], [-7.00, 0.85]] },
  { id: "hall-chest-front-approach", points: [[-6.10, 4.65], [-6.72, 4.65]] },
  { id: "hall-east-daily-aisle", diameter: 1.10, points: [[-5.302, 0.85], [-5.302, 3.68]] },
  { id: "hall-south-furniture-return", diameter: 0.75, points: [[-5.302, 3.0], [-5.302, 3.75], [-6.10, 3.85], [-6.10, 4.60], [-6.85, 4.60], [-6.85, 3.90]] },
  { id: "hall-chest-working-approach", diameter: 0.75, points: [[-6.10, 4.60], [-6.72, 4.60]] },
];
const clip = (polygon, y, sign) => {
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = sign * (a[1] - y), db = sign * (b[1] - y);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push(a.map((value, axis) => value + (b[axis] - value) * t));
    }
  }
  return out;
};
const distanceToSegment = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const distanceToPolygon = (p, polygon) => {
  let inside = false, minimum = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    minimum = Math.min(minimum, distanceToSegment(p, a, b));
  }
  return inside ? 0 : minimum;
};
const segmentDistance = (a, b, c, d) => {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], q = [c[0] - a[0], c[1] - a[1]];
  const cross = (u, v) => u[0] * v[1] - u[1] * v[0], den = cross(r, s);
  if (Math.abs(den) > 1e-15) {
    const t = cross(q, s) / den, u = cross(q, r) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(distanceToSegment(a, c, d), distanceToSegment(b, c, d), distanceToSegment(c, a, b), distanceToSegment(d, a, b));
};
// Analytic sentinels protect the collision instrument, including a crossing
// between samples and a vertically clipped triangle outside the body slab.
assert.equal(segmentDistance([0, 0], [2, 0], [1, -1], [1, 1]), 0);
assert.equal(segmentDistance([0, 0], [1, 0], [0, 2], [1, 2]), 2);
assert.equal(distanceToPolygon([0.2, 0.2], [[0, 0], [1, 0], [0, 1]]), 0);
assert.equal(clip([[0, 0, 0], [1, 0, 0], [0, 0, 1]], 1, 1).length, 0);
const polygons = [];
for (const entry of source.entries) for (const part of entry.model.parts) {
  const geometry = part.geometry.type === "primitive" ? tessellateToMesh(part.geometry.shape) : part.geometry.mesh;
  const mesh = transformAutoMovieMesh(transformAutoMovieMesh(geometry, part.transform), inventory.transforms[entry.id]);
  const indices = mesh.indices ?? Array.from({ length: mesh.positions.length / 3 }, (_, i) => i);
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3).map(index => mesh.positions.slice(index * 3, index * 3 + 3));
    // Only spatial culling; every source owner and every modeled part can enter.
    if (Math.max(...triangle.map(p => p[0])) < -7.4 || Math.min(...triangle.map(p => p[0])) > (kitchen ? -3.3 : -3.5) || Math.max(...triangle.map(p => p[2])) < (kitchen ? -5.5 : 0) || Math.min(...triangle.map(p => p[2])) > (kitchen ? 0 : 5.6)) continue;
    const clipped = clip(clip(triangle, body.floor + body.floorContactSlack, 1), body.floor + body.height, -1);
    if (clipped.length) polygons.push({ element: entry.id, part: part.id, polygon: clipped.map(p => [p[0], p[2]]) });
  }
}
const findings = routes.map(route => {
  let minimum = Infinity, nearest = null;
  const collisions = new Set();
  for (let i = 0; i < route.points.length - 1; i++) {
    const a = route.points[i], b = route.points[i + 1];
    for (const item of polygons) {
      let distance = Math.min(distanceToPolygon(a, item.polygon), distanceToPolygon(b, item.polygon));
      for (let j = 0; j < item.polygon.length; j++)
        distance = Math.min(distance, segmentDistance(a, b, item.polygon[j], item.polygon[(j + 1) % item.polygon.length]));
      if (distance < minimum) { minimum = distance; nearest = { element: item.element, part: item.part, segment: i }; }
      if (distance < (route.diameter ?? body.diameter) / 2) collisions.add(item.element);
    }
  }
  return { ...route, minimumDistanceFromCenterline: minimum, nearest, collisions: [...collisions].sort() };
});
console.log(JSON.stringify({
  basis: "current source triangles in inventory default transforms; source diagnostic, not official review",
  inventoryDigest: createHash("sha256").update(inventoryBytes).digest("hex"),
  sourceInputs: inventory.inputs, body, clippedTriangles: polygons.length, findings,
  limits: "Checks obstruction for the stated stationary-open-door route only. Does not prove floor support, safe door actuation with an occupant, seated-body access, all alternate paths, or whole-house compliance.",
}, null, 2));
if (findings.some(finding => finding.collisions.length)) process.exitCode = 1;
