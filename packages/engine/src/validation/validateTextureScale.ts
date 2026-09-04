import {
  IAutoMovieMaterial,
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieTextureReference,
  IAutoMovieValidation,
} from "@automovie/interface";

import { ViolationCollector } from "./violation";

/**
 * Relative slack allowed before a measured UV span is called wrong.
 *
 * The two comparisons this validator makes are exact statements about a ratio,
 * not tolerances a production tunes: a normalized set covers its surface once,
 * and a tile either fits on the surface it is bound to or it does not. What
 * needs slack is only the floating-point sum that produced the span, which a
 * generated mesh accumulates one vertex at a time, so the bound is relative to
 * the compared magnitude rather than an absolute metre figure.
 */
const SCALE_EPSILON = 1e-9;

/** The PBR slots that bind an image and can therefore imply a tile size. */
const TEXTURE_SLOTS = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "normalTexture",
  "occlusionTexture",
  "emissiveTexture",
] as const;

/**
 * Measure whether a surface and the material bound to it agree about scale.
 *
 * A material record alone cannot answer this and never could. `transform.scale`
 * is turns of an image per unit of a coordinate source, so the physical size it
 * implies is a fact about the SURFACE, and until a binding declared its
 * {@link IAutoMovieTextureReference.coordinateSource} the unit that scale was
 * expressed in was not stated anywhere either. Both halves now exist at one
 * place — a part carries the mesh, the part names the material — which is the
 * only place in the pipeline where the question is answerable at all.
 *
 * Two things become decidable there, and this validator deliberately treats
 * them as different kinds of finding.
 *
 * A binding that declares `"normalized"` against a set whose measured span
 * EXCEEDS one is refused. That is not an aesthetic judgement: "normalized"
 * means the set covers the whole surface exactly once, so a span of nine is the
 * declaration contradicting the geometry it was bound to, and every downstream
 * repeat count computed from it is arithmetic on a unit that does not exist. A
 * span under one is left alone, because a set may legitimately occupy part of
 * its range.
 *
 * A `"surface-metres"` binding whose implied tile (`1 / scale`) is LARGER than
 * the surface's own span is warned about instead. The surface cannot show one
 * whole turn of the image, so a nail-sized crop of a wood grain stretches
 * across a bed post and reads as flat paint — which is exactly how it failed
 * once nothing measured it. It stays a warning because that same geometry is
 * how a single image is legitimately fitted to one face, and the engine cannot
 * read the intent from the numbers. A binding whose sampler clamps that axis
 * HAS stated the intent, so it is not warned about.
 *
 * Out of scope on purpose: `"source-uv"` sets, whose unit has no general
 * formula; bindings that omit `coordinateSource`, which make no claim to check;
 * primitive geometry, whose texture coordinates are produced downstream rather
 * than carried; a degenerate span, which is mesh topology's finding, not this
 * one; and a part naming a material the model does not define, which model
 * validation already reports.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `validateTextureScale` detects a texture coordinate and real-scale conflict between a surface and the material bound to it instead of leaving the pairing unchecked.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-surface-visual The validator implements the texture scale and coordinate-set subset of surface validation by measuring the bound mesh's own span, without claiming seam, state, or frame review.
 * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale `validateTextureScale` holds a declared coordinate system and real scale to the surface it is applied to, so the same declaration places the same way.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations The validator checks the binding record's coordinate set and coordinate transform against the surface it joins without letting an image decide the material's scale.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-coordinate-convention The validator is what holds a declared coordinate source to the surface it was bound to, so the convention is a checked contract rather than prose beside a type.
 * @author Samchon
 */
