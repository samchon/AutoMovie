import type { IAutoMovieHumanFaceDocument } from "./IAutoMovieHumanFaceDocument";
import { portraitEyelashParameters } from "./components/eyelashes";
import { portraitSkinParameters } from "./components/skinShape";
import { portraitTongueParameters } from "./components/tongueShape";
import { humanFaceRegionValue, humanFaceRegions } from "./humanFaceRegion";
import { mergeHumanFaceSettings } from "./mergeHumanFaceSettings";

/**
 * A numerical anatomical channel. Identity neutral is the versioned basis
 * value, not a universal person's dimension. Coupled geometry still requires
 * successful construction; these scalar envelopes cannot prove attachment.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Gives detailed editor channels stable anatomical semantics and signed units.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Declares scalar editing envelopes separately from coupled geometry admission.
 * @author Samchon
 */
export interface IAutoMovieHumanFaceDetailChannel {
  /** Stable path beneath the detailed profile, independent of the person. */
  id: string;
  /** Anatomical profile owning this channel. */
  region: (typeof humanFaceRegions)[number];
  /** Field path beneath that profile. */
  path: readonly string[];
  /** Anatomical meaning, also shown by the editor. */
  meaning: string;
  /** Millimetres, degrees, a dimensionless ratio or a discrete count. */
  unit: string;
  /** Inclusive authoring-envelope minimum. */
  minimum: number;
  /** Inclusive authoring-envelope maximum. */
  maximum: number;
  /** Slider interval; numeric entry may retain finer valid precision. */
  step: number;
  /** The exact neutral is read from this document's inherited basis. */
  neutral: "basis";
  /** Positive and negative changes keep this interpretation for every person. */
  effect: string;
  /** Whether right and left can override this profile independently. */
  paired: boolean;
  /** Shared geometry reference used when the value is constructed. */
  attachment: string;
}

const channel = (
  region: Exclude<
    IAutoMovieHumanFaceDetailChannel["region"],
    "hairLayers" | "skinColour"
  >,
  path: string,
  meaning: string,
  unit: string,
  minimum: number,
  maximum: number,
  step: number,
  effect: string,
): IAutoMovieHumanFaceDetailChannel => ({
  id: `${region}.${path}`,
  region,
  path: path.split("."),
  meaning,
  unit,
  minimum,
  maximum,
  step,
  neutral: "basis",
  effect,
  paired: region === "eye" || region === "cheek" || region === "ear",
  attachment: {
    skin: "live bilateral eye/brow and oral attachments on the shared skin",
    hair: "authored scalp-root guides in head millimetres",
    frame:
      "basis.host: nasion, gonial, gnathion, pogonion, frontal and temporal supports; basis.bindings.eyes: bilateral brow foundation",
    eye: "basis.bindings.eyes: shared skin margin and identity optical centre",
    nose: "basis.bindings.nose: exterior support and shared cavity rims",
    mouth: "basis.bindings.mouth: common vermilion and oral margins",
    tongue:
      "basis.bindings.mouth.lower and jawHinge: observed oral frame with posterior anchoring",
    cheek: "basis.bindings.cheeks: malar, medial, buccal and modiolus anchors",
    cranium:
      "basis.host facial oval: shared forehead, temple and mandibular boundary",
    ear: "resolved temporal skin: embedded pinna root",
    neck: "cranial collar: continuous cervical sections",
    dentition: "basis.bindings.dentition: fixed maxillary frame",
    lowerDentition:
      "basis.bindings.mouth.lower and jawHinge: observed mandibular frame",
    orbits: "recipe.orbits: retained superior-orbit anchors",
    relief: "named supplemental skin supports",
    curves: "named supplemental anatomical curves",
  }[region],
});

/**
 * Scalar controls on the component profiles. Array and complete-object profiles
 * remain independently replaceable through the same region document editor.
 * Ranges are editing envelopes; the part's coupled validator remains decisive.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Connects numerical sliders to actual detailed shape settings.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Provides field meaning, applied-value inspection and anatomical attachment context.
 */
export const humanFaceDetailChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
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

/**
 * Read one present scalar from the final applied anatomical profile.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Displays actual combined values rather than echoing a slider's requested number.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Resolves side-aware scalar display through the document interpreter.
 */
