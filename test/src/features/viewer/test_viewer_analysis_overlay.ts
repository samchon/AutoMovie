import {
  IAutoMovieDaylightRequest,
  analyzeAutoMovieAcoustics,
  analyzeAutoMovieDaylight,
  sealAutoMovieAnalysisRun,
} from "@automovie/engine";
import { IAutoMovieAnalysisRun } from "@automovie/interface";
import {
  autoMovieAnalysisRampColor,
  buildAnalysisOverlayObject,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { analysisContext, boxSolid } from "../internal/analysisFixtures";
import { namedFacts, throwsError } from "../internal/predicates";

/**
 * The viewer draws a field only from the artifact a report reads, and refuses
 * to draw anything else.
 *
 * A heatmap is the most persuasive thing a review looks at, so the overlay is
 * the place a missing analysis would most easily be laundered into a result.
 * Every refusal below exists for that: an `unsupported` or `not-run` run, a
 * metric the run never carried, a metric that produced no value, and a metric
 * with no spatial field each throw carrying the run's own reason, so the only
 * picture that can exist is one of a measurement that happened.
 *
 * The colour ramp is written out rather than sampled, so the same value paints
 * the same colour in a live viewer and in a headless capture. Its stops are
 * checked against the definition: blue at the bottom, green at the middle, red
 * at the top, linear between them, clamped outside.
 *
 * Scenarios:
 *
 * 1. A solved two-cell study becomes two points at the measured positions,
 *    coloured by the ends of the ramp, carrying the run identity and unit in
 *    `userData`.
 * 2. The ramp is its own definition at both ends, the middle, both quarters and
 *    outside the range in both directions.
 * 3. A pinned domain rescales the same field, and a field with no spread is drawn
 *    at the middle of the ramp instead of dividing by zero.
 * 4. A default material is disposed with the overlay; a caller's material is left
 *    alone.
 * 5. An unsupported run, a not-run run, an unknown metric, a gapped metric and a
 *    measured metric with no field are each refused with the reason attached.
 * 6. A non-positive point size and an inverted or non-finite ramp domain are
 *    refused.
 */
export const test_viewer_analysis_overlay = (): void => {
  const context = analysisContext();
  const request = (
    overrides: Partial<IAutoMovieDaylightRequest> = {},
  ): IAutoMovieDaylightRequest => ({
    id: "hall-daylight",
    subject: "space:hall",
    inputRevision: "r7",
    context,
    instant: null,
    workplane: {
      origin: { x: -1, y: 0, z: 1 },
      axisU: { x: 1, y: 0, z: 0 },
      axisV: { x: 0, y: 0, z: -1 },
      sizeU: 2,
      sizeV: 2,
      countU: 2,
      countV: 1,
    },
    shades: [boxSolid("beam", { x: 0, y: 1, z: -1 }, { x: 2, y: 2, z: 1 })],
    luminaires: [
      { id: "downlight", position: { x: -0.5, y: 3, z: 0 }, intensity: 900 },
    ],
    sky: "isotropic",
    diffuseSamples: 16,
    targets: [],
    ...overrides,
  });
  const run = analyzeAutoMovieDaylight({ request: request() });
  const overlay = buildAnalysisOverlayObject({
    run,
    metric: "workplane.total.illuminance",
  });
  const positions = overlay.object.geometry.getAttribute("position");
  const colors = overlay.object.geometry.getAttribute("color");
  TestValidator.equals(
    "a solved study becomes one coloured point per measured cell",
    {
      type: overlay.object.type,
      name: overlay.object.name,
      count: overlay.count(),
      range: overlay.range(),
      positions: Array.from(positions.array),
      colors: Array.from(colors.array),
      bounded: overlay.object.geometry.boundingSphere !== null,
      userData: overlay.object.userData.autoMovieAnalysis,
    },
    {
      type: "Points",
      name: "analysis:hall-daylight:workplane.total.illuminance",
      count: 2,
      range: { min: 0, max: 100 },
      positions: [-0.5, 0, 0, 0.5, 0, 0],
      colors: [1, 0, 0, 0, 0, 1],
      bounded: true,
      userData: {
        run: "hall-daylight",
        domain: "artificial-light",
        metric: "workplane.total.illuminance",
        unit: "lx",
        status: "untargeted",
        min: 0,
        max: 100,
        digest: run.digest,
      },
    },
  );
  overlay.dispose();

  TestValidator.equals(
    "the ramp is its own definition at every stop and clamped outside",
    {
      bottom: autoMovieAnalysisRampColor(0),
      quarter: autoMovieAnalysisRampColor(0.25),
      middle: autoMovieAnalysisRampColor(0.5),
      threeQuarter: autoMovieAnalysisRampColor(0.75),
      top: autoMovieAnalysisRampColor(1),
      under: autoMovieAnalysisRampColor(-2),
      over: autoMovieAnalysisRampColor(3),
    },
    {
      bottom: { r: 0, g: 0, b: 1 },
      quarter: { r: 0, g: 0.5, b: 0.5 },
      middle: { r: 0, g: 1, b: 0 },
      threeQuarter: { r: 0.5, g: 0.5, b: 0 },
      top: { r: 1, g: 0, b: 0 },
      under: { r: 0, g: 0, b: 1 },
      over: { r: 1, g: 0, b: 0 },
    },
  );

  const pinned = buildAnalysisOverlayObject({
    run,
    metric: "workplane.total.illuminance",
    domain: { min: 0, max: 200 },
    size: 0.25,
  });
  const flatRun = analyzeAutoMovieDaylight({
    request: request({ shades: [] }),
  });
  const flat = buildAnalysisOverlayObject({
    run: flatRun,
    metric: "workplane.total.illuminance",
    domain: { min: 5, max: 5 },
  });
  TestValidator.equals(
    "a pinned domain rescales the field and a flat one sits at the middle",
    {
      pinnedRange: pinned.range(),
      pinnedColors: Array.from(
        pinned.object.geometry.getAttribute("color").array,
      ),
      size: (pinned.object.material as THREE.PointsMaterial).size,
      flatColors: Array.from(flat.object.geometry.getAttribute("color").array),
    },
    {
      pinnedRange: { min: 0, max: 200 },
      // 100 of 200 is the middle of the ramp; 0 of 200 is its bottom.
      pinnedColors: [0, 1, 0, 0, 0, 1],
      size: 0.25,
      flatColors: [0, 1, 0, 0, 1, 0],
    },
  );
  pinned.dispose();
  flat.dispose();

  let ownedDisposed = 0;
  let borrowedDisposed = 0;
  const defaulted = buildAnalysisOverlayObject({
    run,
    metric: "workplane.total.illuminance",
  });
  (defaulted.object.material as THREE.PointsMaterial).addEventListener(
    "dispose",
    () => {
      ownedDisposed += 1;
    },
  );
  const borrowed = new THREE.PointsMaterial({ size: 1, vertexColors: true });
  borrowed.addEventListener("dispose", () => {
    borrowedDisposed += 1;
  });
  const lent = buildAnalysisOverlayObject({
    run,
    metric: "workplane.total.illuminance",
    material: borrowed,
  });
  defaulted.dispose();
  lent.dispose();
  TestValidator.equals(
    "the overlay disposes the material it created and never the one it was lent",
    {
      ownedDisposed,
      borrowedDisposed,
      lentMaterial: lent.object.material === borrowed,
    },
    { ownedDisposed: 1, borrowedDisposed: 0, lentMaterial: true },
  );
  borrowed.dispose();

  const unsupported = analyzeAutoMovieDaylight({
    request: request({ sky: "perez-all-weather" }),
  });
  const skipped = sealAutoMovieAnalysisRun({
    id: "skipped",
    domain: "air",
    subject: "space:hall",
    inputRevision: "r7",
    solver: { id: "s", version: "1", model: "m" },
    settings: "none",
    outcome: {
      status: "not-run",
      reason: "no supply flow declared",
      remedy: "declare the supply flow",
    },
  });
  const acoustics = analyzeAutoMovieAcoustics({
    request: {
      id: "hall-acoustics",
      subject: "space:hall",
      inputRevision: "r7",
      volume: 100,
      surfaces: [{ id: "boundaries", area: 100, absorption: 0.5 }],
      partitions: [],
      sources: [],
      receivers: [],
      targets: [],
    },
  });
  const draw = (
    target: IAutoMovieAnalysisRun,
    metric: string,
    fragment: string,
  ): boolean =>
    throwsError(
      () => buildAnalysisOverlayObject({ run: target, metric }),
      fragment,
    );
  TestValidator.equals(
    "nothing but a real measurement can be drawn",
    namedFacts([
      [
        "an unsupported run",
        () =>
          draw(
            unsupported,
            "workplane.total.illuminance",
            'is "unsupported", so it has no field to draw',
          ),
      ],
      [
        "a not-run run",
        () => draw(skipped, "space.airChangeRate", "no supply flow declared"),
      ],
      [
        "an unknown metric",
        () => draw(run, "room.clarity", 'carries no metric "room.clarity"'),
      ],
      [
        "a gapped metric",
        () =>
          draw(
            run,
            "workplane.groundReflected.illuminance",
            "models the sky vault only",
          ),
      ],
      [
        "a measurement with no field",
        () =>
          draw(
            acoustics,
            "room.absorptionArea",
            "recorded no spatial samples of it",
          ),
      ],
      [
        "a non-positive point size",
        () =>
          throwsError(
            () =>
              buildAnalysisOverlayObject({
                run,
                metric: "workplane.total.illuminance",
                size: 0,
              }),
            "point size must be a finite number above zero",
          ),
      ],
      [
        "an inverted ramp domain",
        () =>
          throwsError(
            () =>
              buildAnalysisOverlayObject({
                run,
                metric: "workplane.total.illuminance",
                domain: { min: 10, max: 1 },
              }),
            "max at or above min",
          ),
      ],
      [
        "a non-finite ramp domain",
        () =>
          throwsError(
            () =>
              buildAnalysisOverlayObject({
                run,
                metric: "workplane.total.illuminance",
                domain: { min: Number.NaN, max: 1 },
              }),
            "finite range",
          ),
      ],
    ]),
    {
      "an unsupported run": true,
      "a not-run run": true,
      "an unknown metric": true,
      "a gapped metric": true,
      "a measurement with no field": true,
      "a non-positive point size": true,
      "an inverted ramp domain": true,
      "a non-finite ramp domain": true,
    },
  );
};