export const validateTextureScale = (props: {
  models: readonly IAutoMovieModel[];
}): IAutoMovieValidation => {
  const out = new ViolationCollector();
  props.models.forEach((model, modelIndex) => {
    const materials = new Map(
      model.materials.map((material) => [material.id, material]),
    );
    model.parts.forEach((part, partIndex) => {
      const span = surfaceSpan(part);
      if (span === null) return;
      if (part.material === null) return;
      const material = materials.get(part.material);
      if (material === undefined) return;
      for (const slot of TEXTURE_SLOTS) {
        const binding = material[slot];
        if (binding === null || binding === undefined) continue;
        if (typeof binding === "string") continue;
        checkBinding({
          binding,
          slot,
          span,
          part,
          material,
          path: `$input.models[${modelIndex}].parts[${partIndex}]`,
          out,
        });
      }
    });
  });
  return out.toValidation();
};

/**
 * The extent a part's own texture coordinates cover, or `null` when the part
 * carries none to measure.
 *
 * A primitive's coordinates are produced downstream rather than stored, an
 * imported mesh may have none at all, and a span of zero on either axis is a
 * degenerate layout whose owner is mesh topology. Each of those is a reason to
 * say nothing here rather than to invent a measurement.
 */
const surfaceSpan = (
  part: IAutoMovieModelPart,
): { u: number; v: number } | null => {
  if (part.geometry.type !== "mesh") return null;
  const uvs = part.geometry.mesh.uvs;
  if (uvs === null || uvs.length < 2) return null;
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i + 1 < uvs.length; i += 2) {
    const u = uvs[i]!;
    const v = uvs[i + 1]!;
    if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const u = maxU - minU;
  const v = maxV - minV;
  return u > 0 && v > 0 ? { u, v } : null;
};

/** Both axes of one structured binding against one measured surface. */
const checkBinding = (props: {
  binding: IAutoMovieTextureReference;
  slot: (typeof TEXTURE_SLOTS)[number];
  span: { u: number; v: number };
  part: IAutoMovieModelPart;
  material: IAutoMovieMaterial;
  path: string;
  out: ViolationCollector;
}): void => {
  const source = props.binding.coordinateSource;
  if (source === undefined || source === "source-uv") return;
  const axes = [
    {
      name: "u" as const,
      span: props.span.u,
      scale: props.binding.transform?.scale.x,
      wrap: props.binding.sampler?.wrapS,
    },
    {
      name: "v" as const,
      span: props.span.v,
      scale: props.binding.transform?.scale.y,
      wrap: props.binding.sampler?.wrapT,
    },
  ];
  for (const axis of axes) {
    const path = `${props.path}.material.${props.slot}.${axis.name}`;
    if (source === "normalized") {
      // A declared normalized set covers its surface exactly once, so a span
      // past one is the declaration disagreeing with the geometry rather than a
      // scale anyone chose. Reported without the transform, because the
      // contradiction is in the set itself.
      if (axis.span > 1 + SCALE_EPSILON)
        props.out.push(
          "type",
          path,
          `part "${props.part.id}" spans ${axis.span} in ${axis.name} but material "${props.material.id}" declares "normalized" texture coordinates on ${props.slot}; a normalized set covers its surface exactly once, so declare "surface-metres" or normalize the set`,
          axis.span,
          axis.span - 1,
        );
      continue;
    }
    // "surface-metres": the span is the surface's own extent and 1 / scale is
    // the tile the finish claims, so the two are directly comparable metres.
    if (axis.scale === undefined) continue;
    if (!Number.isFinite(axis.scale) || axis.scale === 0) continue;
    if (axis.wrap === "clamp") continue;
    const tile = 1 / Math.abs(axis.scale);
    if (tile <= axis.span * (1 + SCALE_EPSILON)) continue;
    props.out.warn(
      "range",
      path,
      `part "${props.part.id}" spans ${axis.span} m in ${axis.name} but material "${props.material.id}" implies a tile of ${tile} m on ${props.slot}; the surface cannot show one whole turn of a repeating image, so state the tile the surface can carry or clamp the axis to declare a deliberate fit`,
      tile,
      tile - axis.span,
    );
  }
};
