import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const { flightSpeedReadout } = loadSourceModule<{
  flightSpeedReadout: (
    speed: number,
    frames: readonly number[],
    budgetSeconds: number,
  ) => string;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/viewer/src/flightSpeedReadout.ts",
  ),
);

const filled = (seconds: number): number[] =>
  new Array<number>(15).fill(seconds);

const alternating = (): number[] =>
  new Array<number>(15)
    .fill(0)
    .map((_unused, index) => (index % 2 === 0 ? 0.3 : 0.05));

/**
 * The inspection eye reports the pace its capped frame integration carries.
 *
 * Expected values come from distance over elapsed time. At a 0.1 second
 * integration budget, for example, 0.1429 second frames carry
 * `4 * 0.1 / 0.1429 = 2.799` metres per second.
 *
 * Scenarios:
 *
 * 1. Frames within the budget report only the requested speed.
 * 2. Consistently slow frames report the independently calculated flown speed
 *    and frame rate.
 * 3. A difference is shown only when it changes the printed precision.
 * 4. One returning-tab gap is dropped while sustained slow frames remain.
 * 5. Empty, instantaneous, and insufficient samples refuse to infer a deficit.
 * 6. Raising the requested speed scales the flown speed.
 * 7. Alternating and mixed slow populations use their whole elapsed-time share
 *    rather than a typical frame.
 */
export const test_viewer_inspect_flight_readout = (): void => {
  TestValidator.equals(
    "frames within the integration budget keep the requested pace",
    flightSpeedReadout(4, filled(1 / 60), 0.1),
    "4.00m/s",
  );

  TestValidator.equals(
    "slow frames report the pace their capped integration carries",
    [
      flightSpeedReadout(4, filled(0.1429), 0.1),
      flightSpeedReadout(4, filled(0.3668), 0.1),
    ],
    [
      "4.00m/s (flying 2.80m/s at 7.0fps)",
      "4.00m/s (flying 1.09m/s at 2.7fps)",
    ],
  );

  TestValidator.equals(
    "the deficit appears only when it changes the printed pace",
    [0.1, 0.1001, 0.1013].map((seconds) =>
      flightSpeedReadout(4, filled(seconds), 0.1),
    ),
    ["4.00m/s", "4.00m/s", "4.00m/s (flying 3.95m/s at 9.9fps)"],
  );

  const returning = [...filled(1 / 60).slice(1), 30];
  TestValidator.equals(
    "one return gap is ignored but a sustained delay is measured",
    [
      flightSpeedReadout(4, returning, 0.1),
      flightSpeedReadout(4, filled(2.0156), 0.1),
    ],
    ["4.00m/s", "4.00m/s (flying 0.20m/s at 0.5fps)"],
  );

  TestValidator.equals(
    "samples that cannot establish elapsed pace stay quiet",
    [
      flightSpeedReadout(4, [], 0.1),
      flightSpeedReadout(4, [0, 0, 0], 0.1),
      flightSpeedReadout(4, [0, 0.3668], 0.1),
    ],
    ["4.00m/s", "4.00m/s", "4.00m/s"],
  );

  TestValidator.equals(
    "the selected speed scales the pace a heavy scene carries",
    flightSpeedReadout(13.5, filled(0.3668), 0.1),
    "13.50m/s (flying 3.68m/s at 2.7fps)",
  );

  const stuttering = [
    ...new Array<number>(8).fill(0.05),
    ...new Array<number>(7).fill(0.5),
  ];
  TestValidator.equals(
    "mixed frame rates use the whole measured population",
    [
      flightSpeedReadout(4, alternating(), 0.1),
      flightSpeedReadout(4, stuttering, 0.1),
    ],
    [
      "4.00m/s (flying 1.71m/s at 5.7fps)",
      "4.00m/s (flying 1.18m/s at 4.1fps)",
    ],
  );
};
