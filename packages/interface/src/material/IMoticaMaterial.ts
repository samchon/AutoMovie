import { IMoticaColor } from "../color/IMoticaColor";

/**
 * A physically-based (PBR) surface material — the "what it's made of and how it
 * catches light" of a character or object surface.
 *
 * Fields mirror the glTF 2.0 metallic-roughness model so a generated material
 * maps 1:1 onto `three.js` `MeshStandardMaterial`, VRM/MToon inputs, and glTF
 * export. Every coefficient is a scalar documented to `[0, 1]` or an
 * {@link "../color/IMoticaColor"} — the whole material is a small numeric
 * record, which is exactly why an LLM can author or tweak it ("make it more
 * metallic", "rougher", "warmer base color") through structured output; the
 * engine range-checks the coefficients.
 *
 * Texture _maps_ (image-based base color / normal / roughness) are referenced
 * by id rather than embedded — the pixel payload is an asset the engine
 * resolves, not something the LLM emits.
 *
 * Reference: glTF 2.0 `pbrMetallicRoughness`
 * (https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials).
 *
 * @author Samchon
 */
export interface IMoticaMaterial {
  /** Stable id so meshes / scene nodes can cite this material. */
  id: string;

  /** Human / LLM readable label (e.g. `"glossy red plastic"`). Null if unnamed. */
  name: string | null;

  /** Diffuse / albedo base color (linear). */
  baseColor: IMoticaColor;

  /** Metalness, `[0, 1]`. `0` = dielectric, `1` = metal. */
  metallic: number;

  /** Surface roughness, `[0, 1]`. `0` = mirror-smooth, `1` = fully diffuse. */
  roughness: number;

  /**
   * Emissive (self-illumination) color, or `null` for a non-emitting surface.
   * Distinct from a black base color — this surface _adds_ light.
   */
  emissive: IMoticaColor | null;

  /**
   * Opacity, `[0, 1]`. `1` = opaque. Below `1` the engine enables alpha
   * blending. (Mirrors `baseColor.a`; kept explicit for the common author
   * gesture "make it 50% transparent".)
   */
  opacity: number;

  /**
   * Id of an optional base-color texture map. `null` = flat `baseColor` only.
   * The image is an engine-resolved asset, never LLM-emitted pixels.
   */
  baseColorTexture: string | null;
}
