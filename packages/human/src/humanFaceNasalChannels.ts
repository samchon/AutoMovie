/**
 * Own scalar editor declarations for external nasal dimensions and its attached apertures.
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
 * Declare nose scalar controls for the common document editor.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes external nose support and aperture shape through signed numerical detail controls.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Retains nasal envelope and cavity profile paths and scalar bounds while the nasal component admits their common geometry.
 */
export const humanFaceNasalChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    channel(
      "nose",
      "widthScale",
      "Complete nasal width",
      "ratio",
      0.4,
      1.8,
      0.01,
      "Increasing widens exterior and attached cavities together; decreasing narrows them.",
    ),
    channel(
      "nose",
      "depthScale",
      "Nasal depth relative to facial support",
      "ratio",
      0.25,
      1.5,
      0.01,
      "Increasing projects the full nasal basis; decreasing flattens it toward its support plane.",
    ),
    channel(
      "nose",
      "tipProjection",
      "Nasal tip relief",
      "mm",
      -10,
      10,
      0.1,
      "Increasing advances the tip; decreasing recesses it.",
    ),
    channel(
      "nose",
      "alarProjection",
      "Paired alar relief",
      "mm",
      -5,
      8,
      0.1,
      "Increasing advances the alar bodies; decreasing recesses them.",
    ),
    channel(
      "nose",
      "nostrilWidthScale",
      "Nostril aperture transverse extent",
      "ratio",
      0.2,
      1.8,
      0.01,
      "Increasing widens the opening in its own fitted plane; decreasing narrows it.",
    ),
    channel(
      "nose",
      "nostrilHeightScale",
      "Nostril aperture vertical extent",
      "ratio",
      0.2,
      1.8,
      0.01,
      "Increasing opens the fitted aperture height; decreasing compresses it.",
    ),
    channel(
      "nose",
      "nostrilRise",
      "Nostril aperture elevation",
      "mm",
      -6,
      6,
      0.1,
      "Increasing raises the aperture; decreasing lowers it.",
    ),
    channel(
      "nose",
      "nostrilTilt",
      "Inferior-facing aperture rotation",
      "degrees",
      -25,
      30,
      0.5,
      "Increasing turns the opening downward about head X; decreasing turns it upward.",
    ),
    channel(
      "nose",
      "rimRoundness",
      "Fitted elliptical rim participation",
      "ratio",
      0,
      1,
      0.01,
      "Increasing rounds the measured rim toward its fitted ellipse; decreasing retains its observed contour.",
    ),
  ];
