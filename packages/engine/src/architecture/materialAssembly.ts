import {
  IAutoMovieMaterialAssembly,
  IAutoMovieMaterialLayer,
  IAutoMovieMaterialSubstance,
  IAutoMovieValidation,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";

const AXES = ["x", "y", "z"] as const;
const SENSES = ["positive", "negative"] as const;
const SUBSTANCES = ["solid", "cavity", "membrane"] as const;
const EXPOSURES = ["exposed", "concealed"] as const;

/** Largest metre slack a summed build-up may differ from its host by. */
const THICKNESS_EPSILON = 1e-9;

/** The host dimension a build-up is measured against. */
export interface IAutoMovieAssemblyHost {
  /** Nominal host thickness along the assembly's stacking axis, in metres. */
  thickness: number;
}

/** One layer placed on the host's own measuring line. */
export interface IAutoMovieResolvedLayer {
  /** The contributing {@link IAutoMovieMaterialLayer.id}. */
  id: string;
  /** The layer's construction role. */
  role: string;
  /** What occupies the layer. */
  substance: "solid" | "cavity" | "membrane";
  /** Substance id, or `null` for a cavity. */
  material: string | null;
  /** Authored layer thickness in metres. */
  thickness: number;
  /** Signed coordinate of the face nearer the reference plane. */
  start: number;
  /** Signed coordinate of the face further from the reference plane. */
  end: number;
  /** Signed coordinate of the layer's midplane. */
  center: number;
  /** Whether the layer is a visible finish. */
  finish: boolean;
  /** Whether the layer continues around an opening's reveal. */
  wrapsOpening: boolean;
}

/** A build-up placed on a signed measuring line, ready to be dimensioned. */
export interface IAutoMovieResolvedAssembly {
  /** The contributing {@link IAutoMovieMaterialAssembly.id}. */
  id: string;
  /** Host-local axis the layers stack along. */
  axis: "x" | "y" | "z";
  /** Summed layer thickness in metres: the build-up's overall dimension. */
  total: number;
  /** Signed coordinate of the first layer's outer face. */
  start: number;
  /** Signed coordinate of the last layer's outer face. */
  end: number;
  /** Ordered signed span of the whole build-up, lowest coordinate first. */
  extent: {
    /** Lowest signed coordinate the build-up occupies. */
    min: number;
    /** Highest signed coordinate the build-up occupies. */
    max: number;
  };
  /** Layers in authored order, each placed on the measuring line. */
  layers: IAutoMovieResolvedLayer[];
}

/** What a build-up does to an opening cut through its host. */
export interface IAutoMovieAssemblyReveal {
  /** Finished clear width in metres once the lining runs reach the jamb. */
  width: number;
  /** Finished clear height in metres. */
  height: number;
  /** Lining thickness taken off each side of the opening, in metres. */
  inset: number;
  /** Lining depth measured inward from the first face, in metres. */
  first: number;
  /** Lining depth measured inward from the last face, in metres. */
  last: number;
  /** Jamb depth left bare between the two linings, in metres. */
  bare: number;
  /** Ids of the layers that line the jamb, in stack order. */
  layers: string[];
}

/** One construction role carried through a junction by both build-ups. */
export interface IAutoMovieAssemblyContinuity {
  /** The role both sides declare. */
  role: string;
  /** Signed span the role occupies on the left build-up. */
  left: {
    /** Lowest signed coordinate. */
    min: number;
    /** Highest signed coordinate. */
    max: number;
  };
  /** Signed span the role occupies on the right build-up. */
  right: {
    /** Lowest signed coordinate. */
    min: number;
    /** Highest signed coordinate. */
    max: number;
  };
  /** Shared signed length in metres; negative states the gap between spans. */
  overlap: number;
  /** Whether the two spans meet or overlap within the caller's tolerance. */
  aligned: boolean;
}

/** One construction role that stops at a junction. */
export interface IAutoMovieAssemblyBreak {
  /** The role only one side declares. */
  role: string;
  /** Which build-up carries it. */
  side: "left" | "right";
  /** Summed thickness the carrying side gives the role, in metres. */
  thickness: number;
}

/** What survives a junction between two build-ups and what stops there. */
export interface IAutoMovieAssemblyJunction {
  /** Roles both sides carry, in the left build-up's declaration order. */
  continuous: IAutoMovieAssemblyContinuity[];
  /** Roles only one side carries, left-hand ones first. */
  broken: IAutoMovieAssemblyBreak[];
}

/**
 * Range-check one substance record.
 *
 * The engine ships no substances, so every value here is the production's own
 * and every one of them is optional. What the engine owns is the refusal: a
 * negative density, an absorption above one, or a vapour resistance below still
 * air are not measurements a later study can use, and a study that silently
 * consumes them reports a number nobody can trace back to a defect.
 */
export const validateAutoMovieMaterialSubstance = (props: {
  substance: IAutoMovieMaterialSubstance;
}): IAutoMovieValidation => {
  const { substance } = props;
  const collector = new ViolationCollector();
  const root = "$input";
  nonEmpty(substance.id, `${root}.id`, "substance id", collector);
  nonEmpty(
    substance.classification,
    `${root}.classification`,
    "substance classification",
    collector,
  );
  if (substance.name !== null)
    nonEmpty(substance.name, `${root}.name`, "substance name", collector);
  if (substance.surface !== null)
    nonEmpty(
      substance.surface,
      `${root}.surface`,
      "substance surface id",
      collector,
    );
  above(
    substance.density,
    0,
    `${root}.density`,
    "substance density",
    collector,
  );
  atLeast(
    substance.thermalConductivity,
    0,
    `${root}.thermalConductivity`,
    "substance thermal conductivity",
    collector,
  );
  above(
    substance.specificHeat,
    0,
    `${root}.specificHeat`,
    "substance specific heat",
    collector,
  );
  if (
    substance.soundAbsorption !== null &&
    (!Number.isFinite(substance.soundAbsorption) ||
      substance.soundAbsorption < 0 ||
      substance.soundAbsorption > 1)
  )
    collector.push(
      "range",
      `${root}.soundAbsorption`,
      `substance sound absorption must be a finite number within [0, 1], but was ${substance.soundAbsorption}`,
      substance.soundAbsorption,
    );
  atLeast(
    substance.vapourResistance,
    1,
    `${root}.vapourResistance`,
    "substance vapour resistance",
    collector,
  );
  above(
    substance.serviceLife,
    0,
    `${root}.serviceLife`,
    "substance service life",
    collector,
  );
  return collector.toValidation();
};

/**
 * Judge one layered build-up: its layers, its finishes, and its total.
 *
 * The checks fall into three groups the requirement names separately. Layer
 * conflicts are contradictions inside a layer — a cavity that carries a
 * substance, a solid with no thickness, a substance id that resolves to
 * nothing. Finish defects are contradictions between the stack and the faces it
 * presents — an exposed face with nothing finishing it, a finish laid over
 * another finish, a finish buried where it will never be seen, a finish spent
 * on a concealed face. Dimension conflicts are contradictions with the host — a
 * build-up whose layers do not sum to the thickness the host was drawn at.
 *
 * A single-layer stack presents both faces with the same layer, so its finish
 * answers for whichever of them is exposed rather than being demanded twice.
 */
export const validateAutoMovieMaterialAssembly = (props: {
  assembly: IAutoMovieMaterialAssembly;
  /** Substances the layers may cite; omitted skips reference resolution. */
  substances?: readonly IAutoMovieMaterialSubstance[];
  /** Host dimension the layers must sum to; omitted skips the comparison. */
  host?: IAutoMovieAssemblyHost;
}): IAutoMovieValidation => {
  const { assembly } = props;
  const collector = new ViolationCollector();
  const root = "$input";
  const layers = assembly.layers;

  nonEmpty(assembly.id, `${root}.id`, "material assembly id", collector);
  if (!AXES.includes(assembly.axis))
    collector.push(
      "type",
      `${root}.axis`,
      `material assembly axis must be one of ${AXES.join(", ")}, but was "${String(assembly.axis)}"`,
      assembly.axis,
    );
  if (!SENSES.includes(assembly.sense))
    collector.push(
      "type",
      `${root}.sense`,
      `material assembly sense must be one of ${SENSES.join(", ")}, but was "${String(assembly.sense)}"`,
      assembly.sense,
    );
  if (!Number.isFinite(assembly.offset))
    collector.push(
      "range",
      `${root}.offset`,
      `material assembly offset must be finite, but was ${assembly.offset}`,
      assembly.offset,
    );
  for (const face of ["first", "last"] as const)
    if (!EXPOSURES.includes(assembly.faces[face]))
      collector.push(
        "type",
        `${root}.faces.${face}`,
        `material assembly face exposure must be one of ${EXPOSURES.join(", ")}, but was "${String(assembly.faces[face])}"`,
        assembly.faces[face],
      );
  if (layers.length === 0)
    collector.push(
      "range",
      `${root}.layers`,
      "a material assembly needs at least one layer",
      layers.length,
    );

  const substanceIds =
    props.substances === undefined
      ? null
      : new Set(props.substances.map((substance) => substance.id));
  const ids = new Set<string>();
  layers.forEach((layer, index) => {
    const path = `${root}.layers[${index}]`;
    nonEmpty(layer.id, `${path}.id`, "material layer id", collector);
    if (ids.has(layer.id))
      collector.push(
        "type",
        `${path}.id`,
        `material layer id "${layer.id}" must be unique within assembly "${assembly.id}"`,
        layer.id,
      );
    ids.add(layer.id);
    nonEmpty(layer.role, `${path}.role`, "material layer role", collector);
    if (!SUBSTANCES.includes(layer.substance))
      collector.push(
        "type",
        `${path}.substance`,
        `material layer substance must be one of ${SUBSTANCES.join(", ")}, but was "${String(layer.substance)}"`,
        layer.substance,
      );
    if (!Number.isFinite(layer.thickness) || layer.thickness < 0)
      collector.push(
        "range",
        `${path}.thickness`,
        `material layer thickness must be a finite number >= 0, but was ${layer.thickness}`,
        layer.thickness,
      );
    else if (layer.substance !== "membrane" && layer.thickness === 0)
      collector.push(
        "range",
        `${path}.thickness`,
        `a ${layer.substance} layer must be thicker than zero; only a membrane may measure nothing`,
        layer.thickness,
      );
    if (layer.substance === "cavity") {
      if (layer.material !== null)
        collector.push(
          "type",
          `${path}.material`,
          "a cavity layer is an air gap and carries no substance",
          layer.material,
        );
      if (layer.finish)
        collector.push(
          "type",
          `${path}.finish`,
          "a cavity layer has no surface and cannot be a finish",
          layer.finish,
        );
    } else if (layer.material === null)
      collector.push(
        "type",
        `${path}.material`,
        `a ${layer.substance} layer must cite a substance`,
        layer.material,
      );
    else if (substanceIds !== null && !substanceIds.has(layer.material))
      collector.push(
        "type",
        `${path}.material`,
        `material layer substance "${layer.material}" does not resolve`,
        layer.material,
      );
  });

  appendFinishDefects(assembly, collector, root);
  appendWrapDefects(layers, collector, root);

  if (props.host !== undefined) {
    const total = layers.reduce((sum, layer) => sum + layer.thickness, 0);
    if (
      Number.isFinite(props.host.thickness) === false ||
      props.host.thickness <= 0
    )
      collector.push(
        "range",
        `${root}.layers`,
        `host thickness must be a finite number > 0, but was ${props.host.thickness}`,
        props.host.thickness,
      );
    else if (Math.abs(total - props.host.thickness) > THICKNESS_EPSILON)
      collector.push(
        "range",
        `${root}.layers`,
        `layer thicknesses must sum to the host thickness ${props.host.thickness} m, but summed to ${total} m`,
        total,
        total - props.host.thickness,
      );
  }

  return collector.toValidation();
};

/**
 * Place a validated build-up on the host's own signed measuring line.
 *
 * This is the step that makes a build-up a dimension rather than a list. The
 * first layer's outer face starts at {@link IAutoMovieMaterialAssembly.offset},
 * each layer advances along the stacking axis in the declared sense, and the
 * summed thickness is the overall dimension the host must be drawn at. A caller
 * that sizes a wall from `total` and cuts an opening through it can then ask
 * {@link autoMovieAssemblyOpeningReveal} what the opening finishes at.
 *
 * An invalid build-up is refused here rather than resolved into numbers that
 * look usable, the same way a built environment refuses to lower.
 */
export const resolveAutoMovieMaterialAssembly = (props: {
  assembly: IAutoMovieMaterialAssembly;
  /** Substances the layers may cite; omitted skips reference resolution. */
  substances?: readonly IAutoMovieMaterialSubstance[];
  /** Host dimension the layers must sum to; omitted skips the comparison. */
  host?: IAutoMovieAssemblyHost;
}): IAutoMovieResolvedAssembly => {
  const validated = validateAutoMovieMaterialAssembly(props);
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `material assembly "${props.assembly.id}" is invalid at ${first.path}: ${first.expected}`,
    );
  }
  const { assembly } = props;
  const direction = assembly.sense === "positive" ? 1 : -1;
  let cursor = assembly.offset;
  const resolved: IAutoMovieResolvedLayer[] = assembly.layers.map((layer) => {
    const start = cursor;
    const end = cursor + direction * layer.thickness;
    cursor = end;
    return {
      id: layer.id,
      role: layer.role,
      substance: layer.substance,
      material: layer.material,
      thickness: layer.thickness,
      start,
      end,
      center: (start + end) / 2,
      finish: layer.finish,
      wrapsOpening: layer.wrapsOpening,
    };
  });
  const total = assembly.layers.reduce(
    (sum, layer) => sum + layer.thickness,
    0,
  );
  const end = assembly.offset + direction * total;
  return {
    id: assembly.id,
    axis: assembly.axis,
    total,
    start: assembly.offset,
    end,
    extent: {
      min: Math.min(assembly.offset, end),
      max: Math.max(assembly.offset, end),
    },
    layers: resolved,
  };
};

