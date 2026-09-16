/**
 * Own scalar editor declarations for facial foundation, cervical continuation, cheek supports and pinnae.
 * Values are authoring envelopes, not clinical population bounds. The common
 * channel constructor supplies identity, side ownership and attachment context;
 * humanFaceDetail consumes these declarations in its established display order.
 * Component validators still admit coupled dimensions, and document setters
 * own immutable override writes. No subject data or rendered fit is stored here.
 */
import {
  type IAutoMovieHumanFaceDetailChannel,
  createHumanFaceDetailChannel as channel,
} from "./humanFaceDetailChannel";

/**
 * Declare neck scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes submental projection as a millimetre edit on the neck profile.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Keeps submental projection within its scalar envelope while cervical construction owns endpoint and tangent continuity.
 */
export const humanFaceNeckChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "neck",
      "submentalProjection",
      "Submental anterior fullness",
      "mm",
      0,
      40,
      0.5,
      "Increasing projects the anterior collar-to-neck transition without changing its endpoint positions or tangents",
    ),
  ];

/**
 * Declare frame scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes facial width, length and named foundation projections through the detailed editor.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Carries signed foundation dimensions into the shared host profile, leaving the host to admit their combined deformation.
 */
export const humanFaceFrameChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "frame",
      "widthScale",
      "Nasion-centred facial width",
      "ratio",
      0.7,
      1.3,
      0.01,
      "Increasing widens the common facial foundation; decreasing narrows it.",
    ),
    channel(
      "frame",
      "lengthScale",
      "Nasion-centred facial length",
      "ratio",
      0.7,
      1.3,
      0.01,
      "Increasing lengthens the common facial foundation; decreasing shortens it.",
    ),
    channel(
      "frame",
      "jawWidth",
      "Mandibular angle breadth",
      "mm",
      -8,
      8,
      0.1,
      "Increasing moves both gonial supports laterally; decreasing draws them medially.",
    ),
    channel(
      "frame",
      "chinHeight",
      "Gnathion inferior extent",
      "mm",
      -8,
      8,
      0.1,
      "Increasing lowers the chin; decreasing raises it.",
    ),
    channel(
      "frame",
      "chinProjection",
      "Pogonion anterior prominence",
      "mm",
      -8,
      8,
      0.1,
      "Increasing advances the chin; decreasing recesses it.",
    ),
    channel(
      "frame",
      "foreheadProjection",
      "Frontal midline prominence",
      "mm",
      -8,
      8,
      0.1,
      "Increasing advances the forehead; decreasing recesses it.",
    ),
    channel(
      "frame",
      "browProjection",
      "Superior-orbit foundation projection",
      "mm",
      -8,
      8,
      0.1,
      "Increasing advances both brow supports before eyelid fitting; decreasing recesses them without moving the aperture basis.",
    ),
    channel(
      "frame",
      "templeWidth",
      "Temporal breadth",
      "mm",
      -8,
      8,
      0.1,
      "Increasing widens both temporal supports; decreasing narrows them.",
    ),
  ];

/**
 * Declare cheek scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes malar, medial, buccal and nasolabial detail with independent cheek ownership.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Keeps cheek projections and groove depth in millimetres while the cheek component owns shared-skin attachment.
 */
export const humanFaceCheekChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "cheek",
      "malar.projection",
      "Malar support projection",
      "mm",
      -5,
      10,
      0.1,
      "Increasing advances the zygomatic cheek support; decreasing recesses it.",
    ),
    channel(
      "cheek",
      "medial.projection",
      "Medial cheek support projection",
      "mm",
      -5,
      10,
      0.1,
      "Increasing advances the cheek beside the nose; decreasing recesses it.",
    ),
    channel(
      "cheek",
      "buccal.projection",
      "Buccal support projection",
      "mm",
      -5,
      10,
      0.1,
      "Increasing fills the lower lateral cheek; decreasing hollows it.",
    ),
    channel(
      "cheek",
      "foldDepth",
      "Nasolabial groove depth",
      "mm",
      0,
      3,
      0.05,
      "Increasing recesses the nasolabial path; decreasing flattens it.",
    ),
  ];

/**
 * Declare ear scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes pinna span, projection, tilt and signed vertical placement as numerical details.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Preserves the ear profile paths and units used by side-specific overrides and temporal attachment.
 */
export const humanFaceEarChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "ear",
      "heightScale",
      "Pinna vertical outline",
      "ratio",
      0.5,
      2,
      0.01,
      "Increasing elongates the pinna; decreasing shortens it.",
    ),
    channel(
      "ear",
      "depthScale",
      "Pinna anterior-posterior outline",
      "ratio",
      0.3,
      1.8,
      0.01,
      "Increasing broadens the pinna's sagittal extent; decreasing narrows it.",
    ),
    channel(
      "ear",
      "projection",
      "Pinna projection beyond temporal skin",
      "mm",
      1,
      25,
      0.1,
      "Increasing projects the posterior pinna rim; decreasing draws it closer to the head.",
    ),
    channel(
      "ear",
      "centerY",
      "Pinna centre elevation",
      "mm",
      -25,
      30,
      0.1,
      "Increasing raises the whole pinna; decreasing lowers it.",
    ),
    channel(
      "ear",
      "centerZ",
      "Pinna centre anterior placement",
      "mm",
      -90,
      -10,
      0.1,
      "Increasing moves the pinna forward; decreasing moves it posteriorly.",
    ),
  ];
