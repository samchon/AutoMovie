import { deriveAutoMovieSemanticMask } from "@automovie/engine";
import { IAutoMovieScene, IAutoMovieSpace } from "@automovie/interface";
import {
  SPACE_GROUP_NAME,
  applyAutoMovieSemanticMask,
  applyRenderMode,
  auditAutoMovieSemanticMaskScene,
  buildModel,
  buildScene,
  buildSpaceObject,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";

const SPACE: IAutoMovieSpace = {
  id: "space-1",
  surfaces: [
    {
      id: "floor",
      kind: "floor",
      polygon: [
        { x: -2, y: 0, z: -1 },
        { x: 2, y: 0, z: -1 },
        { x: 2, y: 0, z: 1 },
        { x: -2, y: 0, z: 1 },
      ],
    },
  ],
  walkable: ["floor"],
};

const DESIGN: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "node-a",
      model: "model-a",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [],
  lights: [],
  space: SPACE,
};

/** The one support-patch mesh in a freshly built copy of the design. */
const built = (): { scene: THREE.Scene; patch: THREE.Mesh } => {
  const scene = buildScene(DESIGN, () =>
    buildModel({ ...createModel(), id: "model-a" }),
  ).scene;
  return {
    scene,
    patch: scene.getObjectByName(SPACE_GROUP_NAME)!.children[0] as THREE.Mesh,
  };
};

/**
 * A semantic support declaration is structural evidence and never beauty
 * geometry proving that a physical floor exists.
 *
 * The defect was stronger than z-fighting. A walkable polygon with no slab was
 * an opaque neutral floor in the delivered frame, so the declaration rendered
 * as evidence of its own satisfaction. The patch must remain a real mesh for
 * the depth, normal, outline, legacy mask, and stable semantic-mask products
 * introduced by #1173, while its ordinary material changes neither beauty
 * colour nor beauty depth.
 *
 * Scenarios:
 *
 * 1. Direct `buildSpaceObject` and `buildScene` embedders receive a patch whose
 *    ordinary material writes neither colour nor depth, while a model's
 *    authored material keeps both channels.
 * 2. Depth, normal, outline, and legacy mask replace that ordinary material,
 *    then idempotent restoration returns the exact borrowed material.
 * 3. Semantic-mask audit still resolves the support group, direct semantic-mask
 *    application paints it, and restoration returns the non-beauty material.
 * 4. The beauty mode is a no-op and cannot promote the declaration into pixels.
 */
export const test_viewer_space_ground_beauty = (): void => {
  const direct = built();
  const beautyMaterial = direct.patch.material as THREE.Material;
  const embeddedPatch = buildSpaceObject(SPACE).children[0] as THREE.Mesh;
  const embeddedMaterial = embeddedPatch.material as THREE.Material;
  const modelMaterials: THREE.Material[] = [];
  direct.scene.getObjectByName("node-a")!.traverse((object) => {
    if ((object as THREE.Mesh).isMesh === true)
      modelMaterials.push((object as THREE.Mesh).material as THREE.Material);
  });
  TestValidator.equals(
    "only authored geometry contributes to the beauty buffers",
    namedFacts([
      ["the space contributed a patch", () => direct.patch.isMesh],
      ["the patch writes no beauty colour", () => !beautyMaterial.colorWrite],
      ["the patch writes no beauty depth", () => !beautyMaterial.depthWrite],
      [
        "a directly embedded patch writes neither",
        () => !embeddedMaterial.colorWrite && !embeddedMaterial.depthWrite,
      ],
      ["the model contributed meshes", () => modelMaterials.length > 0],
      [
        "authored meshes still write colour and depth",
        () =>
          modelMaterials.every(
            (material) => material.colorWrite && material.depthWrite,
          ),
      ],
    ]),
    {
      "the space contributed a patch": true,
      "the patch writes no beauty colour": true,
      "the patch writes no beauty depth": true,
      "a directly embedded patch writes neither": true,
      "the model contributed meshes": true,
      "authored meshes still write colour and depth": true,
    },
  );

  for (const mode of ["depth", "normal", "outline", "mask"] as const) {
    const handle = applyRenderMode(direct.scene, mode);
    TestValidator.predicate(
      `${mode} gives the support patch a structural material`,
      direct.patch.material !== beautyMaterial,
    );
    handle.restore();
    handle.restore();
    TestValidator.predicate(
      `${mode} restores the exact non-beauty material`,
      direct.patch.material === beautyMaterial,
    );
  }

  const mask = deriveAutoMovieSemanticMask({ scene: DESIGN, models: [] });
  TestValidator.equals(
    "semantic audit resolves the support patch without beauty participation",
    auditAutoMovieSemanticMaskScene({
      scene: direct.scene,
      design: DESIGN,
      mask,
    }),
    { unresolved: [], unaddressed: 0 },
  );
  const semantic = applyAutoMovieSemanticMask({
    scene: direct.scene,
    design: DESIGN,
    mask,
  });
  TestValidator.equals(
    "direct semantic masking paints the support patch",
    {
      materialChanged: direct.patch.material !== beautyMaterial,
      painted: semantic.painted,
      unaddressed: semantic.unaddressed,
      unresolved: semantic.unresolved,
    },
    { materialChanged: true, painted: 2, unaddressed: 0, unresolved: [] },
  );
  semantic.restore();
  semantic.restore();
  TestValidator.predicate(
    "semantic restore returns the exact non-beauty material",
    direct.patch.material === beautyMaterial,
  );

  const beauty = applyRenderMode(direct.scene, "beauty");
  TestValidator.predicate(
    "beauty leaves the non-writing material in place",
    direct.patch.material === beautyMaterial &&
      !beautyMaterial.colorWrite &&
      !beautyMaterial.depthWrite,
  );
  beauty.restore();
};
