import {
  IAutoMovieAnalysisMetric,
  IAutoMovieAnalysisMetricGap,
  IAutoMovieAnalysisRun,
  IAutoMovieAnalysisSample,
  IAutoMovieAnalysisTarget,
  IAutoMovieAnalysisWarning,
  IAutoMovieEnvironmentContext,
  IAutoMovieEnvironmentInstant,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  AUTOMOVIE_ANALYSIS_MAX_SAMPLES,
  assertAutoMovieAnalysisTargets,
  autoMovieAnalysisMetric,
  sealAutoMovieAnalysisRun,
  warnAutoMovieAnalysisTargetKeys,
} from "./analysisRun";
import {
  autoMovieEnvironmentInstant,
  validateAutoMovieEnvironmentContext,
} from "./environmentContext";

/**
 * Magnus coefficients for saturation vapour pressure over water, as published
 * by Sonntag: `a` is dimensionless and `b` is in degrees Celsius.
 *
 * They are constants of the equation, not a material table: every dew point
 * anyone computes from air temperature and relative humidity uses these two
 * numbers, so they are capability rather than content.
 */
const MAGNUS_A = 17.62;
const MAGNUS_B = 243.12;

/**
 * One homogeneous layer of an envelope assembly.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `IAutoMovieEnvelopeLayer` declares one material thickness and conductivity used to calculate envelope thermal resistance.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The layer record contributes one explicit `thickness / conductivity` resistance to a resolved assembly load path.
 */
export interface IAutoMovieEnvelopeLayer {
  /**
   * Stable layer identity within the assembly.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment The layer `id` keeps each authored material stratum separately traceable in the envelope build-up.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract This stable key makes duplicate layers a deterministic validation error within their assembly.
   */
  id: string;
  /**
   * Thickness in metres; strictly positive.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `thickness` states the material depth through which the envelope heat load passes.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The positive metre value is divided by conductivity to obtain this layer's thermal resistance.
   */
  thickness: number;
  /**
   * Thermal conductivity in W/(m*K); strictly positive.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `conductivity` declares how readily this authored layer transmits heat instead of selecting a hidden material table.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The positive W/(m*K) operand closes the steady one-dimensional resistance calculation for the layer.
   */
  conductivity: number;
}

/**
 * One envelope build-up between the indoor air and the outdoor air.
 *
 * The production declares its own layers and its own surface films. A shipped
 * table of conductivities would be content this product does not sell; the
 * one-dimensional steady-state resistance network that turns them into a
 * transmittance is the capability it does.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `IAutoMovieEnvelopeAssembly` binds one boundary area to its films, ordered layers, and overlay position for thermal-load evidence.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The assembly supplies the complete series-resistance path and area multiplier used by the resolved environmental calculation.
 */
export interface IAutoMovieEnvelopeAssembly {
  /**
   * Stable assembly identity within the request.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment The assembly `id` identifies which envelope build-up contributes each reported U-value and sample.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract This key also resolves linear bridges to their owning resistance path and rejects ambiguous duplicates.
   */
  id: string;
  /**
   * Building boundary this assembly realizes.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `boundary` names the building enclosure element whose environmental performance this assembly realizes.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The boundary label keeps the calculated load attributable to the resolved architectural path rather than only to a solver id.
   */
  boundary: string;
  /**
   * Layers from the interior face outward; at least one.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `layers` explicitly declare the material sequence whose combined resistance limits heat flow.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The nonempty ordered list is validated and reduced to the conductive portion of total assembly resistance.
   */
  layers: readonly IAutoMovieEnvelopeLayer[];
  /**
   * Interior surface film resistance in m^2*K/W; strictly positive.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `interiorFilm` declares the room-side surface resistance used in both heat flow and condensation risk.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract This positive boundary resistance enters the U-value denominator and the interior-surface temperature calculation.
   */
  interiorFilm: number;
  /**
   * Exterior surface film resistance in m^2*K/W; strictly positive.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `exteriorFilm` states the outside surface resistance completing the declared envelope path.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The exterior boundary term is summed with layer and interior resistances before transmittance is inverted.
   */
  exteriorFilm: number;
  /**
   * Area in m^2; strictly positive.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment Assembly `area` declares how much enclosure participates in the fabric heat load.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The square-metre operand scales U-value and temperature difference into this assembly's watt contribution.
   */
  area: number;
  /**
   * Representative world point on the interior face, for the field overlay.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment Assembly `position` locates the calculated interior-surface result for a deterministic field overlay.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The representative world point becomes the sample coordinate paired with this assembly's surface temperature.
   */
  position: IAutoMovieVector3;
}

/**
 * One linear thermal bridge along an assembly.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `IAutoMovieEnvelopeBridge` declares one linear bypass whose extra heat load must not disappear into planar U-values.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The bridge links a length and linear transmittance to a resolved assembly before its watt contribution is added.
 */
