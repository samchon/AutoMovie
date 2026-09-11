import { TestValidator } from "@nestia/e2e";

import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";
import type { IPortraitComponent } from "../../subjects/portraitComponents";

/**
 * The head assembler applies collected final proposals before its common normal
 * field and interior finishers, while assemblies without hooks retain behavior.
 *
 * Scenarios:
 * 1. A topology-free component moves one resident final vertex and its finisher
 *    reads that changed position. A second component reads the original basis.
 * 2. Swapping those providers preserves the refined result, while an absent or
 *    empty final proposal reproduces the original zero-round assembly exactly.
 */
export const test_subject_final_surface_assembly = (): void => {
  const host = {
    positions: referenceControlNet.positions,
    indices: referenceControlNet.indices,
    viewRay: referenceControlNet.viewRay,
  };
  // The measured net supplies a connected host, while this small legacy
  // component keeps the scenario independent of expensive eye/hair builders.
  const legacy: IPortraitComponent = {
    id: "legacy",
    fit: () => ({
      constraints: [
        {
          vertex: 4,
          target: host.positions[4].map(
            (value, axis) => value + (axis === 2 ? 0.25 : 0),
          ),
          reach: 0,
        },
      ],
      cutFaces: [],
      attach: () => ({ openings: [], finish: () => [] }),
    }),
  };
  const baseline = buildPortraitHead(host, [legacy], 0);
  let finished = 0;
  const first: IPortraitComponent = {
    id: "first-final",
    fit: () => ({
      constraints: [],
      cutFaces: [],
      attach: () => ({
        openings: [],
        finalSurface: (surface) => [
          {
            vertex: 4,
            target: [
              surface.positions[4][0],
              surface.positions[4][1],
              surface.positions[4][2] + 1,
            ],
          },
        ],
        finish: (surface) => {
          finished = surface.positions[4][2];
          return [];
        },
      }),
    }),
  };
  const second: IPortraitComponent = {
    id: "second-final",
    fit: () => ({
      constraints: [],
      cutFaces: [],
      attach: () => ({
        openings: [],
        finalSurface: (surface) => {
          TestValidator.equals(
            "the second component reads the unchanged common basis",
            surface.positions[4],
            baseline.refined.positions[4],
          );
          return [
            {
              vertex: 5,
              target: [
                surface.positions[5][0],
                surface.positions[5][1],
                surface.positions[5][2] + 0.5,
              ],
            },
          ];
        },
        finish: () => [],
      }),
    }),
  };
  const output = buildPortraitHead(host, [legacy, first, second], 0);
  TestValidator.equals(
    "interior finisher reads the proposed final position",
    finished,
    baseline.refined.positions[4][2] + 1,
  );
  TestValidator.equals(
    "head collects final providers independently of order",
    buildPortraitHead(host, [legacy, second, first], 0).refined,
    output.refined,
  );
  const empty: IPortraitComponent = {
    id: "empty-final",
    fit: () => ({
      constraints: [],
      cutFaces: [],
      attach: () => ({
        openings: [],
        finalSurface: () => [],
        finish: () => [],
      }),
    }),
  };
  TestValidator.equals(
    "an empty hook preserves the original assembled surface",
    buildPortraitHead(host, [legacy, empty], 0).refined,
    baseline.refined,
  );
};
