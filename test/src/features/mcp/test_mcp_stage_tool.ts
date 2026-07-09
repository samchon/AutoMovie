import {
  IAutoMovieScriptApplication,
  IAutoMovieStagingApplication,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();
const script = makeScriptWrite();
const staging = makeStagingWrite();

/**
 * MCP `stage` is a tool boundary, so malformed direct payload shapes fail as
 * stage violations before the engine stage consumer iterates or dereferences
 * them.
 */
export const test_mcp_stage_tool = (): void => {
  const staged = app.stage({ script, staging }).staged;
  TestValidator.equals("valid stage succeeds", staged.success, true);

  const malformedRequest = app.stage(null as never).staged;
  TestValidator.predicate(
    "malformed request root returns violations",
    malformedRequest.success === false &&
      hasViolation(malformedRequest, "type", "$input"),
  );

  const malformedCast = app.stage({
    script: {
      ...script,
      cast: null as unknown as IAutoMovieScriptApplication.IWrite["cast"],
    },
    staging,
  }).staged;
  TestValidator.predicate(
    "malformed script cast returns violations",
    malformedCast.success === false &&
      hasViolation(malformedCast, "type", "$input.script.cast"),
  );

  const malformedActors = app.stage({
    script,
    staging: {
      ...staging,
      actors: null as unknown as IAutoMovieStagingApplication.IWrite["actors"],
    },
  }).staged;
  TestValidator.predicate(
    "malformed staging actors return violations",
    malformedActors.success === false &&
      hasViolation(malformedActors, "type", "$input.staging.actors"),
  );

  const malformedActorEntry = app.stage({
    script,
    staging: {
      ...staging,
      actors: [
        null as unknown as IAutoMovieStagingApplication.IWrite["actors"][number],
      ],
    },
  }).staged;
  TestValidator.predicate(
    "malformed actor entry returns violations",
    malformedActorEntry.success === false &&
      hasViolation(malformedActorEntry, "type", "$input.staging.actors[0]"),
  );

  const malformedCameraTarget = app.stage({
    script,
    staging: {
      ...staging,
      cameras: [
        {
          ...staging.cameras[0]!,
          lookAt:
            null as unknown as IAutoMovieStagingApplication.IWrite["cameras"][number]["lookAt"],
        },
      ],
    },
  }).staged;
  TestValidator.predicate(
    "malformed camera target returns violations",
    malformedCameraTarget.success === false &&
      hasViolation(
        malformedCameraTarget,
        "type",
        "$input.staging.cameras[0].lookAt",
      ),
  );

  const malformedLightDirection = app.stage({
    script,
    staging: {
      ...staging,
      lights: [
        {
          ...staging.lights[0]!,
          direction:
            null as unknown as IAutoMovieStagingApplication.IWrite["lights"][number]["direction"],
        },
      ],
    },
  }).staged;
  TestValidator.predicate(
    "malformed light direction returns violations",
    malformedLightDirection.success === false &&
      hasViolation(
        malformedLightDirection,
        "type",
        "$input.staging.lights[0].direction",
      ),
  );
};