export interface IAutoMovieEnvelopeBridge {
  /**
   * Stable bridge identity within the request.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment The bridge `id` keeps each linear thermal path individually attributable in validation and settings evidence.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract This identity makes duplicate bridge declarations explicit before their loads are summed.
   */
  id: string;
  /**
   * Assembly the bridge runs along.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `assembly` names the envelope build-up along which this extra thermal path runs.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The foreign key is resolved against declared assembly ids so an orphaned bridge cannot enter the load total.
   */
  assembly: string;
  /**
   * Linear thermal transmittance in W/(m*K); at or above zero.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `linearTransmittance` declares the bridge's additional heat-flow rate per metre and kelvin.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The nonnegative psi-value is multiplied by bridge length and temperature difference for its bounded load.
   */
  linearTransmittance: number;
  /**
   * Length in metres; strictly positive.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment Bridge `length` states how far the declared linear heat path extends.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The positive metre measure scales psi into a conductance before exterior-interior temperature difference is applied.
   */
  length: number;
}

/**
 * The indoor air an envelope is analysed against.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `IAutoMovieIndoorCondition` declares the room temperature and moisture state against which envelope performance is judged.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The condition supplies the indoor side of heat-flow, dew-point, and surface-condensation calculations.
 */
export interface IAutoMovieIndoorCondition {
  /**
   * Dry-bulb air temperature in degrees Celsius.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `airTemperature` states the authored indoor dry-bulb condition rather than inferring comfort from geometry.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The Celsius input forms the warm boundary for fabric loss, surface temperature, and Magnus dew-point evaluation.
   */
  airTemperature: number;
  /**
   * Relative humidity as a `[0, 1]` fraction.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `relativeHumidity` declares the indoor moisture fraction used to test condensation risk.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The bounded fraction combines with air temperature in the Magnus equation to produce the comparison dew point.
   */
  relativeHumidity: number;
}

/**
 * Everything one envelope study is configured with.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `IAutoMovieEnvelopeRequest` binds one revision's indoor and outdoor conditions to explicit assemblies, bridges, and performance targets.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The request closes the input network used to produce paired thermal and moisture runs from the same envelope state.
 */
export interface IAutoMovieEnvelopeRequest {
  /**
   * Stable study identity; each produced run suffixes its own domain.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment The envelope request `id` identifies the shared study from which its thermal and moisture runs are derived.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract This base key is deterministically suffixed by domain so paired environmental outcomes stay related but distinct.
   */
  id: string;
  /**
   * Logical space the envelope encloses.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `subject` names the logical interior whose enclosure load and condensation evidence are reported.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The label is preserved across both domain runs so their resolved outcomes remain attributable to one space.
   */
  subject: string;
  /**
   * Design revision being read.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `inputRevision` records the exact design state whose envelope capacity was calculated.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The revision enters both sealed records so a later rollup can reject superseded environmental evidence.
   */
  inputRevision: string;
  /**
   * Read-only external world.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `context` supplies the validated external temperature state used as the envelope's outdoor boundary.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The read-only environment is resolved by instant and contributes no undeclared climate assumptions to the load network.
   */
  context: IAutoMovieEnvironmentContext;
  /**
   * Instant supplying the exterior boundary condition, or null.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `instant` selects the declared exterior condition, while null leaves the unavailable boundary explicit.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The nullable key controls context lookup and makes both domain runs `not-run` when no outside temperature is resolved.
   */
  instant: string | null;
  /**
   * Indoor air.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `indoor` contributes the explicitly authored temperature and humidity against which the enclosure is tested.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract This condition feeds both the thermal gradient and the dew-point comparison in the resolved scenario.
   */
  indoor: IAutoMovieIndoorCondition;
  /**
   * Envelope build-ups; at least one.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `assemblies` enumerate every planar envelope path included in fabric loss and surface-risk results.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The nonempty collection is validated, solved individually, sampled spatially, and summed into environmental capacity metrics.
   */
  assemblies: readonly IAutoMovieEnvelopeAssembly[];
  /**
   * Linear thermal bridges.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `bridges` list the authored linear losses added outside the planar assembly calculation.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract Each bridge is resolved to an assembly and contributes `psi * length * deltaT` to the total heat load.
   */
  bridges: readonly IAutoMovieEnvelopeBridge[];
  /**
   * Targets the production declares for this study.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment Envelope `targets` declare the thermal and moisture thresholds the authored design is expected to meet.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The shared target list is validated once and resolved against metrics in each of the two domain runs.
   */
  targets: readonly IAutoMovieAnalysisTarget[];
}

