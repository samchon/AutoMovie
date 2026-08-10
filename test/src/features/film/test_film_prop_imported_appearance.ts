import { forgeProp } from "@automovie/engine";
import { IAutoMoviePropSpec } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";
import { createDoorPropSpec } from "./test_film_forge_prop";

/** A well-formed sealed digest, distinct per byte identity. */
const digest = (fill: string): `sha256:${string}` =>
  `sha256:${fill.repeat(64).slice(0, 64)}`;

const HERO_BYTES = "assets/chair.glb";
const SIDECAR_BYTES = "assets/chair-albedo.png";

/**
 * A chair whose pixels come from a registered glTF and whose meaning does not.
 *
 * The model is shaped exactly as the compiler materializes a registered
 * external appearance: `imported` origin, the manifest-owned bytes in `asset`,
 * the sealed digest closure, and one registered collision proxy standing in for
 * the visible primitives. Everything the engine measures or simulates is
 * authored here on top of that: the seat's `stack-top` face, the body it
 * weighs, and (in the placement suite) the relations and keep-out volumes it
 * claims.
 */
export const createImportedPropSpec = (): IAutoMoviePropSpec => ({
  node: "chair",
  modelRef: "chair-recipe",
  model: {
    id: "chair",
    name: "imported recipe chair-recipe",
    origin: "imported",
    skeleton: null,
    body: { mass: 6, centerOfMass: null, friction: 0.5, restitution: 0.05 },
    affordances: [
      {
        id: "seat",
        kind: "stack-top",
        frame: {
          translation: { x: 0, y: 0.45, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        extent: [
          { x: -0.2, y: 0, z: -0.2 },
          { x: 0.2, y: 0, z: -0.2 },
          { x: 0.2, y: 0, z: 0.2 },
          { x: -0.2, y: 0, z: 0.2 },
        ],
      },
    ],
    materials: [],
    parts: [
      {
        id: "registered-collision-proxy",
        name: "registered collision proxy",
        geometry: {
          type: "primitive",
          shape: { type: "box", width: 0.5, height: 0.9, depth: 0.5 },
        },
        material: null,
        attachedBone: null,
        transform: null,
      },
    ],
    asset: HERO_BYTES,
    profiles: [],
    imported: {
      profile: "gltf-static-v1",
      lod: [
        {
          level: "hero",
          asset: HERO_BYTES,
          digest: digest("a"),
          profile: "gltf-static-v1",
          humanoidBones: [],
        },
      ],
      assets: [
        { path: HERO_BYTES, digest: digest("a") },
        { path: SIDECAR_BYTES, digest: digest("b") },
      ],
      humanoidBones: [],
    },
  },
  articulation: null,
});

/** Forge a fresh imported chair after one mutation, so cases never compound. */
const refuses = (
  mutate: (spec: IAutoMoviePropSpec) => void,
  path: string,
  message: string,
): boolean => {
  const spec = createImportedPropSpec();
  mutate(spec);
  const result = forgeProp(spec);
  return (
    result.success === false &&
    result.violations.some(
      (item) => item.path === path && item.expected.includes(message),
    )
  );
};

/** The same mutation, asserted to leave the prop forgeable. */
const tolerated = (mutate: (spec: IAutoMoviePropSpec) => void): boolean => {
  const spec = createImportedPropSpec();
  mutate(spec);
  return forgeProp(spec).success;
};

/**
 * A prop may draw a registered external appearance, and stating that reference
 * opens the origin gate exactly as far as the record can be checked: the
 * reference must classify something, the media must be a kind a prop can be,
 * and the compiler-sealed byte closure must be internally coherent. Nothing the
 * prop means moves out of the spec, and a prop that names no reference keeps
 * the generated contract it always had, message for message.
 *
 * Scenarios:
 *
 * 1. The imported chair forges and the accepted spec is echoed for the staging
 *    join, carrying its reference, its body, and its seat affordance.
 * 2. Regression on the generated contract: the canonical generated door still
 *    forges, and the same imported model with no reference (absent field and an
 *    explicit `null` alike) still reports the original `origin must be
 *    "generated"` violation verbatim, at the original path.
 * 3. A reference that is blank classifies nothing, and a generated model that
 *    cites one references bytes nothing draws; both are refused by name.
 * 4. A reference with no bytes behind it is refused: a null `asset`, and an absent
 *    compiler-sealed closure, which stops the closure gates rather than
 *    reporting each of them against a record that is not there.
 * 5. Wrong media is refused: a humanoid ingest profile is a performer and goes
 *    through forgeCast, a rigid appearance maps no humanoid bones, and neither
 *    does any of its levels.
 * 6. The sealed byte ledger is refused when a path is blank, when one path is
 *    sealed twice, and when a digest is not `sha256:` plus 64 lowercase hex
 *    digits; the boundary case of 63 digits and the case of uppercase digits
 *    are each refused.
 * 7. The LOD closure is refused when a level repeats, when a level disagrees with
 *    the appearance's profile, when a level's digest is malformed, when a level
 *    reads a path the ledger seals under a different digest (and a malformed
 *    digest is not also reported as that disagreement), when a level binds
 *    bytes the ledger does not cover, when there is no hero at all, and when
 *    the hero binds bytes other than the ones the prop draws.
 * 8. An imported appearance changes none of the other prop contracts: a skeleton
 *    still makes it an actor, a model id still has to equal the node,
 *    `validateModel` still judges the deterministic proxy it left behind, and
 *    the door's own hinge articulation both rides on it and is still gated on
 *    it, so the reference buys the pixels and not an exemption.
 */
export const test_film_prop_imported_appearance = (): void => {
  const forged = forgeProp(createImportedPropSpec());
  TestValidator.equals(
    "an imported chair forges",
    forged.success === true
      ? {
          node: forged.prop.node,
          modelRef: forged.prop.modelRef,
          origin: forged.prop.model.origin,
          mass: forged.prop.model.body?.mass ?? null,
          affordance: forged.prop.model.affordances?.[0]?.kind ?? null,
        }
      : null,
    {
      node: "chair",
      modelRef: "chair-recipe",
      origin: "imported",
      mass: 6,
      affordance: "stack-top",
    },
  );

  TestValidator.equals(
    "a prop naming no reference keeps the generated contract",
    namedFacts([
      [
        "generatedDoorStillForges",
        () => forgeProp(createDoorPropSpec()).success,
      ],
      [
        "importedWithoutReferenceIsRefusedVerbatim",
        () => {
          const spec = createImportedPropSpec();
          delete spec.modelRef;
          const result = forgeProp(spec);
          return (
            result.success === false &&
            result.violations.some(
              (item) =>
                item.path === "$input.model.origin" &&
                item.expected ===
                  'a forged prop\'s origin must be "generated", but was "imported"',
            )
          );
        },
      ],
      [
        "anExplicitNullReferenceIsTheSameSilence",
        () => {
          const spec = createImportedPropSpec();
          spec.modelRef = null;
          const result = forgeProp(spec);
          return (
            result.success === false &&
            result.violations.some(
              (item) =>
                item.path === "$input.model.origin" &&
                item.expected ===
                  'a forged prop\'s origin must be "generated", but was "imported"',
            )
          );
        },
      ],
      [
        "aGeneratedPropNamingNoReferenceIsNotJudgedAsImported",
        () => {
          const spec = createDoorPropSpec();
          const result = forgeProp(spec);
          return result.success === true && (spec.modelRef ?? null) === null;
        },
      ],
    ]),
    {
      generatedDoorStillForges: true,
      importedWithoutReferenceIsRefusedVerbatim: true,
      anExplicitNullReferenceIsTheSameSilence: true,
      aGeneratedPropNamingNoReferenceIsNotJudgedAsImported: true,
    },
  );

  TestValidator.equals(
    "the reference itself, and the bytes behind it, are gated",
    namedFacts([
      [
        "blankReference",
        () =>
          refuses(
            (spec) => (spec.modelRef = "   "),
            "$input.modelRef",
            "an empty reference classifies nothing",
          ),
      ],
      [
        "generatedModelCitingAReference",
        () =>
          refuses(
            (spec) => (spec.model.origin = "generated"),
            "$input.model.origin",
            'its origin must be "imported", but was "generated"',
          ),
      ],
      [
        "nullAsset",
        () =>
          refuses(
            (spec) => (spec.model.asset = null),
            "$input.model.asset",
            "must name the binary payload",
          ),
      ],
      [
        "absentSealedClosure",
        () =>
          refuses(
            (spec) => delete spec.model.imported,
            "$input.model.imported",
            "carries no compiler-sealed ingest closure",
          ),
      ],
      [
        "anAbsentClosureStopsTheClosureGates",
        () => {
          const spec = createImportedPropSpec();
          delete spec.model.imported;
          const result = forgeProp(spec);
          return (
            result.success === false &&
            result.violations.every(
              (item) => !item.path.startsWith("$input.model.imported."),
            )
          );
        },
      ],
    ]),
    {
      blankReference: true,
      generatedModelCitingAReference: true,
      nullAsset: true,
      absentSealedClosure: true,
      anAbsentClosureStopsTheClosureGates: true,
    },
  );

  TestValidator.equals(
    "wrong media and a malformed byte ledger are refused",
    namedFacts([
      [
        "humanoidProfileIsAPerformer",
        () =>
          refuses(
            (spec) => {
              spec.model.imported!.profile = "vrm-humanoid-v1";
              spec.model.imported!.lod[0]!.profile = "vrm-humanoid-v1";
            },
            "$input.model.imported.profile",
            "goes through forgeCast",
          ),
      ],
      [
        "appearanceMappingHumanoidBones",
        () =>
          refuses(
            (spec) =>
              spec.model.imported!.humanoidBones.push({
                bone: "hips",
                node: 3,
                weighted: true,
              }),
            "$input.model.imported.humanoidBones",
            "maps no humanoid bones",
          ),
      ],
      [
        "levelMappingHumanoidBones",
        () =>
          refuses(
            (spec) =>
              spec.model.imported!.lod[0]!.humanoidBones.push({
                bone: "hips",
                node: 3,
                weighted: false,
              }),
            "$input.model.imported.lod[0].humanoidBones",
            "maps no humanoid bones",
          ),
      ],
      [
        "blankLedgerPath",
        () =>
          refuses(
            (spec) => (spec.model.imported!.assets[1]!.path = " "),
            "$input.model.imported.assets[1].path",
            "non-empty project-relative path",
          ),
      ],
      [
        "duplicatedLedgerPath",
        () =>
          refuses(
            (spec) =>
              spec.model.imported!.assets.push({
                path: HERO_BYTES,
                digest: digest("c"),
              }),
            "$input.model.imported.assets[2].path",
            "is declared twice",
          ),
      ],
      [
        "aBlankPathIsNotAlsoCalledADuplicate",
        () => {
          const spec = createImportedPropSpec();
          spec.model.imported!.assets[0]!.path = "";
          spec.model.imported!.assets[1]!.path = "";
          const result = forgeProp(spec);
          return (
            result.success === false &&
            result.violations.every(
              (item) => !item.expected.includes("is declared twice"),
            )
          );
        },
      ],
      [
        "shortLedgerDigest",
        () =>
          refuses(
            (spec) =>
              (spec.model.imported!.assets[1]!.digest = `sha256:${"b".repeat(63)}`),
            "$input.model.imported.assets[1].digest",
            "64 lowercase hexadecimal digits",
          ),
      ],
      [
        "uppercaseLedgerDigest",
        () =>
          refuses(
            (spec) =>
              (spec.model.imported!.assets[1]!.digest = `sha256:${"B".repeat(64)}`),
            "$input.model.imported.assets[1].digest",
            "64 lowercase hexadecimal digits",
          ),
      ],
    ]),
    {
      humanoidProfileIsAPerformer: true,
      appearanceMappingHumanoidBones: true,
      levelMappingHumanoidBones: true,
      blankLedgerPath: true,
      duplicatedLedgerPath: true,
      aBlankPathIsNotAlsoCalledADuplicate: true,
      shortLedgerDigest: true,
      uppercaseLedgerDigest: true,
    },
  );

  TestValidator.equals(
    "the LOD closure answers for its own levels and for the hero",
    namedFacts([
      [
        "duplicatedLevel",
        () =>
          refuses(
            (spec) =>
              spec.model.imported!.lod.push({
                ...spec.model.imported!.lod[0]!,
              }),
            "$input.model.imported.lod[1].level",
            "is declared twice",
          ),
      ],
      [
        "levelProfileDisagreement",
        () =>
          refuses(
            (spec) =>
              (spec.model.imported!.lod[0]!.profile = "gltf-humanoid-v1"),
            "$input.model.imported.lod[0].profile",
            "every level of one appearance shares its profile",
          ),
      ],
      [
        "malformedLevelDigest",
        () =>
          refuses(
            (spec) => (spec.model.imported!.lod[0]!.digest = "sha256:"),
            "$input.model.imported.lod[0].digest",
            "64 lowercase hexadecimal digits",
          ),
      ],
      [
        "levelDisagreesWithTheLedgerDigest",
        () =>
          refuses(
            (spec) => (spec.model.imported!.lod[0]!.digest = digest("c")),
            "$input.model.imported.lod[0].digest",
            "while the sealed ledger carries",
          ),
      ],
      [
        "aMalformedDigestIsNotAlsoALedgerDisagreement",
        () => {
          const spec = createImportedPropSpec();
          spec.model.imported!.lod[0]!.digest = "sha256:";
          const result = forgeProp(spec);
          return (
            result.success === false &&
            result.violations.every(
              (item) =>
                !item.expected.includes("while the sealed ledger carries"),
            )
          );
        },
      ],
      [
        "levelOutsideTheLedger",
        () =>
          refuses(
            (spec) =>
              spec.model.imported!.lod.push({
                level: "far",
                asset: "assets/chair-far.glb",
                digest: digest("d"),
                profile: "gltf-static-v1",
                humanoidBones: [],
              }),
            "$input.model.imported.lod[1].asset",
            "the sealed byte ledger does not cover",
          ),
      ],
      [
        "noHeroAtAll",
        () =>
          refuses(
            (spec) => (spec.model.imported!.lod = []),
            "$input.model.imported.lod",
            "needs a hero LOD",
          ),
      ],
      [
        "aNonHeroLevelIsStillNotAHero",
        () =>
          refuses(
            (spec) => (spec.model.imported!.lod[0]!.level = "near"),
            "$input.model.imported.lod",
            "needs a hero LOD",
          ),
      ],
      [
        "heroBindingOtherBytes",
        () =>
          refuses(
            (spec) => (spec.model.imported!.lod[0]!.asset = SIDECAR_BYTES),
            "$input.model.imported.lod",
            "one appearance is one set of bytes",
          ),
      ],
      [
        "aNullAssetIsNotAlsoAHeroMismatch",
        () => {
          const spec = createImportedPropSpec();
          spec.model.asset = null;
          const result = forgeProp(spec);
          return (
            result.success === false &&
            result.violations.every(
              (item) =>
                !item.expected.includes("one appearance is one set of bytes"),
            )
          );
        },
      ],
      [
        "aSecondSealedLevelIsAccepted",
        () =>
          tolerated((spec) => {
            spec.model.imported!.assets.push({
              path: "assets/chair-far.glb",
              digest: digest("e"),
            });
            spec.model.imported!.lod.push({
              level: "far",
              asset: "assets/chair-far.glb",
              digest: digest("e"),
              profile: "gltf-static-v1",
              humanoidBones: [],
            });
          }),
      ],
    ]),
    {
      duplicatedLevel: true,
      levelProfileDisagreement: true,
      malformedLevelDigest: true,
      levelDisagreesWithTheLedgerDigest: true,
      aMalformedDigestIsNotAlsoALedgerDisagreement: true,
      levelOutsideTheLedger: true,
      noHeroAtAll: true,
      aNonHeroLevelIsStillNotAHero: true,
      heroBindingOtherBytes: true,
      aNullAssetIsNotAlsoAHeroMismatch: true,
      aSecondSealedLevelIsAccepted: true,
    },
  );

  TestValidator.equals(
    "every other prop contract still holds over an imported appearance",
    namedFacts([
      [
        "aSkeletonStillMakesItAnActor",
        () =>
          refuses(
            (spec) => (spec.model.skeleton = createSkeleton()),
            "$input.model.skeleton",
            "riggable actors go through forgeCast",
          ),
      ],
      [
        "theModelIdStillHasToEqualTheNode",
        () =>
          refuses(
            (spec) => (spec.model.id = "chair-recipe"),
            "$input.model.id",
            "the staged scene joins on it",
          ),
      ],
      [
        "validateModelStillJudgesTheProxy",
        () =>
          refuses(
            (spec) =>
              (spec.model.parts[0]!.geometry = {
                type: "primitive",
                shape: { type: "box", width: 0, height: 0.9, depth: 0.5 },
              }),
            "$input.model.parts[0].geometry.shape.width",
            "must be a finite number > 0",
          ),
      ],
      [
        "anImportedPropMayStillArticulate",
        () =>
          tolerated(
            (spec) => (spec.articulation = createDoorPropSpec().articulation),
          ),
      ],
      [
        "andItsArticulationIsStillGated",
        () =>
          refuses(
            (spec) => {
              const articulation = createDoorPropSpec().articulation!;
              articulation.binding.boneMap.pivot = "ghost";
              spec.articulation = articulation;
            },
            '$input.articulation.binding.boneMap["pivot"]',
            "which is not a declared articulation node",
          ),
      ],
    ]),
    {
      aSkeletonStillMakesItAnActor: true,
      theModelIdStillHasToEqualTheNode: true,
      validateModelStillJudgesTheProxy: true,
      anImportedPropMayStillArticulate: true,
      andItsArticulationIsStillGated: true,
    },
  );
};
