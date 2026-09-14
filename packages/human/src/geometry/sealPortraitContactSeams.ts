import type { IControlMesh } from "./subdivideControlMesh";

/**
 * Close explicitly requested, geometrically coincident free rims after their
 * common refinement. Only vertices on the selected boundary components weld,
 * and only exactly equal coordinates identify contact. A reversed duplicate
 * face pair at a commissure is the two sides of its collapsed fold and is
 * removed together. Same-oriented duplicate faces are not valid closure.
 *
 * Original positions and vertex identities remain available to anatomical
 * finishers; resident triangles use the welded representative. Unselected open
 * eyes, the neck crop, ordinary nearby surfaces and their topology stay intact.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Turns fully closed oral or eyelid contact into one shared skin seam.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Preserves one resident surface at explicit closed tissue contact instead of emitting opposing duplicate faces.
 */
export function sealPortraitContactSeams(
  mesh: IControlMesh,
  seeds: readonly number[],
): IControlMesh {
  if (seeds.length === 0) return mesh;
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < mesh.indices.length; i += 3)
    for (let corner = 0; corner < 3; corner++) {
      const a = mesh.indices[i + corner],
        b = mesh.indices[i + ((corner + 1) % 3)];
      const key = a < b ? `${a}/${b}` : `${b}/${a}`;
      const old = edges.get(key);
      if (old === undefined) edges.set(key, { a, b, count: 1 });
      else old.count++;
    }
  const neighbours = new Map<number, number[]>();
  for (const { a, b, count } of edges.values())
    if (count === 1) {
      neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
      neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
    }
  const selected = new Set<number>();
  const representatives = new Map<number, number>();
  for (const seed of seeds) {
    if (!Number.isInteger(seed) || !neighbours.has(seed))
      throw new Error("A contact seam must start on a resident free boundary.");
    if (selected.has(seed)) continue;
    const queue = [seed];
    selected.add(seed);
    for (let i = 0; i < queue.length; i++) {
      const adjacent = neighbours.get(queue[i])!;
      if (adjacent.length !== 2)
        throw new Error(
          "A contact seam needs a simple closed boundary population.",
        );
      for (const id of adjacent)
        if (!selected.has(id)) {
          selected.add(id);
          queue.push(id);
        }
    }
    const coordinates = new Map<string, number>();
    let merged = false;
    for (const id of queue) {
      const point = mesh.positions[id];
      if (point.length !== 3 || !point.every(Number.isFinite))
        throw new Error("Contact seam coordinates must be finite XYZ.");
      const key = point.join("/");
      const previous = coordinates.get(key);
      if (previous === undefined) coordinates.set(key, id);
      else {
        representatives.set(id, previous);
        merged = true;
      }
    }
    if (!merged)
      throw new Error(
        "An explicit closed contact needs coincident boundary vertices.",
      );
  }
  const triangles: (number[] | null)[] = [];
  const groups: number[] = [];
  const occupied = new Map<
    string,
    { triangle: number; oriented: string; group: number }
  >();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const source = mesh.indices.slice(i, i + 3);
    const ids = source.map((id) => representatives.get(id) ?? id);
    if (new Set(ids).size < 3) continue;
    const changed = source.some((id) => selected.has(id));
    if (changed) {
      const key = [...ids].sort((a, b) => a - b).join("/");
      const at = ids.indexOf(Math.min(...ids));
      const oriented = [ids[at], ids[(at + 1) % 3], ids[(at + 2) % 3]].join(
        "/",
      );
      const previous = occupied.get(key);
      if (previous !== undefined) {
        if (
          previous.oriented === oriented ||
          previous.group !== mesh.groups[i / 3] ||
          triangles[previous.triangle] === null
        )
          throw new Error(
            "A closed contact cannot merge duplicate orientation, conflicting materials or repeated folds.",
          );
        triangles[previous.triangle] = null;
        continue;
      }
      occupied.set(key, {
        triangle: triangles.length,
        oriented,
        group: mesh.groups[i / 3],
      });
    }
    triangles.push(ids);
    groups.push(mesh.groups[i / 3]);
  }
  const output: IControlMesh = {
    positions: mesh.positions,
    indices: [],
    groups: [],
  };
  triangles.forEach((triangle, i) => {
    if (triangle !== null) {
      output.indices.push(...triangle);
      output.groups.push(groups[i]);
    }
  });
  // A declaration of closure is stronger than finding at least one pair.
  // Every surviving selected edge must now have two opposite incident faces.
  const contacts = new Map<string, { count: number; direction: number }>();
  const closed = new Set(
    [...selected].map((id) => representatives.get(id) ?? id),
  );
  for (let i = 0; i < output.indices.length; i += 3)
    for (let corner = 0; corner < 3; corner++) {
      const a = output.indices[i + corner],
        b = output.indices[i + ((corner + 1) % 3)];
      if (!closed.has(a) || !closed.has(b)) continue;
      const key = a < b ? `${a}/${b}` : `${b}/${a}`;
      const old = contacts.get(key) ?? { count: 0, direction: 0 };
      contacts.set(key, {
        count: old.count + 1,
        direction: old.direction + (a < b ? 1 : -1),
      });
    }
  if (
    [...contacts.values()].some(
      (edge) => edge.count !== 2 || edge.direction !== 0,
    )
  )
    throw new Error(
      "The requested contact leaves an open or inconsistently oriented seam.",
    );
  return output;
}
