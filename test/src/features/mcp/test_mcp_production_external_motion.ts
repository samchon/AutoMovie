import {
  IAutoMovieAssetManifest,
  IAutoMovieCompiledShotSource,
  IAutoMovieExternalMotionBasis,
  IAutoMovieExternalMotionConversionReceipt,
  IAutoMovieGeneratedManifest,
  IAutoMovieProductionDesign,
  IAutoMovieSkeleton,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
  rewriteSource,
} from "./productionFixtures";

/**
 * Compile one byte-pinned external take through explicit native adoption.
 *
 * Scenarios:
 *
 * 1. The compiler verifies the manifest take inventory and external buffer
 *    closure, lowers the selected node tracks, and injects only the declared
 *    clip into the named shot actor's performance.
 * 2. The compiler inventories a canonical receipt that pins source closure,
 *    byte-inspected basis, authored decision, target basis, transform ledger,
 *    converted motion digest, and exact generated shot bytes.
 * 3. Recompiling unchanged bytes produces the same shot and receipt bytes, while
 *    choosing retarget mode changes the receipt and records its scale.
 * 4. Native use refuses same-id target rigs whose mapped hierarchy or local rest
 *    basis differs from the inspected source.
 * 5. Unused, cross-actor, colliding, missing, or stale adoptions fail closed
 *    instead of being inferred or silently dropped.
 */
