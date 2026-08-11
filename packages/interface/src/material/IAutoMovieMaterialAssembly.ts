/**
 * What a substance _is_, separately from how its surface catches light.
 *
 * {@link IAutoMovieMaterial} answers the optical question and nothing else: a
 * base colour, a roughness, a normal map. That is the right record for a
 * renderer and the wrong one for a wall, because a wall's thickness, weight,
 * warmth, and wear are not properties of an image. Splitting them means one
 * substance can be shown by different surfaces (the same stone polished and
 * flamed) and one surface can stand in for different substances, without either
 * record having to lie about the other.
 *
 * Every physical property is optional and every one is `null` until measured. A
 * production that never runs a thermal or acoustic study leaves them null and
 * loses nothing; a production that does gets its inputs from the same record
 * the geometry cites, rather than from a table kept beside the model.
 *
 * The engine ships no substances. Names, classifications, and values are the
 * production's to author, because a catalogue of real-world materials is
 * content, and content is the customer's.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `IAutoMovieMaterialSubstance` as the portable data boundary for the interior surface substance product requirement.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `IAutoMovieMaterialSubstance` for the interior space surface assembly region system contract.
 */
export interface IAutoMovieMaterialSubstance {
  /**
   * Stable id so a layer can cite this substance.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `id` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `id` for the interior space surface assembly region system contract.
   */
  id: string;

  /**
   * Human / LLM readable label, or `null` when unnamed.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `name` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `name` for the interior space surface assembly region system contract.
   */
  name: string | null;

  /**
   * Open classification such as `stone`, `timber`, `metal`, `board`, or a
   * production-specific family. Open on purpose: an era, a fiction, or a
   * speculative building brings its own families.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `classification` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `classification` for the interior space surface assembly region system contract.
   */
  classification: string;

  /**
   * Bulk density in kg/m³, strictly above zero, or `null` when unmeasured.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `density` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `density` for the interior space surface assembly region system contract.
   */
  density: number | null;

  /**
   * Thermal conductivity in W/(m·K), non-negative, or `null`.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `thermalConductivity` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `thermalConductivity` for the interior space surface assembly region system contract.
   */
  thermalConductivity: number | null;

  /**
   * Specific heat capacity in J/(kg·K), strictly above zero, or `null`.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `specificHeat` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `specificHeat` for the interior space surface assembly region system contract.
   */
  specificHeat: number | null;

  /**
   * Fractional sound absorption in `[0, 1]`, or `null`.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `soundAbsorption` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `soundAbsorption` for the interior space surface assembly region system contract.
   */
  soundAbsorption: number | null;

  /**
   * Dimensionless water-vapour resistance factor (µ), at least `1`, or `null`.
   * `1` is still air; a vapour barrier is in the tens of thousands.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `vapourResistance` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `vapourResistance` for the interior space surface assembly region system contract.
   */
  vapourResistance: number | null;

  /**
   * Expected service life in years, strictly above zero, or `null`.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `serviceLife` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `serviceLife` for the interior space surface assembly region system contract.
   */
  serviceLife: number | null;

  /**
   * {@link IAutoMovieMaterial} id this substance is shown with, or `null`.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `surface` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `surface` for the interior space surface assembly region system contract.
   */
  surface: string | null;
}

/**
 * One ordered constituent of a layered build-up.
 *
 * A layer is not only a material and a thickness. It states what occupies the
 * layer, whether the layer is meant to be seen, and whether it continues around
 * the reveal of an opening cut through the host, because those three facts are
 * what decide the finished dimension a performer actually touches.
 *
 * @evidence requirements/interior/materials-and-physical-properties.md#interior-material-visual-physical Exposes `IAutoMovieMaterialLayer` as the portable data boundary for the interior material visual physical requirement.
 * @evidence specifications/interior-space/materials-style-and-art.md#interior-space-material-facts-analysis-boundary Types `IAutoMovieMaterialLayer` for the interior space material facts analysis boundary system contract.
 */
export interface IAutoMovieMaterialLayer {
  /**
   * Stable id, unique inside one assembly.
   *
   * @evidence requirements/interior/materials-and-physical-properties.md#interior-material-visual-physical Exposes `id` as the portable data boundary for the interior material visual physical requirement.
   * @evidence specifications/interior-space/materials-style-and-art.md#interior-space-material-facts-analysis-boundary Types `id` for the interior space material facts analysis boundary system contract.
   */
  id: string;

  /**
   * Open construction role such as `structure`, `insulation`, `barrier`, or
   * `finish`. Roles are matched across a junction to decide which layers
   * continue and which stop, so the same word must mean the same thing on both
   * sides of that junction; nothing else reads it.
   *
   * @evidence requirements/interior/materials-and-physical-properties.md#interior-material-visual-physical Exposes `role` as the portable data boundary for the interior material visual physical requirement.
   * @evidence specifications/interior-space/materials-style-and-art.md#interior-space-material-facts-analysis-boundary Types `role` for the interior space material facts analysis boundary system contract.
   */
  role: string;

  /**
   * What occupies the layer.
   *
   * A `solid` carries a substance and real thickness. A `cavity` is a
   * ventilated air gap: it has thickness and deliberately no substance. A
   * `membrane` is a continuous sheet whose job is to be unbroken rather than
   * thick, so it carries a substance and may measure zero.
   *
   * @evidence requirements/interior/materials-and-physical-properties.md#interior-material-visual-physical Exposes `substance` as the portable data boundary for the interior material visual physical requirement.
   * @evidence specifications/interior-space/materials-style-and-art.md#interior-space-material-facts-analysis-boundary Types `substance` for the interior space material facts analysis boundary system contract.
   */
  substance: "solid" | "cavity" | "membrane";

