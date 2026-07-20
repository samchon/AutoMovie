import { sampleClip } from "@automovie/engine";
import {
  IAutoMovieChannel,
  IAutoMovieClip,
  IAutoMovieTrack,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * The track sampler now binary-searches the enclosing keyframe segment instead
 * of scanning front to back, the same O(N·F) → O(F·log N) fix the pose sampler
 * got, on the general channel path (`resolveFrame`/`resolveDrivers`/attached
 * objects). A closed-form ramp on a vec3 translation track (value.x = i at time
 * i·dt, linear) gives an exact oracle: the sampled x equals time/dt across the
 * whole 240-key array.
 *
 * Scenarios:
 *
 * 1. Dense sweep (segment midpoints, exact interior keys, off-grid points) → the
 *    sampled x equals time/dt to 1e-9, y and z stay 0.
 * 2. Exact keyframe times return that keyframe's value verbatim.
 */

const DT = 0.1;
const N = 240;

const TRANSLATION: IAutoMovieChannel = {
  kind: "node",
  node: "n",
  path: "translation",
};
const KEY = "node:n:translation";

const rampClip = (): IAutoMovieClip => {
  const times: number[] = [];
  const values: number[] = [];
  for (let i = 0; i < N; ++i) {
    times.push(i * DT);
    values.push(i, 0, 0);
  }
  const track: IAutoMovieTrack = {
    channel: TRANSLATION,
    times,
    values,
    interpolation: "linear",
  };
  return {
    id: "c",
    name: null,
    duration: (N - 1) * DT,
    loop: false,
    tracks: [track],
  };
};

const xAt = (t: number): number[] => {
  const hit = sampleClip(rampClip(), t).get(KEY);
  if (hit === undefined) throw new Error(`${KEY} missing`);
  return hit.value;
};

export const test_resolve_sample_clip_binary_search = (): void => {
  const last = (N - 1) * DT;

  const queries: number[] = [];
  for (let i = 0; i < N - 1; ++i) queries.push((i + 0.5) * DT); // midpoints
  for (let i = 1; i < N - 1; ++i) queries.push(i * DT); // interior keys
  queries.push(last * 0.137, last * 0.611, last * 0.909); // off-grid

  for (const t of queries) {
    const v = xAt(t);
    TestValidator.predicate(
      `translation.x ramp is exact at t=${t.toFixed(4)}`,
      nclose(v[0]!, t / DT, 1e-9) && v[1] === 0 && v[2] === 0,
    );
  }

  // Endpoint tie: an exact interior key returns that key's value verbatim.
  TestValidator.equals(
    "exact key 137 returns x=137",
    xAt(137 * DT),
    [137, 0, 0],
  );
  TestValidator.equals(
    "exact key 200 returns x=200",
    xAt(200 * DT),
    [200, 0, 0],
  );
};