/**
 * Report what a build-up finishes an opening at.
 *
 * An opening is cut at a structural size and used at a finished one. Every
 * layer that continues around the jamb lines both sides of the opening, so the
 * clear width loses twice the wrapping thickness and the clear height the same;
 * the depth each lining reaches is the run of wrapping layers measured inward
 * from that face, and whatever the two linings do not reach is bare jamb.
 *
 * A lining that would consume the opening is refused rather than reported as a
 * negative dimension: a door 0.6 m wide lined by 0.4 m on each side is not a
 * narrow door, it is a wall. The refusal is written as "not above zero" rather
 * than "at or below zero", so a build-up carrying a non-finite thickness is
 * refused here too instead of returning a `NaN` width that every later
 * comparison would read as acceptable.
 *
 * Only wrapping layers reachable from a face line the jamb. A layer that claims
 * to wrap from behind one that stops there cannot turn the corner, which is why
 * validation refuses it; measuring the runs rather than the flags means it also
 * cannot narrow an opening here if one ever reaches this function unvalidated.
 */
export const autoMovieAssemblyOpeningReveal = (props: {
  resolved: IAutoMovieResolvedAssembly;
  /** Structural opening width in metres before lining, strictly above zero. */
  width: number;
  /** Structural opening height in metres before lining, strictly above zero. */
  height: number;
}): IAutoMovieAssemblyReveal => {
  positive(props.width, "opening width");
  positive(props.height, "opening height");
  const layers = props.resolved.layers;
  const lead = leadingRun(layers, (layer) => layer.wrapsOpening);
  const tail = Math.min(
    trailingRun(layers, (layer) => layer.wrapsOpening),
    layers.length - lead,
  );
  const lining = [
    ...layers.slice(0, lead),
    ...layers.slice(layers.length - tail),
  ];
  const first = layers
    .slice(0, lead)
    .reduce((sum, layer) => sum + layer.thickness, 0);
  const last = layers
    .slice(layers.length - tail)
    .reduce((sum, layer) => sum + layer.thickness, 0);
  const inset = first + last;
  const width = props.width - 2 * inset;
  const height = props.height - 2 * inset;
  if (!(width > 0) || !(height > 0))
    throw new Error(
      `material assembly "${props.resolved.id}" lines ${inset} m on each side, which leaves no usable opening in ${props.width} x ${props.height} m`,
    );
  return {
    width,
    height,
    inset,
    first,
    last,
    bare: props.resolved.total - first - last,
    layers: lining.map((layer) => layer.id),
  };
};