export const test_mcp_production_external_motion = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const motion = externalMotionFixture();
    const motionPath = "public/motion/imported-cue.gltf";
    const bufferPath = "public/motion/imported-cue.bin";
    writeAsset(fixture.root, motionPath, motion.document);
    writeAsset(fixture.root, bufferPath, motion.payload);

    const assetManifestPath = path.join(fixture.root, ".automovie/assets.json");
    const assetManifest = JSON.parse(
      fs.readFileSync(assetManifestPath, "utf8"),
    ) as IAutoMovieAssetManifest;
    const motionDigest = digestAutoMovieBytes(motion.document);
    const bufferDigest = digestAutoMovieBytes(motion.payload);
    assetManifest.assets.push(
      {
        path: motionPath,
        digest: motionDigest,
        original: {
          url: "https://example.invalid/imported-cue.gltf",
          digest: motionDigest,
        },
        license: {
          identifier: "CC0-1.0",
          url: "https://creativecommons.org/publicdomain/zero/1.0/",
        },
        processing: [],
        uses: [
          {
            production: "fixture-film",
            consumer: { kind: "motion-adoption", id: "opening-cue" },
            reason: "The opening shot explicitly enacts this selected take.",
          },
        ],
        motion: {
          ingestProfile: "gltf-motion-v1",
          basis: externalMotionBasis(),
          takes: [
            {
              id: "clip_0",
              animationIndex: 0,
              sourceName: "Imported Cue",
              durationSeconds: 6,
            },
          ],
        },
      },
      {
        path: bufferPath,
        digest: bufferDigest,
        original: {
          url: "https://example.invalid/imported-cue.bin",
          digest: bufferDigest,
        },
        license: {
          identifier: "CC0-1.0",
          url: "https://creativecommons.org/publicdomain/zero/1.0/",
        },
        processing: [],
        uses: [
          {
            production: "fixture-film",
            consumer: { kind: "motion-resource", id: motionPath },
            reason: "This buffer is the declared closure of the motion glTF.",
          },
        ],
      },
    );
    assetManifest.assets.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
    fs.writeFileSync(
      assetManifestPath,
      `${JSON.stringify(assetManifest, null, 2)}\n`,
    );

    const productionPath = path.join(
      fixture.root,
      ".automovie/design/fixture-film/production.json",
    );
    const production = JSON.parse(
      fs.readFileSync(productionPath, "utf8"),
    ) as IAutoMovieProductionDesign;
    const sourceRig = externalSourceRig();
    production.externalMotions = [
      {
        id: "opening-cue",
        asset: motionPath,
        take: "clip_0",
        shot: "opening",
        actor: "soloist",
        clip: "imported-cue",
        sourceRig,
        mapping: [
          { source: "node_0", target: "hips" },
          { source: "node_2", target: "leftUpperArm" },
        ],
        mode: { kind: "native" },
      },
    ];
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(production, null, 2)}\n`,
    );
    const shotSourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const adoptedShotSource = rewriteSource(
      fs.readFileSync(shotSourcePath, "utf8"),
      "clip: performer.clips![0]!.id,",
      'clip: "imported-cue",',
    );
    fs.writeFileSync(shotSourcePath, adoptedShotSource);

    const first = new AutoMovieProductionCompiler(
      project,
    ).compile({ scope: "source" });
    const compiledPath = path.join(
      fixture.root,
      "generated/fixture-film/shots/opening.json",
    );
    const conversionReceiptPath = path.join(
      fixture.root,
      "generated/fixture-film/receipts/external-motion/opening-cue.json",
    );
    const generatedManifestPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/generated-manifest.json",
    );
    const firstBytes = first.success
      ? fs.readFileSync(compiledPath)
      : Buffer.alloc(0);
    const compiled = first.success
      ? (JSON.parse(
          firstBytes.toString("utf8"),
        ) as IAutoMovieCompiledShotSource)
      : null;
    const firstReceiptBytes = first.success
      ? fs.readFileSync(conversionReceiptPath)
      : Buffer.alloc(0);
    const firstReceipt = first.success
      ? (JSON.parse(
          firstReceiptBytes.toString("utf8"),
        ) as IAutoMovieExternalMotionConversionReceipt)
      : null;
    const generatedManifest = first.success
      ? (JSON.parse(
          fs.readFileSync(generatedManifestPath, "utf8"),
        ) as IAutoMovieGeneratedManifest)
      : null;
    const second = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    const secondBytes = second.success
      ? fs.readFileSync(compiledPath)
      : Buffer.alloc(1);
    const secondReceiptBytes = second.success
      ? fs.readFileSync(conversionReceiptPath)
      : Buffer.alloc(1);

    TestValidator.equals(
      "selected external motion reaches the deterministic shot",
      namedFacts([
        [
          "first compile succeeds",
          () => productionCompileSucceeded("external motion first", first),
        ],
        [
          "second compile succeeds",
          () => productionCompileSucceeded("external motion second", second),
        ],
        [
          "compiled motion is enacted",
          () =>
            compiled?.shot.performances.some(
              (entry) =>
                entry.node === "soloist" && entry.motion === "perform:soloist",
            ) === true,
        ],
        [
          "compiled motion targets actor rig",
          () =>
            compiled?.motions.find((entry) => entry.id === "perform:soloist")
              ?.skeleton === "automovie:skeleton:soloist",
        ],
        ["compiled bytes are stable", () => firstBytes.equals(secondBytes)],
        [
          "conversion receipt bytes are stable",
          () => firstReceiptBytes.equals(secondReceiptBytes),
        ],
        [
          "receipt pins source closure and basis",
          () =>
            firstReceipt?.source.asset.path === motionPath &&
            firstReceipt.source.asset.digest === motionDigest &&
            firstReceipt.source.closure.length === 1 &&
            firstReceipt.source.closure[0]?.path === bufferPath &&
            firstReceipt.source.closure[0]?.digest === bufferDigest &&
            firstReceipt.source.basis.nodes[1]?.parent === "node_0",
        ],
        [
          "receipt binds actor decision and target",
          () =>
            firstReceipt?.compiler.protocolVersion ===
              "automovie.compiler.v8" &&
            firstReceipt.compiler.packageVersion.length !== 0 &&
            firstReceipt.decision.shot === "opening" &&
            firstReceipt.decision.actor === "soloist" &&
            firstReceipt.decision.clip === "imported-cue" &&
            firstReceipt.decision.mode === "native" &&
            firstReceipt.target.model === "soloist" &&
            firstReceipt.target.skeleton === "automovie:skeleton:soloist",
        ],
        [
          "receipt binds exact generated shot bytes",
          () =>
            firstReceipt?.result.outputPath === "shots/opening.json" &&
            firstReceipt.result.outputDigest ===
              digestAutoMovieBytes(firstBytes) &&
            firstReceipt.result.motionId === "perform:soloist" &&
            firstReceipt.result.motionDigest ===
              digestAutoMovieBytes(
                canonicalAutoMovieJsonBytes(
                  compiled?.motions.find(
                    (motion) => motion.id === "perform:soloist",
                  ),
                ),
              ),
        ],
        [
          "generated manifest inventories receipt ownership",
          () =>
            generatedManifest?.files.some(
              (file) =>
                file.path === "receipts/external-motion/opening-cue.json" &&
                file.digest === digestAutoMovieBytes(firstReceiptBytes) &&
                file.sourceTargets.join("|") ===
                  "external-motion:opening-cue|shot:opening",
            ) === true,
        ],
      ]),
      {
        "first compile succeeds": true,
        "second compile succeeds": true,
        "compiled motion is enacted": true,
        "compiled motion targets actor rig": true,
        "compiled bytes are stable": true,
        "conversion receipt bytes are stable": true,
        "receipt pins source closure and basis": true,
        "receipt binds actor decision and target": true,
        "receipt binds exact generated shot bytes": true,
        "generated manifest inventories receipt ownership": true,
      },
    );

    production.externalMotions[0]!.mode = {
      kind: "humanoid-retarget",
      translationScale: 1,
    };
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(production, null, 2)}\n`,
    );
    const retargeted = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    const retargetedSource = retargeted.success
      ? (JSON.parse(
          fs.readFileSync(compiledPath, "utf8"),
        ) as IAutoMovieCompiledShotSource)
      : null;
    const retargetedReceiptBytes = retargeted.success
      ? fs.readFileSync(conversionReceiptPath)
      : Buffer.alloc(0);
    const retargetedReceipt = retargeted.success
      ? (JSON.parse(
          retargetedReceiptBytes.toString("utf8"),
        ) as IAutoMovieExternalMotionConversionReceipt)
      : null;
    TestValidator.predicate(
      "explicit retarget mode reaches the target actor rig",
      productionCompileSucceeded("external motion retarget", retargeted) &&
        retargetedSource?.motions.some(
          (entry) =>
            entry.id === "perform:soloist" &&
            entry.skeleton === "automovie:skeleton:soloist",
        ) === true &&
        retargetedReceipt?.decision.mode === "humanoid-retarget" &&
        retargetedReceipt.decision.translationScale === 1 &&
        retargetedReceipt.transforms.some(
          (activity) => activity.kind === "retarget",
        ) &&
        retargetedReceipt.transforms.some(
          (activity) => activity.kind === "translation-scale",
        ) &&
        firstReceiptBytes.equals(retargetedReceiptBytes) === false,
    );

    production.externalMotions[0]!.mode = { kind: "native" };
    production.externalMotions[0]!.sourceRig.id = "external:skeleton:foreign";
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(production, null, 2)}\n`,
    );
    const incompatibleNative = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "native adoption requires the actor's exact rig identity",
      incompatibleNative.success === false &&
        incompatibleNative.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "source-motion-adoption-invalid" &&
            diagnostic.message.includes("was authored for source rig"),
        ),
    );

    production.externalMotions[0]!.sourceRig.id = "automovie:skeleton:soloist";
    const modelPath = path.join(
      fixture.root,
      ".automovie/design/shared/models/soloist.json",
    );
    const modelBytes = fs.readFileSync(modelPath);
    const resizedModel = JSON.parse(modelBytes.toString("utf8")) as {
      parameters: { height: number };
    };
    resizedModel.parameters.height = 2;
    fs.writeFileSync(modelPath, `${JSON.stringify(resizedModel, null, 2)}\n`);
    const incompatibleNativeBasis = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "native adoption requires mapped target rest compatibility",
      incompatibleNativeBasis.success === false &&
        incompatibleNativeBasis.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "source-motion-adoption-invalid" &&
            diagnostic.message.includes("mapped hierarchy, rest transforms"),
        ),
    );
    fs.writeFileSync(modelPath, modelBytes);
    fs.writeFileSync(
      shotSourcePath,
      rewriteSource(
        adoptedShotSource,
        'clip: "imported-cue",',
        "clip: performer.clips![0]!.id,",
      ),
    );
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(production, null, 2)}\n`,
    );
    const unused = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "unused external motion adoption fails closed",
      unused.success === false &&
        unused.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "source-motion-adoption-invalid" &&
            diagnostic.message.includes("final performance never enacts"),
        ),
    );

    fs.writeFileSync(
      shotSourcePath,
      rewriteSource(
        adoptedShotSource,
        'actor: "soloist",\n          start: 0,\n          duration: context.contract.durationSeconds,\n          clip: "imported-cue",',
        'actor: ["soloist", "other-soloist"],\n          start: 0,\n          duration: context.contract.durationSeconds,\n          clip: "imported-cue",',
      ),
    );
    const mixedActor = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "external motion clip cannot be shared by a mixed actor set",
      mixedActor.success === false &&
        mixedActor.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "source-motion-adoption-invalid" &&
            diagnostic.message.includes("belongs only to actor"),
        ),
    );

    fs.writeFileSync(shotSourcePath, adoptedShotSource);
    production.externalMotions[0]!.mapping = [];
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(production, null, 2)}\n`,
    );
    const invalid = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "missing explicit mapping fails closed",
      invalid.success === false &&
        invalid.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "design-collection-empty" &&
            diagnostic.message.includes("no explicit source-node mapping"),
        ),
    );

    production.externalMotions[0]!.mapping = [
      { source: "node_missing", target: "hips" },
      { source: "node_2", target: "leftUpperArm" },
    ];
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(production, null, 2)}\n`,
    );
    const unmapped = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "unresolved imported node mapping fails closed",
      unmapped.success === false &&
        unmapped.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "source-motion-adoption-invalid" &&
            diagnostic.message.includes("not present in the inspected source"),
        ),
    );

    production.externalMotions[0]!.mapping = [
      { source: "node_0", target: "hips" },
      { source: "node_2", target: "leftUpperArm" },
    ];
    production.externalMotions[0]!.clip = "opening-cue";
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(production, null, 2)}\n`,
    );
    const colliding = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "external motion cannot replace a source-authored clip",
      colliding.success === false &&
        colliding.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "source-motion-adoption-invalid" &&
            diagnostic.message.includes("shot source already declares"),
        ),
    );

    production.externalMotions[0]!.clip = "imported-cue";
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(production, null, 2)}\n`,
    );
    fs.writeFileSync(
      shotSourcePath,
      rewriteSource(
        fs.readFileSync(shotSourcePath, "utf8"),
        "actors: [...(performer.actors ?? [])],",
        "actors: [],",
      ),
    );
    const missingActor = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "adoption actor must exist in the built shot program",
      missingActor.success === false &&
        missingActor.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "source-motion-adoption-invalid" &&
            diagnostic.message.includes("actor is absent"),
        ),
    );

    const motionAsset = assetManifest.assets.find(
      (asset) => asset.path === motionPath,
    )!;
    motionAsset.motion!.takes[0]!.durationSeconds = 5;
    fs.writeFileSync(
      assetManifestPath,
      `${JSON.stringify(assetManifest, null, 2)}\n`,
    );
    const staleInventory = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "manifest take inventory must match current inspected bytes",
      staleInventory.success === false &&
        staleInventory.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "asset-motion-provenance-missing" &&
            diagnostic.message.includes("take inventory"),
        ),
    );

    motionAsset.motion!.takes[0]!.durationSeconds = 6;
    motionAsset.motion!.basis.nodes[2]!.localRest.translation.y += 0.01;
    fs.writeFileSync(
      assetManifestPath,
      `${JSON.stringify(assetManifest, null, 2)}\n`,
    );
    const staleBasis = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "manifest source basis must match current inspected bytes",
      staleBasis.success === false &&
        staleBasis.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "asset-motion-provenance-missing" &&
            diagnostic.message.includes("hierarchy/rest basis"),
        ),
    );
  } finally {
    fixture.dispose();
  }
};

