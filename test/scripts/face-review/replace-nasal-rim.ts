import type { IAutoMovieMesh, IAutoMovieModel } from "@automovie/interface";
import { NodeIO } from "@gltf-transform/core";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { portraitAssembly } from "../../src/subjects/generated-korean-girl-01/configuration";
import { buildReferencePortrait } from "../../src/subjects/generated-korean-girl-01/model";
import {
  portraitDocument,
  portraitGltfExtensions,
} from "../../src/subjects/portraitDocument";
import { replacePortraitRimAttachment } from "../../src/subjects/replacePortraitRim";

/**
 * One frozen-input falsifier: replace only anatomical-left final aperture/lining
 * on the rejected body, with a 3 mm skin collar and unchanged right-hand control.
 * This command exports diagnostic models; it does not select an active preset,
 * render images, publish a preview, or accept the resulting anatomical shape.
 */
async function main(): Promise<void> {
  const root = ".shots/face-experiment";
  const output = path.join(root, "nasal-rim-falsifier-inputs");
  const io = new NodeIO().registerExtensions(portraitGltfExtensions);
  const digest = (bytes: string | Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex");
  const meshOf = (model: IAutoMovieModel, id: string): IAutoMovieMesh => {
    const part = model.parts.find((entry) => entry.id === id)!;
    assert(part.geometry.type === "mesh" && part.transform === null);
    return part.geometry.mesh;
  };
  const current = buildReferencePortrait(portraitAssembly);
  const read = async (directory: string, expected: string) => {
    const bytes = await fs.readFile(path.join(directory, "portrait.glb"));
    const modelBytes = await fs.readFile(path.join(directory, "model.json"));
    const profile = await fs.readFile(
      path.join(directory, "capture-profile.json"),
    );
    const configurationBytes = await fs.readFile(
      path.join(directory, "configuration.json"),
    );
    const receipt = JSON.parse(
      await fs.readFile(path.join(directory, "artifact-basis.json"), "utf8"),
    );
    assert.equal(digest(bytes), expected);
    assert.equal(digest(bytes), receipt.gltf);
    assert.equal(digest(modelBytes), receipt.model);
    assert.equal(digest(profile), receipt.profile);
    assert.equal(digest(configurationBytes), receipt.configuration);
    const model: IAutoMovieModel = JSON.parse(modelBytes.toString("utf8"));
    // The strict export now requires unit normals at redundant spherical poles.
    // Regenerate the same analytic sclera component for both archive conditions;
    // identical positions/indices prove this is a normal correction only.
    for (const id of ["right-sclera", "left-sclera"]) {
      const before = meshOf(model, id),
        fresh = meshOf(current, id);
      assert.deepEqual(before.positions, fresh.positions);
      assert.deepEqual(before.indices, fresh.indices);
      before.normals = [...fresh.normals!];
    }
    const document = await io.readBinary(bytes);
    for (const node of document.getRoot().listNodes())
      assert.deepEqual(
        node.getMatrix(),
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      );
    // Skin's first member is the named head. Material export retains its prefix.
    assert.equal(
      model.parts.find((part) => part.material === "skin")!.id,
      "head",
    );
    for (const [id, material] of [
      ["head", "skin"],
      ["nostril-interiors", "nasal-interior"],
    ]) {
      const mesh = meshOf(model, id);
      const primitive = document
        .getRoot()
        .listMeshes()
        .find((item) => item.getName() === material)!
        .listPrimitives()[0];
      const actual = Array.from(
        primitive.getAttribute("POSITION")!.getArray()!,
      );
      assert.deepEqual(
        actual.slice(0, mesh.positions.length),
        mesh.positions.map(Math.fround),
      );
      assert.deepEqual(
        Array.from(primitive.getIndices()!.getArray()!).slice(
          0,
          mesh.indices!.length,
        ),
        mesh.indices,
      );
    }
    return {
      model,
      profile,
      configuration: JSON.parse(configurationBytes.toString("utf8")),
      receipt,
    };
  };
  const baseline = await read(
    path.join(root, "nasal-frame-analysis/baseline"),
    "af101029de3dfb4ac98c72ed8e3fe2a3c282f33236a1577465b743a633cb8ba2",
  );
  const failed = await read(
    path.join(root, "nasal-section-rejected"),
    "38a72f4b7f86ed5cc8d6b22b124db6241aa36963d4cd1cab436bb6325c1c928e",
  );
  assert.deepEqual(baseline.profile, failed.profile);
  assert.deepEqual(baseline.model.materials, failed.model.materials);
  const candidate = structuredClone(failed.model);
  const pair = (model: IAutoMovieModel) => ({
    skin: meshOf(model, "head"),
    lining: meshOf(model, "nostril-interiors"),
  });
  const replaced = replacePortraitRimAttachment(
    pair(failed.model),
    pair(baseline.model),
    1,
    3,
  );
  assert.equal(replaced.rim.length, 72);
  Object.assign(meshOf(candidate, "head"), replaced.skin);
  Object.assign(meshOf(candidate, "nostril-interiors"), replaced.lining);
  const moved = new Set(replaced.changedPositions);
  const collar = new Set([...replaced.rim, ...replaced.collar]);
  const summary = {
    source: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    baseline: baseline.receipt,
    failed: failed.receipt,
    operation:
      "Only +X final rim/lining replaced; 3 mm final-skin geodesic collar; no subsequent subdivision",
    pairedNormalUpdate:
      "Current analytic sclera NORMAL in both archives, with exactly unchanged POSITION/indices",
    rimVertices: replaced.rim.length,
    freeCollarVertices: replaced.collar.length,
    changedPositions: replaced.changedPositions.length,
    affectedNormalVertices: replaced.affectedNormals.length,
    unchangedPositionNormalVertices: replaced.affectedNormals.filter(
      (id) => !moved.has(id),
    ).length,
    outsideCollarHeadNormalVertices: replaced.affectedNormals.filter(
      (id) => id < replaced.skin.positions.length / 3 && !collar.has(id),
    ).length,
  };
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(
    path.join(output, "measurement.json"),
    JSON.stringify(summary, null, 2),
  );
  for (const [name, model, archive] of [
    ["baseline", baseline.model, baseline],
    ["failed", failed.model, failed],
    ["candidate", candidate, failed],
  ] as const) {
    const directory = path.join(output, name);
    await fs.mkdir(directory, { recursive: true });
    const document = portraitDocument(model);
    await io.write(path.join(directory, "portrait.glb"), document);
    await io.write(path.join(directory, "portrait.gltf"), document);
    const modelBytes = JSON.stringify(model);
    const configuration = JSON.stringify(
      {
        ...archive.configuration,
        finalRimExperiment: { ...summary, condition: name },
      },
      null,
      2,
    );
    await fs.writeFile(path.join(directory, "model.json"), modelBytes);
    await fs.writeFile(
      path.join(directory, "capture-profile.json"),
      archive.profile,
    );
    await fs.writeFile(
      path.join(directory, "configuration.json"),
      configuration,
    );
    await fs.writeFile(
      path.join(directory, "artifact-basis.json"),
      JSON.stringify(
        {
          input: archive.receipt.input,
          model: digest(modelBytes),
          gltf: digest(await fs.readFile(path.join(directory, "portrait.glb"))),
          profile: digest(archive.profile),
          configuration: digest(configuration),
        },
        null,
        2,
      ),
    );
  }
  console.log(JSON.stringify(summary, null, 2));
}

void main();
