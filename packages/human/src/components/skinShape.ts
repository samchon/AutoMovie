/**
 * Skin-shape editing envelopes, not ages or measured elastic moduli. Laxity
 * weights persistent folds, volume loss and descent together; each regional
 * amount remains independently authored. Expression creasing is independent,
 * so a taut face may crease temporarily without acquiring resting age folds.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Gives skin folds and soft-tissue descent named, unit-bearing controls.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Shares scalar defaults and bounds between construction and the numerical editor.
 */
export const portraitSkinParameters = [
  {
    id: "laxity",
    meaning: "Skin laxity (taut to loose)",
    unit: "ratio",
    minimum: 0,
    maximum: 1,
    step: 0.01,
    initial: 0,
    effect:
      "Increasing reveals authored resting folds, tissue descent and volume loss; zero retains taut underlying shape.",
  },
  {
    id: "wrinkleDepth",
    meaning: "Resting crease depth",
    unit: "mm",
    minimum: 0,
    maximum: 2,
    step: 0.05,
    initial: 1,
    effect:
      "Increasing deepens persistent creases, weighted by laxity and regional amounts.",
  },
  {
    id: "wrinkleWidth",
    meaning: "Crease transverse support",
    unit: "mm",
    minimum: 0.5,
    maximum: 3,
    step: 0.05,
    initial: 1.2,
    effect:
      "Increasing broadens crease transitions without increasing their requested depth.",
  },
  {
    id: "forehead",
    meaning: "Transverse forehead folds",
    unit: "ratio",
    minimum: 0,
    maximum: 2,
    step: 0.05,
    initial: 1,
    effect: "Increasing strengthens the forehead's resting fold family.",
  },
  {
    id: "glabella",
    meaning: "Vertical glabellar folds",
    unit: "ratio",
    minimum: 0,
    maximum: 2,
    step: 0.05,
    initial: 1,
    effect: "Increasing strengthens paired inter-brow resting creases.",
  },
  {
    id: "crowFeet",
    meaning: "Lateral canthal folds",
    unit: "ratio",
    minimum: 0,
    maximum: 2,
    step: 0.05,
    initial: 1,
    effect: "Increasing strengthens radiating folds beside both outer canthi.",
  },
  {
    id: "lowerLid",
    meaning: "Inferior orbital folds",
    unit: "ratio",
    minimum: 0,
    maximum: 2,
    step: 0.05,
    initial: 1,
    effect:
      "Increasing strengthens the crease below each lower eyelid without changing optical size.",
  },
  {
    id: "nasolabial",
    meaning: "Nasolabial folds",
    unit: "ratio",
    minimum: 0,
    maximum: 2,
    step: 0.05,
    initial: 1,
    effect: "Increasing deepens the paired alar-to-oral cheek folds.",
  },
  {
    id: "marionette",
    meaning: "Labiomandibular folds",
    unit: "ratio",
    minimum: 0,
    maximum: 2,
    step: 0.05,
    initial: 1,
    effect: "Increasing deepens folds descending from both oral corners.",
  },
  {
    id: "perioral",
    meaning: "Cutaneous upper-lip creases",
    unit: "ratio",
    minimum: 0,
    maximum: 2,
    step: 0.05,
    initial: 0.5,
    effect:
      "Increasing strengthens radial creases above the vermilion, not colour lines on the lip.",
  },
  {
    id: "cheekSag",
    meaning: "Malar tissue descent",
    unit: "mm",
    minimum: 0,
    maximum: 6,
    step: 0.1,
    initial: 2,
    effect:
      "Increasing lowers bilateral cheek tissue in proportion to skin laxity.",
  },
  {
    id: "jowlSag",
    meaning: "Lower-cheek tissue descent",
    unit: "mm",
    minimum: 0,
    maximum: 6,
    step: 0.1,
    initial: 2,
    effect:
      "Increasing lowers tissue beside the oral corners in proportion to skin laxity.",
  },
  {
    id: "underEyeBag",
    meaning: "Infraorbital tissue projection",
    unit: "mm",
    minimum: 0,
    maximum: 3,
    step: 0.05,
    initial: 1,
    effect:
      "Increasing projects the lower orbital pad in proportion to laxity, independently of the eyelid margin.",
  },
  {
    id: "volumeLoss",
    meaning: "Mid-cheek deflation",
    unit: "mm",
    minimum: 0,
    maximum: 4,
    step: 0.1,
    initial: 1,
    effect:
      "Increasing recesses bilateral mid-cheek tissue in proportion to laxity.",
  },
  {
    id: "expressionCreasing",
    meaning: "Expression-dependent crease depth",
    unit: "mm",
    minimum: 0,
    maximum: 1,
    step: 0.05,
    initial: 0,
    effect:
      "Increasing adds transient brow, canthal and perioral creases from current performance, independently of resting laxity.",
  },
] as const;

/**
 * Optional scalar skin settings. Both sides use the same authored amounts but
 * follow their own live anatomical bindings and performance. Omitted values
 * take the documented parameter defaults; zero laxity and expression creasing
 * leave the underlying surface exactly unchanged. This is visible morphology,
 * not a biological age predictor or a viscoelastic simulation.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-skin-condition Separates persistent skin condition from transient expression folds.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-skin-condition Declares one numerical skin layer on the shared anatomical surface.
 */
export type IPortraitSkinShape = Partial<
  Record<(typeof portraitSkinParameters)[number]["id"], number>
>;

/**
 * Resolve owned complete skin settings without clipping invalid input. The
 * same envelopes supply the editor; geometry admission remains a later gate.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Preserves omission defaults and refuses unsupported skin values.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Resolves finite bounded skin settings independently of edit history.
 */
export function resolvePortraitSkinShape(
  input: IPortraitSkinShape = {},
): Required<IPortraitSkinShape> {
  const output = {} as Required<IPortraitSkinShape>;
  for (const parameter of portraitSkinParameters) {
    const value =
      input[parameter.id] === undefined
        ? parameter.initial
        : input[parameter.id]!;
    if (
      !Number.isFinite(value) ||
      value < parameter.minimum ||
      value > parameter.maximum
    )
      throw new Error(`Invalid skin shape: ${parameter.id}.`);
    output[parameter.id] = value;
  }
  return output;
}
