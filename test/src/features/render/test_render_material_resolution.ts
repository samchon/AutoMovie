import { resolveAutoMovieMaterial } from "@automovie/engine";
import type { IAutoMovieMaterial } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import { boxModel, material } from "../internal/renderFixtures";

/**
 * A cross-model material id resolves to one definition, never to model order.
 *
 * Scenarios:
 *
 * 1. One declaration resolves directly, while a blank or absent id is refused.
 * 2. Repeated complete records remain one definition even when model order and
 *    nested object property insertion differ.
 * 3. Any conflicting complete record is refused, and the diagnostic lists its
 *    model population in stable code-unit order under either input order.
 */
export const test_render_material_resolution = (): void => {
  const fabric: IAutoMovieMaterial = {
    ...material("fabric"),
    name: "woven fabric",
    baseColorTexture: {
      asset: "textures/fabric.png",
      texCoord: 0,
      colorSpace: "srgb",
      transform: {
        offset: { x: 0.25, y: 0.5 },
        scale: { x: 2, y: 3 },
        rotationDeg: 15,
      },
      sampler: {
        wrapS: "repeat",
        wrapT: "mirror",
        minFilter: "linearMipmapLinear",
        magFilter: "linear",
      },
    },
    doubleSided: true,
  };
  const reordered: IAutoMovieMaterial = {
    doubleSided: true,
    baseColorTexture: {
      sampler: {
        magFilter: "linear",
        minFilter: "linearMipmapLinear",
        wrapT: "mirror",
        wrapS: "repeat",
      },
      transform: {
        rotationDeg: 15,
        scale: { y: 3, x: 2 },
        offset: { y: 0.5, x: 0.25 },
      },
      colorSpace: "srgb",
      texCoord: 0,
      asset: "textures/fabric.png",
    },
    opacity: fabric.opacity,
    emissive: fabric.emissive,
    roughness: fabric.roughness,
    metallic: fabric.metallic,
    baseColor: fabric.baseColor,
    name: fabric.name,
    id: fabric.id,
  };
  const alpha = boxModel({
    id: "alpha",
    materials: [fabric, material("irrelevant")],
  });
  const zeta = boxModel({ id: "zeta", materials: [reordered] });

  TestValidator.equals(
    "one declaration and structurally equal repeats resolve identically",
    [
      resolveAutoMovieMaterial({ models: [alpha], material: "fabric" }),
      resolveAutoMovieMaterial({
        models: [alpha, zeta],
        material: "fabric",
      }),
      resolveAutoMovieMaterial({
        models: [zeta, alpha],
        material: "fabric",
      }),
    ],
    [fabric, fabric, fabric],
  );
  TestValidator.equals(
    "blank and absent ids are explicit refusals",
    [
      throwsError(
        () => resolveAutoMovieMaterial({ models: [alpha], material: "  " }),
        "must not be blank",
      ),
      throwsError(
        () =>
          resolveAutoMovieMaterial({
            models: [alpha],
            material: "missing",
          }),
        ['material "missing"', "is absent"],
      ),
    ],
    [true, true],
  );

  const beta = boxModel({
    id: "beta",
    materials: [{ ...fabric, roughness: 0.25 }],
  });
  const conflict = (
    models: Parameters<typeof resolveAutoMovieMaterial>[0]["models"],
  ) => {
    try {
      resolveAutoMovieMaterial({ models, material: "fabric" });
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  };
  TestValidator.equals(
    "conflict diagnostics are independent of candidate order",
    [conflict([zeta, beta, alpha]), conflict([alpha, beta, zeta])],
    [
      'material "fabric" has conflicting definitions in models: "alpha", "beta", "zeta".',
      'material "fabric" has conflicting definitions in models: "alpha", "beta", "zeta".',
    ],
  );
};