export function humanFaceDetailValue(
  document: IAutoMovieHumanFaceDocument,
  id: string,
  side?: "right" | "left",
): number | undefined {
  const definition = definitionOf(id);
  let value: unknown = humanFaceRegionValue(document, definition.region, side);
  for (const key of definition.path) {
    if (value === undefined) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value as number | undefined;
}

/**
 * Write or remove one exact scalar override without flattening the rest of a
 * profile into explicit values. Subsequent trait edits retain every other edit.
 * Removal never creates a missing path. Empty ancestors of the removed leaf
 * return to omission, so an inherited optional component stays optional.
 * Shared authored objects are detached along the edited path, so neither a
 * write nor removal can alter another owner through a caller-supplied alias.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Separates one user detail from inherited settings and independent sides.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Preserves override intent rather than serializing a derived combined profile.
 */
export function setHumanFaceDetail(
  document: IAutoMovieHumanFaceDocument,
  id: string,
  value: number | undefined,
  side?: "right" | "left",
): IAutoMovieHumanFaceDocument {
  const definition = definitionOf(id);
  assertDetailValue(definition, value);
  if (
    side !== undefined &&
    (!definition.paired || (side !== "right" && side !== "left"))
  )
    throw new Error("This detail does not have that independent side owner.");
  const next = structuredClone(document);
  const path = [
    ...(side === undefined ? ["detail"] : ["asymmetry", side]),
    definition.region,
    ...definition.path,
  ];
  return writeDetail(next, path, value);
}

/**
 * Edit one named additional hair layer with the existing hair scalar vocabulary.
 * The selected authored population becomes a whole-array override, preserving
 * every other layer and the separate legacy hair owner. Clearing one scalar is
 * deliberately absent: inheritance resets the entire additional-layer region.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Edits a named layer's numeric profile without requiring its guide array to be re-entered.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Uses the same hair channel bounds and units while retaining complete-array replacement semantics.
 */
export function setHumanFaceHairLayerDetail(
  document: IAutoMovieHumanFaceDocument,
  layerId: string,
  id: string,
  value: number,
): IAutoMovieHumanFaceDocument {
  const definition = definitionOf(id);
  if (definition.region !== "hair")
    throw new Error("A hair layer accepts only hair detail channels.");
  assertDetailValue(definition, value);
  const layers = mergeHumanFaceSettings(
    document.basis.recipe.hairLayers,
    document.detail?.hairLayers,
  );
  const index = layers?.findIndex((layer) => layer.id === layerId) ?? -1;
  if (index < 0) throw new Error("The selected hair layer does not exist.");
  const next = structuredClone(document);
  (next.detail ??= {}).hairLayers = layers;
  return writeDetail(
    next,
    ["detail", "hairLayers", String(index), "profile", ...definition.path],
    value,
  );
}

function assertDetailValue(
  definition: IAutoMovieHumanFaceDetailChannel,
  value: number | undefined,
): void {
  if (
    value !== undefined &&
    (!Number.isFinite(value) ||
      value < definition.minimum ||
      value > definition.maximum ||
      (definition.unit === "count" && !Number.isInteger(value)))
  )
    throw new Error(`Invalid numerical detail: ${definition.id}.`);
}

function writeDetail(
  next: IAutoMovieHumanFaceDocument,
  path: readonly string[],
  value: number | undefined,
): IAutoMovieHumanFaceDocument {
  let object = next as unknown as Record<string, unknown>;
  const ancestors: { object: Record<string, unknown>; key: string }[] = [];
  for (const key of path.slice(0, -1)) {
    if (object[key] === undefined) {
      if (value === undefined) return next;
      object[key] = {};
    } else {
      // structuredClone preserves aliases. Detach only the containers on this
      // path so a selected side/layer cannot also edit its basis or sibling.
      const child = object[key] as Record<string, unknown> | unknown[];
      object[key] = Array.isArray(child) ? [...child] : { ...child };
    }
    ancestors.push({ object, key });
    object = object[key] as Record<string, unknown>;
  }
  const key = path[path.length - 1];
  if (value === undefined) {
    if (!Object.hasOwn(object, key)) return next;
    delete object[key];
    for (const parent of ancestors.reverse()) {
      if (Object.keys(object).length !== 0) break;
      delete parent.object[parent.key];
      object = parent.object;
    }
  } else object[key] = value;
  return next;
}

function definitionOf(id: string): IAutoMovieHumanFaceDetailChannel {
  const definition = humanFaceDetailChannels.find(
    (channel) => channel.id === id,
  );
  if (definition === undefined)
    throw new Error(`Unknown anatomical detail: ${id}.`);
  return definition;
}