/**
 * Report which construction roles survive a junction between two build-ups.
 *
 * Two walls meeting at a corner are two build-ups on one measuring line, and
 * the question a junction asks is not whether they look alike but whether each
 * role reaches across. A role both sides declare is continuous, and the signed
 * spans say whether it actually lines up or merely exists on both sides — an
 * insulation layer that ends where the next one begins is a thermal bridge, and
 * a barrier that stops at a corner is a leak.
 *
 * Roles are matched as declared: the caller decides what a role name means, and
 * a build-up that spends the same role over several layers has those layers
 * summed and spanned together rather than silently reduced to the first one.
 */
export const matchAutoMovieAssemblyJunction = (props: {
  left: IAutoMovieResolvedAssembly;
  right: IAutoMovieResolvedAssembly;
  /** Greatest metre gap between two spans still counted as aligned. */
  tolerance: number;
}): IAutoMovieAssemblyJunction => {
  if (!Number.isFinite(props.tolerance) || props.tolerance < 0)
    throw new Error("junction tolerance must be a finite number >= 0");
  const left = rolesOf(props.left);
  const right = rolesOf(props.right);
  const continuous: IAutoMovieAssemblyContinuity[] = [];
  const broken: IAutoMovieAssemblyBreak[] = [];
  for (const [role, span] of left) {
    const other = right.get(role);
    if (other === undefined) {
      broken.push({ role, side: "left", thickness: span.thickness });
      continue;
    }
    const overlap =
      Math.min(span.max, other.max) - Math.max(span.min, other.min);
    continuous.push({
      role,
      left: { min: span.min, max: span.max },
      right: { min: other.min, max: other.max },
      overlap,
      aligned: overlap >= -props.tolerance,
    });
  }
  for (const [role, span] of right)
    if (!left.has(role))
      broken.push({ role, side: "right", thickness: span.thickness });
  return { continuous, broken };
};

