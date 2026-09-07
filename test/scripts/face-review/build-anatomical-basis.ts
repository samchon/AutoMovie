import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { gunzipSync } from "node:zlib";

/**
 * Freeze only the head/upper-neck portion of the pinned CC0 MakeHuman asset and
 * the selected CC0 shape deltas. No MPFB program code or body surface below the
 * crop is copied. Runtime construction consumes the resulting resident JSON;
 * this offline generator alone requires the reference checkout.
 *
 * Source OBJ faces retain their original order for the published lip UV-region
 * membership. Eye joint means travel with the same morphs as the skin. Keeping
 * these attachments prevents a phenotype edit from leaving the eyes behind.
 */
async function main(): Promise<void> {
  const repository = ".references/mpfb2",
    commit = "437dd513888a92399d1d3200d2e80859fae55abc";
  if (
    execFileSync("git", ["-C", repository, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim() !== commit
  )
    throw new Error("Anatomical source revision changed.");
  const sourceRoot = repository + "/src/mpfb/data",
    output = "test/src/subjects/reference-anatomy";
  const inputs: { path: string; sha256: string }[] = [];
  const read = async (path: string) => {
    const bytes = await fs.readFile(sourceRoot + "/" + path);
    inputs.push({
      path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    return bytes;
  };
  const source = (await read("3dobjs/base.obj")).toString();
  const membership = JSON.parse(
    (await read("mesh_metadata/basemesh_vertex_groups.json")).toString(),
  );
  const lips = JSON.parse(
    gunzipSync(await read("uv_layers/lips_solid.json.gz")).toString(),
  );
  const positions: number[][] = [],
    faces: { vertices: number[]; group: number }[] = [];
  let group = "",
    ordinal = 0;
  for (const line of source.split(/\r?\n/)) {
    const [kind, ...values] = line.trim().split(/\s+/);
    if (kind === "v") positions.push(values.map(Number));
    if (kind === "g") group = values.join(" ");
    if (kind === "f") {
      const vertices = values.map((v) => Number(v.split("/")[0]) - 1);
      if (group === "body" && vertices.every((i) => positions[i][1] >= 6.2))
        faces.push({ vertices, group: lips[ordinal] === undefined ? 0 : 1 });
      ordinal++;
    }
  }
  const retained = [...new Set(faces.flatMap((f) => f.vertices))].sort(
    (a, b) => a - b,
  );
  const remap = new Map(retained.map((id, i) => [id, i]));
  const indices: number[] = [],
    groups: number[] = [];
  for (const face of faces)
    for (let i = 1; i < face.vertices.length - 1; i++) {
      indices.push(
        remap.get(face.vertices[0])!,
        remap.get(face.vertices[i])!,
        remap.get(face.vertices[i + 1])!,
      );
      groups.push(face.group);
    }
  const eyeIds = ["joint-r-eye", "joint-l-eye"].map((name) =>
    (membership[name] as number[][]).flatMap(([a, b]) =>
      Array.from({ length: b - a + 1 }, (_v, i) => a + i),
    ),
  );
  const mean = (ids: number[], points: readonly number[][]) =>
    [0, 1, 2].map(
      (a) => ids.reduce((sum, i) => sum + points[i][a], 0) / ids.length,
    );
  const morphs: Record<string, { points: number[][]; eyes: number[][] }> = {};
  for (const [name, path] of [
    ["child", "macrodetails/asian-female-child.target.gz"],
    ["young", "macrodetails/asian-female-young.target.gz"],
    ["smile", "expression/units/asian/mouth-corner-puller.target.gz"],
    ["jawOpen", "expression/units/asian/mouth-open.target.gz"],
  ]) {
    const delta = positions.map(() => [0, 0, 0]);
    for (const line of gunzipSync(await read("targets/" + path))
      .toString()
      .split(/\r?\n/)) {
      if (!/^\d/.test(line)) continue;
      const [id, ...values] = line.split(/\s+/).map(Number);
      delta[id] = values;
    }
    morphs[name] = {
      points: retained.flatMap((id, i) =>
        delta[id].some((v) => v !== 0) ? [[i, ...delta[id]]] : [],
      ),
      eyes: eyeIds.map((ids) => mean(ids, delta)),
    };
  }
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(
    output + "/mesh.json",
    JSON.stringify({
      provenance: {
        repository: "https://github.com/makehumancommunity/mpfb2",
        commit,
        license: "CC0-1.0",
        sourceUnit: "MakeHuman OBJ unit",
        minimumOriginalY: 6.2,
        inputs,
      },
      positions: retained.map((i) => positions[i]),
      indices,
      groups,
      eyes: eyeIds.map((ids) => mean(ids, positions)),
      morphs,
    }),
  );
  await fs.copyFile(
    repository + "/LICENSE.ASSETS.md",
    output + "/LICENSE.CC0.md",
  );
  console.log(
    "Frozen anatomical head",
    retained.length,
    "vertices",
    indices.length / 3,
    "triangles",
    Object.keys(morphs),
  );
}
void main();
