/**
 * An authored closed lingual body in millimetres, not an MRI reconstruction.
 * Independent dimensions describe the visible body, dorsum and median groove;
 * the two closed endpoints do not model the tongue's actual muscular roots.
 * A named resident material supplies its finish without changing other tissues.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates tongue volume and median groove from oral depth, lips and enamel.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Declares local lingual dimensions and observed oral placement without embedding a person preset.
 */
export interface IPortraitTongueShape {
  /** Transverse body semiaxis in [5,35] mm. */
  halfWidth: number;
  /** Anterior-to-posterior body length in [20,70] mm. */
  length: number;
  /** Vertical body semiaxis in [2,15] mm. */
  halfThickness: number;
  /** Superior mid-body centreline rise in [0,15] mm at the observed expression. */
  dorsumRise: number;
  /** Median groove depression in [0,3] mm, strictly less than halfThickness. */
  grooveDepth: number;
  /** Gaussian transverse groove scale in [0.2,8] mm. */
  grooveWidth: number;
  /** Inferior placement from the observed lower oral anchor in [0,15] mm. */
  drop: number;
  /** Posterior tip placement from the observed lower oral anchor in [0,30] mm. */
  recess: number;
  /** Nonempty existing material identity, independent of enamel and vermilion. */
  material: string;
}

/**
 * Editing envelopes shared by tongue construction and scalar controls. These
 * are finite authoring ranges, not biological population measurements.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Gives each lingual shape axis a stable unit, direction and editable range.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Uses one scalar envelope for detailed editing and complete profile admission.
 */
export const portraitTongueParameters = [
  {
    id: "halfWidth",
    minimum: 5,
    maximum: 35,
    meaning: "Tongue transverse semiaxis",
    effect: "Increasing widens the body without moving the tip or root.",
  },
  {
    id: "length",
    minimum: 20,
    maximum: 70,
    meaning: "Tongue posterior length",
    effect: "Increasing extends the body posteriorly from the tip.",
  },
  {
    id: "halfThickness",
    minimum: 2,
    maximum: 15,
    meaning: "Tongue vertical semiaxis",
    effect: "Increasing thickens both the dorsal and inferior surfaces.",
  },
  {
    id: "dorsumRise",
    minimum: 0,
    maximum: 15,
    meaning: "Observed tongue dorsum rise",
    effect:
      "Increasing raises the mid-body centreline without moving either endpoint.",
  },
  {
    id: "grooveDepth",
    minimum: 0,
    maximum: 3,
    meaning: "Lingual median groove depth",
    effect: "Increasing depresses the central dorsal surface only.",
  },
  {
    id: "grooveWidth",
    minimum: 0.2,
    maximum: 8,
    meaning: "Lingual median groove width",
    effect: "Increasing spreads the median depression laterally.",
  },
  {
    id: "drop",
    minimum: 0,
    maximum: 15,
    meaning: "Tongue inferior placement",
    effect:
      "Increasing lowers the observed tongue frame relative to the lower oral anchor.",
  },
  {
    id: "recess",
    minimum: 0,
    maximum: 30,
    meaning: "Tongue posterior placement",
    effect: "Increasing moves the observed body behind the lower oral anchor.",
  },
] as const;

/**
 * Admit a complete optional tongue before allocating its surface. The median
 * depression cannot consume the upper half of the body.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Refuses incomplete or inverted lingual profiles instead of inventing absent anatomy.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Enforces finite dimensions, positive material identity and the coupled groove-thickness condition.
 */
export function assertPortraitTongueShape(shape: IPortraitTongueShape): void {
  for (const p of portraitTongueParameters)
    if (
      !Number.isFinite(shape[p.id]) ||
      shape[p.id] < p.minimum ||
      shape[p.id] > p.maximum
    )
      throw new Error(
        `Tongue ${p.id} must be finite in [${p.minimum},${p.maximum}] mm.`,
      );
  if (shape.grooveDepth >= shape.halfThickness)
    throw new Error(
      "Tongue groove depth must be less than its half thickness.",
    );
  if (shape.material.trim().length === 0)
    throw new Error("Tongue needs a nonempty resident material identity.");
}
