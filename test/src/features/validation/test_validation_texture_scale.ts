import { validateTextureScale } from "@automovie/engine";
import {
  IAutoMovieMaterial,
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieTextureReference,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  hasViolation,
  validationHasWarning,
  validationHasWarningCount,
  violationCount,
} from "../internal/predicates";

/** A structured base-colour binding with only the fields a case cares about. */
const texture = (
  extra: Partial<IAutoMovieTextureReference> = {},
): IAutoMovieTextureReference => ({
  asset: "public/textures/oak.png",
  texCoord: 0,
  colorSpace: "srgb",
  ...extra,
});

/** Turns of the image per coordinate unit, same on both axes unless split. */
const uv = (
  x: number,
  y: number = x,
): NonNullable<IAutoMovieTextureReference["transform"]> => ({
  offset: { x: 0, y: 0 },
  scale: { x, y },
  rotationDeg: 0,
});

const material = (
  id: string,
  base: IAutoMovieMaterial["baseColorTexture"],
  extra: Partial<IAutoMovieMaterial> = {},
): IAutoMovieMaterial =>
  ({
    id,
    baseColorTexture: base,
    ...extra,
  }) as IAutoMovieMaterial;

/** One mesh part whose UV rectangle spans exactly `spanU` by `spanV`. */
const meshPart = (
  id: string,
  materialId: string | null,
  uvs: number[] | null,
): IAutoMovieModelPart => ({
  id,
  name: null,
  geometry: {
    type: "mesh",
    mesh: { positions: [], normals: null, uvs, indices: null, skin: null },
  },
  material: materialId,
  attachedBone: null,
  transform: null,
});

const rect = (spanU: number, spanV: number): number[] => [
  0,
  0,
  spanU,
  0,
  spanU,
  spanV,
  0,
  spanV,
];

const model = (
  parts: IAutoMovieModelPart[],
  materials: IAutoMovieMaterial[],
): IAutoMovieModel =>
  ({
    id: "residence",
    origin: "generated",
    parts,
    skeleton: null,
    body: null,
    materials,
  }) as IAutoMovieModel;

const run = (parts: IAutoMovieModelPart[], materials: IAutoMovieMaterial[]) =>
  validateTextureScale({ models: [model(parts, materials)] });

/**
 * A surface and the material bound to it are measured against each other.
 *
 * The pairing is the only place the question is answerable: `transform.scale`
 * is turns per coordinate unit, so what it means physically is a fact about the
 * surface, and `coordinateSource` is what finally states which unit that is.
 *
 * Scenarios:
 *
 * 1. A `"normalized"` binding on a set that spans more than once is refused on
 *    each offending axis; a span of exactly one, and a span under one, are not.
 * 2. A `"surface-metres"` binding whose implied tile is larger than the
 *    surface's own span warns without failing — the bed-post case from the
 *    `#1902` production, where a 1 m image was bound to a 0.1 m post. A tile
 *    exactly equal to the span passes, and a smaller one passes.
 * 3. Everything that makes no measurable claim is left silent: a legacy bare-id
 *    binding, an omitted `coordinateSource`, a `"source-uv"` set, a clamped
 *    axis, a missing or unusable transform scale, a primitive part, a mesh with
 *    no or degenerate texture coordinates, an unbound part, and a part naming a
 *    material the model does not define.
 */
