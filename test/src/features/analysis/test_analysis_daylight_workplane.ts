import {
  IAutoMovieAnalysisWorkplane,
  IAutoMovieDaylightRequest,
  analyzeAutoMovieDaylight,
} from "@automovie/engine";
import {
  IAutoMovieAnalysisMetric,
  IAutoMovieAnalysisRun,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { analysisContext, boxSolid } from "../internal/analysisFixtures";
import { namedFacts, nclose, throwsError } from "../internal/predicates";

/**
 * A workplane is measured against the sun, the sky and the fittings the
 * production declares, and every number is the governing equation rather than
 * whatever the code emitted.
 *
 * The oracles are exact where the model is exact. A horizontal plane under a
 * sun straight overhead receives the whole declared beam, `1000 * cos(0)`. The
 * cosine-weighted sky estimator sees every one of its directions on an
 * unobstructed upward plane, so it returns the declared horizontal illuminance
 * itself for any sample count, and a downward plane sees none of the sky at
 * all. A fitting three metres above a point at 900 cd delivers `900 / 3^2`
 * lux.
 *
 * What the solver cannot do it refuses to fake. A sky model it does not
 * implement is an `unsupported` run rather than a substituted one; a study with
 * no emitter is `not-run`; ground-reflected light is a permanently
 * `unsupported` metric rather than a term quietly folded into the sky; and a
 * contrast ratio over a plane with a dark point is a gap, because `max / 0` is
 * not a large number.
 *
 * Scenarios:
 *
 * 1. Noon on an unobstructed horizontal plane is exactly beam plus sky, with a
 *    daylight factor of 100% and unit uniformity and contrast.
 * 2. A different sun changes the beam by exactly its own cosine, and a dark
 *    instant leaves the plane at zero with the uniformity, contrast and
 *    daylight-factor gaps that a zero plane implies.
 * 3. A canopy over the plane removes the beam and the whole sky vault; a
 *    downward-facing plane loses the vault to the ground instead.
 * 4. A vertical plane sees the analytic half of the isotropic vault.
 * 5. An artificial-only study reports the inverse square law exactly, names its
 *    domain `artificial-light`, and gaps every daylight metric as `not-run`.
 * 6. A fitting behind the plane, a fitting on the plane, and a fitting a shade
 *    stands in front of each contribute nothing, the second with a warning.
 * 7. One shaded cell of two makes uniformity zero and contrast a gap, and the
 *    field records one sample per cell.
 * 8. An unimplemented sky model is `unsupported`; a study with no sun and no
 *    fitting is `not-run`.
 * 9. Declared targets judge in the unit they are declared in; a target in another
 *    unit is dropped with a warning rather than compared across units, and a
 *    target naming a metric the study never reports is warned about too.
 * 10. Identical requests digest identically and any change to the study digests
 *     differently.
 * 11. Every malformed request is refused at its own message.
 */
export const test_analysis_daylight_workplane = (): void => {
  const context = analysisContext();
  const upward: IAutoMovieAnalysisWorkplane = {
    origin: { x: -1, y: 0, z: 1 },
    axisU: { x: 1, y: 0, z: 0 },
    axisV: { x: 0, y: 0, z: -1 },
    sizeU: 2,
    sizeV: 2,
    countU: 1,
    countV: 1,
  };
  const request = (
    overrides: Partial<IAutoMovieDaylightRequest> = {},
  ): IAutoMovieDaylightRequest => ({
    id: "hall-daylight",
    subject: "space:hall",
    inputRevision: "r7",
    context,
    instant: "noon",
    workplane: upward,
    shades: [],
    luminaires: [],
    sky: "isotropic",
    diffuseSamples: 64,
    targets: [],
    ...overrides,
  });
  const study = (
    overrides: Partial<IAutoMovieDaylightRequest> = {},
  ): IAutoMovieAnalysisRun =>
    analyzeAutoMovieDaylight({ request: request(overrides) });
  const metrics = (run: IAutoMovieAnalysisRun): IAutoMovieAnalysisMetric[] =>
    run.outcome.status === "solved" ? run.outcome.metrics : [];
  const of = (run: IAutoMovieAnalysisRun, key: string): number | null =>
    metrics(run).find((metric) => metric.key === key)?.value ?? null;
  const statusOf = (run: IAutoMovieAnalysisRun, key: string): string =>
    metrics(run).find((metric) => metric.key === key)?.status ?? "absent";

  const noon = study();
  TestValidator.equals(
    "noon on an unobstructed horizontal plane is the whole beam plus the whole vault",
    {
      domain: noon.domain,
      status: noon.outcome.status,
      direct: of(noon, "workplane.direct.illuminance"),
      sky: of(noon, "workplane.skyDiffuse.illuminance"),
      daylight: of(noon, "workplane.daylight.illuminance"),
      artificial: of(noon, "workplane.artificial.illuminance"),
      total: of(noon, "workplane.total.illuminance"),
      min: of(noon, "workplane.total.illuminance.min"),
      max: of(noon, "workplane.total.illuminance.max"),
      uniformity: of(noon, "workplane.total.uniformity"),
      contrast: of(noon, "workplane.total.contrast"),
      daylightFactor: of(noon, "workplane.daylightFactor"),
      groundReflected: of(noon, "workplane.groundReflected.illuminance"),
      groundStatus: statusOf(noon, "workplane.groundReflected.illuminance"),
      samples:
        noon.outcome.status === "solved"
          ? noon.outcome.samples.map((sample) => [
              sample.id,
              sample.key,
              sample.position,
              sample.value,
            ])
          : [],
    },
    {
      domain: "daylight",
      status: "solved",
      direct: 1000,
      sky: 200,
      daylight: 1200,
      artificial: 0,
      total: 1200,
      min: 1200,
      max: 1200,
      uniformity: 1,
      contrast: 1,
      daylightFactor: 100,
      groundReflected: null,
      groundStatus: "unsupported",
      samples: [
        ["0-0", "workplane.total.illuminance", { x: 0, y: 0, z: 0 }, 1200],
      ],
    },
  );

  const afternoon = study({ instant: "afternoon" });
  const night = study({ instant: "night" });
  TestValidator.predicate(
    "a sun at 45 degrees delivers exactly its own cosine of the declared beam",
    nclose(
      of(afternoon, "workplane.direct.illuminance") ?? Number.NaN,
      800 * (1 / Math.sqrt(2)),
      1e-9,
    ),
  );
  TestValidator.equals(
    "a dark instant leaves the plane at zero, with every ratio it makes undefined",
    {
      direct: of(night, "workplane.direct.illuminance"),
      sky: of(night, "workplane.skyDiffuse.illuminance"),
      total: of(night, "workplane.total.illuminance"),
      uniformity: statusOf(night, "workplane.total.uniformity"),
      contrast: statusOf(night, "workplane.total.contrast"),
      daylightFactor: statusOf(night, "workplane.daylightFactor"),
      reasons: metrics(night)
        .filter((metric) => metric.gap !== null && metric.status === "not-run")
        .map((metric) => metric.key),
    },
    {
      direct: 0,
      sky: 0,
      total: 0,
      uniformity: "not-run",
      contrast: "not-run",
      daylightFactor: "not-run",
      reasons: [
        "workplane.total.uniformity",
        "workplane.total.contrast",
        "workplane.daylightFactor",
      ],
    },
  );

  const canopy = boxSolid(
    "canopy",
    { x: -1000, y: 2, z: -1000 },
    { x: 1000, y: 4, z: 1000 },
  );
  const shaded = study({ shades: [canopy] });
  const downward = study({
    workplane: { ...upward, axisV: { x: 0, y: 0, z: 1 } },
  });
  TestValidator.equals(
    "a canopy removes the vault, and a downward plane never had one",
    {
      shadedDirect: of(shaded, "workplane.direct.illuminance"),
      shadedSky: of(shaded, "workplane.skyDiffuse.illuminance"),
      shadedTotal: of(shaded, "workplane.total.illuminance"),
      downwardDirect: of(downward, "workplane.direct.illuminance"),
      downwardSky: of(downward, "workplane.skyDiffuse.illuminance"),
    },
    {
      shadedDirect: 0,
      shadedSky: 0,
      shadedTotal: 0,
      downwardDirect: 0,
      downwardSky: 0,
    },
  );

  const neighbourly = study({
    context: analysisContext({
      occluders: [
        {
          ...boxSolid(
            "neighbour",
            { x: -1000, y: 2, z: -1000 },
            { x: 1000, y: 4, z: 1000 },
          ),
          kind: "neighbour-tower",
        },
      ],
    }),
  });
  TestValidator.equals(
    "a read-only neighbouring mass shades the plane exactly as a building shade does",
    {
      direct: of(neighbourly, "workplane.direct.illuminance"),
      sky: of(neighbourly, "workplane.skyDiffuse.illuminance"),
      distinct: neighbourly.digest !== shaded.digest,
    },
    { direct: 0, sky: 0, distinct: true },
  );

  // A vertical plane sees the sky above the horizon and the ground below it, so
  // the isotropic vault contributes DHI * (1 + cos 90) / 2 = DHI / 2. The
  // estimator samples that half rather than integrating it, so the assertion is
  // the analytic value with a stated sampling bound rather than an equality.
  const vertical = study({
    workplane: {
      origin: { x: -1, y: -1, z: 0 },
      axisU: { x: 0, y: 1, z: 0 },
      axisV: { x: 1, y: 0, z: 0 },
      sizeU: 2,
      sizeV: 2,
      countU: 1,
      countV: 1,
    },
    diffuseSamples: 256,
  });
  TestValidator.predicate(
    "a vertical plane sees the analytic half of the isotropic vault",
    nclose(
      of(vertical, "workplane.skyDiffuse.illuminance") ?? Number.NaN,
      100,
      10,
    ),
  );
  TestValidator.equals(
    "a vertical plane receives no beam from a sun directly overhead",
    of(vertical, "workplane.direct.illuminance"),
    0,
  );

  const lamp = study({
    instant: null,
    luminaires: [
      { id: "downlight", position: { x: 0, y: 3, z: 0 }, intensity: 900 },
    ],
  });
  TestValidator.equals(
    "an artificial-only study is the inverse square law and nothing else",
    {
      domain: lamp.domain,
      artificial: of(lamp, "workplane.artificial.illuminance"),
      total: of(lamp, "workplane.total.illuminance"),
      uniformity: of(lamp, "workplane.total.uniformity"),
      contrast: of(lamp, "workplane.total.contrast"),
      daylight: metrics(lamp)
        .filter(
          (metric) =>
            metric.key.startsWith("workplane.direct") ||
            metric.key.startsWith("workplane.skyDiffuse") ||
            metric.key.startsWith("workplane.daylight"),
        )
        .map((metric) => [metric.key, metric.status]),
    },
    {
      domain: "artificial-light",
      artificial: 100,
      total: 100,
      uniformity: 1,
      contrast: 1,
      daylight: [
        ["workplane.direct.illuminance", "not-run"],
        ["workplane.skyDiffuse.illuminance", "not-run"],
        ["workplane.daylight.illuminance", "not-run"],
        ["workplane.daylightFactor", "not-run"],
      ],
    },
  );

  const behind = study({
    instant: null,
    luminaires: [
      { id: "uplight", position: { x: 0, y: -3, z: 0 }, intensity: 900 },
    ],
  });
  const onPlane = study({
    instant: null,
    luminaires: [
      { id: "flush", position: { x: 0, y: 0, z: 0 }, intensity: 900 },
    ],
  });
  TestValidator.equals(
    "a fitting behind the plane or lying on it contributes nothing",
    {
      behind: of(behind, "workplane.artificial.illuminance"),
      behindWarnings:
        behind.outcome.status === "solved" ? behind.outcome.warnings : [],
      flush: of(onPlane, "workplane.artificial.illuminance"),
      flushWarnings:
        onPlane.outcome.status === "solved"
          ? onPlane.outcome.warnings.map((warning) => [
              warning.code,
              warning.subject,
            ])
          : [],
    },
    {
      behind: 0,
      behindWarnings: [],
      flush: 0,
      flushWarnings: [["luminaire-on-workplane", "flush"]],
    },
  );

  // Two cells at (-0.5, 0, 0) and (0.5, 0, 0). The fitting stands over the
  // first; a block from x = 0 to x = 2 between y = 1 and y = 2 stands across the
  // sight line to the second and clears the first entirely.
  const split = study({
    instant: null,
    workplane: { ...upward, countU: 2 },
    luminaires: [
      { id: "downlight", position: { x: -0.5, y: 3, z: 0 }, intensity: 900 },
    ],
    shades: [boxSolid("beam", { x: 0, y: 1, z: -1 }, { x: 2, y: 2, z: 1 })],
  });
  TestValidator.equals(
    "one shaded cell of two makes uniformity zero and contrast undefined",
    {
      samples:
        split.outcome.status === "solved"
          ? split.outcome.samples.map((sample) => [
              sample.id,
              sample.position.x,
              sample.value,
            ])
          : [],
      mean: of(split, "workplane.total.illuminance"),
      min: of(split, "workplane.total.illuminance.min"),
      max: of(split, "workplane.total.illuminance.max"),
      uniformity: of(split, "workplane.total.uniformity"),
      contrast: statusOf(split, "workplane.total.contrast"),
    },
    {
      samples: [
        ["0-0", -0.5, 100],
        ["1-0", 0.5, 0],
      ],
      mean: 50,
      min: 0,
      max: 100,
      uniformity: 0,
      contrast: "not-run",
    },
  );

  const perez = study({ sky: "perez-all-weather" });
  const dark = study({ instant: null });
  TestValidator.equals(
    "an unimplemented sky is unsupported and an unlit study is not-run",
    {
      perez:
        perez.outcome.status === "unsupported"
          ? [
              perez.outcome.status,
              perez.outcome.reason.includes("perez-all-weather"),
              perez.outcome.remedy.includes("isotropic"),
            ]
          : [perez.outcome.status],
      dark:
        dark.outcome.status === "not-run"
          ? [
              dark.outcome.status,
              dark.outcome.reason.includes("nothing emits light"),
              dark.outcome.remedy.includes("declare at least one luminaire"),
            ]
          : [dark.outcome.status],
    },
    {
      perez: ["unsupported", true, true],
      dark: ["not-run", true, true],
    },
  );

  const judged = study({
    targets: [
      {
        key: "workplane.total.illuminance",
        unit: "lx",
        value: 300,
        comparison: "at-least",
      },
      {
        key: "workplane.total.uniformity",
        unit: "ratio",
        value: 0.6,
        comparison: "at-least",
      },
    ],
  });
  const missed = study({
    targets: [
      {
        key: "workplane.total.illuminance",
        unit: "lx",
        value: 5000,
        comparison: "at-least",
      },
    ],
  });
  const mismatched = study({
    targets: [
      {
        key: "workplane.total.illuminance",
        unit: "cd",
        value: 300,
        comparison: "at-least",
      },
    ],
  });
  const hopeful = study({
    targets: [
      {
        key: "workplane.glareIndex",
        unit: "ratio",
        value: 19,
        comparison: "at-most",
      },
    ],
  });
  TestValidator.equals(
    "targets judge in their own unit, and an inapplicable one is stated rather than dropped",
    {
      met: statusOf(judged, "workplane.total.illuminance"),
      uniformity: statusOf(judged, "workplane.total.uniformity"),
      missed: statusOf(missed, "workplane.total.illuminance"),
      mismatched: statusOf(mismatched, "workplane.total.illuminance"),
      warning:
        mismatched.outcome.status === "solved"
          ? mismatched.outcome.warnings.map((warning) => warning.code)
          : [],
      // A study that judges nothing at all still says so: the whole point is
      // that a report cannot read `meets` over a rule nobody could apply.
      unknownKey:
        hopeful.outcome.status === "solved"
          ? hopeful.outcome.warnings.map((warning) => [
              warning.code,
              warning.subject,
            ])
          : [],
      // The negative twin: every target of the judged study names a metric it
      // reports, so nothing is warned about there.
      judgedWarnings:
        judged.outcome.status === "solved" ? judged.outcome.warnings : [],
    },
    {
      met: "meets",
      uniformity: "meets",
      missed: "misses",
      mismatched: "untargeted",
      warning: ["target-unit-mismatch"],
      unknownKey: [["target-key-unknown", "workplane.glareIndex"]],
      judgedWarnings: [],
    },
  );

  TestValidator.equals(
    "identical studies digest identically and any change digests differently",
    {
      stable: study().digest === noon.digest,
      shaded: shaded.digest !== noon.digest,
      instant: afternoon.digest !== noon.digest,
      samples: study({ diffuseSamples: 128 }).digest !== noon.digest,
      settingsStable: study().settings === noon.settings,
    },
    {
      stable: true,
      shaded: true,
      instant: true,
      samples: true,
      settingsStable: true,
    },
  );

  TestValidator.equals(
    "every malformed study is refused at its own message",
    namedFacts([
      ["blank id", () => throwsError(() => study({ id: " " }), "non-blank id")],
      [
        "blank sky model",
        () => throwsError(() => study({ sky: "" }), "non-blank sky model"),
      ],
      [
        "invalid context",
        () =>
          throwsError(
            () =>
              study({
                context: analysisContext({ version: 2 as unknown as 1 }),
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
        "non-positive extent",
        () =>
          throwsError(
            () => study({ workplane: { ...upward, sizeU: 0 } }),
            "workplane sizeU must be a finite number above zero",
          ),
      ],
      [
        "fractional cell count",
        () =>
          throwsError(
            () => study({ workplane: { ...upward, countV: 1.5 } }),
            "workplane countV must be a whole number",
          ),
      ],
      [
        "a grid past the sample bound",
        () =>
          throwsError(
            () => study({ workplane: { ...upward, countU: 65, countV: 64 } }),
            "exceeds the 4096-sample bound",
          ),
      ],
      [
        "non-finite origin",
        () =>
          throwsError(
            () =>
              study({
                workplane: {
                  ...upward,
                  origin: { x: Number.NaN, y: 0, z: 0 },
                },
              }),
            "workplane origin x must be finite",
          ),
      ],
      [
        "zero axis",
        () =>
          throwsError(
            () =>
              study({
                workplane: { ...upward, axisU: { x: 0, y: 0, z: 0 } },
              }),
            "workplane axisU must be a finite non-zero in-plane direction",
          ),
      ],
      [
        "non-finite axis",
        () =>
          throwsError(
            () =>
              study({
                workplane: {
                  ...upward,
                  axisV: { x: Number.NaN, y: 0, z: -1 },
                },
              }),
            "workplane axisV must be a finite non-zero in-plane direction",
          ),
      ],
      [
        "parallel axes",
        () =>
          throwsError(
            () =>
              study({
                workplane: { ...upward, axisV: { x: 2, y: 0, z: 0 } },
              }),
            "two non-parallel in-plane axes",
          ),
      ],
      [
        "zero sky samples",
        () =>
          throwsError(
            () => study({ diffuseSamples: 0 }),
            "positive whole sky sample count",
          ),
      ],
      [
        "blank luminaire id",
        () =>
          throwsError(
            () =>
              study({
                luminaires: [
                  { id: " ", position: { x: 0, y: 1, z: 0 }, intensity: 1 },
                ],
              }),
            "luminaire must carry a non-blank id",
          ),
      ],
      [
        "duplicated luminaire",
        () =>
          throwsError(
            () =>
              study({
                luminaires: [
                  { id: "a", position: { x: 0, y: 1, z: 0 }, intensity: 1 },
                  { id: "a", position: { x: 0, y: 2, z: 0 }, intensity: 1 },
                ],
              }),
            'luminaire id "a" is declared twice',
          ),
      ],
      [
        "negative intensity",
        () =>
          throwsError(
            () =>
              study({
                luminaires: [
                  { id: "a", position: { x: 0, y: 1, z: 0 }, intensity: -1 },
                ],
              }),
            "intensity must be a finite number at or above zero",
          ),
      ],
      [
        "non-finite luminaire position",
        () =>
          throwsError(
            () =>
              study({
                luminaires: [
                  {
                    id: "a",
                    position: { x: 0, y: Number.NaN, z: 0 },
                    intensity: 1,
                  },
                ],
              }),
            "position y must be finite",
          ),
      ],
      [
        "malformed shade",
        () =>
          throwsError(
            () =>
              study({
                shades: [
                  {
                    id: "flat",
                    planes: [{ normal: { x: 0, y: 1, z: 0 }, offset: 1 }],
                  },
                ],
              }),
            "at least 4 half-spaces",
          ),
      ],
      [
        "duplicated target",
        () =>
          throwsError(
            () =>
              study({
                targets: [
                  {
                    key: "workplane.total.illuminance",
                    unit: "lx",
                    value: 1,
                    comparison: "at-least",
                  },
                  {
                    key: "workplane.total.illuminance",
                    unit: "lx",
                    value: 2,
                    comparison: "at-least",
                  },
                ],
              }),
            "declared more than once",
          ),
      ],
    ]),
    {
      "blank id": true,
      "blank sky model": true,
      "invalid context": true,
      "unknown instant": true,
      "non-positive extent": true,
      "fractional cell count": true,
      "a grid past the sample bound": true,
      "non-finite origin": true,
      "zero axis": true,
      "non-finite axis": true,
      "parallel axes": true,
      "zero sky samples": true,
      "blank luminaire id": true,
      "duplicated luminaire": true,
      "negative intensity": true,
      "non-finite luminaire position": true,
      "malformed shade": true,
      "duplicated target": true,
    },
  );
};
