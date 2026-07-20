import { IAutoMovieForgeApplication } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { forgeEntry, makeScriptWrite } from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();
const script = makeScriptWrite();
const rest = createSkeleton().bones[0]!.rest;

type ForgeModel = IAutoMovieForgeApplication.IEntry["model"];

const forgeModel = (
  model: Record<string, unknown>,
): ReturnType<AutoMovieApplication["forge"]>["forged"] =>
  app.forge({
    script,
    forge: {
      type: "write",
      entries: [forgeEntry("knightB", model as Partial<ForgeModel>)],
    },
  }).forged;

const modelRoot = "$input.forge.entries[0].model";

/**
 * The MCP `forge` model shape gate: skeleton, joint constraint, materials,
 * parts, mesh geometry, and affordances are all validated before the engine
 * forge consumer dereferences them, so a malformed direct model payload fails
 * as a field-located forge violation instead of a raw dereference.
 *
 * Scenarios (each a malformed twin of the valid one-part test model):
 *
 * 1. A non-object skeleton, a non-object skeleton bone, and a non-object /
 *    per-axis-malformed joint constraint fail at their skeleton paths.
 * 2. Non-object materials entries, a non-array parts list, a non-object part, and
 *    a non-object part geometry fail at their model paths.
 * 3. A `mesh` geometry validates its positions, optional buffers, and skin buffers
 *, malformed ones fail at `...mesh...` paths.
 * 4. A non-array affordances list and a non-object affordance entry fail at their
 *    affordance paths.
 * 5. A non-object script cast member fails at `$input.script.cast[0]`.
 */
export const test_mcp_forge_model_shape_edges = (): void => {
  const nonObjectSkeleton = forgeModel({ skeleton: 5 });
  TestValidator.predicate(
    "a non-object skeleton fails at its path",
    hasViolation(nonObjectSkeleton, "type", `${modelRoot}.skeleton`),
  );

  const nonObjectBone = forgeModel({ skeleton: { id: "s", bones: [null] } });
  TestValidator.predicate(
    "a non-object skeleton bone fails at its path",
    hasViolation(nonObjectBone, "type", `${modelRoot}.skeleton.bones[0]`),
  );

  const badConstraint = forgeModel({
    skeleton: {
      id: "s",
      bones: [
        { bone: "hips", parent: null, rest, constraint: 5 },
        {
          bone: "spine",
          parent: null,
          rest,
          constraint: { flexion: 5, abduction: null, twist: {} },
        },
      ],
    },
  });
  TestValidator.predicate(
    "a non-object joint constraint and a non-object constraint axis fail",
    hasViolation(
      badConstraint,
      "type",
      `${modelRoot}.skeleton.bones[0].constraint`,
    ) &&
      hasViolation(
        badConstraint,
        "type",
        `${modelRoot}.skeleton.bones[1].constraint.flexion`,
      ),
  );

  const nonObjectMaterial = forgeModel({ materials: [null] });
  TestValidator.predicate(
    "a non-object material fails at its path",
    hasViolation(nonObjectMaterial, "type", `${modelRoot}.materials[0]`),
  );

  const nonArrayParts = forgeModel({ parts: 5 });
  TestValidator.predicate(
    "a non-array parts list fails at its path",
    hasViolation(nonArrayParts, "type", `${modelRoot}.parts`),
  );

  const nonObjectPart = forgeModel({ parts: [null] });
  TestValidator.predicate(
    "a non-object part fails at its path",
    hasViolation(nonObjectPart, "type", `${modelRoot}.parts[0]`),
  );

  const nonObjectGeometry = forgeModel({
    parts: [
      {
        id: "p",
        name: null,
        geometry: 5,
        material: null,
        attachedBone: null,
        transform: null,
      },
    ],
  });
  TestValidator.predicate(
    "a non-object part geometry fails at its path",
    hasViolation(nonObjectGeometry, "type", `${modelRoot}.parts[0].geometry`),
  );

  const meshGeometry = forgeModel({
    parts: [
      {
        id: "p",
        name: null,
        geometry: {
          type: "mesh",
          mesh: {
            positions: "nope",
            normals: null,
            uvs: 5,
            indices: [],
            skin: { joints: "x", boneIndices: [], weights: [] },
          },
        },
        material: null,
        attachedBone: null,
        transform: null,
      },
    ],
  });
  const meshRoot = `${modelRoot}.parts[0].geometry.mesh`;
  TestValidator.predicate(
    "a mesh geometry validates its positions, buffers, and skin",
    hasViolation(meshGeometry, "type", `${meshRoot}.positions`) &&
      hasViolation(meshGeometry, "type", `${meshRoot}.uvs`) &&
      hasViolation(meshGeometry, "type", `${meshRoot}.skin.joints`),
  );

  const nonObjectMesh = forgeModel({
    parts: [
      {
        id: "p",
        name: null,
        geometry: { type: "mesh", mesh: 5 },
        material: null,
        attachedBone: null,
        transform: null,
      },
    ],
  });
  TestValidator.predicate(
    "a non-object mesh fails at its path",
    hasViolation(nonObjectMesh, "type", `${modelRoot}.parts[0].geometry.mesh`),
  );

  const nonObjectSkin = forgeModel({
    parts: [
      {
        id: "p",
        name: null,
        geometry: {
          type: "mesh",
          mesh: {
            positions: [],
            normals: null,
            uvs: null,
            indices: null,
            skin: 5,
          },
        },
        material: null,
        attachedBone: null,
        transform: null,
      },
    ],
  });
  TestValidator.predicate(
    "a non-object mesh skin fails at its path",
    hasViolation(
      nonObjectSkin,
      "type",
      `${modelRoot}.parts[0].geometry.mesh.skin`,
    ),
  );

  const nonArrayAffordances = forgeModel({ affordances: 5 });
  TestValidator.predicate(
    "a non-array affordances list fails at its path",
    hasViolation(nonArrayAffordances, "type", `${modelRoot}.affordances`),
  );

  const nonObjectAffordance = forgeModel({ affordances: [null] });
  TestValidator.predicate(
    "a non-object affordance fails at its path",
    hasViolation(nonObjectAffordance, "type", `${modelRoot}.affordances[0]`),
  );

  const nonObjectCastMember = app.forge({
    script: makeScriptWrite({
      cast: [null] as unknown as ReturnType<typeof makeScriptWrite>["cast"],
    }),
    forge: { type: "write", entries: [forgeEntry("knightB")] },
  }).forged;
  TestValidator.predicate(
    "a non-object script cast member fails at its path",
    hasViolation(nonObjectCastMember, "type", "$input.script.cast[0]"),
  );
};