/**
 * Report every finish contradiction between a stack and the faces it presents.
 *
 * A finish is only a finish where it can be seen. Index zero presents the first
 * face and the final index the last one, so a finish anywhere else is either a
 * second coat over the finish beside it or a layer buried where nothing reaches
 * it; both are defects, and naming them apart is what tells the author whether
 * to delete a layer or move it.
 */
const appendFinishDefects = (
  assembly: IAutoMovieMaterialAssembly,
  collector: ViolationCollector,
  root: string,
): void => {
  const layers = assembly.layers;
  if (layers.length === 0) return;
  const last = layers.length - 1;
  layers.forEach((layer, index) => {
    if (!layer.finish || index === 0 || index === last) return;
    const doubled = layers[index - 1]!.finish || layers[index + 1]!.finish;
    collector.push(
      "type",
      `${root}.layers[${index}].finish`,
      doubled
        ? `material layer "${layer.id}" lays a finish over the finish beside it`
        : `material layer "${layer.id}" is a finish buried between layers and reaches no exposed face`,
      layer.finish,
    );
  });
  const terminals = new Map<number, Array<"first" | "last">>();
  terminals.set(0, ["first"]);
  terminals.set(last, [...(terminals.get(last) ?? []), "last"]);
  for (const [index, faces] of terminals) {
    const layer = layers[index]!;
    const exposed = faces.filter((face) => assembly.faces[face] === "exposed");
    if (exposed.length > 0 && !layer.finish)
      collector.push(
        "type",
        `${root}.layers[${index}].finish`,
        `no finish presents the exposed ${exposed.join(" and ")} face; material layer "${layer.id}" is the layer that reaches it`,
        layer.finish,
      );
    if (exposed.length === 0 && layer.finish)
      collector.push(
        "type",
        `${root}.layers[${index}].finish`,
        `material layer "${layer.id}" spends a finish on the concealed ${faces.join(" and ")} face`,
        layer.finish,
      );
  }
};