const writeAsset = (
  root: string,
  relative: string,
  bytes: Uint8Array,
): void => {
  const file = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
};

const externalSourceRig = (): IAutoMovieSkeleton => ({
  id: "automovie:skeleton:soloist",
  bones: [
    {
      bone: "hips",
      parent: null,
      rest: {
        translation: { x: 0, y: 1.8 * 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      constraint: null,
    },
    {
      bone: "leftUpperArm",
      parent: "hips",
      rest: {
        translation: {
          x: 1.8 * 0.125,
          y: 1.8 * 0.18 + 1.8 * 0.15,
          z: 0,
        },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      constraint: null,
    },
  ],
});

const externalMotionBasis = (): IAutoMovieExternalMotionBasis => ({
  profile: "gltf-motion-basis-v1",
  lengthUnit: "meter",
  handedness: "right-handed",
  upAxis: "Y-up",
  nodes: [
    {
      nodeIndex: 0,
      id: "node_0",
      sourceName: "Hips",
      parent: null,
      localRest: structuredClone(externalSourceRig().bones[0]!.rest),
    },
    {
      nodeIndex: 1,
      id: "node_1",
      sourceName: "Spine",
      parent: "node_0",
      localRest: {
        translation: { x: 0, y: 1.8 * 0.18, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
    {
      nodeIndex: 2,
      id: "node_2",
      sourceName: "LeftUpperArm",
      parent: "node_1",
      localRest: {
        translation: { x: 1.8 * 0.125, y: 1.8 * 0.15, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
  ],
});

const externalMotionFixture = (): {
  document: Buffer;
  payload: Buffer;
} => {
  const loweredHalfAngle = -Math.PI / 4;
  const raisedHalfAngle = Math.PI / 12;
  const payload = Buffer.concat(
    [
      [0, 2, 6],
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      [
        0,
        0,
        Math.sin(loweredHalfAngle),
        Math.cos(loweredHalfAngle),
        0,
        0,
        Math.sin(raisedHalfAngle),
        Math.cos(raisedHalfAngle),
        0,
        0,
        Math.sin(raisedHalfAngle),
        Math.cos(raisedHalfAngle),
      ],
    ].map((values) => Buffer.from(new Float32Array(values).buffer)),
  );
  const document = Buffer.from(
    JSON.stringify({
      asset: { version: "2.0" },
      buffers: [{ byteLength: payload.byteLength, uri: "imported-cue.bin" }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 12 },
        { buffer: 0, byteOffset: 12, byteLength: 48 },
        { buffer: 0, byteOffset: 60, byteLength: 48 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "SCALAR" },
        { bufferView: 1, componentType: 5126, count: 3, type: "VEC4" },
        { bufferView: 2, componentType: 5126, count: 3, type: "VEC4" },
      ],
      nodes: [
        {
          name: "Hips",
          translation: [0, 1.8 * 0.5, 0],
          children: [1],
        },
        {
          name: "Spine",
          translation: [0, 1.8 * 0.18, 0],
          children: [2],
        },
        {
          name: "LeftUpperArm",
          translation: [1.8 * 0.125, 1.8 * 0.15, 0],
        },
      ],
      scenes: [{ nodes: [0] }],
      animations: [
        {
          name: "Imported Cue",
          samplers: [
            { input: 0, output: 1, interpolation: "LINEAR" },
            { input: 0, output: 2, interpolation: "LINEAR" },
          ],
          channels: [
            { sampler: 0, target: { node: 0, path: "rotation" } },
            { sampler: 1, target: { node: 2, path: "rotation" } },
          ],
        },
      ],
    }),
    "utf8",
  );
  return { document, payload };
};
