import { Vector3 } from "@automovie/engine";

/**
 * Regularize one ordered nasal rim in its own fitted plane. Zero copies the
 * measured boundary; one uses an ellipse whose principal axes and extents come
 * from that boundary. Perimeter progress preserves cyclic vertex ownership,
 * and recentering preserves the original centroid before blending.
 * The operation is independent of head orientation and does not choose a new
 * nasal opening or alter its connectivity. All distances remain millimetres.
 */
export function fitPortraitNostrilRim(
  points: number[][],
  amount: number,
): number[][] {
  if (
    points.length < 3 ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 1 ||
    points.some((point) => point.length !== 3 || !point.every(Number.isFinite))
  )
    throw new Error(
      "Nasal rim fitting needs finite three-dimensional points and a blend in [0,1].",
    );
  if (amount === 0) return points.map((point) => [...point]);
  // Normalize before covariance and area calculations so their products cannot
  // overflow merely because the same geometric loop uses a larger unit scale.
  const scale = Math.max(...points.flat().map(Math.abs)) || 1;
  const normalized = points.map((point) => point.map((value) => value / scale));
  const center = [0, 1, 2].map(
    (axis) =>
      normalized.reduce((sum, point) => sum + point[axis], 0) / points.length,
  );
  const local = normalized.map((point) =>
    Vector3.create(
      point[0] - center[0],
      point[1] - center[1],
      point[2] - center[2],
    ),
  );
  let normal = Vector3.create(0, 0, 0),
    chord = Vector3.create(0, 0, 0),
    longest = 0;
  for (let i = 0; i < local.length; i++) {
    normal = Vector3.add(
      normal,
      Vector3.cross(local[i], local[(i + 1) % local.length]),
    );
  }
  normal = Vector3.normalize(normal);
  if (Vector3.length(normal) === 0)
    throw new Error("A nasal rim needs a nonzero oriented area.");
  for (let i = 0; i < local.length; i++)
    for (let j = i + 1; j < local.length; j++) {
      const delta = Vector3.subtract(local[j], local[i]);
      const planar = Vector3.subtract(
        delta,
        Vector3.scale(normal, Vector3.dot(delta, normal)),
      );
      const length = Vector3.length(planar);
      if (length > longest) {
        chord = planar;
        longest = length;
      }
    }
  const u = Vector3.normalize(chord);
  const v = Vector3.cross(normal, u);
  const projected = local.map((point) => [
    Vector3.dot(point, u),
    Vector3.dot(point, v),
  ]);
  let xx = 0,
    xy = 0,
    yy = 0;
  for (const [x, y] of projected) {
    xx += x * x;
    xy += x * y;
    yy += y * y;
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy),
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const principal = projected.map(([x, y]) => [
    x * cos + y * sin,
    -x * sin + y * cos,
  ]);
  const radiusX = Math.max(...principal.map((point) => Math.abs(point[0])));
  const radiusY = Math.max(...principal.map((point) => Math.abs(point[1])));
  const distances = [0];
  for (let i = 0; i < principal.length; i++) {
    const a = principal[i],
      b = principal[(i + 1) % principal.length];
    distances.push(distances[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const phase = Math.atan2(
    principal[0][1] / radiusY,
    principal[0][0] / radiusX,
  );
  const major = Vector3.add(Vector3.scale(u, cos), Vector3.scale(v, sin));
  const minor = Vector3.add(Vector3.scale(u, -sin), Vector3.scale(v, cos));
  const ellipse = points.map((_point, i) => {
    const t =
      phase + (2 * Math.PI * distances[i]) / distances[distances.length - 1];
    const point = Vector3.add(
      Vector3.scale(major, radiusX * Math.cos(t)),
      Vector3.scale(minor, radiusY * Math.sin(t)),
    );
    return [point.x, point.y, point.z];
  });
  const drift = [0, 1, 2].map(
    (axis) =>
      ellipse.reduce((sum, point) => sum + point[axis], 0) / ellipse.length,
  );
  const output = normalized.map((point, i) =>
    point.map(
      (value, axis) =>
        (value * (1 - amount) +
          amount * (center[axis] + ellipse[i][axis] - drift[axis])) *
        scale,
    ),
  );
  if (output.some((point) => !point.every(Number.isFinite)))
    throw new Error(
      "The fitted nasal rim exceeds its representable coordinate range.",
    );
  return output;
}
