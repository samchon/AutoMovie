import type {
  IAutoMovieMaterial,
  IAutoMovieSceneEnvironment,
  IAutoMovieTextureReference,
} from "@automovie/interface";

/**
 * How to declare a physically-based finish and bind images to it.
 *
 * This file is a mechanism, not a finish library. There is no `marble`, `oak`
 * or `brushedSteel` here to call: the surfaces a production needs are the
 * production's own, and a catalogue would only decide them badly on its behalf.
 * What is worth having in one place is the shape of the declaration, because
 * every wrong-looking surface in a PBR pipeline traces to one of four mistakes
 * this file is arranged to make visible.
 *
 * 1. **Decoding.** A base-color or emissive image is a colour and is stored in
 *    sRGB. A metallic-roughness, normal or occlusion image is a MEASUREMENT and
 *    must stay linear, or every roughness value is silently gamma-shifted and
 *    the whole surface reads too shiny. The engine refuses the wrong intent per
 *    slot rather than correcting it, and refuses one image bound under both.
 * 2. **Repetition.** A tile is not authored at its final size; it is authored once
 *    and repeated by the binding's UV `transform`. The same image tiles a floor
 *    40 times and a table top twice, and each binding keeps its own repeat
 *    because the viewer hands each one its own texture over one decode.
 * 3. **Coverage.** `alphaMode` is stated, not inferred from opacity. `mask` with a
 *    cutoff is what cuts foliage or a perforated screen; `blend` is what a
 *    curtain needs and costs sorting; `opaque` is everything else, and a
 *    transmissive surface must be opaque because its transparency comes from
 *    the transmission lobe, not from alpha.
 * 4. **Provenance.** Every image named here is a registered project asset with a
 *    licence, a digest, and a typed `material-texture` use naming the model
 *    whose materials bind it. Read `ASSET_SOURCING` before acquiring one.
 *
 * The paths and numbers below are illustrative values to edit. Replace them
 * with your own registered assets; do not import these constants as if they
 * were a shipped finish.
 */

/**
 * One image binding: which asset, decoded how, repeated how, sampled how.
 *
 * `texCoord` is 0 because generated automovie geometry provides one UV set.
 * `scale` is the repeat count across that set, `offset` shifts the pattern so
 * two adjacent surfaces do not start their grout line in the same place, and
 * `rotationDeg` turns the pattern without turning the geometry, which is how a
 * herringbone or a diagonal lay is stated.
 */
export const tiledTexture = (props: {
  asset: string;
  colorSpace: IAutoMovieTextureReference["colorSpace"];
  repeat: number;
  offset?: { x: number; y: number };
  rotationDeg?: number;
}): IAutoMovieTextureReference => ({
  asset: props.asset,
  texCoord: 0,
  colorSpace: props.colorSpace,
  transform: {
    offset: props.offset ?? { x: 0, y: 0 },
    scale: { x: props.repeat, y: props.repeat },
    rotationDeg: props.rotationDeg ?? 0,
  },
  sampler: {
    // A tile that does not wrap is a tile that shows its seam, so a repeating
    // pattern wraps on both axes; a decal or a one-off panel clamps instead.
    wrapS: "repeat",
    wrapT: "repeat",
    // Trilinear minification is what stops a repeated floor from shimmering as
    // the camera moves; keep `nearest` for a deliberately pixelated surface.
    minFilter: "linearMipmapLinear",
    magFilter: "linear",
  },
});

/**
 * A repeating surface finish: one pattern, three maps, one repeat count.
 *
 * The three images are the same pattern measured three ways, so they share the
 * transform. Splitting the repeat between them is the classic defect: the
 * normal map lands out of register with the colour and the surface looks lit
 * from a direction nothing in the scene occupies.
 */
export const tiledFinish = (props: {
  id: string;
  baseColorAsset: string;
  metallicRoughnessAsset: string;
  normalAsset: string;
  repeat: number;
}): IAutoMovieMaterial => ({
  id: props.id,
  name: props.id,
  baseColor: { r: 1, g: 1, b: 1, a: 1, hex: null },
  // The maps carry the variation; the scalars stay neutral so the image is not
  // multiplied by a second, invisible tint.
  metallic: 1,
  roughness: 1,
  emissive: null,
  opacity: 1,
  alphaMode: "opaque",
  baseColorTexture: tiledTexture({
    asset: props.baseColorAsset,
    colorSpace: "srgb",
    repeat: props.repeat,
  }),
  metallicRoughnessTexture: tiledTexture({
    asset: props.metallicRoughnessAsset,
    colorSpace: "linear",
    repeat: props.repeat,
  }),
  normalTexture: tiledTexture({
    asset: props.normalAsset,
    colorSpace: "linear",
    repeat: props.repeat,
  }),
  normalScale: 1,
});