  /**
   * Layer thickness in metres along the assembly's stacking axis.
   *
   * @evidence requirements/interior/materials-and-physical-properties.md#interior-material-visual-physical Exposes `thickness` as the portable data boundary for the interior material visual physical requirement.
   * @evidence specifications/interior-space/materials-style-and-art.md#interior-space-material-facts-analysis-boundary Types `thickness` for the interior space material facts analysis boundary system contract.
   */
  thickness: number;

  /**
   * {@link IAutoMovieMaterialSubstance} id, or `null` for a cavity.
   *
   * @evidence requirements/interior/materials-and-physical-properties.md#interior-material-visual-physical Exposes `material` as the portable data boundary for the interior material visual physical requirement.
   * @evidence specifications/interior-space/materials-style-and-art.md#interior-space-material-facts-analysis-boundary Types `material` for the interior space material facts analysis boundary system contract.
   */
  material: string | null;

  /**
   * Whether this layer is a visible finish.
   *
   * A finish must be reachable from an exposed end of the stack. A finish
   * buried behind another layer is a defect, not a decoration, and so is a
   * second finish laid over the first.
   *
   * @evidence requirements/interior/materials-and-physical-properties.md#interior-material-visual-physical Exposes `finish` as the portable data boundary for the interior material visual physical requirement.
   * @evidence specifications/interior-space/materials-style-and-art.md#interior-space-material-facts-analysis-boundary Types `finish` for the interior space material facts analysis boundary system contract.
   */
  finish: boolean;

  /**
   * Whether the layer continues around the reveal of an opening in the host.
   *
   * A wrapping layer narrows the finished opening on every side and lines the
   * jamb to its own depth. A layer that stops at the jamb does neither.
   *
   * Wrapping is a run that starts at a face: a layer cannot turn the corner
   * into the reveal from behind one that already ended at the jamb, so setting
   * this on a buried layer is a defect rather than a deeper lining.
   *
   * @evidence requirements/interior/materials-and-physical-properties.md#interior-material-visual-physical Exposes `wrapsOpening` as the portable data boundary for the interior material visual physical requirement.
   * @evidence specifications/interior-space/materials-style-and-art.md#interior-space-material-facts-analysis-boundary Types `wrapsOpening` for the interior space material facts analysis boundary system contract.
   */
  wrapsOpening: boolean;
}

/**
 * An ordered layer build-up applied to one host element.
 *
 * This is the third of the three material records the requirement separates:
 * the substance, the visible surface, and the assembly. It exists because a
 * single colour cannot say that a wall is 300 mm of structure, cavity,
 * insulation, barrier, and board, and because that build-up — not the colour —
 * is what sets the wall's overall thickness, the depth of a window reveal, and
 * which layers survive a junction with the next wall.
 *
 * The stack is measured, not drawn: {@link axis} names the host-local direction
 * the layers advance along, {@link sense} whether they advance with or against
 * that axis, and {@link offset} where the first layer's outer face sits relative
 * to the host's reference plane. That triple is what lets a build-up be stated
 * once and applied to a wall, a floor, and a soffit without rewriting it for
 * each.
 *
 * The engine ships no build-ups. A layered wall, a tiled floor, and a coffered
 * ceiling are all the same record with the production's own layers in it.
 *
 * @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-assembly-quantity-representation Exposes `IAutoMovieMaterialAssembly` as the portable data boundary for the building exterior assembly quantity representation requirement.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-material-assembly-failures Types `IAutoMovieMaterialAssembly` for the building envelope material assembly failures system contract.
 */
export interface IAutoMovieMaterialAssembly {
  /**
   * Stable assembly id.
   *
   * @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-assembly-quantity-representation Exposes `id` as the portable data boundary for the building exterior assembly quantity representation requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-material-assembly-failures Types `id` for the building envelope material assembly failures system contract.
   */
  id: string;

  /**
   * Host-local axis the layers stack along.
   *
   * @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-assembly-quantity-representation Exposes `axis` as the portable data boundary for the building exterior assembly quantity representation requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-material-assembly-failures Types `axis` for the building envelope material assembly failures system contract.
   */
  axis: "x" | "y" | "z";

  /**
   * Whether layer order advances along the axis (`positive`) or against it.
   *
   * @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-assembly-quantity-representation Exposes `sense` as the portable data boundary for the building exterior assembly quantity representation requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-material-assembly-failures Types `sense` for the building envelope material assembly failures system contract.
   */
  sense: "positive" | "negative";

  /**
   * Signed metre offset from the host's reference plane to the outer face of
   * the first layer. Zero puts the stack's first face on the reference plane.
   *
   * @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-assembly-quantity-representation Exposes `offset` as the portable data boundary for the building exterior assembly quantity representation requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-material-assembly-failures Types `offset` for the building envelope material assembly failures system contract.
   */
  offset: number;

  /**
   * Whether each end of the stack is exposed to view.
   *
   * `first` is the face the first layer presents, `last` the face the final
   * layer presents. An exposed end must be finished and a concealed end must
   * not be, which is how a missing finish and a wasted one are both caught.
   *
   * @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-assembly-quantity-representation Exposes `faces` as the portable data boundary for the building exterior assembly quantity representation requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-material-assembly-failures Types `faces` for the building envelope material assembly failures system contract.
   */
  faces: {
    /** Exposure of the face the first layer presents. */
    first: "exposed" | "concealed";
    /** Exposure of the face the last layer presents. */
    last: "exposed" | "concealed";
  };

  /**
   * Ordered layers, the first one at the reference face. Never empty.
   *
   * @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-assembly-quantity-representation Exposes `layers` as the portable data boundary for the building exterior assembly quantity representation requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-material-assembly-failures Types `layers` for the building envelope material assembly failures system contract.
   */
  layers: IAutoMovieMaterialLayer[];
}
