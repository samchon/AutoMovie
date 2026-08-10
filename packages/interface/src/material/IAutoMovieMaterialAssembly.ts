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
 */
export interface IAutoMovieMaterialSubstance {
  /** Stable id so a layer can cite this substance. */
  id: string;

  /** Human / LLM readable label, or `null` when unnamed. */
  name: string | null;

  /**
   * Open classification such as `stone`, `timber`, `metal`, `board`, or a
   * production-specific family. Open on purpose: an era, a fiction, or a
   * speculative building brings its own families.
   */
  classification: string;

  /** Bulk density in kg/m³, strictly above zero, or `null` when unmeasured. */
  density: number | null;

  /** Thermal conductivity in W/(m·K), non-negative, or `null`. */
  thermalConductivity: number | null;

  /** Specific heat capacity in J/(kg·K), strictly above zero, or `null`. */
  specificHeat: number | null;

  /** Fractional sound absorption in `[0, 1]`, or `null`. */
  soundAbsorption: number | null;

  /**
   * Dimensionless water-vapour resistance factor (µ), at least `1`, or `null`.
   * `1` is still air; a vapour barrier is in the tens of thousands.
   */
  vapourResistance: number | null;

  /** Expected service life in years, strictly above zero, or `null`. */
  serviceLife: number | null;

  /** {@link IAutoMovieMaterial} id this substance is shown with, or `null`. */
  surface: string | null;
}

/**
 * One ordered constituent of a layered build-up.
 *
 * A layer is not only a material and a thickness. It states what occupies the
 * layer, whether the layer is meant to be seen, and whether it continues around
 * the reveal of an opening cut through the host, because those three facts are
 * what decide the finished dimension a performer actually touches.
 */
export interface IAutoMovieMaterialLayer {
  /** Stable id, unique inside one assembly. */
  id: string;

  /**
   * Open construction role such as `structure`, `insulation`, `barrier`, or
   * `finish`. Roles are matched across a junction to decide which layers
   * continue and which stop, so the same word must mean the same thing on both
   * sides of that junction; nothing else reads it.
   */
  role: string;

  /**
   * What occupies the layer.
   *
   * A `solid` carries a substance and real thickness. A `cavity` is a
   * ventilated air gap: it has thickness and deliberately no substance. A
   * `membrane` is a continuous sheet whose job is to be unbroken rather than
   * thick, so it carries a substance and may measure zero.
   */
  substance: "solid" | "cavity" | "membrane";

  /** Layer thickness in metres along the assembly's stacking axis. */
  thickness: number;

  /** {@link IAutoMovieMaterialSubstance} id, or `null` for a cavity. */
  material: string | null;

  /**
   * Whether this layer is a visible finish.
   *
   * A finish must be reachable from an exposed end of the stack. A finish
   * buried behind another layer is a defect, not a decoration, and so is a
   * second finish laid over the first.
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
 */
export interface IAutoMovieMaterialAssembly {
  /** Stable assembly id. */
  id: string;

  /** Host-local axis the layers stack along. */
  axis: "x" | "y" | "z";

  /** Whether layer order advances along the axis (`positive`) or against it. */
  sense: "positive" | "negative";

  /**
   * Signed metre offset from the host's reference plane to the outer face of
   * the first layer. Zero puts the stack's first face on the reference plane.
   */
  offset: number;

  /**
   * Whether each end of the stack is exposed to view.
   *
   * `first` is the face the first layer presents, `last` the face the final
   * layer presents. An exposed end must be finished and a concealed end must
   * not be, which is how a missing finish and a wasted one are both caught.
   */
  faces: {
    /** Exposure of the face the first layer presents. */
    first: "exposed" | "concealed";
    /** Exposure of the face the last layer presents. */
    last: "exposed" | "concealed";
  };

  /** Ordered layers, the first one at the reference face. Never empty. */
  layers: IAutoMovieMaterialLayer[];
}