/**
 * Solve one envelope for heat and for surface condensation, as two runs.
 *
 * Two runs rather than one because heat and moisture are two domains a report
 * rolls up separately: a wall may be warm enough and still wet, and one merged
 * verdict would let either fact hide the other. Both read the same inputs and
 * carry the same settings digest, so they are provably about the same
 * envelope.
 *
 * The governing model is the one-dimensional steady-state network, stated
 * exactly:
 *
 * - `R = Rsi + sum(t / lambda) + Rse`, and `U = 1 / R`;
 * - The interior surface sits at `Tsi = Ti - U * Rsi * (Ti - Te)`, so the
 *   temperature factor `fRsi = (Tsi - Te) / (Ti - Te)` reduces exactly to `1 -
 *   U
 *
 *   - Rsi` and needs no temperatures at all;
 * - Fabric loss is `sum(U * A) * dT` and linear bridges add `sum(psi * L) * dT`;
 * - The dew point comes from the Magnus form, `gamma = ln(RH) + a*T/(b+T)` and
 *   `Td = b*gamma/(a - gamma)`, and surface condensation is `Tsi <= Td`.
 *
 * What it does not do, it says. Transient storage, vapour diffusion through the
 * build-up and solar gain through glazing each appear as an `unsupported`
 * metric with the exact reason, because an envelope study that quietly omitted
 * them would read as a complete answer.
 *
 * Without an exterior boundary condition there is no answer at all, and both
 * runs come back `not-run` naming the missing input rather than assuming a
 * temperature nobody declared.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `analyzeAutoMovieEnvelope` computes steady fabric and bridge loads plus surface condensation risk, and names transient, vapour, and solar claims it does not solve.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The solver validates the resolved envelope network, evaluates resistance and Magnus equations, and seals separate thermal and moisture results over identical settings.
 * @author Samchon
 */
