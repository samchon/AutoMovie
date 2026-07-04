import { Quaternion, compileCameraMove } from "@automovie/engine";
import {
  IAutoMovieCamera,
  IAutoMovieCameraAction,
  IAutoMovieQuaternion,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

const camera = (
  translation = { x: 0, y: 1.44, z: 5 },
  rotation: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 },
): IAutoMovieCamera => ({
  id: "cam",
  transform: { translation, rotation, scale: { x: 1, y: 1, z: 1 } },
  fovY: 90,
  near: 0.1,
  far: 1000,
});

const frame = (
  move: IAutoMovieCameraAction["move"],
  framing: IAutoMovieCameraAction["framing"],
  start = 0,
  duration: number | "auto" = "auto",
): IAutoMovieCameraAction => ({
  verb: "frame",
  actor: "cam",
  start,
  duration,
  framing,
  move,
  on: { kind: "point", point: { x: 0, y: 0, z: 0 } },
});

const SUBJECT = { base: { x: 0, y: 0, z: 0 }, height: 2, at: null };

/**
 * Pins the framing grammar's arithmetic with hand-computed oracles. With a 90°
 * vertical FOV, `tan(fovY/2) = 1`, so the framed distance is exactly half the
 * visible height — a subject of height 2 framed `medium` (0.62×) gives `d =
 * 1.24 / 2 = 0.62`, aimed at 0.72 × height = y 1.44.
 *
 * Scenarios:
 *
 * 1. `static medium` → one key at the framed position `(0, 1.44, 0.62)` (the
 *    staged bearing is +Z), rotation identity (−Z already faces the aim),
 *    emitted as `translation` + `rotation` node tracks on the camera.
 * 2. `push-in medium` → an eased dolly (9 keys) from `0.62×1.25 = 0.775` to
 *    `0.62×0.8 = 0.496` along the bearing, easeInOut so it starts slow (the
 *    quarter-mark key sits at 0.7401, short of a linear 0.705), spanning start
 *    → shot end.
 * 3. `whip` from a 90°-yawed staged orientation → two keys 0.2 s apart, both at
 *    the STAGED position (a whip pans in place), rotating from the staged
 *    quaternion to the aim.
 */
export const test_film_camera_move_grammar = (): void => {
  const still = compileCameraMove({
    clipId: "clip",
    camera: camera(),
    entries: [{ action: frame("static", "medium"), subject: SUBJECT }],
    shotDuration: 2,
  });
  TestValidator.predicate("static compiles", still !== null);
  if (still === null) return;
  TestValidator.equals(
    "track channels",
    still.tracks.map((t) => (t.channel.kind === "node" ? t.channel.path : "")),
    ["translation", "rotation"],
  );
  TestValidator.equals("one key", still.tracks[0]!.times, [0]);
  TestValidator.predicate(
    "framed position",
    vclose(
      {
        x: still.tracks[0]!.values[0]!,
        y: still.tracks[0]!.values[1]!,
        z: still.tracks[0]!.values[2]!,
      },
      { x: 0, y: 1.44, z: 0.62 },
    ),
  );
  TestValidator.predicate(
    "aim already down −Z (identity rotation)",
    nclose(still.tracks[1]!.values[3]!, 1),
  );

  const dolly = compileCameraMove({
    clipId: "clip",
    camera: camera(),
    entries: [{ action: frame("push-in", "medium"), subject: SUBJECT }],
    shotDuration: 2,
  })!;
  TestValidator.equals(
    "push-in eases over 9 keys",
    dolly.tracks[0]!.times.length,
    9,
  );
  TestValidator.predicate(
    "push-in spans the shot (0 → 2 s)",
    nclose(dolly.tracks[0]!.times[0]!, 0) &&
      nclose(dolly.tracks[0]!.times[8]!, 2),
  );
  TestValidator.predicate(
    "dolly from 1.25×d",
    nclose(dolly.tracks[0]!.values[2]!, 0.775),
  );
  TestValidator.predicate(
    "dolly to 0.8×d (the last key)",
    nclose(dolly.tracks[0]!.values[26]!, 0.496),
  );
  // Eased, not ramped: at the quarter mark easeInOut(0.25) = 0.125, so the dolly
  // has crept only 12.5% of the way (d = 0.62 × 1.19375 = 0.7401), well short of
  // a linear quarter (0.705) — the camera starts slow.
  TestValidator.predicate(
    "the dolly eases in (slow at the start)",
    nclose(dolly.tracks[0]!.values[8]!, 0.7401, 1e-3),
  );

  const yawed = camera(undefined, {
    x: 0,
    y: Math.SQRT1_2,
    z: 0,
    w: Math.SQRT1_2,
  });
  const whip = compileCameraMove({
    clipId: "clip",
    camera: yawed,
    entries: [{ action: frame("whip", "medium"), subject: SUBJECT }],
    shotDuration: 2,
  })!;
  TestValidator.equals("whip snaps in 0.2 s", whip.tracks[0]!.times, [0, 0.2]);
  TestValidator.predicate(
    "whip holds the staged position",
    vclose(
      {
        x: whip.tracks[0]!.values[3]!,
        y: whip.tracks[0]!.values[4]!,
        z: whip.tracks[0]!.values[5]!,
      },
      yawed.transform.translation,
    ),
  );
  TestValidator.predicate(
    "whip starts on the staged orientation",
    nclose(Math.abs(whip.tracks[1]!.values[1]!), Math.SQRT1_2),
  );
  const landing = {
    x: whip.tracks[1]!.values[4]!,
    y: whip.tracks[1]!.values[5]!,
    z: whip.tracks[1]!.values[6]!,
    w: whip.tracks[1]!.values[7]!,
  };
  TestValidator.predicate(
    "whip lands with −Z on the aim",
    vclose(Quaternion.rotateVector(landing, { x: 0, y: 0, z: -1 }), {
      x: 0,
      y: 0,
      z: -1,
    }),
  );
};
