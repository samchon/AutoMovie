/**
 * Own scalar editor declarations for ocular dimensions, eyelids and eyebrow/eyelash detail.
 * Values are authoring envelopes, not clinical population bounds. The common
 * channel constructor supplies identity, side ownership and attachment context;
 * humanFaceDetail consumes these declarations in its established display order.
 * Component validators still admit coupled dimensions, and document setters
 * own immutable override writes. No subject data or rendered fit is stored here.
 */
import { portraitEyelashParameters } from "./components/eyelashes";
import {
  type IAutoMovieHumanFaceDetailChannel,
  createHumanFaceDetailChannel as channel,
} from "./humanFaceDetailChannel";

/**
 * Declare lashes scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Connects the native eyelash parameter vocabulary to upper lash profile editing.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Prefixes each native lash parameter with upperLashProfile while retaining its units, bounds, step and effect.
 */
export const humanFaceLashChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    ...portraitEyelashParameters.map((p) =>
      channel(
        "eye",
        `upperLashProfile.${p.id}`,
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
 * Declare eye scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes identity aperture, lid relief, optical dimensions and brow detail through numerical controls.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Separates identity aperture from blink and keeps scalar optical envelopes subordinate to coupled eye construction.
 */
export const humanFaceOcularChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "eye",
      "widthScale",
      "Canthus-to-canthus aperture width",
      "ratio",
      0.4,
      1.8,
      0.01,
      "Increasing widens the aperture; decreasing narrows it.",
    ),
    channel(
      "eye",
      "openingScale",
      "Identity aperture height, independent of blink",
      "ratio",
      0.2,
      2,
      0.01,
      "Increasing separates identity lid margins; decreasing brings them closer.",
    ),
    channel(
      "eye",
      "outerCornerLift",
      "Lateral canthus elevation",
      "mm",
      -6,
      6,
      0.1,
      "Increasing raises the outer canthus; decreasing lowers it.",
    ),
    channel(
      "eye",
      "foldWidth",
      "Superior eyelid crease span",
      "mm",
      0.1,
      10,
      0.1,
      "Increasing moves the superior crease farther from the lid margin; decreasing brings it closer.",
    ),
    channel(
      "eye",
      "foldDepth",
      "Superior palpebral crease depth",
      "mm",
      0,
      3,
      0.05,
      "Increasing recesses the crease; decreasing flattens it.",
    ),
    channel(
      "eye",
      "upperLidVolume",
      "Upper tarsal surface fullness",
      "mm",
      0,
      4,
      0.05,
      "Increasing advances the upper lid body; decreasing flattens it.",
    ),
    channel(
      "eye",
      "lowerLidWidth",
      "Inferior palpebral transition width",
      "mm",
      0.1,
      10,
      0.1,
      "Increasing broadens the lower transition; decreasing narrows it.",
    ),
    channel(
      "eye",
      "lowerLidVolume",
      "Inferior palpebral surface fullness",
      "mm",
      0,
      4,
      0.05,
      "Increasing advances the lower lid roll; decreasing flattens it.",
    ),
    channel(
      "eye",
      "lidThickness",
      "Lid margin anterior support",
      "mm",
      0.01,
      2,
      0.02,
      "Increasing advances the contact margin; decreasing reduces its clearance.",
    ),
    channel(
      "eye",
      "globeLift",
      "Globe depth relative to its skin attachment",
      "mm",
      -8,
      8,
      0.1,
      "Positive advances the globe along the observation ray; negative recesses it. Outer skin targets do not translate with it; final contact still adapts neighbouring tissue.",
    ),
    channel(
      "eye",
      "surfaceRadius",
      "Fitted ocular surface curvature radius",
      "mm",
      8,
      35,
      0.1,
      "Increasing flattens curvature; decreasing strengthens curvature. This is not a measured globe diameter.",
    ),
    channel(
      "eye",
      "irisRadius",
      "Pigmented iris radius",
      "mm",
      2,
      9,
      0.05,
      "Increasing enlarges the limbus; decreasing shrinks it, within the corneal radius.",
    ),
    channel(
      "eye",
      "pupilRadius",
      "Pupillary aperture radius",
      "mm",
      0.2,
      5,
      0.05,
      "Increasing dilates the pupil; decreasing constricts it, within the iris.",
    ),
    channel(
      "eye",
      "cornealRadius",
      "Anterior corneal curvature radius",
      "mm",
      3,
      15,
      0.05,
      "Increasing flattens the corneal cap; decreasing increases its dome, within the optical coupling constraints.",
    ),
    channel(
      "eye",
      "browFibres",
      "Eyebrow fibre population",
      "count",
      0,
      4096,
      1,
      "Increasing adds deterministic fibres; zero omits them without changing the brow support.",
    ),
    channel(
      "eye",
      "browProfile.radius",
      "Individual brow fibre radius",
      "mm",
      0.02,
      0.15,
      0.002,
      "Increasing thickens each fibre; decreasing thins it.",
    ),
    channel(
      "eye",
      "browProfile.span",
      "Brow fibre span across its supporting band",
      "ratio",
      0.02,
      0.8,
      0.01,
      "Increasing lengthens the fibre span; decreasing shortens it within the supporting band.",
    ),
  ];
