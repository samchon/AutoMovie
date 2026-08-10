import {
  AUTOMOVIE_ANALYSIS_MAX_SAMPLES,
  IAutoMovieEnvelopeAssembly,
  IAutoMovieEnvelopeRequest,
  IAutoMovieSpaceAirRequest,
  analyzeAutoMovieEnvelope,
  analyzeAutoMovieSpaceAir,
  autoMovieDewPoint,
} from "@automovie/engine";
import {
  IAutoMovieAnalysisMetric,
  IAutoMovieAnalysisRun,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { analysisContext } from "../internal/analysisFixtures";
import { namedFacts, nclose, throwsError } from "../internal/predicates";

/**
 * An envelope is solved for heat and for surface condensation as two separate
 * domains, and a space is solved for ventilation without pretending it solved
 * the air.
 *
 * Every expected number is the one-dimensional steady-state network by hand.
 * The wall is `0.1 + 0.2/0.25 + 0.1 = 1.0` m2K/W, so `U = 1` W/m2K exactly, its
 * temperature factor is `1 - 1 * 0.1 = 0.9`, and its interior face sits at `20
 *
 * - 1 * 0.1 * 20 = 18`degC. The glazing is`0.1 + 0.006/0.01 + 0.1 = 0.8`, so `U =
 *   1.25`and its face sits at`17.5`. Fabric loss is `10 * 1 + 2 * 1.25 = 12.5`
 *   W/K, one 4 m lintel at 0.5 W/mK adds 2 more, and 20 K of difference makes
 *   290 W of which 40 is the bridge. The dew point is the Magnus form, which
 *   puts 20 degC air at 50% humidity at 9.255 degC, the published value for
 *   that air.
 *
 * The refusals matter as much. Without an exterior air temperature there is no
 * answer, and both runs come back `not-run` naming the missing boundary
 * condition rather than assuming a temperature. Vapour diffusion through the
 * build-up, solar gain through glazing, air speed and stagnation are all
 * `unsupported`: they are real questions this host does not answer, and a
 * number here would be indistinguishable from one that was computed.
 *
 * Scenarios:
 *
 * 1. The declared envelope produces the hand-computed transmittance, heat loss,
 *    bridge share, temperature factor and surface temperatures, one field
 *    sample per assembly.
 * 2. Solar gain is `unsupported` inside a solved thermal run, and interstitial
 *    condensation is `unsupported` inside a solved moisture run.
 * 3. The dew point is the Magnus value, the condensation margins follow it, and
 *    raising the indoor humidity puts exactly the coldest surface at risk.
 * 4. Indoor air at the outdoor temperature has no heat flow to apportion and warns
 *    that the interior face is the warm side.
 * 5. Air at zero relative humidity has no dew point, so every moisture metric gaps
 *    and the field is empty.
 * 6. A study with no instant, and a study whose instant declares no outdoor
 *    temperature, are both `not-run` naming the missing boundary condition.
 * 7. Ventilation reports air changes, outdoor air per person and the steady-state
 *    contaminant balance exactly, and reports air speed and stagnation as
 *    `unsupported`.
 * 8. A space with no supply flow, no occupants, or a supply flow of zero gaps the
 *    metric that needs it instead of dividing by it.
 * 9. Every malformed envelope and ventilation request is refused at its own
 *    message.
 * 10. The exported dew point refuses air that has no dew point.
 */
export const test_analysis_envelope_hygrothermal = (): void => {
  const context = analysisContext();
  const wall: IAutoMovieEnvelopeAssembly = {
    id: "wall",
    boundary: "boundary:north",
    layers: [{ id: "core", thickness: 0.2, conductivity: 0.25 }],
    interiorFilm: 0.1,
    exteriorFilm: 0.1,
    area: 10,
    position: { x: 0, y: 1.5, z: 0 },
  };
  const glazing: IAutoMovieEnvelopeAssembly = {
    id: "glazing",
    boundary: "boundary:north",
    layers: [{ id: "pane", thickness: 0.006, conductivity: 0.01 }],
    interiorFilm: 0.1,
    exteriorFilm: 0.1,
    area: 2,
    position: { x: 2, y: 1.5, z: 0 },
  };
  const request = (
    overrides: Partial<IAutoMovieEnvelopeRequest> = {},
  ): IAutoMovieEnvelopeRequest => ({
    id: "hall-envelope",
    subject: "space:hall",
    inputRevision: "r7",
    context,
    instant: "noon",
    indoor: { airTemperature: 20, relativeHumidity: 0.5 },
    assemblies: [wall, glazing],
    bridges: [
      {
        id: "lintel",
        assembly: "glazing",
        linearTransmittance: 0.5,
        length: 4,
      },
    ],
    targets: [],
    ...overrides,
  });
  const study = (
    overrides: Partial<IAutoMovieEnvelopeRequest> = {},
  ): { thermal: IAutoMovieAnalysisRun; moisture: IAutoMovieAnalysisRun } =>
    analyzeAutoMovieEnvelope({ request: request(overrides) });
  const metrics = (run: IAutoMovieAnalysisRun): IAutoMovieAnalysisMetric[] =>
    run.outcome.status === "solved" ? run.outcome.metrics : [];
  const of = (run: IAutoMovieAnalysisRun, key: string): number | null =>
    metrics(run).find((metric) => metric.key === key)?.value ?? null;
  const statusOf = (run: IAutoMovieAnalysisRun, key: string): string =>
    metrics(run).find((metric) => metric.key === key)?.status ?? "absent";

  const base = study();
  TestValidator.equals(
    "the envelope reports the steady-state network exactly",
    {
      ids: [base.thermal.id, base.moisture.id],
      domains: [base.thermal.domain, base.moisture.domain],
      settings: base.thermal.settings === base.moisture.settings,
      areaWeighted: of(
        base.thermal,
        "envelope.thermalTransmittance.areaWeighted",
      ),
      worst: of(base.thermal, "envelope.thermalTransmittance.max"),
      heatLoss: of(base.thermal, "envelope.heatLoss"),
      bridgeShare: of(base.thermal, "envelope.thermalBridgeShare"),
      temperatureFactor: of(base.thermal, "envelope.temperatureFactor.min"),
      surfaceMean: of(base.thermal, "envelope.surfaceTemperature"),
      surfaceMin: of(base.thermal, "envelope.surfaceTemperature.min"),
      solarGain: statusOf(base.thermal, "envelope.solarHeatGain"),
      interstitial: statusOf(
        base.moisture,
        "envelope.interstitialCondensation",
      ),
      warnings:
        base.thermal.outcome.status === "solved"
          ? base.thermal.outcome.warnings
          : [],
      field:
        base.thermal.outcome.status === "solved"
          ? base.thermal.outcome.samples.map((sample) => [
              sample.id,
              sample.key,
              sample.value,
            ])
          : [],
    },
    {
      ids: ["hall-envelope.thermal", "hall-envelope.moisture"],
      domains: ["thermal", "moisture"],
      settings: true,
      areaWeighted: 12.5 / 12,
      worst: 1.25,
      heatLoss: 290,
      bridgeShare: 40 / 290,
      temperatureFactor: 0.875,
      surfaceMean: 215 / 12,
      surfaceMin: 17.5,
      solarGain: "unsupported",
      interstitial: "unsupported",
      warnings: [],
      field: [
        ["wall", "envelope.surfaceTemperature", 18],
        ["glazing", "envelope.surfaceTemperature", 17.5],
      ],
    },
  );

  const dry = study({ indoor: { airTemperature: 20, relativeHumidity: 0.88 } });
  TestValidator.predicate(
    "the dew point is the Magnus value for the declared indoor air",
    nclose(of(base.moisture, "space.dewPoint") ?? Number.NaN, 9.2552, 1e-3) &&
      nclose(of(dry.moisture, "space.dewPoint") ?? Number.NaN, 17.9501, 1e-3),
  );
  TestValidator.predicate(
    "condensation margins follow the dew point on every assembly",
    nclose(
      of(base.moisture, "envelope.condensationMargin") ?? Number.NaN,
      8.66149,
      1e-4,
    ) &&
      nclose(
        of(base.moisture, "envelope.condensationMargin.min") ?? Number.NaN,
        17.5 - 9.255174598981256,
        1e-9,
      ),
  );
  TestValidator.equals(
    "raising the indoor humidity puts exactly the coldest surface at risk",
    {
      safe: of(base.moisture, "envelope.condensationRisk"),
      atRisk: of(dry.moisture, "envelope.condensationRisk"),
      wetSurface:
        dry.moisture.outcome.status === "solved"
          ? dry.moisture.outcome.samples
              .filter((sample) => sample.value <= 0)
              .map((sample) => sample.id)
          : [],
    },
    { safe: 0, atRisk: 1, wetSurface: ["glazing"] },
  );

  const isothermal = study({
    instant: "afternoon",
    indoor: { airTemperature: 5, relativeHumidity: 0.5 },
  });
  TestValidator.equals(
    "indoor air at the outdoor temperature has no heat flow to apportion",
    {
      heatLoss: of(isothermal.thermal, "envelope.heatLoss"),
      share: statusOf(isothermal.thermal, "envelope.thermalBridgeShare"),
      warnings:
        isothermal.thermal.outcome.status === "solved"
          ? isothermal.thermal.outcome.warnings.map((warning) => warning.code)
          : [],
      surface: of(isothermal.thermal, "envelope.surfaceTemperature"),
    },
    {
      heatLoss: 0,
      share: "not-run",
      warnings: ["reverse-heat-flow"],
      surface: 5,
    },
  );

  const bone = study({ indoor: { airTemperature: 20, relativeHumidity: 0 } });
  TestValidator.equals(
    "air with no humidity has no dew point, so every moisture metric gaps",
    {
      statuses: metrics(bone.moisture).map((metric) => [
        metric.key,
        metric.status,
      ]),
      samples:
        bone.moisture.outcome.status === "solved"
          ? bone.moisture.outcome.samples
          : null,
      thermalStillSolved: bone.thermal.outcome.status,
    },
    {
      statuses: [
        ["space.dewPoint", "not-run"],
        ["envelope.condensationMargin", "not-run"],
        ["envelope.condensationMargin.min", "not-run"],
        ["envelope.condensationRisk", "not-run"],
        ["envelope.interstitialCondensation", "unsupported"],
      ],
      samples: [],
      thermalStillSolved: "solved",
    },
  );

  const unbounded = study({ instant: null });
  const dark = study({ instant: "night" });
  TestValidator.equals(
    "a missing exterior boundary condition is not-run, never assumed",
    {
      noInstant: [
        unbounded.thermal.outcome.status,
        unbounded.moisture.outcome.status,
        unbounded.thermal.outcome.status === "not-run"
          ? unbounded.thermal.outcome.reason.includes(
              "no environmental instant",
            )
          : false,
      ],
      noTemperature: [
        dark.thermal.outcome.status,
        dark.moisture.outcome.status,
        dark.thermal.outcome.status === "not-run"
          ? dark.thermal.outcome.reason.includes(
              'instant "night" declares no outdoor air temperature',
            )
          : false,
      ],
    },
    {
      noInstant: ["not-run", "not-run", true],
      noTemperature: ["not-run", "not-run", true],
    },
  );

  const airRequest = (
    overrides: Partial<IAutoMovieSpaceAirRequest> = {},
  ): IAutoMovieSpaceAirRequest => ({
    id: "hall-air",
    subject: "space:hall",
    inputRevision: "r7",
    volume: 100,
    supplyFlow: 0.05,
    occupants: 4,
    occupantCarbonDioxide: 5e-6,
    outdoorCarbonDioxide: 400,
    targets: [],
    ...overrides,
  });
  const air = (
    overrides: Partial<IAutoMovieSpaceAirRequest> = {},
  ): IAutoMovieAnalysisRun =>
    analyzeAutoMovieSpaceAir({ request: airRequest(overrides) });
  const ventilated = air();
  TestValidator.equals(
    "ventilation answers the zone balance and refuses to answer the flow field",
    {
      domain: ventilated.domain,
      changes: of(ventilated, "space.airChangeRate"),
      perPerson: of(ventilated, "space.freshAirPerOccupant"),
      steadyState: of(ventilated, "space.carbonDioxide.steadyState"),
      velocity: statusOf(ventilated, "space.airVelocity.mean"),
      stagnation: statusOf(ventilated, "space.stagnationVolumeFraction"),
      samples:
        ventilated.outcome.status === "solved"
          ? ventilated.outcome.samples
          : null,
      stagnationReason:
        ventilated.outcome.status === "solved"
          ? (
              ventilated.outcome.metrics.find(
                (metric) => metric.key === "space.stagnationVolumeFraction",
              )?.gap?.reason ?? ""
            ).includes("computes none")
          : false,
    },
    {
      domain: "air",
      changes: 1.8,
      perPerson: 12.5,
      steadyState: 800,
      velocity: "unsupported",
      stagnation: "unsupported",
      samples: [],
      stagnationReason: true,
    },
  );
  TestValidator.equals(
    "a space that declares no flow or nobody in it gaps rather than divides",
    {
      noFlow: [
        statusOf(air({ supplyFlow: null }), "space.airChangeRate"),
        statusOf(air({ supplyFlow: null }), "space.freshAirPerOccupant"),
        statusOf(air({ supplyFlow: null }), "space.carbonDioxide.steadyState"),
      ],
      noOccupants: [
        of(air({ occupants: 0 }), "space.airChangeRate"),
        statusOf(air({ occupants: 0 }), "space.freshAirPerOccupant"),
        of(air({ occupants: 0 }), "space.carbonDioxide.steadyState"),
      ],
      sealed: [
        of(air({ supplyFlow: 0 }), "space.airChangeRate"),
        statusOf(air({ supplyFlow: 0 }), "space.carbonDioxide.steadyState"),
      ],
    },
    {
      noFlow: ["not-run", "not-run", "not-run"],
      noOccupants: [1.8, "not-run", 400],
      sealed: [0, "not-run"],
    },
  );

  TestValidator.equals(
    "declared targets judge the envelope and the ventilation in their own units",
    {
      envelope: statusOf(
        study({
          targets: [
            {
              key: "envelope.heatLoss",
              unit: "W",
              value: 500,
              comparison: "at-most",
            },
          ],
        }).thermal,
        "envelope.heatLoss",
      ),
      ventilation: statusOf(
        air({
          targets: [
            {
              key: "space.airChangeRate",
              unit: "1/h",
              value: 2,
              comparison: "at-least",
            },
          ],
        }),
        "space.airChangeRate",
      ),
    },
    { envelope: "meets", ventilation: "misses" },
  );

  TestValidator.equals(
    "every malformed study is refused at its own message",
    namedFacts([
      [
        "blank envelope id",
        () => throwsError(() => study({ id: "" }), "non-blank id"),
      ],
      [
        "invalid context",
        () =>
          throwsError(
            () =>
              study({
                context: analysisContext({
                  units: "foot" as unknown as "meter",
                }),
              }),
            "invalid environment context",
          ),
      ],
      [
        "unknown instant",
        () =>
          throwsError(
            () => study({ instant: "dawn" }),
            "which the environment context does not declare",
          ),
      ],
      [
        "non-finite indoor temperature",
        () =>
          throwsError(
            () =>
              study({
                indoor: { airTemperature: Number.NaN, relativeHumidity: 0.5 },
              }),
            "indoor air temperature must be finite",
          ),
      ],
      [
        "out of range indoor humidity",
        () =>
          throwsError(
            () =>
              study({
                indoor: { airTemperature: 20, relativeHumidity: 1.2 },
              }),
            "indoor relative humidity must be a fraction",
          ),
      ],
      [
        "no assembly",
        () =>
          throwsError(
            () => study({ assemblies: [], bridges: [] }),
            "at least one assembly",
          ),
      ],
      [
        "too many assemblies",
        () =>
          throwsError(
            () =>
              study({
                assemblies: Array.from(
                  { length: AUTOMOVIE_ANALYSIS_MAX_SAMPLES + 1 },
                  (_, index) => ({ ...wall, id: `wall-${index}` }),
                ),
                bridges: [],
              }),
            "may not exceed 4096",
          ),
      ],
      [
        "blank assembly id",
        () =>
          throwsError(
            () => study({ assemblies: [{ ...wall, id: " " }], bridges: [] }),
            "assembly must carry a non-blank id",
          ),
      ],
      [
        "duplicated assembly",
        () =>
          throwsError(
            () => study({ assemblies: [wall, wall], bridges: [] }),
            'envelope assembly "wall" is declared twice',
          ),
      ],
      [
        "assembly without a boundary",
        () =>
          throwsError(
            () =>
              study({ assemblies: [{ ...wall, boundary: "" }], bridges: [] }),
            "must name the boundary it realizes",
          ),
      ],
      [
        "non-positive film resistance",
        () =>
          throwsError(
            () =>
              study({
                assemblies: [{ ...wall, interiorFilm: 0 }],
                bridges: [],
              }),
            "interiorFilm must be a finite number above zero",
          ),
      ],
      [
        "non-positive area",
        () =>
          throwsError(
            () => study({ assemblies: [{ ...wall, area: -1 }], bridges: [] }),
            "area must be a finite number above zero",
          ),
      ],
      [
        "non-finite assembly position",
        () =>
          throwsError(
            () =>
              study({
                assemblies: [
                  { ...wall, position: { x: 0, y: 0, z: Number.NaN } },
                ],
                bridges: [],
              }),
            "position z must be finite",
          ),
      ],
      [
        "no layer",
        () =>
          throwsError(
            () => study({ assemblies: [{ ...wall, layers: [] }], bridges: [] }),
            "must declare at least one layer",
          ),
      ],
      [
        "blank layer id",
        () =>
          throwsError(
            () =>
              study({
                assemblies: [
                  {
                    ...wall,
                    layers: [{ id: "", thickness: 0.1, conductivity: 1 }],
                  },
                ],
                bridges: [],
              }),
            "must carry a non-blank id",
          ),
      ],
      [
        "duplicated layer",
        () =>
          throwsError(
            () =>
              study({
                assemblies: [
                  {
                    ...wall,
                    layers: [
                      { id: "core", thickness: 0.1, conductivity: 1 },
                      { id: "core", thickness: 0.1, conductivity: 1 },
                    ],
                  },
                ],
                bridges: [],
              }),
            "is declared twice",
          ),
      ],
      [
        "non-positive conductivity",
        () =>
          throwsError(
            () =>
              study({
                assemblies: [
                  {
                    ...wall,
                    layers: [{ id: "core", thickness: 0.1, conductivity: 0 }],
                  },
                ],
                bridges: [],
              }),
            "conductivity must be a finite number above zero",
          ),
      ],
      [
        "blank bridge id",
        () =>
          throwsError(
            () =>
              study({
                bridges: [
                  {
                    id: "",
                    assembly: "wall",
                    linearTransmittance: 0.1,
                    length: 1,
                  },
                ],
              }),
            "thermal bridge must carry a non-blank id",
          ),
      ],
      [
        "duplicated bridge",
        () =>
          throwsError(
            () =>
              study({
                bridges: [
                  {
                    id: "b",
                    assembly: "wall",
                    linearTransmittance: 0.1,
                    length: 1,
                  },
                  {
                    id: "b",
                    assembly: "wall",
                    linearTransmittance: 0.1,
                    length: 1,
                  },
                ],
              }),
            'thermal bridge "b" is declared twice',
          ),
      ],
      [
        "bridge on nothing",
        () =>
          throwsError(
            () =>
              study({
                bridges: [
                  {
                    id: "b",
                    assembly: "roof",
                    linearTransmittance: 0.1,
                    length: 1,
                  },
                ],
              }),
            "which the study does not declare",
          ),
      ],
      [
        "negative bridge transmittance",
        () =>
          throwsError(
            () =>
              study({
                bridges: [
                  {
                    id: "b",
                    assembly: "wall",
                    linearTransmittance: -1,
                    length: 1,
                  },
                ],
              }),
            "linear transmittance must be a finite number at or above zero",
          ),
      ],
      [
        "non-positive bridge length",
        () =>
          throwsError(
            () =>
              study({
                bridges: [
                  {
                    id: "b",
                    assembly: "wall",
                    linearTransmittance: 0.1,
                    length: 0,
                  },
                ],
              }),
            "length must be a finite number above zero",
          ),
      ],
      [
        "duplicated envelope target",
        () =>
          throwsError(
            () =>
              study({
                targets: [
                  {
                    key: "envelope.heatLoss",
                    unit: "W",
                    value: 1,
                    comparison: "at-most",
                  },
                  {
                    key: "envelope.heatLoss",
                    unit: "W",
                    value: 2,
                    comparison: "at-most",
                  },
                ],
              }),
            "declared more than once",
          ),
      ],
      [
        "blank ventilation id",
        () => throwsError(() => air({ subject: " " }), "non-blank subject"),
      ],
      [
        "non-positive volume",
        () =>
          throwsError(
            () => air({ volume: 0 }),
            "space volume must be a finite number above zero",
          ),
      ],
      [
        "negative supply flow",
        () =>
          throwsError(
            () => air({ supplyFlow: -1 }),
            "supply flow must be null or a finite number",
          ),
      ],
      [
        "fractional occupancy",
        () =>
          throwsError(
            () => air({ occupants: 1.5 }),
            "occupancy must be a whole number",
          ),
      ],
      [
        "negative generation",
        () =>
          throwsError(
            () => air({ occupantCarbonDioxide: -1 }),
            "occupantCarbonDioxide must be a finite number at or above zero",
          ),
      ],
      [
        "negative outdoor concentration",
        () =>
          throwsError(
            () => air({ outdoorCarbonDioxide: Number.NaN }),
            "outdoorCarbonDioxide must be a finite number at or above zero",
          ),
      ],
      [
        "duplicated ventilation target",
        () =>
          throwsError(
            () =>
              air({
                targets: [
                  {
                    key: "space.airChangeRate",
                    unit: "1/h",
                    value: 1,
                    comparison: "at-least",
                  },
                  {
                    key: "space.airChangeRate",
                    unit: "1/h",
                    value: 2,
                    comparison: "at-least",
                  },
                ],
              }),
            "declared more than once",
          ),
      ],
      [
        "a dew point of air with none",
        () =>
          throwsError(
            () => autoMovieDewPoint(20, 0),
            "relative humidity within (0, 1]",
          ),
      ],
      [
        "a dew point of impossible air",
        () =>
          throwsError(
            () => autoMovieDewPoint(Number.NaN, 0.5),
            "finite air temperature",
          ),
      ],
      [
        "a dew point of saturated air",
        () => nclose(autoMovieDewPoint(20, 1), 20, 1e-9),
      ],
    ]),
    {
      "blank envelope id": true,
      "invalid context": true,
      "unknown instant": true,
      "non-finite indoor temperature": true,
      "out of range indoor humidity": true,
      "no assembly": true,
      "too many assemblies": true,
      "blank assembly id": true,
      "duplicated assembly": true,
      "assembly without a boundary": true,
      "non-positive film resistance": true,
      "non-positive area": true,
      "non-finite assembly position": true,
      "no layer": true,
      "blank layer id": true,
      "duplicated layer": true,
      "non-positive conductivity": true,
      "blank bridge id": true,
      "duplicated bridge": true,
      "bridge on nothing": true,
      "negative bridge transmittance": true,
      "non-positive bridge length": true,
      "duplicated envelope target": true,
      "blank ventilation id": true,
      "non-positive volume": true,
      "negative supply flow": true,
      "fractional occupancy": true,
      "negative generation": true,
      "negative outdoor concentration": true,
      "duplicated ventilation target": true,
      "a dew point of air with none": true,
      "a dew point of impossible air": true,
      "a dew point of saturated air": true,
    },
  );
};