/**
 * Refuse a wrapping layer that sits behind a layer stopping at the jamb.
 *
 * Lining an opening is a run that starts at a face: a layer cannot turn the
 * corner into the reveal if the layer in front of it already ended there. A
 * buried wrap would otherwise be counted into the finished opening size and
 * quietly narrow a door nothing actually lines.
 */
const appendWrapDefects = (
  layers: readonly IAutoMovieMaterialLayer[],
  collector: ViolationCollector,
  root: string,
): void => {
  const lead = leadingRun(layers, (layer) => layer.wrapsOpening);
  const tail = Math.min(
    trailingRun(layers, (layer) => layer.wrapsOpening),
    layers.length - lead,
  );
  layers.forEach((layer, index) => {
    if (!layer.wrapsOpening) return;
    if (index < lead || index >= layers.length - tail) return;
    collector.push(
      "type",
      `${root}.layers[${index}].wrapsOpening`,
      `material layer "${layer.id}" wraps an opening from behind a layer that stops at the jamb`,
      layer.wrapsOpening,
    );
  });
};

const leadingRun = <T>(
  items: readonly T[],
  match: (item: T) => boolean,
): number => {
  let count = 0;
  while (count < items.length && match(items[count]!)) count += 1;
  return count;
};

const trailingRun = <T>(
  items: readonly T[],
  match: (item: T) => boolean,
): number => {
  let count = 0;
  while (count < items.length && match(items[items.length - 1 - count]!))
    count += 1;
  return count;
};