export const analyzeAutoMovieEnvelope = (props: {
  request: IAutoMovieEnvelopeRequest;
}): { thermal: IAutoMovieAnalysisRun; moisture: IAutoMovieAnalysisRun } => {
  const request = props.request;
  validateEnvelopeRequest(request);
  // Resolved before the settings text, because the request validator already
  // refused an instant the context does not declare; a second lookup would add
  // an unreachable fallback nobody can test.
  const instant =
    request.instant === null
      ? null
      : autoMovieEnvironmentInstant(request.context, request.instant)!;
  const settings = envelopeSettings(request, instant);
  const solver = {
    id: "automovie.envelope.steady-state-1d",
    version: "1",
    model:
      "1D steady-state resistance network U=1/(Rsi+sum(t/lambda)+Rse), surface Tsi=Ti-U*Rsi*(Ti-Te), Magnus dew point; transient storage, vapour diffusion and solar gain excluded",
  };
  const exterior = exteriorTemperature(instant);
  if (exterior === null) {
    const missing =
      instant === null
        ? {
            reason:
              "the study names no environmental instant, so no exterior air temperature was supplied",
            remedy:
              "name an instant of the environment context that declares an outdoor air temperature",
          }
        : {
            reason: `instant "${instant.id}" declares no outdoor air temperature, so the exterior boundary condition is missing`,
            remedy: `declare outdoorAirTemperature on instant "${instant.id}", or name an instant that does`,
          };
    return {
      thermal: sealAutoMovieAnalysisRun({
        id: `${request.id}.thermal`,
        domain: "thermal",
        subject: request.subject,
        inputRevision: request.inputRevision,
        solver,
        settings,
        outcome: { status: "not-run", ...missing },
      }),
      moisture: sealAutoMovieAnalysisRun({
        id: `${request.id}.moisture`,
        domain: "moisture",
        subject: request.subject,
        inputRevision: request.inputRevision,
        solver,
        settings,
        outcome: { status: "not-run", ...missing },
      }),
    };
  }

  const indoor = request.indoor.airTemperature;
  const delta = indoor - exterior;
  // One shared observation about the inputs, then a separate sink per run: a
  // target stated in the wrong unit for a moisture metric is a fact about the
  // moisture run, and carrying it on the thermal run would tell a reader the
  // heat result had a problem it does not have.
  const shared: IAutoMovieAnalysisWarning[] = [];
  if (delta <= 0)
    shared.push({
      code: "reverse-heat-flow",
      // `Tsi = Ti - U*Rsi*(Ti - Te)` and `U*Rsi < 1`, so the interior face sits
      // between the two air temperatures: it is never colder than the indoor
      // air once the outdoor air is at or above it. Saying it is the *warm*
      // side would be a claim the equal-temperature case contradicts, and this
      // warning exists to keep a reader from misreading the margin.
      detail: `indoor air at ${indoor} degC is not warmer than outdoor air at ${exterior} degC, so the interior surface is no colder than the indoor air; the surface condensation criterion is reported but is not the governing risk`,
      subject: null,
    });
  const thermalWarnings: IAutoMovieAnalysisWarning[] = [...shared];
  const moistureWarnings: IAutoMovieAnalysisWarning[] = [...shared];

  const solved = request.assemblies.map((assembly) => {
    const resistance =
      assembly.interiorFilm +
      assembly.layers.reduce(
        (sum, layer) => sum + layer.thickness / layer.conductivity,
        0,
      ) +
      assembly.exteriorFilm;
    const transmittance = 1 / resistance;
    return {
      assembly,
      transmittance,
      temperatureFactor: 1 - transmittance * assembly.interiorFilm,
      surface: indoor - transmittance * assembly.interiorFilm * delta,
    };
  });
  const area = solved.reduce((sum, entry) => sum + entry.assembly.area, 0);
  const fabric = solved.reduce(
    (sum, entry) => sum + entry.transmittance * entry.assembly.area,
    0,
  );
  const bridge = request.bridges.reduce(
    (sum, entry) => sum + entry.linearTransmittance * entry.length,
    0,
  );
  const heatLoss = (fabric + bridge) * delta;
  const bridgeLoss = bridge * delta;

  const thermalMetrics: IAutoMovieAnalysisMetric[] = [
    metric(request, thermalWarnings, {
      key: "envelope.thermalTransmittance.areaWeighted",
      unit: "W/(m2*K)",
      value: fabric / area,
    }),
    metric(request, thermalWarnings, {
      key: "envelope.thermalTransmittance.max",
      unit: "W/(m2*K)",
      value: Math.max(...solved.map((entry) => entry.transmittance)),
    }),
    metric(request, thermalWarnings, {
      key: "envelope.heatLoss",
      unit: "W",
      value: heatLoss,
    }),
    metric(request, thermalWarnings, {
      key: "envelope.thermalBridgeShare",
      unit: "ratio",
      value: heatLoss === 0 ? null : bridgeLoss / heatLoss,
      gap:
        heatLoss === 0
          ? {
              // Stated as the measured fact rather than as its usual cause. The
              // usual cause is equal air temperatures, but the share is
              // undefined whenever the loss is zero, and a reason that named
              // only the temperatures would be a sentence the artifact itself
              // could contradict.
              reason: `the envelope carries no heat flow at all with indoor air at ${indoor} degC against outdoor air at ${exterior} degC, so there is nothing to apportion between fabric and bridges`,
              remedy:
                "analyse an instant whose outdoor air temperature differs from the indoor air temperature",
            }
          : undefined,
    }),
    metric(request, thermalWarnings, {
      key: "envelope.temperatureFactor.min",
      unit: "ratio",
      value: Math.min(...solved.map((entry) => entry.temperatureFactor)),
    }),
    metric(request, thermalWarnings, {
      key: "envelope.surfaceTemperature",
      unit: "degC",
      value:
        solved.reduce(
          (sum, entry) => sum + entry.surface * entry.assembly.area,
          0,
        ) / area,
    }),
    metric(request, thermalWarnings, {
      key: "envelope.surfaceTemperature.min",
      unit: "degC",
      value: Math.min(...solved.map((entry) => entry.surface)),
    }),
    metric(request, thermalWarnings, {
      key: "envelope.solarHeatGain",
      unit: "W",
      value: null,
      gap: {
        reason:
          "this solver reads no glazing g-value and no solar incidence, so heat gained through the envelope by sunlight is not computed",
        remedy:
          "bind a solar-gain adapter and record its result as its own run, or read this envelope as a conduction-only study",
      },
      status: "unsupported",
    }),
  ];
  const thermalSamples: IAutoMovieAnalysisSample[] = solved.map((entry) => ({
    id: entry.assembly.id,
    key: "envelope.surfaceTemperature",
    position: entry.assembly.position,
    value: entry.surface,
  }));

  const humidity = request.indoor.relativeHumidity;
  const dewPoint = humidity === 0 ? null : magnusDewPoint(indoor, humidity);
  const noDewPoint: IAutoMovieAnalysisMetricGap = {
    reason:
      "the indoor air declares 0 relative humidity, which has no dew point at any temperature",
    remedy:
      "declare the indoor relative humidity the space is actually conditioned to",
  };
  const margins =
    dewPoint === null
      ? null
      : solved.map((entry) => ({
          assembly: entry.assembly,
          margin: entry.surface - dewPoint,
        }));
  const moistureMetrics: IAutoMovieAnalysisMetric[] = [
    metric(request, moistureWarnings, {
      key: "space.dewPoint",
      unit: "degC",
      value: dewPoint,
      gap: dewPoint === null ? noDewPoint : undefined,
    }),
    metric(request, moistureWarnings, {
      key: "envelope.condensationMargin",
      unit: "K",
      value:
        margins === null
          ? null
          : margins.reduce(
              (sum, entry) => sum + entry.margin * entry.assembly.area,
              0,
            ) / area,
      gap: margins === null ? noDewPoint : undefined,
    }),
    metric(request, moistureWarnings, {
      key: "envelope.condensationMargin.min",
      unit: "K",
      value:
        margins === null
          ? null
          : Math.min(...margins.map((entry) => entry.margin)),
      gap: margins === null ? noDewPoint : undefined,
    }),
    metric(request, moistureWarnings, {
      key: "envelope.condensationRisk",
      unit: "count",
      value:
        margins === null
          ? null
          : margins.filter((entry) => entry.margin <= 0).length,
      gap: margins === null ? noDewPoint : undefined,
    }),
    metric(request, moistureWarnings, {
      key: "envelope.interstitialCondensation",
      unit: "count",
      value: null,
      gap: {
        reason:
          "this solver reads no vapour resistivity, so condensation inside the build-up is not computed; only the interior surface is judged",
        remedy:
          "bind a vapour-diffusion adapter and record its result as its own run",
      },
      status: "unsupported",
    }),
  ];
  const moistureSamples: IAutoMovieAnalysisSample[] =
    margins === null
      ? []
      : margins.map((entry) => ({
          id: entry.assembly.id,
          key: "envelope.condensationMargin",
          position: entry.assembly.position,
          value: entry.margin,
        }));

  // Checked against both runs at once. Heat and moisture are two domains of one
  // study, so a dew-point target is not "unmatched" merely because the thermal
  // run has no such metric, and the observation belongs to whichever run a
  // reader happens to open.
  const reported = [...thermalMetrics, ...moistureMetrics].map(
    (entry) => entry.key,
  );
  for (const sink of [thermalWarnings, moistureWarnings])
    warnAutoMovieAnalysisTargetKeys({
      targets: request.targets,
      keys: reported,
      warnings: sink,
    });

  return {
    thermal: sealAutoMovieAnalysisRun({
      id: `${request.id}.thermal`,
      domain: "thermal",
      subject: request.subject,
      inputRevision: request.inputRevision,
      solver,
      settings,
      outcome: {
        status: "solved",
        metrics: thermalMetrics,
        samples: thermalSamples,
        warnings: thermalWarnings,
      },
    }),
    moisture: sealAutoMovieAnalysisRun({
      id: `${request.id}.moisture`,
      domain: "moisture",
      subject: request.subject,
      inputRevision: request.inputRevision,
      solver,
      settings,
      outcome: {
        status: "solved",
        metrics: moistureMetrics,
        samples: moistureSamples,
        warnings: moistureWarnings,
      },
    }),
  };
};