/**
 * A cut-out finish: coverage decided per texel by the base color's alpha.
 *
 * `mask` is a hard test, not a blend, so it neither sorts nor costs order
 * dependence; it is what a leaf, a grille, a perforated panel or a chain-link
 * screen is for. `doubleSided` follows from the same fact: a cut-out surface is
 * usually a plane the camera can walk around.
 */
export const cutoutFinish = (props: {
  id: string;
  baseColorAsset: string;
  cutoff: number;
}): IAutoMovieMaterial => ({
  id: props.id,
  name: props.id,
  baseColor: { r: 1, g: 1, b: 1, a: 1, hex: null },
  metallic: 0,
  roughness: 0.8,
  emissive: null,
  opacity: 1,
  alphaMode: "mask",
  alphaCutoff: props.cutoff,
  doubleSided: true,
  baseColorTexture: {
    asset: props.baseColorAsset,
    texCoord: 0,
    colorSpace: "srgb",
  },
});

/**
 * A transmissive finish: glass, water in a basin, a resin panel.
 *
 * Transmission is a physical lobe and needs `opaque` alpha coverage: alpha
 * blending would fade the surface out, which is the opposite of light passing
 * THROUGH it and picking up its tint and thickness on the way. `ior` is the
 * refraction the medium actually has (about 1.5 for soda-lime glass, 1.33 for
 * water) and `thickness` is the volume in metres, not a visual strength dial.
 */
export const transmissiveFinish = (props: {
  id: string;
  ior: number;
  thickness: number;
  roughness: number;
}): IAutoMovieMaterial => ({
  id: props.id,
  name: props.id,
  baseColor: { r: 1, g: 1, b: 1, a: 1, hex: null },
  metallic: 0,
  roughness: props.roughness,
  emissive: null,
  opacity: 1,
  alphaMode: "opaque",
  baseColorTexture: null,
  transmission: 1,
  ior: props.ior,
  thickness: props.thickness,
});

/**
 * An emissive finish: a fixture that adds light to the frame.
 *
 * The emissive colour is what the surface RADIATES, which is why it is separate
 * from a bright base colour: a white lamp shade and a lit lamp shade differ by
 * this field alone. It brightens the fixture itself; a fixture that must also
 * light the room needs a real light beside it, and if the light comes off a
 * panel rather than a point, an `area` light is the kind that says so.
 */
export const emissiveFinish = (props: {
  id: string;
  emissive: { r: number; g: number; b: number };
}): IAutoMovieMaterial => ({
  id: props.id,
  name: props.id,
  baseColor: { r: 0.05, g: 0.05, b: 0.05, a: 1, hex: null },
  metallic: 0,
  roughness: 0.4,
  emissive: { ...props.emissive, a: null, hex: null },
  opacity: 1,
  alphaMode: "opaque",
  baseColorTexture: null,
});

/**
 * The scene's photographic response: what lights it and how it is exposed.
 *
 * `image` is a registered equirectangular HDR and is what makes a
 * physically-based interior read at all : it supplies the sky through a window,
 * the bounce off a floor, and the reflections metal and glass in the shot are
 * showing. `background` is its alternative, not its companion, and exactly one
 * of the two is stated.
 *
 * The curve and the exposure belong here rather than on the render spec,
 * because one render spec covers a whole sequence and a night interior and a
 * noon exterior do not share a response. Shadows are declared cost: enable them
 * deliberately, and give every casting light explicit map size and bias.
 */
export const imageLitEnvironment = (props: {
  image: string;
  intensity: number;
  rotationDeg: number;
  exposure: number;
}): IAutoMovieSceneEnvironment => ({
  image: props.image,
  background: null,
  intensity: props.intensity,
  rotationDeg: props.rotationDeg,
  exposure: props.exposure,
  toneMapping: "acesFilmic",
  shadows: { enabled: true, type: "pcfSoft" },
});