const rolesOf = (
  assembly: IAutoMovieResolvedAssembly,
): Map<string, { min: number; max: number; thickness: number }> => {
  const roles = new Map<
    string,
    { min: number; max: number; thickness: number }
  >([]);
  for (const layer of assembly.layers) {
    const min = Math.min(layer.start, layer.end);
    const max = Math.max(layer.start, layer.end);
    const previous = roles.get(layer.role);
    if (previous === undefined)
      roles.set(layer.role, { min, max, thickness: layer.thickness });
    else
      roles.set(layer.role, {
        min: Math.min(previous.min, min),
        max: Math.max(previous.max, max),
        thickness: previous.thickness + layer.thickness,
      });
  }
  return roles;
};

const nonEmpty = (
  value: string,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (value.trim().length === 0)
    collector.push("type", path, `${label} must be non-empty`, value);
};

const above = (
  value: number | null,
  limit: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (value !== null && (!Number.isFinite(value) || value <= limit))
    collector.push(
      "range",
      path,
      `${label} must be a finite number > ${limit}, but was ${value}`,
      value,
    );
};

const atLeast = (
  value: number | null,
  limit: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (value !== null && (!Number.isFinite(value) || value < limit))
    collector.push(
      "range",
      path,
      `${label} must be a finite number >= ${limit}, but was ${value}`,
      value,
    );
};

const positive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} must be a finite number > 0`);
};
