/**
 * Own scalar editor declarations for skin and hair surface detail.
 * Values are authoring envelopes, not clinical population bounds. The common
 * channel constructor supplies identity, side ownership and attachment context;
 * humanFaceDetail consumes these declarations in its established display order.
 * Component validators still admit coupled dimensions, and document setters
 * own immutable override writes. No subject data or rendered fit is stored here.
 */
import { portraitSkinParameters } from "./components/skinShape";
import {
  type IAutoMovieHumanFaceDetailChannel,
  createHumanFaceDetailChannel as channel,
} from "./humanFaceDetailChannel";

/**
 * Declare skin scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Connects native skin-shape parameters to numerical detail editing.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Preserves each skin parameter ID, unit, interval and effect instead of defining a second skin-shape vocabulary.
 */
export const humanFaceSkinChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    ...portraitSkinParameters.map((p) =>
      channel(
        "skin",
        p.id,
        p.meaning,
        p.unit,
        p.minimum,
        p.maximum,
        p.step,
        p.effect,
      ),
    ),
  ];

/**
 * Declare hair scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes guide width, taper, painted fibres, curl and sampling through hair detail controls.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Uses the same hair profile leaves for the legacy owner and named additional layers, separating painted effects from mesh sampling.
 */
export const humanFaceHairChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "hair",
      "widthScale",
      "Hair lock width multiplier",
      "ratio",
      0.1,
      4,
      0.05,
      "Positive widens every card around its unchanged guide",
    ),
    channel(
      "hair",
      "tipWidth",
      "Hair lock tip/root width",
      "ratio",
      0.05,
      1,
      0.05,
      "Positive leaves broader tips; roots stay unchanged",
    ),
    channel(
      "hair",
      "taperStart",
      "Hair lock taper start",
      "ratio",
      0,
      0.95,
      0.05,
      "Positive retains the full lock width farther from the root before narrowing to the same tip",
    ),
    channel(
      "hair",
      "coverage",
      "Painted fibre coverage",
      "ratio",
      0.1,
      1,
      0.05,
      "Positive fills more of the card's gaps without adding triangles",
    ),
    channel(
      "hair",
      "fibreShadeStrength",
      "Painted fibre shade strength",
      "ratio",
      0,
      1,
      0.05,
      "Zero leaves pigment to the base finish; one retains the original RGB variation without changing alpha, normals or geometry",
    ),
    channel(
      "hair",
      "fibreNormalScale",
      "Painted fibre normal strength",
      "ratio",
      0,
      1,
      0.05,
      "Positive strengthens fibre relief without changing silhouettes or triangles; zero retains the base finish's normal binding",
    ),
    channel(
      "hair",
      "fibreCurl.amplitude",
      "Painted curl transverse excursion",
      "UV fraction",
      0,
      0.5,
      0.01,
      "Positive bends painted fibres farther across the same card; geometry is unchanged",
    ),
    channel(
      "hair",
      "fibreCurl.cycles",
      "Painted curl turns along the card",
      "turns",
      0,
      16,
      0.1,
      "Positive increases the wave frequency without adding mesh fibres",
    ),
    channel(
      "hair",
      "fibreCurl.aspectRatio",
      "Curl normal nominal card width/length",
      "ratio",
      0.01,
      100,
      0.01,
      "Positive turns the transverse normal farther along the wave tangent; alpha is unchanged",
    ),
    channel(
      "hair",
      "segments",
      "Hair guide sampling",
      "count",
      2,
      64,
      1,
      "Positive adds curved-strip segments without adding fibres",
    ),
  ];
