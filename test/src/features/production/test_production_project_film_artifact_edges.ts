import { AutoMovieProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface IFilmArtifactFixtureFailure {
  error: unknown;
}

class FilmArtifactFixtureCleanupError extends AggregateError {}

/** Remove one film-artifact root without replacing its primary failure. */
const preserveFilmArtifactFixtureCleanup = (
  failure: IFilmArtifactFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new FilmArtifactFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Film-artifact fixture cleanup failed after the test failed.",
    );
  }
};

/**
 * A stored shot the read validator accepts.
 *
 * A shot lives at `shots/<beat>.json` and its id is `shot:<beat>`, never
 * free-form. `cameraMotion` must be present even when null, and `performances`
 * and `objectMotions` are both read through `validateArrayArtifact`, which
 * refuses an absent value rather than treating it as empty. The metadata and
 * light-motion passes are the absent-tolerant ones.
 */
const storedShot = (beat: string, duration: number): unknown => ({
  id: `shot:${beat}`,
  scene: "sc",
  camera: "cam",
  duration,
  cameraMotion: null,
  performances: [],
  objectMotions: [],
});

/** A cut entry the validator accepts, so a case reports only what it broke. */
const entry = (overrides: Record<string, unknown> = {}): unknown => ({
  shot: "shot:opening",
  trim: null,
  transition: null,
  ...overrides,
});

const film = (overrides: Record<string, unknown> = {}): unknown => ({
  id: "feature",
  fps: 24,
  shots: [entry()],
  ...overrides,
});

interface IFilmCase {
  title: string;
  value: unknown;
  fragments: string[];
}

/**
 * Every violation the sequence artifact validator can report, driven
 * through the store's read boundary.
 *
 * This validator guards both the `commitFilm` precondition and the resident
 * `film.json` slice on load, and it carries the cut rules the engine's
 * `cutSequence` would otherwise discover at runtime: a film with no entries, an
 * entry naming no available shot, a first entry with an incoming transition,
 * and a transition longer than the entries it joins. None of them had a test,
 * which is most of what keeps `packages/production/src/validators/artifacts.ts` under
 * the coverage gate (#1791).
 *
 * Scenarios:
 *
 * 1. Film identity and clock: a blank id and a non-positive fps.
 * 2. Entries: a non-object entry, a blank shot reference, a shot the registry does
 *    not supply, and an absent `trim`/`transition`, which is not the same thing
 *    as an explicit `null` and is reported as its own violation.
 * 3. Cut rules: an empty cut list, an incoming transition on the first entry, and
 *    a transition longer than the spans it joins.
 */
export const test_production_project_film_artifact_edges = (): void => {
  const cases: IFilmCase[] = [
    {
      title: "a blank film id is refused",
      value: film({ id: " " }),
      fragments: ["$input.id"],
    },
    {
      title: "a non-positive film fps is refused",
      value: film({ fps: 0 }),
      fragments: ["$input.fps"],
    },
    {
      title: "an empty cut list is not a film",
      value: film({ shots: [] }),
      fragments: ["$input.shots", "at least one shot"],
    },
    {
      title: "a non-object cut entry reports its own violation",
      value: film({ shots: [7] }),
      fragments: ["$input.shots[0]"],
    },
    {
      title: "a cut entry naming no shot is refused",
      value: film({ shots: [entry({ shot: " " })] }),
      fragments: ["$input.shots[0].shot"],
    },
    {
      title: "a cut entry naming an unavailable shot is refused",
      value: film({ shots: [entry({ shot: "shot:absent" })] }),
      fragments: ["$input.shots[0].shot", "must reference an available shot"],
    },
    {
      title: "an absent trim is not the same as an explicit null",
      value: film({ shots: [{ shot: "shot:opening", transition: null }] }),
      fragments: ["$input.shots[0].trim"],
    },
    {
      title: "an absent transition is not the same as an explicit null",
      value: film({ shots: [{ shot: "shot:opening", trim: null }] }),
      fragments: ["$input.shots[0].transition"],
    },
    {
      title: "the first cut entry cannot carry an incoming transition",
      value: film({
        shots: [entry({ transition: { kind: "dissolve", duration: 0.5 } })],
      }),
      fragments: ["$input.shots[0].transition"],
    },
    {
      title: "a transition longer than the entries it joins is refused",
      value: film({
        shots: [
          entry(),
          entry({
            shot: "shot:answer",
            transition: { kind: "dissolve", duration: 99 },
          }),
        ],
      }),
      fragments: ["$input.shots[1].transition"],
    },
  ];

  // One root for every case, rewritten in place: a root per case would churn
  // this host's inode-keyed coordination lock, which is not this subject.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-film-"));
  let filmArtifactFailure: IFilmArtifactFixtureFailure | undefined;
  try {
    AutoMovieProject.open(root);
    fs.mkdirSync(path.join(root, "shots"), { recursive: true });
    for (const [beat, duration] of [
      ["opening", 2],
      ["answer", 2],
    ] as const)
      fs.writeFileSync(
        path.join(root, "shots", `${beat}.json`),
        `${JSON.stringify(storedShot(beat, duration), null, 2)}\n`,
      );
    // Report the message each case actually produced, not merely whether it
    // matched. A slice fixture that fails its own read validator throws about
    // the shot instead, and a boolean would send the next round guessing.
    const reported = (value: unknown): string => {
      fs.writeFileSync(
        path.join(root, "film.json"),
        `${JSON.stringify(value, null, 2)}\n`,
      );
      try {
        AutoMovieProject.open(root).writableSlate();
        return "accepted";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };
    TestValidator.equals(
      "the film validator reports the located violation for each malformed cut",
      Object.fromEntries(
        cases.map((item) => {
          const message = reported(item.value);
          return [
            item.title,
            item.fragments.every((fragment) => message.includes(fragment))
              ? "located"
              : message.slice(0, 400),
          ];
        }),
      ),
      Object.fromEntries(cases.map((item) => [item.title, "located"])),
    );
  } catch (error) {
    filmArtifactFailure = { error };
    throw error;
  } finally {
    preserveFilmArtifactFixtureCleanup(filmArtifactFailure, () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
  }
};