/**
 * Everything one ventilation study is configured with.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `IAutoMovieSpaceAirRequest` declares one zone's volume, outdoor-air supply, occupancy, carbon-dioxide sources, and targets without implying a flow field.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The request closes the scalar ventilation network used for air-change, per-person flow, and well-mixed concentration outcomes.
 */
export interface IAutoMovieSpaceAirRequest {
  /**
   * Stable run identity.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment The air request `id` gives one ventilation calculation a stable run identity.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract This key anchors the sealed air-domain result and its deterministic diagnostics.
   */
  id: string;
  /**
   * Logical space being ventilated.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment Air-study `subject` names the logical space whose supply and contaminant capacity are evaluated.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The space label is copied into the run so ventilation evidence remains attributable to its resolved zone.
   */
  subject: string;
  /**
   * Design revision being read.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment Air-study `inputRevision` records which design state supplied the volume, occupancy, and ventilation flow.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The revision is sealed with the outcome so superseded service-capacity evidence is classified as stale.
   */
  inputRevision: string;
  /**
   * Space volume in m^3; strictly positive.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment Space `volume` states the air capacity across which the declared supply is distributed.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The positive cubic-metre operand converts supply flow into the room's hourly air-change rate.
   */
  volume: number;
  /**
   * Mechanical outdoor-air supply in m^3/s, or null when none is declared.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `supplyFlow` declares mechanical outdoor-air capacity, with null preserving the absence of a specified service.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract A positive flow enables the three scalar ventilation equations; null or zero yields named gaps instead of inferred air movement.
   */
  supplyFlow: number | null;
  /**
   * Occupants the space is designed for; a whole number at or above zero.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `occupants` states the design population against which ventilation capacity and contaminant load are judged.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The whole-number count determines whether per-person flow is defined and multiplies individual carbon-dioxide generation.
   */
  occupants: number;
  /**
   * Carbon dioxide one occupant generates, in m^3/s; at or above zero.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `occupantCarbonDioxide` declares the contaminant generation assigned to each design occupant.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The per-person m3/s rate is multiplied by occupancy in the well-mixed steady-state concentration balance.
   */
  occupantCarbonDioxide: number;
  /**
   * Outdoor carbon dioxide concentration in ppm; at or above zero.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `outdoorCarbonDioxide` states the incoming baseline concentration instead of assuming ambient air quality.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The ppm baseline is the additive boundary condition in the resolved zone concentration equation.
   */
  outdoorCarbonDioxide: number;
  /**
   * Targets the production declares for this study.
   *
   * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment Air-study `targets` declare the service-capacity thresholds applied to computed ventilation and concentration values.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The list is validated and matched by key and unit as each supported zone metric is constructed.
   */
  targets: readonly IAutoMovieAnalysisTarget[];
}

