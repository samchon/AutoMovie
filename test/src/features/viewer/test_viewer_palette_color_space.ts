import {
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  materializeCompiledInstanceSet,
  materializeProductionModels,
} from "@automovie/mcp";
import { buildInstancedInstanceSet, buildMaterial } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { nclose } from "../internal/predicates";

/**
 * One swatch authored through either color path renders one color.
 *
 * A production covers a surface two ways at once: whole units come from an
 * instance set's `variation.palette`, and the cut pieces that meet them carry a
 * generated model recipe's own material. Both are authored as `#RRGGBB`, so an
 * author reasonably expects the same string to mean the same color. It did not:
 * the viewer decoded the palette from sRGB while the compiler divided the
 * recipe's digits by 255 and wrote them into a linear `baseColor`, which put
 * one roof's whole slates at linear 0.21 and its cut slates at 0.49 and drew a
 * bright band along every hip and ridge where the two met.
 *
 * The two paths are read where they become the renderer's albedo: a batch's
 * instance color, and a material's diffuse color. The batch material is forced
 * to white so its instance color is the whole answer, which is what makes the
 * two directly comparable.
 *
 * Scenarios:
 *
 * 1. `#7d828c`, the swatch the observed defect was measured on, renders one
 *    linear triple through both paths.
 * 2. Both land on the value the sRGB standard gives that swatch rather than on
 *    the transcription, so restoring the divide-by-255 fails here instead of
 *    merely making the two paths agree on a wrong color.
 * 3. A deliberately different palette entry stays different from the material,
 *    so the parity above cannot be satisfied by collapsing every color onto one
 *    value.
 * 4. `#000000` and `#ffffff` agree exactly at both gamut ends, where a decode
 *    and a transcription are indistinguishable and a broken one would still
 *    look right.
 * 5. Disabling three.js's mutable color-management switch cannot turn an
 *    instance palette back into transcribed RGB; the engine-owned decode stays
 *    equal to the material path and the global is restored before this case
 *    returns.
 * 6. Two slots sharing one palette entry both receive that color, covering the
 *    per-set decoded-swatch cache rather than paying the transfer per slot.
 */
export const test_viewer_palette_color_space = (): void => {
  const SLATE = "#7d828c";

  TestValidator.predicate(
    "one swatch renders one linear triple through both paths",
    sameRendered(materialAlbedo(SLATE), instanceAlbedo(SLATE)),
  );

  const decoded = materialAlbedo(SLATE);
  TestValidator.predicate(
    "both paths land on the standard's value, not the transcription",
    nclose(decoded.r, 0.20507874, 1e-7) &&
      nclose(decoded.g, 0.22322796, 1e-7) &&
      nclose(decoded.b, 0.26225066, 1e-7) &&
      nclose(decoded.r, 0x7d / 255, 1e-7) === false,
  );

  TestValidator.predicate(
    "a different swatch stays a different color",
    sameRendered(materialAlbedo(SLATE), instanceAlbedo("#3a3f47")) === false,
  );

  TestValidator.predicate(
    "the gamut ends agree exactly",
    sameRendered(materialAlbedo("#000000"), instanceAlbedo("#000000")) &&
      sameRendered(materialAlbedo("#ffffff"), instanceAlbedo("#ffffff")),
  );

  const colorManagement = THREE.ColorManagement.enabled;
  try {
    THREE.ColorManagement.enabled = false;
    TestValidator.predicate(
      "a host color-management switch cannot change palette decoding",
      sameRendered(materialAlbedo(SLATE), instanceAlbedo(SLATE)),
    );
  } finally {
    THREE.ColorManagement.enabled = colorManagement;
  }

  const repeated = instanceAlbedos(SLATE);
  TestValidator.predicate(
    "slots sharing one decoded swatch receive the same color",
    sameRendered(repeated[0]!, repeated[1]!),
  );
};

/** The linear diffuse color a generated recipe's own material renders with. */
const materialAlbedo = (swatch: string): THREE.Color => {
  const recipe = paletteRecipe(swatch);
  const model = [
    ...materializeProductionModels(new Map([[recipe.id, recipe]])).values(),
  ][0]!;
  return buildMaterial(model.materials[0]!).color;
};

/** The linear instance color one slot of a palette-driven batch renders with. */
const instanceAlbedo = (swatch: string): THREE.Color =>
  instanceAlbedos(swatch)[0]!;

/** The two linear instance colors in one palette-driven batch. */
const instanceAlbedos = (swatch: string): THREE.Color[] => {
  const recipe = paletteRecipe(swatch);
  const design: IAutoMovieInstanceSetDesign = {
    id: "roof",
    modelRecipe: recipe.id,
    count: 2,
    layout: { kind: "grid", rows: 1, columns: 2, spacing: { x: 1, z: 1 } },
    anchor: { x: 0, y: 0, z: 0 },
    facingDeg: 0,
    seed: 3,
    variation: {
      scale: { min: 1, max: 1 },
      palette: [swatch],
      traits: [],
    },
  };
  const world: IAutoMovieWorldDesign = {
    id: "roof-world",
    units: "meter",
    landmarks: [],
    surfaces: [],
    routes: [],
    effectRecipes: [],
    effectZones: [],
    instanceSets: [design],
  };
  const recipes = new Map([[recipe.id, recipe]]);
  const built = buildInstancedInstanceSet({
    instanceSet: materializeCompiledInstanceSet(design, world, recipes),
    models: new Map(
      [...materializeProductionModels(recipes).values()].map((model) => [
        model.id,
        model,
      ]),
    ),
  });
  const mesh = built.object.children.find(
    (child): child is THREE.InstancedMesh =>
      child instanceof THREE.InstancedMesh,
  )!;
  return [0, 1].map((index) => {
    const color = new THREE.Color();
    mesh.getColorAt(index, color);
    return color;
  });
};

/** One flat slab whose single material color is the swatch under test. */
const paletteRecipe = (swatch: string): IAutoMovieModelRecipe => ({
  id: "slate",
  role: "prop",
  archetype: "primitive-prop",
  parameters: { shape: "box", width: 1, height: 0.05, depth: 1 },
  palette: { slate: swatch },
  lod: [{ tier: "near", maxDistance: null, recipe: "slate" }],
  capabilities: [],
  attachments: [],
});

/**
 * Both paths end in a 32-bit attribute or a float uniform, so they are compared
 * at that width rather than as doubles.
 */
const sameRendered = (left: THREE.Color, right: THREE.Color): boolean =>
  nclose(left.r, right.r, 1e-7) &&
  nclose(left.g, right.g, 1e-7) &&
  nclose(left.b, right.b, 1e-7);
