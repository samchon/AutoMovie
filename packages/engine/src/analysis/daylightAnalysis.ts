import {
  IAutoMovieAnalysisMetric,
  IAutoMovieAnalysisMetricGap,
  IAutoMovieAnalysisRun,
  IAutoMovieAnalysisSample,
  IAutoMovieAnalysisTarget,
  IAutoMovieAnalysisWarning,
  IAutoMovieEnvironmentContext,
  IAutoMovieEnvironmentInstant,
  IAutoMovieReferenceGround,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import {
  AUTOMOVIE_ANALYSIS_MAX_SAMPLES,
  assertAutoMovieAnalysisTargets,
  autoMovieAnalysisMetric,
  sealAutoMovieAnalysisRun,
} from "./analysisRun";
import {
  IAutoMovieAnalysisSolid,
  assertAutoMovieAnalysisSolids,
  autoMovieContextSolids,
  autoMovieEnvironmentInstant,
  autoMovieHemisphereDirections,
  autoMovieRayObstructed,
  autoMovieSkyward,
  validateAutoMovieEnvironmentContext,
} from "./environmentContext";

/** The one sky luminance distribution this solver implements. */
export const AUTOMOVIE_DAYLIGHT_SKY_MODEL = "isotropic";

/** Directions and lengths shorter than this are degenerate. */
const EPSILON = 1e-12;

/**
 * A rectangular grid of measurement points on one plane.
 *
 * The grid is stated in the plane's own axes rather than in world axes, so a
 * sloped roof light, a tilted desk and a wall panel are all one shape. Samples
 * sit at cell centres, which is what keeps a 1x1 grid a measurement of the
 * middle of the plane instead of a measurement of its corner.
 */
export interface IAutoMovieAnalysisWorkplane {
  /** World-space corner the grid grows from, in metres. */
  origin: IAutoMovieVector3;
  /** In-plane direction the first axis runs along; non-zero. */
  axisU: IAutoMovieVector3;
  /** In-plane direction the second axis runs along; non-zero, not parallel. */
  axisV: IAutoMovieVector3;
  /** Extent along {@link axisU} in metres; strictly positive. */
  sizeU: number;
  /** Extent along {@link axisV} in metres; strictly positive. */
  sizeV: number;
  /** Cells along {@link axisU}; a whole number at or above one. */
  countU: number;
  /** Cells along {@link axisV}; a whole number at or above one. */
  countV: number;
}

/**
 * One artificial source, as a point radiating equally in every direction.
 *
 * Intensity is declared in candela by the production. Shipping a luminaire
 * catalogue would be shipping content; what the engine owes is the inverse
 * square law and the occlusion test, both of which are the same for every
 * fitting anyone ever specifies.
 */
export interface IAutoMovieAnalysisLuminaire {
  /** Stable luminaire identity within the request. */
  id: string;
  /** World position in metres. */
  position: IAutoMovieVector3;
  /** Luminous intensity in candela; at or above zero. */
  intensity: number;
}

/** Everything one daylight or artificial-light study is configured with. */
export interface IAutoMovieDaylightRequest {
  /** Stable run identity. */
  id: string;
  /** Logical space or surface being studied. */
  subject: string;
  /** Design revision being read. */
  inputRevision: string;
  /** Read-only external world. */
  context: IAutoMovieEnvironmentContext;
  /** Instant id to study, or null for an artificial-light-only study. */
  instant: string | null;
  /** Measurement grid. */
  workplane: IAutoMovieAnalysisWorkplane;
  /** Building-owned convex shading solids such as a canopy or a fin. */
  shades: readonly IAutoMovieAnalysisSolid[];
  /** Artificial sources contributing to the same plane. */
  luminaires: readonly IAutoMovieAnalysisLuminaire[];
  /** Sky luminance distribution requested. */
  sky: string;
  /** Sky-vault sample count per measurement point; a positive whole number. */
  diffuseSamples: number;
  /** Targets the production declares for this study. */
  targets: readonly IAutoMovieAnalysisTarget[];
}

/**
 * Measure one workplane under one declared instant, one set of shades and one
 * set of luminaires.
 *
 * The governing model is stated and bounded rather than implied:
 *
 * - Beam illuminance is `DNI * max(0, dot(n, s))`, zeroed when any solid stops
 *   the ray to the sun;
 * - Sky illuminance is the isotropic vault `DHI * V`, where `V` is the fraction
 *   of a cosine-weighted hemisphere that reaches the sky unobstructed and above
 *   the reference ground. Cosine weighting makes this exact, not approximate,
 *   for an unobstructed plane: every direction is visible, so `V` is one and
 *   the result is the declared horizontal illuminance for any sample count;
 * - Each luminaire contributes `I * max(0, dot(n, d)) / r^2`, zeroed when a solid
 *   stands between the fitting and the point;
 * - Ground-reflected light is **not** modelled, and says so as an `unsupported`
 *   metric rather than being quietly folded into the sky term.
 *
 * Anything the solver cannot answer is reported rather than approximated. A sky
 * model it does not implement returns an `unsupported` run; a study with
 * neither a sun nor a fitting returns `not-run`; a contrast ratio over a plane
 * with a dark point returns a gap, because `max / 0` is not a large number, it
 * is not a number.
 *
 * Everything the study is configured with is digested into the run, so two
 * identical requests produce one identical artifact and any change to shading,
 * time or grid produces a different one.
 *
 * @author Samchon
 */
export const analyzeAutoMovieDaylight = (props: {
  request: IAutoMovieDaylightRequest;
}): IAutoMovieAnalysisRun => {
  const request = props.request;
  const plane = validateDaylightRequest(request);
  const solver = {
    id: "automovie.daylight.isotropic-sky",
    version: "1",
    model:
      "beam DNI*cos(i) with analytic convex occlusion, isotropic sky DHI*V by cosine-weighted hemisphere visibility, point luminaires I*cos/r^2; ground-reflected light excluded",
  };
  // Resolved before the settings text is built, because the request validator
  // has already refused an instant the context does not declare: looking it up
  // twice would add a second, unreachable "or nothing" that no test can reach
  // and no reader can trust.
  const instant =
    request.instant === null
      ? null
      : autoMovieEnvironmentInstant(request.context, request.instant)!;
  const settings = daylightSettings(request, instant);
  const domain = request.instant === null ? "artificial-light" : "daylight";

  if (request.sky !== AUTOMOVIE_DAYLIGHT_SKY_MODEL)
    return sealAutoMovieAnalysisRun({
      id: request.id,
      domain,
      subject: request.subject,
      inputRevision: request.inputRevision,
      solver,
      settings,
      outcome: {
        status: "unsupported",
        reason: `sky luminance model "${request.sky}" is not implemented by this solver`,
        remedy: `declare the "${AUTOMOVIE_DAYLIGHT_SKY_MODEL}" sky model, or bind an external adapter that implements "${request.sky}" and record its result as its own run`,
      },
    });
  if (instant === null && request.luminaires.length === 0)
    return sealAutoMovieAnalysisRun({
      id: request.id,
      domain,
      subject: request.subject,
      inputRevision: request.inputRevision,
      solver,
      settings,
      outcome: {
        status: "not-run",
        reason:
          "the study declares neither an environmental instant nor a luminaire, so nothing emits light onto the workplane",
        remedy:
          "name an instant of the environment context, declare at least one luminaire, or stop requesting the study",
      },
    });

  const warnings: IAutoMovieAnalysisWarning[] = [];
  const solids: IAutoMovieAnalysisSolid[] = [
    ...autoMovieContextSolids(request.context),
    ...request.shades,
  ];
  // The grid is planar, so every sample shares one normal and therefore one set
  // of sky directions. Building them once instead of once per point is what
  // keeps a fine grid under a fine sky a study rather than a wait.
  const skyDirections = autoMovieHemisphereDirections({
    normal: plane.normal,
    count: request.diffuseSamples,
  });
  const beamSource =
    instant === null
      ? null
      : {
          sun: Vector3.normalize(instant.sun),
          illuminance: instant.directNormalIlluminance,
        };
  const coincident = new Set<string>();
  const samples: IAutoMovieAnalysisSample[] = [];
  const direct: number[] = [];
  const diffuse: number[] = [];
  const artificial: number[] = [];

  for (let i = 0; i < request.workplane.countU; ++i)
    for (let j = 0; j < request.workplane.countV; ++j) {
      const point = gridPoint(request.workplane, plane, i, j);
      const beam =
        beamSource === null
          ? 0
          : beamIlluminance({
              point,
              normal: plane.normal,
              solids,
              ...beamSource,
            });
      const sky =
        instant === null
          ? 0
          : skyIlluminance({
              point,
              ground: request.context.ground,
              illuminance: instant.diffuseHorizontalIlluminance,
              solids,
              directions: skyDirections,
            });
      const lamp = artificialIlluminance({
        point,
        normal: plane.normal,
        luminaires: request.luminaires,
        solids,
        warnings,
        coincident,
      });
      direct.push(beam);
      diffuse.push(sky);
      artificial.push(lamp);
      samples.push({
        id: `${i}-${j}`,
        key: "workplane.total.illuminance",
        position: point,
        value: beam + sky + lamp,
      });
    }

  const totals = samples.map((sample) => sample.value);
  const daylight = direct.map((value, index) => value + diffuse[index]!);
  const metric = (
    key: string,
    unitSymbol: string,
    value: number | null,
    gap?: IAutoMovieAnalysisMetricGap,
    status?: "unsupported" | "not-run",
  ): IAutoMovieAnalysisMetric =>
    autoMovieAnalysisMetric({
      key,
      unit: unitSymbol,
      value,
      targets: request.targets,
      warnings,
      gap,
      status,
    });
  const noInstant = {
    reason:
      "the study declares no environmental instant, so no sun and no sky were read",
    remedy:
      "name an instant of the environment context to measure daylight on this plane",
  };
  const minimum = Math.min(...totals);
  const maximum = Math.max(...totals);
  const mean = average(totals);
  const skyMean = average(diffuse);

  const metrics: IAutoMovieAnalysisMetric[] = [
    metric(
      "workplane.direct.illuminance",
      "lx",
      instant === null ? null : average(direct),
      instant === null ? noInstant : undefined,
    ),
    metric(
      "workplane.skyDiffuse.illuminance",
      "lx",
      instant === null ? null : skyMean,
      instant === null ? noInstant : undefined,
    ),
    metric(
      "workplane.daylight.illuminance",
      "lx",
      instant === null ? null : average(daylight),
      instant === null ? noInstant : undefined,
    ),
    metric("workplane.artificial.illuminance", "lx", average(artificial)),
    metric("workplane.total.illuminance", "lx", mean),
    metric("workplane.total.illuminance.min", "lx", minimum),
    metric("workplane.total.illuminance.max", "lx", maximum),
    metric(
      "workplane.total.uniformity",
      "ratio",
      mean === 0 ? null : minimum / mean,
      mean === 0
        ? {
            reason:
              "the mean workplane illuminance is 0 lx, so a min/mean uniformity ratio is undefined",
            remedy:
              "light the plane, or read the min and max illuminance metrics directly",
          }
        : undefined,
    ),
    metric(
      "workplane.total.contrast",
      "ratio",
      minimum === 0 ? null : maximum / minimum,
      minimum === 0
        ? {
            reason:
              "the darkest workplane sample measures 0 lx, so a max/min contrast ratio is undefined",
            remedy:
              "raise the minimum illuminance, or judge the plane by its min and max illuminance metrics",
          }
        : undefined,
    ),
    metric(
      "workplane.daylightFactor",
      "%",
      instant === null || instant.diffuseHorizontalIlluminance === 0
        ? null
        : (skyMean / instant.diffuseHorizontalIlluminance) * 100,
      instant === null
        ? noInstant
        : instant.diffuseHorizontalIlluminance === 0
          ? {
              reason: `instant "${instant.id}" declares 0 lx of diffuse horizontal illuminance, so a daylight factor has no reference sky to divide by`,
              remedy:
                "declare the unobstructed horizontal sky illuminance of the instant, or judge the plane by its absolute illuminance",
            }
          : undefined,
    ),
    metric(
      "workplane.groundReflected.illuminance",
      "lx",
      null,
      {
        reason:
          "this solver models the sky vault only; light reflected from the reference ground and from surrounding surfaces is not computed",
        remedy:
          "bind an inter-reflection adapter and record its result as its own run, or read this plane as a sky-component study",
      },
      "unsupported",
    ),
  ];

  return sealAutoMovieAnalysisRun({
    id: request.id,
    domain,
    subject: request.subject,
    inputRevision: request.inputRevision,
    solver,
    settings,
    outcome: { status: "solved", metrics, samples, warnings },
  });
};

/** Beam illuminance at one point, or zero when the sun is hidden or behind. */
const beamIlluminance = (props: {
  point: IAutoMovieVector3;
  normal: IAutoMovieVector3;
  sun: IAutoMovieVector3;
  illuminance: number;
  solids: readonly IAutoMovieAnalysisSolid[];
}): number => {
  const incidence = Vector3.dot(props.normal, props.sun);
  if (incidence <= 0) return 0;
  if (
    autoMovieRayObstructed({
      origin: props.point,
      direction: props.sun,
      solids: props.solids,
      maxDistance: Infinity,
    })
  )
    return 0;
  return props.illuminance * incidence;
};

/** Isotropic sky illuminance at one point, by hemisphere visibility. */
const skyIlluminance = (props: {
  point: IAutoMovieVector3;
  ground: IAutoMovieReferenceGround;
  illuminance: number;
  solids: readonly IAutoMovieAnalysisSolid[];
  directions: readonly IAutoMovieVector3[];
}): number => {
  let visible = 0;
  for (const direction of props.directions) {
    if (!autoMovieSkyward(direction, props.ground)) continue;
    if (
      autoMovieRayObstructed({
        origin: props.point,
        direction,
        solids: props.solids,
        maxDistance: Infinity,
      })
    )
      continue;
    ++visible;
  }
  return (props.illuminance * visible) / props.directions.length;
};

/** Summed luminaire illuminance at one point. */
const artificialIlluminance = (props: {
  point: IAutoMovieVector3;
  normal: IAutoMovieVector3;
  luminaires: readonly IAutoMovieAnalysisLuminaire[];
  solids: readonly IAutoMovieAnalysisSolid[];
  warnings: IAutoMovieAnalysisWarning[];
  coincident: Set<string>;
}): number => {
  let total = 0;
  for (const luminaire of props.luminaires) {
    const offset: IAutoMovieVector3 = {
      x: luminaire.position.x - props.point.x,
      y: luminaire.position.y - props.point.y,
      z: luminaire.position.z - props.point.z,
    };
    const distance = Vector3.length(offset);
    if (distance <= EPSILON) {
      // Reported once per fitting rather than once per sample: the fact is
      // about the luminaire, and a warning repeated per grid cell would bury
      // every other warning the run carries.
      if (!props.coincident.has(luminaire.id)) {
        props.coincident.add(luminaire.id);
        props.warnings.push({
          code: "luminaire-on-workplane",
          detail: `luminaire "${luminaire.id}" sits on the workplane itself, where the inverse square law has no value; it contributes nothing`,
          subject: luminaire.id,
        });
      }
      continue;
    }
    const direction = Vector3.normalize(offset);
    const incidence = Vector3.dot(props.normal, direction);
    if (incidence <= 0) continue;
    if (
      autoMovieRayObstructed({
        origin: props.point,
        direction,
        solids: props.solids,
        maxDistance: distance,
      })
    )
      continue;
    total += (luminaire.intensity * incidence) / (distance * distance);
  }
  return total;
};

/** The world position of one grid cell centre. */
const gridPoint = (
  workplane: IAutoMovieAnalysisWorkplane,
  plane: { axisU: IAutoMovieVector3; axisV: IAutoMovieVector3 },
  i: number,
  j: number,
): IAutoMovieVector3 => {
  const u = ((i + 0.5) * workplane.sizeU) / workplane.countU;
  const v = ((j + 0.5) * workplane.sizeV) / workplane.countV;
  return {
    x: workplane.origin.x + plane.axisU.x * u + plane.axisV.x * v,
    y: workplane.origin.y + plane.axisU.y * u + plane.axisV.y * v,
    z: workplane.origin.z + plane.axisU.z * u + plane.axisV.z * v,
  };
};

/** The arithmetic mean of a non-empty list, in list order. */
const average = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Refuse a request no honest study can be made from, and return the plane it
 * describes.
 *
 * Authoring mistakes throw rather than becoming an `unsupported` run: an
 * unsupported run is a true statement about the host's capability, and using it
 * for a degenerate grid would turn a bug report into a capability claim.
 */
const validateDaylightRequest = (
  request: IAutoMovieDaylightRequest,
): {
  normal: IAutoMovieVector3;
  axisU: IAutoMovieVector3;
  axisV: IAutoMovieVector3;
} => {
  for (const [label, value] of [
    ["id", request.id],
    ["subject", request.subject],
    ["input revision", request.inputRevision],
    ["sky model", request.sky],
  ] as const)
    if (value.trim().length === 0)
      throw new Error(`a daylight study must state a non-blank ${label}`);
  const validated = validateAutoMovieEnvironmentContext({
    context: request.context,
  });
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `daylight study "${request.id}" reads an invalid environment context at ${first.path}: ${first.expected}`,
    );
  }
  if (
    request.instant !== null &&
    autoMovieEnvironmentInstant(request.context, request.instant) === null
  )
    throw new Error(
      `daylight study "${request.id}" names instant "${request.instant}", which the environment context does not declare`,
    );
  const workplane = request.workplane;
  for (const axis of ["sizeU", "sizeV"] as const)
    if (!Number.isFinite(workplane[axis]) || workplane[axis] <= 0)
      throw new Error(
        `workplane ${axis} must be a finite number above zero, but was ${workplane[axis]}`,
      );
  for (const axis of ["countU", "countV"] as const)
    if (!Number.isSafeInteger(workplane[axis]) || workplane[axis] < 1)
      throw new Error(
        `workplane ${axis} must be a whole number at or above one, but was ${workplane[axis]}`,
      );
  const cells = workplane.countU * workplane.countV;
  if (cells > AUTOMOVIE_ANALYSIS_MAX_SAMPLES)
    throw new Error(
      `a workplane grid of ${cells} cells exceeds the ${AUTOMOVIE_ANALYSIS_MAX_SAMPLES}-sample bound one run may carry; measure a coarser grid or split the plane`,
    );
  for (const axis of ["x", "y", "z"] as const)
    if (!Number.isFinite(workplane.origin[axis]))
      throw new Error(
        `workplane origin ${axis} must be finite, but was ${workplane.origin[axis]}`,
      );
  for (const key of ["axisU", "axisV"] as const) {
    const length = Vector3.length(workplane[key]);
    if (!Number.isFinite(length) || length <= EPSILON)
      throw new Error(
        `workplane ${key} must be a finite non-zero in-plane direction`,
      );
  }
  const axisU = Vector3.normalize(workplane.axisU);
  const axisV = Vector3.normalize(workplane.axisV);
  const normal = Vector3.cross(axisU, axisV);
  if (Vector3.length(normal) <= EPSILON)
    throw new Error(
      "a workplane needs two non-parallel in-plane axes to have a normal",
    );
  if (
    !Number.isSafeInteger(request.diffuseSamples) ||
    request.diffuseSamples < 1
  )
    throw new Error(
      `a daylight study needs a positive whole sky sample count, but was ${request.diffuseSamples}`,
    );
  const luminaires = new Set<string>();
  for (const luminaire of request.luminaires) {
    if (luminaire.id.trim().length === 0)
      throw new Error("every luminaire must carry a non-blank id");
    if (luminaires.has(luminaire.id))
      throw new Error(`luminaire id "${luminaire.id}" is declared twice`);
    luminaires.add(luminaire.id);
    if (!Number.isFinite(luminaire.intensity) || luminaire.intensity < 0)
      throw new Error(
        `luminaire "${luminaire.id}" intensity must be a finite number at or above zero, but was ${luminaire.intensity}`,
      );
    for (const axis of ["x", "y", "z"] as const)
      if (!Number.isFinite(luminaire.position[axis]))
        throw new Error(
          `luminaire "${luminaire.id}" position ${axis} must be finite, but was ${luminaire.position[axis]}`,
        );
  }
  assertAutoMovieAnalysisSolids(request.shades, "shading solid");
  assertAutoMovieAnalysisTargets(request.targets);
  return { normal: Vector3.normalize(normal), axisU, axisV };
};

/** The canonical settings text one daylight run is digested against. */
const daylightSettings = (
  request: IAutoMovieDaylightRequest,
  instant: IAutoMovieEnvironmentInstant | null,
): string =>
  JSON.stringify({
    context: request.context.id,
    ground: request.context.ground,
    north: request.context.north,
    instant,
    occluders: request.context.occluders.map((occluder) => ({
      id: occluder.id,
      planes: occluder.planes,
    })),
    workplane: request.workplane,
    shades: request.shades.map((shade) => ({
      id: shade.id,
      planes: shade.planes,
    })),
    luminaires: request.luminaires.map((luminaire) => ({
      id: luminaire.id,
      position: luminaire.position,
      intensity: luminaire.intensity,
    })),
    sky: request.sky,
    diffuseSamples: request.diffuseSamples,
    targets: request.targets.map((target) => ({
      key: target.key,
      unit: target.unit,
      value: target.value,
      comparison: target.comparison,
    })),
  });