/**
 * Solve one space for ventilation, and refuse to pretend it solved the air.
 *
 * What a well-mixed zone model can answer, it answers exactly: the air change
 * rate `n = 3600 * Q / V`, the outdoor air per person `1000 * Q / N`, and the
 * steady-state contaminant balance `C = Co + 1e6 * N * G / Q`. Those are
 * closed-form and are checked against hand arithmetic.
 *
 * What it cannot answer, it refuses to. Air stagnation and a velocity field are
 * properties of a flow solution, and no amount of zone arithmetic produces one,
 * so both are `unsupported` metrics naming exactly what is missing. This is the
 * whole point of the contract: the honest answer to "where does the air sit
 * still" is that this host does not know, and a number invented here would be
 * indistinguishable from one that was computed.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `analyzeAutoMovieSpaceAir` computes bounded zone ventilation and carbon-dioxide capacity while explicitly refusing stagnation and velocity-field claims.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The solver validates the declared zone state, evaluates its three closed forms, records unsupported flow outcomes, and seals one air-domain run.
 * @author Samchon
 */
export const analyzeAutoMovieSpaceAir = (props: {
  request: IAutoMovieSpaceAirRequest;
}): IAutoMovieAnalysisRun => {
  const request = props.request;
  validateAirRequest(request);
  const warnings: IAutoMovieAnalysisWarning[] = [];
  const flow = request.supplyFlow;
  const noFlow: IAutoMovieAnalysisMetricGap = {
    reason:
      "the space declares no mechanical outdoor-air supply, so no ventilation rate exists to report",
    remedy:
      "declare the supply flow the space is ventilated at, or record an infiltration study as its own run",
  };
  const air = (
    key: string,
    unit: string,
    value: number | null,
    gap?: IAutoMovieAnalysisMetricGap,
    status?: "unsupported" | "not-run",
  ): IAutoMovieAnalysisMetric =>
    autoMovieAnalysisMetric({
      key,
      unit,
      value,
      targets: request.targets,
      warnings,
      gap,
      status,
    });
  const metrics: IAutoMovieAnalysisMetric[] = [
    air(
      "space.airChangeRate",
      "1/h",
      flow === null ? null : (flow * 3600) / request.volume,
      flow === null ? noFlow : undefined,
    ),
    air(
      "space.freshAirPerOccupant",
      "L/(s*person)",
      flow === null || request.occupants === 0
        ? null
        : (flow * 1000) / request.occupants,
      flow === null
        ? noFlow
        : request.occupants === 0
          ? {
              reason:
                "the space declares no occupants, so outdoor air per person is undefined",
              remedy:
                "declare the occupancy the ventilation is designed for, or judge the space by its air change rate",
            }
          : undefined,
    ),
    air(
      "space.carbonDioxide.steadyState",
      "ppm",
      flow === null || flow === 0
        ? null
        : request.outdoorCarbonDioxide +
            (1e6 * request.occupants * request.occupantCarbonDioxide) / flow,
      flow === null
        ? noFlow
        : flow === 0
          ? {
              reason:
                "the space declares a supply flow of 0 m3/s, so an occupied space reaches no steady-state concentration at all",
              remedy:
                "declare the outdoor-air flow the space is actually ventilated at",
            }
          : undefined,
    ),
    air(
      "space.airVelocity.mean",
      "m/s",
      null,
      {
        reason:
          "this host solves a well-mixed zone balance and computes no flow field, so air speed inside the space is not known",
        remedy:
          "bind a computational fluid dynamics adapter and record its result as its own run",
      },
      "unsupported",
    ),
    air(
      "space.stagnationVolumeFraction",
      "ratio",
      null,
      {
        reason:
          "stagnation is a property of a velocity field, and this host computes none; a zone air change rate cannot locate still air",
        remedy:
          "bind a computational fluid dynamics adapter and record its result as its own run",
      },
      "unsupported",
    ),
  ];
  warnAutoMovieAnalysisTargetKeys({
    targets: request.targets,
    keys: metrics.map((entry) => entry.key),
    warnings,
  });
  return sealAutoMovieAnalysisRun({
    id: request.id,
    domain: "air",
    subject: request.subject,
    inputRevision: request.inputRevision,
    solver: {
      id: "automovie.air.well-mixed-zone",
      version: "1",
      model:
        "well-mixed single-zone balance n=3600Q/V, per-person 1000Q/N, steady-state C=Co+1e6*N*G/Q; no flow field, so stagnation and air speed are unsupported",
    },
    settings: JSON.stringify({
      volume: request.volume,
      supplyFlow: request.supplyFlow,
      occupants: request.occupants,
      occupantCarbonDioxide: request.occupantCarbonDioxide,
      outdoorCarbonDioxide: request.outdoorCarbonDioxide,
      targets: request.targets.map((target) => ({
        key: target.key,
        unit: target.unit,
        value: target.value,
        comparison: target.comparison,
      })),
    }),
    outcome: { status: "solved", metrics, samples: [], warnings },
  });
};

