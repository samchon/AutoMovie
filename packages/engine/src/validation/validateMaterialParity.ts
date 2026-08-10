/**
 * The glTF material vocabulary an automovie material can actually state.
 *
 * `IAutoMovieMaterial` is deliberately the metallic-roughness core plus the
 * four extensions the engine validates and the viewer lowers, so a generated
 * material and an imported one mean the same thing wherever both can speak:
 * base colour, metalness, roughness, normal, occlusion, emissive, alpha
 * coverage, two-sidedness, a UV transform, and the transmission/IOR/clear-coat
 * lobes.
 *
 * Everything else an imported asset may carry is NOT parity. Sheen,
 * iridescence, anisotropy, a specular tint, a volume's attenuation, an emissive
 * strength multiplier, MToon's stylized surface: `three.js` will happily render
 * some of them from the loader's own path, and the imported model would then
 * look like something no generated material in the same shot could match and no
 * validator in this repository has an opinion about. That is the "unsupported
 * analysis dressed as success" the product boundary forbids, so it is reported
 * instead.
 *
 * @author Samchon
 */
import { compareCodeUnits } from "../text/compareCodeUnits";

/** Extension identities whose semantics an automovie material can restate. */
export const AUTO_MOVIE_SUPPORTED_MATERIAL_EXTENSIONS: ReadonlySet<string> =
  new Set([
    "KHR_texture_transform",
    "KHR_materials_transmission",
    "KHR_materials_ior",
    "KHR_materials_clearcoat",
  ]);

/**
 * Whether an extension identity is about materials or textures at all.
 *
 * Decided from the name's own segments rather than from a list of known
 * offenders, because a denylist is silent about the extension published
 * tomorrow. Geometry, lighting and container extensions that name neither
 * (`KHR_draco_mesh_compression`, `KHR_mesh_quantization`,
 * `KHR_lights_punctual`, `VRMC_vrm`) are not this gate's business and are left
 * to theirs. One that DOES name a texture stays this gate's business even when
 * it only changes an encoding: `KHR_texture_basisu` needs a transcoder the
 * viewer installs no loader for, so an asset declaring it does not render at
 * all, and saying so beside the material extensions is more useful than staying
 * silent because the bytes are "only" compressed.
 */
export const isAutoMovieMaterialExtension = (name: string): boolean =>
  name
    .split("_")
    .some((segment) => MATERIAL_SEGMENTS.has(segment.toLowerCase()));

const MATERIAL_SEGMENTS: ReadonlySet<string> = new Set([
  "material",
  "materials",
  "texture",
  "textures",
]);

/**
 * Every material or texture extension an imported asset declares that automovie
 * cannot restate, in code-unit order.
 *
 * Returned as data rather than pushed as a violation because the honest
 * category is a REPORT, not a refusal: the asset still renders, and refusing a
 * licensed model for carrying a sheen lobe would be the engine deciding what
 * art a production may buy. The caller (the production compiler) turns this
 * into a warning diagnostic that names each one.
 */
export const unsupportedAutoMovieMaterialExtensions = (
  extensions: readonly string[],
): string[] =>
  [
    ...new Set(
      extensions.filter(
        (name) =>
          isAutoMovieMaterialExtension(name) &&
          !AUTO_MOVIE_SUPPORTED_MATERIAL_EXTENSIONS.has(name),
      ),
    ),
  ].sort(compareCodeUnits);