export const test_validation_texture_scale = (): void => {
  //----
  // NORMALIZED: THE DECLARATION MUST MATCH THE SET
  //----
  const metreUvs = run(
    [meshPart("floor", "oak", rect(9, 4))],
    [material("oak", texture({ coordinateSource: "normalized" }))],
  );
  TestValidator.predicate(
    "a normalized declaration over a nine-metre set is refused on u",
    hasViolation(metreUvs, "type", "parts[0].material.baseColorTexture.u"),
  );
  TestValidator.predicate(
    "the same set is refused on its v axis too",
    hasViolation(metreUvs, "type", "parts[0].material.baseColorTexture.v"),
  );
  TestValidator.equals(
    "each offending axis is reported exactly once",
    violationCount(metreUvs),
    2,
  );

  TestValidator.equals(
    "a set spanning exactly one is the boundary and passes",
    violationCount(
      run(
        [meshPart("panel", "oak", rect(1, 1))],
        [material("oak", texture({ coordinateSource: "normalized" }))],
      ),
    ),
    0,
  );
  TestValidator.equals(
    "a normalized set occupying part of its range is left alone",
    violationCount(
      run(
        [meshPart("island", "oak", rect(0.5, 0.25))],
        [material("oak", texture({ coordinateSource: "normalized" }))],
      ),
    ),
    0,
  );

  //----
  // SURFACE-METRES: THE TILE MUST FIT ON THE SURFACE
  //----
  const bedPost = run(
    [meshPart("bed-post", "oak", rect(0.1, 0.1))],
    [
      material(
        "oak",
        texture({ coordinateSource: "surface-metres", transform: uv(1) }),
      ),
    ],
  );
  TestValidator.predicate(
    "a one-metre tile on a ten-centimetre post warns on u",
    validationHasWarning(
      "bed post u",
      bedPost,
      "range",
      "parts[0].material.baseColorTexture.u",
    ),
  );
  TestValidator.predicate(
    "and on v, without failing the validation",
    validationHasWarningCount("bed post total", bedPost, 2),
  );

  TestValidator.predicate(
    "a tile exactly the size of the surface is the boundary and warns about nothing",
    validationHasWarningCount(
      "exact-fit boundary",
      run(
        [meshPart("panel", "oak", rect(4, 4))],
        [
          material(
            "oak",
            texture({
              coordinateSource: "surface-metres",
              transform: uv(0.25),
            }),
          ),
        ],
      ),
      0,
    ),
  );
  TestValidator.predicate(
    "a tile that fits many times over reports nothing at all",
    validationHasWarningCount(
      "many turns",
      run(
        [meshPart("floor", "oak", rect(9, 4))],
        [
          material(
            "oak",
            texture({ coordinateSource: "surface-metres", transform: uv(2) }),
          ),
        ],
      ),
      0,
    ),
  );
  TestValidator.predicate(
    "a mirrored axis is measured by the tile it implies, not its sign",
    validationHasWarning(
      "negative scale",
      run(
        [meshPart("post", "oak", rect(0.1, 0.1))],
        [
          material(
            "oak",
            texture({ coordinateSource: "surface-metres", transform: uv(-1) }),
          ),
        ],
      ),
      "range",
      "parts[0].material.baseColorTexture.u",
    ),
  );
  TestValidator.predicate(
    "only the axis that does not fit is named",
    validationHasWarningCount(
      "split axes",
      run(
        [meshPart("plank", "oak", rect(0.5, 4))],
        [
          material(
            "oak",
            texture({
              coordinateSource: "surface-metres",
              transform: uv(1, 0.25),
            }),
          ),
        ],
      ),
      1,
    ),
  );
  TestValidator.predicate(
    "every image slot the material binds is measured",
    validationHasWarningCount(
      "all slots",
      run(
        [meshPart("post", "oak", rect(0.1, 0.1))],
        [
          material(
            "oak",
            texture({ coordinateSource: "surface-metres", transform: uv(1) }),
            {
              metallicRoughnessTexture: texture({
                coordinateSource: "surface-metres",
                transform: uv(1),
              }),
              normalTexture: texture({
                coordinateSource: "surface-metres",
                transform: uv(1),
              }),
              occlusionTexture: texture({
                coordinateSource: "surface-metres",
                transform: uv(1),
              }),
              emissiveTexture: texture({
                coordinateSource: "surface-metres",
                transform: uv(1),
              }),
            },
          ),
        ],
      ),
      10,
    ),
  );

  //----
  // SILENCE WHERE NOTHING MEASURABLE WAS CLAIMED
  //----
  const post = (base: IAutoMovieMaterial["baseColorTexture"]) =>
    run([meshPart("post", "oak", rect(0.1, 0.1))], [material("oak", base)]);
  const silent: readonly string[] = [
    "a legacy bare-id binding claims no coordinate unit",
    "an omitted coordinateSource makes no claim to check",
    "a source-uv set has no general physical-scale formula",
    "a clamped axis has already declared a deliberate fit",
    "a binding with no transform states no scale",
    "a non-finite scale is not a tile size",
    "a zero scale implies no finite tile",
    "a material with no image slots binds nothing",
  ];
  TestValidator.equals(
    "nothing measurable was claimed, so nothing is reported",
    [
      post("public/textures/oak.png"),
      post(texture({ transform: uv(1) })),
      post(texture({ coordinateSource: "source-uv", transform: uv(1) })),
      post(
        texture({
          coordinateSource: "surface-metres",
          transform: uv(1),
          sampler: {
            wrapS: "clamp",
            wrapT: "clamp",
            minFilter: "linear",
            magFilter: "linear",
          },
        }),
      ),
      post(texture({ coordinateSource: "surface-metres" })),
      post(
        texture({
          coordinateSource: "surface-metres",
          transform: uv(Number.POSITIVE_INFINITY),
        }),
      ),
      post(texture({ coordinateSource: "surface-metres", transform: uv(0) })),
      post(null),
    ].map((validation, index) => [
      silent[index]!,
      validationHasWarningCount(silent[index]!, validation, 0),
    ]),
    silent.map((title) => [title, true]),
  );

  //----
  // SURFACES THIS VALIDATOR CANNOT MEASURE
  //----
  const bound = material(
    "oak",
    texture({ coordinateSource: "normalized", transform: uv(1) }),
  );
  const primitive: IAutoMovieModelPart = {
    ...meshPart("torso", "oak", null),
    geometry: {
      type: "primitive",
      shape: { type: "box", width: 9, height: 9, depth: 9 },
    },
  } as IAutoMovieModelPart;
  const unmeasurable: readonly string[] = [
    "a primitive's coordinates are produced downstream, not carried",
    "an imported mesh may carry no texture coordinates at all",
    "an empty coordinate array is nothing to measure",
    "a non-finite coordinate makes the whole span unusable",
    "a zero u span is mesh topology's finding, not this one",
    "a zero v span is refused the same way",
    "a part bound to no material has no pair to measure",
    "a part naming an undefined material is model validation's finding",
    "no models is a clean pass rather than an empty claim",
  ];
  TestValidator.equals(
    "an unmeasurable surface is silence, not a guess",
    [
      run([primitive], [bound]),
      run([meshPart("imported", "oak", null)], [bound]),
      run([meshPart("empty", "oak", [])], [bound]),
      run([meshPart("nan", "oak", [0, 0, NaN, 9])], [bound]),
      run([meshPart("seam", "oak", rect(0, 9))], [bound]),
      run([meshPart("edge", "oak", rect(9, 0))], [bound]),
      run([meshPart("unbound", null, rect(9, 9))], [bound]),
      run([meshPart("missing", "walnut", rect(9, 9))], [bound]),
      validateTextureScale({ models: [] }),
    ].map((validation, index) => [
      unmeasurable[index]!,
      validationHasWarningCount(unmeasurable[index]!, validation, 0),
    ]),
    unmeasurable.map((title) => [title, true]),
  );
};