/**
 * Dew point of moist air by the Magnus form.
 *
 * `gamma = ln(RH) + a*T/(b+T)`, `Td = b*gamma/(a - gamma)`. Exported because it
 * is the one place this project turns humidity into a temperature, and a second
 * copy would be a second answer.
 *
 * @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment `autoMovieDewPoint` turns declared air temperature and relative humidity into the comparison temperature used for condensation evidence.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-service-network-contract The function evaluates the single Magnus-form moisture boundary shared by envelope risk calculations.
 */
export const autoMovieDewPoint = (
  temperature: number,
  relativeHumidity: number,
): number => {
  if (!Number.isFinite(temperature))
    throw new Error(
      `a dew point needs a finite air temperature, but was ${temperature}`,
    );
  if (
    !Number.isFinite(relativeHumidity) ||
    relativeHumidity <= 0 ||
    relativeHumidity > 1
  )
    throw new Error(
      `a dew point needs a relative humidity within (0, 1], but was ${relativeHumidity}`,
    );
  return magnusDewPoint(temperature, relativeHumidity);
};

const magnusDewPoint = (
  temperature: number,
  relativeHumidity: number,
): number => {
  const gamma =
    Math.log(relativeHumidity) +
    (MAGNUS_A * temperature) / (MAGNUS_B + temperature);
  return (MAGNUS_B * gamma) / (MAGNUS_A - gamma);
};

/** The exterior air temperature an instant supplies, or null. */
const exteriorTemperature = (
  instant: IAutoMovieEnvironmentInstant | null,
): number | null => (instant === null ? null : instant.outdoorAirTemperature);

/** One envelope metric, resolved against the request's declared targets. */
const metric = (
  request: IAutoMovieEnvelopeRequest,
  warnings: IAutoMovieAnalysisWarning[],
  props: {
    key: string;
    unit: string;
    value: number | null;
    gap?: IAutoMovieAnalysisMetricGap;
    status?: "unsupported" | "not-run";
  },
): IAutoMovieAnalysisMetric =>
  autoMovieAnalysisMetric({
    key: props.key,
    unit: props.unit,
    value: props.value,
    targets: request.targets,
    warnings,
    gap: props.gap,
    status: props.status,
  });

