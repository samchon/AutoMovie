import { resolveAutoMovieMaterial } from "@automovie/engine";
import type { IAutoMovieMaterial, IAutoMovieModel } from "@automovie/interface";
import * as THREE from "three";

import {
  AutoMovieTextureCache,
  buildMaterial,
  materialTextureBindings,
} from "./geometry";

/**
 * A shot-owned table of model-declared materials lent to non-model drawables.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves named simulated-surface bindings through the same declared material records as model parts.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Keeps material identity, texture state, and runtime ownership explicit at the render boundary.
 * @author Samchon
 */
export interface IAutoMovieMaterialLibrary {
  /**
   * Return the one built material selected by an id, or `undefined` for the
   * renderer-owned default selected by `null`.
   *
   * The returned object remains owned by this library. A surface builder may
   * borrow it but must not dispose it.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves a named surface to its declared material without hiding an unresolved id behind a fallback.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Supplies one deterministic runtime material for each admitted identity.
   */
  resolve: (material: string | null) => THREE.Material | undefined;

  /**
   * Release every material built by this library, exactly once.
   *
   * Texture instances remain owned by the shot texture cache and are released
   * separately, after the materials that refer to them.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Releases viewer-owned runtime materials at the shot lifetime boundary.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Keeps derived material disposal local to the runtime that built it.
   */
  dispose: () => void;
}

/**
 * Build the exact model material identities requested by simulated surfaces.
 *
 * Model parts cite materials inside one model, but water, soft furnishing, and
 * planting records cite only a material id. Such a citation therefore resolves
 * across the compiled model population and must have exactly one definition.
 * Repeated declarations are one definition only when their complete records are
 * structurally equal. Missing and conflicting declarations are refused before
 * any material is built, so model order can never decide a visible result.
 *
 * Each admitted id is built once and shared by every borrowing surface. Texture
 * assets are primed through the shot cache before synchronous material
 * construction; that cache owns binding-private texture clones and decoded
 * sources, while the returned library owns only the `THREE.Material` objects.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves named simulated-surface bindings through the same PBR construction and texture path as model parts.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Refuses ambiguous or absent material identity and creates one deterministic runtime material per admitted id.
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Assigns derived material and texture resources to explicit shot-lifetime owners.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Keeps material lowering and disposal isolated to one runtime.
 * @author Samchon
 */
export const buildAutoMovieMaterialLibrary = async (props: {
  models: readonly IAutoMovieModel[];
  materialIds: Iterable<string | null>;
  textures?: AutoMovieTextureCache;
}): Promise<IAutoMovieMaterialLibrary> => {
  const requested = new Set<string>();
  for (const id of props.materialIds) {
    if (id === null) continue;
    if (id.trim().length === 0)
      throw new Error("A requested material id must not be blank.");
    requested.add(id);
  }

  const definitions = new Map<string, IAutoMovieMaterial>(
    [...requested].map((id) => [
      id,
      resolveAutoMovieMaterial({ models: props.models, material: id }),
    ]),
  );

  const bindings = [...definitions.values()].flatMap(materialTextureBindings);
  if (bindings.length !== 0 && props.textures === undefined)
    throw new Error(
      "Requested materials bind texture assets but no shot texture cache was supplied.",
    );
  await props.textures?.prime(bindings);

  const materials = new Map(
    [...definitions].map(
      ([id, material]) =>
        [id, buildMaterial(material, props.textures?.resolve)] as const,
    ),
  );
  let disposed = false;
  return {
    resolve: (id) => {
      if (disposed)
        throw new Error(
          "This shot material library has already been disposed.",
        );
      if (id === null) return undefined;
      const material = materials.get(id);
      if (material === undefined)
        throw new Error(`Material "${id}" was not requested by this library.`);
      return material;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const material of materials.values()) material.dispose();
      materials.clear();
    },
  };
};
