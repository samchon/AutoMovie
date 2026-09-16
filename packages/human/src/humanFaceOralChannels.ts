/**
 * Own scalar editor declarations for oral chamber, tongue, vermilion and both dental arches.
 * Values are authoring envelopes, not clinical population bounds. The common
 * channel constructor supplies identity, side ownership and attachment context;
 * humanFaceDetail consumes these declarations in its established display order.
 * Component validators still admit coupled dimensions, and document setters
 * own immutable override writes. No subject data or rendered fit is stored here.
 */
import { portraitTongueParameters } from "./components/tongueShape";
import {
  type IAutoMovieHumanFaceDetailChannel,
  createHumanFaceDetailChannel as channel,
} from "./humanFaceDetailChannel";

/**
 * Declare mouth scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes oral cavity wall and chamber dimensions in the same detailed editor as lip shape.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Distinguishes the wall ratio from chamber millimetre dimensions while oral construction admits their combined clearance.
 */
export const humanFaceCavityChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "mouth",
      "cavityWall",
      "Oral straight-wall depth fraction",
      "ratio",
      0,
      0.95,
      0.05,
      "Increasing keeps the opening cross-section deeper before closing; selecting zero still adds a rim-connected lining",
    ),
    channel(
      "mouth",
      "cavityChamber.horizontalExpansion",
      "Oral chamber transverse expansion",
      "mm",
      0,
      30,
      0.1,
      "Adds internal half-width beyond the vestibule without widening the lip aperture",
    ),
    channel(
      "mouth",
      "cavityChamber.verticalExpansion",
      "Oral chamber vertical expansion",
      "mm",
      0,
      30,
      0.1,
      "Adds internal half-height beyond the vestibule without opening the lips",
    ),
    channel(
      "mouth",
      "cavityChamber.transitionDepth",
      "Oral vestibule transition depth",
      "mm",
      0.1,
      60,
      0.1,
      "Sets the depth at which the chamber expansion reaches full weight before the posterior taper",
    ),
  ];

/**
 * Declare tongue scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Connects native tongue dimensions to numerical editing without duplicating their ranges.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Maps tongue parameter IDs and bounds to tongue profile leaves with a millimetre editing step.
 */
export const humanFaceTongueChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    ...portraitTongueParameters.map((p) =>
      channel(
        "tongue",
        p.id,
        p.meaning,
        "mm",
        p.minimum,
        p.maximum,
        0.1,
        p.effect,
      ),
    ),
  ];

/**
 * Declare lowerDentition scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes mandibular arch dimensions and placement through the detailed editor.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Carries lower dentition millimetre controls into the jaw-owned profile without changing upper dentition settings.
 */
export const humanFaceLowerDentalChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "lowerDentition",
      "row.halfWidth",
      "Mandibular arch transverse semiaxis",
      "mm",
      10,
      35,
      0.1,
      "Increasing widens the lower arch without resizing crowns; decreasing narrows it.",
    ),
    channel(
      "lowerDentition",
      "row.depth",
      "Mandibular arch posterior semiaxis",
      "mm",
      8,
      35,
      0.1,
      "Increasing curves lateral lower crowns farther posteriorly; decreasing flattens the arch.",
    ),
    channel(
      "lowerDentition",
      "placement.drop",
      "Lower cervical plane inferior placement",
      "mm",
      0,
      15,
      0.1,
      "Increasing lowers the lower arch behind its lip; decreasing raises it.",
    ),
    channel(
      "lowerDentition",
      "placement.recess",
      "Whole mandibular row posterior placement",
      "mm",
      0,
      15,
      0.1,
      "Increasing recesses lower enamel; decreasing advances it.",
    ),
  ];

/**
 * Declare mouth scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes aperture, commissure, contact and vermilion shape as mouth detail controls.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Keeps mouth profile paths, signed effects and scalar bounds distinct from the shared oral geometry admission.
 */
export const humanFaceLipChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "mouth",
      "widthScale",
      "Oral and vermilion width",
      "ratio",
      0.4,
      1.8,
      0.01,
      "Increasing widens both oral corners; decreasing narrows them.",
    ),
    channel(
      "mouth",
      "openingScale",
      "Observed oral aperture height scale",
      "ratio",
      0.1,
      2,
      0.01,
      "Increasing separates the basis oral margins; decreasing reduces their separation.",
    ),
    channel(
      "mouth",
      "cornerLift",
      "Common oral-corner elevation",
      "mm",
      -6,
      8,
      0.1,
      "Increasing raises both commissures; decreasing lowers them.",
    ),
    channel(
      "mouth",
      "upperLipProjection",
      "Upper vermilion projection",
      "mm",
      -5,
      5,
      0.05,
      "Increasing advances the upper lip; decreasing recesses it.",
    ),
    channel(
      "mouth",
      "lowerLipProjection",
      "Lower vermilion projection",
      "mm",
      -5,
      5,
      0.05,
      "Increasing advances the lower lip; decreasing recesses it.",
    ),
    channel(
      "mouth",
      "seamProjection",
      "Oral contact-line projection",
      "mm",
      -6,
      6,
      0.05,
      "Increasing advances both oral rims; decreasing deepens the contact line without moving the outer lip boundary.",
    ),
    channel(
      "mouth",
      "section.upperBody",
      "Upper vermilion cross-sectional fullness",
      "mm",
      0,
      5,
      0.05,
      "Increasing rounds the upper lip body between its boundaries; decreasing flattens it.",
    ),
    channel(
      "mouth",
      "section.lowerBody",
      "Lower vermilion cross-sectional fullness",
      "mm",
      0,
      5,
      0.05,
      "Increasing rounds the lower lip body between its boundaries; decreasing flattens it.",
    ),
    channel(
      "mouth",
      "section.upperTubercle",
      "Central upper-lip tubercle fullness",
      "mm",
      0,
      3,
      0.05,
      "Increasing advances the central tubercle; decreasing flattens it.",
    ),
    channel(
      "mouth",
      "section.lowerPads",
      "Paired lower-lip pad fullness",
      "mm",
      0,
      3,
      0.05,
      "Increasing advances the paired pads; decreasing flattens them.",
    ),
  ];

/**
 * Declare dentition scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes maxillary arch dimensions, tooth gap and placement through the detailed editor.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Carries fixed maxillary millimetre controls into dentition overrides independently of the moving mandibular arch.
 */
export const humanFaceUpperDentalChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "dentition",
      "row.halfWidth",
      "Maxillary arch transverse semiaxis",
      "mm",
      12,
      40,
      0.1,
      "Increasing widens the arch without resizing individual crowns; decreasing narrows it.",
    ),
    channel(
      "dentition",
      "row.depth",
      "Maxillary arch posterior semiaxis",
      "mm",
      8,
      35,
      0.1,
      "Increasing curves lateral crowns farther posteriorly; decreasing flattens the arch.",
    ),
    channel(
      "dentition",
      "row.gap",
      "Nominal inter-crown arch clearance",
      "mm",
      0,
      2,
      0.01,
      "Increasing separates crowns along the guide; decreasing packs them more closely.",
    ),
    channel(
      "dentition",
      "placement.lift",
      "Whole maxillary row superior placement",
      "mm",
      -4,
      8,
      0.1,
      "Increasing raises the upper row behind the lip; decreasing lowers it.",
    ),
    channel(
      "dentition",
      "placement.recess",
      "Whole maxillary row posterior placement",
      "mm",
      0,
      15,
      0.1,
      "Increasing recesses the row; decreasing advances it.",
    ),
  ];