const validateEnvelopeRequest = (request: IAutoMovieEnvelopeRequest): void => {
  for (const [label, value] of [
    ["id", request.id],
    ["subject", request.subject],
    ["input revision", request.inputRevision],
  ] as const)
    if (value.trim().length === 0)
      throw new Error(`an envelope study must state a non-blank ${label}`);
  const validated = validateAutoMovieEnvironmentContext({
    context: request.context,
  });
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `envelope study "${request.id}" reads an invalid environment context at ${first.path}: ${first.expected}`,
    );
  }
  if (
    request.instant !== null &&
    autoMovieEnvironmentInstant(request.context, request.instant) === null
  )
    throw new Error(
      `envelope study "${request.id}" names instant "${request.instant}", which the environment context does not declare`,
    );
  if (!Number.isFinite(request.indoor.airTemperature))
    throw new Error(
      `indoor air temperature must be finite, but was ${request.indoor.airTemperature}`,
    );
  if (
    !Number.isFinite(request.indoor.relativeHumidity) ||
    request.indoor.relativeHumidity < 0 ||
    request.indoor.relativeHumidity > 1
  )
    throw new Error(
      `indoor relative humidity must be a fraction within [0, 1], but was ${request.indoor.relativeHumidity}`,
    );
  if (request.assemblies.length === 0)
    throw new Error("an envelope study needs at least one assembly");
  if (request.assemblies.length > AUTOMOVIE_ANALYSIS_MAX_SAMPLES)
    throw new Error(
      `an envelope study carries one sample per assembly and may not exceed ${AUTOMOVIE_ANALYSIS_MAX_SAMPLES}, but had ${request.assemblies.length}`,
    );
  const assemblies = new Set<string>();
  for (const assembly of request.assemblies) {
    if (assembly.id.trim().length === 0)
      throw new Error("every envelope assembly must carry a non-blank id");
    if (assemblies.has(assembly.id))
      throw new Error(`envelope assembly "${assembly.id}" is declared twice`);
    assemblies.add(assembly.id);
    if (assembly.boundary.trim().length === 0)
      throw new Error(
        `envelope assembly "${assembly.id}" must name the boundary it realizes`,
      );
    for (const key of ["interiorFilm", "exteriorFilm", "area"] as const)
      if (!Number.isFinite(assembly[key]) || assembly[key] <= 0)
        throw new Error(
          `envelope assembly "${assembly.id}" ${key} must be a finite number above zero, but was ${assembly[key]}`,
        );
    for (const axis of ["x", "y", "z"] as const)
      if (!Number.isFinite(assembly.position[axis]))
        throw new Error(
          `envelope assembly "${assembly.id}" position ${axis} must be finite, but was ${assembly.position[axis]}`,
        );
    if (assembly.layers.length === 0)
      throw new Error(
        `envelope assembly "${assembly.id}" must declare at least one layer`,
      );
    const layers = new Set<string>();
    for (const layer of assembly.layers) {
      if (layer.id.trim().length === 0)
        throw new Error(
          `every layer of envelope assembly "${assembly.id}" must carry a non-blank id`,
        );
      if (layers.has(layer.id))
        throw new Error(
          `layer "${layer.id}" of envelope assembly "${assembly.id}" is declared twice`,
        );
      layers.add(layer.id);
      for (const key of ["thickness", "conductivity"] as const)
        if (!Number.isFinite(layer[key]) || layer[key] <= 0)
          throw new Error(
            `layer "${layer.id}" ${key} must be a finite number above zero, but was ${layer[key]}`,
          );
    }
  }
  const bridges = new Set<string>();
  for (const bridge of request.bridges) {
    if (bridge.id.trim().length === 0)
      throw new Error("every thermal bridge must carry a non-blank id");
    if (bridges.has(bridge.id))
      throw new Error(`thermal bridge "${bridge.id}" is declared twice`);
    bridges.add(bridge.id);
    if (!assemblies.has(bridge.assembly))
      throw new Error(
        `thermal bridge "${bridge.id}" runs along assembly "${bridge.assembly}", which the study does not declare`,
      );
    if (
      !Number.isFinite(bridge.linearTransmittance) ||
      bridge.linearTransmittance < 0
    )
      throw new Error(
        `thermal bridge "${bridge.id}" linear transmittance must be a finite number at or above zero, but was ${bridge.linearTransmittance}`,
      );
    if (!Number.isFinite(bridge.length) || bridge.length <= 0)
      throw new Error(
        `thermal bridge "${bridge.id}" length must be a finite number above zero, but was ${bridge.length}`,
      );
  }
  assertAutoMovieAnalysisTargets(request.targets);
};

const validateAirRequest = (request: IAutoMovieSpaceAirRequest): void => {
  for (const [label, value] of [
    ["id", request.id],
    ["subject", request.subject],
    ["input revision", request.inputRevision],
  ] as const)
    if (value.trim().length === 0)
      throw new Error(`a ventilation study must state a non-blank ${label}`);
  if (!Number.isFinite(request.volume) || request.volume <= 0)
    throw new Error(
      `a ventilated space volume must be a finite number above zero, but was ${request.volume}`,
    );
  if (
    request.supplyFlow !== null &&
    (!Number.isFinite(request.supplyFlow) || request.supplyFlow < 0)
  )
    throw new Error(
      `a supply flow must be null or a finite number at or above zero, but was ${request.supplyFlow}`,
    );
  if (!Number.isSafeInteger(request.occupants) || request.occupants < 0)
    throw new Error(
      `an occupancy must be a whole number at or above zero, but was ${request.occupants}`,
    );
  for (const key of ["occupantCarbonDioxide", "outdoorCarbonDioxide"] as const)
    if (!Number.isFinite(request[key]) || request[key] < 0)
      throw new Error(
        `${key} must be a finite number at or above zero, but was ${request[key]}`,
      );
  assertAutoMovieAnalysisTargets(request.targets);
};

/** The canonical settings text one envelope study is digested against. */
const envelopeSettings = (
  request: IAutoMovieEnvelopeRequest,
  instant: IAutoMovieEnvironmentInstant | null,
): string =>
  JSON.stringify({
    context: request.context.id,
    instant,
    indoor: request.indoor,
    assemblies: request.assemblies.map((assembly) => ({
      id: assembly.id,
      boundary: assembly.boundary,
      layers: assembly.layers.map((layer) => ({
        id: layer.id,
        thickness: layer.thickness,
        conductivity: layer.conductivity,
      })),
      interiorFilm: assembly.interiorFilm,
      exteriorFilm: assembly.exteriorFilm,
      area: assembly.area,
      position: assembly.position,
    })),
    bridges: request.bridges.map((bridge) => ({
      id: bridge.id,
      assembly: bridge.assembly,
      linearTransmittance: bridge.linearTransmittance,
      length: bridge.length,
    })),
    targets: request.targets.map((target) => ({
      key: target.key,
      unit: target.unit,
      value: target.value,
      comparison: target.comparison,
    })),
  });
