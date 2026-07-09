import {
  IAutoMovieForgeApplication,
  IAutoMovieScriptApplication,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { forgeEntry, makeScriptWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();
const script = makeScriptWrite();
const forge: IAutoMovieForgeApplication.IWrite = {
  type: "write",
  entries: [forgeEntry("knightB")],
};

/**
 * MCP `forge` is a tool boundary, so malformed direct payload shapes fail as
 * forge violations before the engine forge consumer iterates or dereferences
 * them.
 */
export const test_mcp_forge_tool = (): void => {
  const forged = app.forge({ script, forge }).forged;
  TestValidator.equals("valid forge succeeds", forged.success, true);

  const malformedRequest = app.forge(null as never).forged;
  TestValidator.predicate(
    "malformed request root returns violations",
    malformedRequest.success === false &&
      hasViolation(malformedRequest, "type", "$input"),
  );

  const malformedCast = app.forge({
    script: {
      ...script,
      cast: null as unknown as IAutoMovieScriptApplication.IWrite["cast"],
    },
    forge,
  }).forged;
  TestValidator.predicate(
    "malformed script cast returns violations",
    malformedCast.success === false &&
      hasViolation(malformedCast, "type", "$input.script.cast"),
  );

  const malformedEntries = app.forge({
    script,
    forge: {
      ...forge,
      entries: null as unknown as IAutoMovieForgeApplication.IWrite["entries"],
    },
  }).forged;
  TestValidator.predicate(
    "malformed forge entries return violations",
    malformedEntries.success === false &&
      hasViolation(malformedEntries, "type", "$input.forge.entries"),
  );

  const malformedEntry = app.forge({
    script,
    forge: {
      ...forge,
      entries: [
        null as unknown as IAutoMovieForgeApplication.IWrite["entries"][number],
      ],
    },
  }).forged;
  TestValidator.predicate(
    "malformed forge entry returns violations",
    malformedEntry.success === false &&
      hasViolation(malformedEntry, "type", "$input.forge.entries[0]"),
  );

  const malformedModel = app.forge({
    script,
    forge: {
      ...forge,
      entries: [
        {
          ...forge.entries[0]!,
          model:
            null as unknown as IAutoMovieForgeApplication.IWrite["entries"][number]["model"],
        },
      ],
    },
  }).forged;
  TestValidator.predicate(
    "malformed forge model returns violations",
    malformedModel.success === false &&
      hasViolation(malformedModel, "type", "$input.forge.entries[0].model"),
  );

  const malformedMaterials = app.forge({
    script,
    forge: {
      ...forge,
      entries: [
        {
          ...forge.entries[0]!,
          model: {
            ...forge.entries[0]!.model,
            materials:
              null as unknown as IAutoMovieForgeApplication.IWrite["entries"][number]["model"]["materials"],
          },
        },
      ],
    },
  }).forged;
  TestValidator.predicate(
    "malformed model materials return violations",
    malformedMaterials.success === false &&
      hasViolation(
        malformedMaterials,
        "type",
        "$input.forge.entries[0].model.materials",
      ),
  );

  const malformedPartTransform = app.forge({
    script,
    forge: {
      ...forge,
      entries: [
        {
          ...forge.entries[0]!,
          model: {
            ...forge.entries[0]!.model,
            parts: [
              {
                ...forge.entries[0]!.model.parts[0]!,
                transform:
                  undefined as unknown as IAutoMovieForgeApplication.IWrite["entries"][number]["model"]["parts"][number]["transform"],
              },
            ],
          },
        },
      ],
    },
  }).forged;
  TestValidator.predicate(
    "malformed model part transform returns violations",
    malformedPartTransform.success === false &&
      hasViolation(
        malformedPartTransform,
        "type",
        "$input.forge.entries[0].model.parts[0].transform",
      ),
  );

  const duplicateScript = app.forge({
    script: makeScriptWrite({
      cast: [
        {
          node: "knightA",
          character: "the imported challenger",
          modelRef: "stickman",
        },
        {
          node: "knightA",
          character: "the generated impostor",
          modelRef: null,
        },
      ],
    }),
    forge: { type: "write", entries: [forgeEntry("knightA")] },
  }).forged;
  TestValidator.predicate(
    "semantic duplicate script cast returns wrapper path",
    duplicateScript.success === false &&
      hasViolation(duplicateScript, "type", "$input.script.cast[1].node"),
  );

  const ghostEntry = app.forge({
    script,
    forge: { type: "write", entries: [forgeEntry("ghost")] },
  }).forged;
  TestValidator.predicate(
    "semantic forge entry returns wrapper path",
    ghostEntry.success === false &&
      hasViolation(ghostEntry, "type", "$input.forge.entries[0].node"),
  );
};
