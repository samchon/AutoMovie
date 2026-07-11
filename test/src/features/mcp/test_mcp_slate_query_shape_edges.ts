import { IAutoMovieShot } from "@automovie/interface";
import { AutoMovieApplication, IAutoMovieMcpStoredSlate } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

const app = new AutoMovieApplication();

/**
 * SlateQueryService uniqueness guard tolerance (#1040 coverage): the shot
 * uniqueness scan skips an entry whose id is not a string rather than throwing,
 * so a query over a slate with a non-string shot id still answers honestly (the
 * collection shape guard has already accepted the entries as objects).
 *
 * Scenarios:
 *
 * 1. `getShot` over an explicit slate whose shot entry carries a non-string id
 *    resolves to `null` (no matching beat) without throwing.
 * 2. Negative twin: a well-formed shot for the queried beat resolves.
 */
export const test_mcp_slate_query_shape_edges = (): void => {
  const nonStringId: IAutoMovieMcpStoredSlate = {
    script: null,
    scene: null,
    shots: [{ id: 42 } as unknown as IAutoMovieShot],
    beatEnds: [],
    notes: [],
  };
  TestValidator.equals(
    "a non-string shot id is skipped and resolves to null",
    app.getShot({ slate: nonStringId, beat: "beat-1" }).shot,
    null,
  );

  const shot: IAutoMovieShot = {
    id: "shot:beat-1",
    name: null,
    scene: "scene-1",
    camera: "camera",
    cameraMotion: null,
    performances: [],
    objectMotions: [],
    duration: 1,
  };
  TestValidator.equals(
    "a well-formed shot for the beat resolves",
    app.getShot({
      slate: {
        script: null,
        scene: null,
        shots: [shot],
        beatEnds: [],
        notes: [],
      },
      beat: "beat-1",
    }).shot?.id ?? null,
    "shot:beat-1",
  );
};
