import { renderScaffold } from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";

/** The body of one top-level arrow function, or a loud failure when it moved. */
const functionBody = (source: ts.SourceFile, name: string): ts.Node => {
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement) === false) continue;
    for (const declaration of statement.declarationList.declarations)
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer !== undefined &&
        ts.isArrowFunction(declaration.initializer)
      )
        return declaration.initializer.body;
  }
  // A missing subject would otherwise make every fact below vacuously true.
  throw new Error(`scripts/render.ts declares no "${name}" arrow function.`);
};

/** Every callee named inside one function, as written. */
const callees = (body: ts.Node, source: ts.SourceFile): string[] => {
  const output: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node))
      output.push(node.expression.getText(source).replace(/\s+/g, ""));
    ts.forEachChild(node, visit);
  };
  visit(body);
  return output;
};

/** Property names of the object each call to one callee is given. */
const callArgumentKeys = (
  body: ts.Node,
  source: ts.SourceFile,
  callee: string,
): string[][] => {
  const output: string[][] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === callee
    ) {
      const argument = node.arguments[0];
      output.push(
        argument !== undefined && ts.isObjectLiteralExpression(argument)
          ? argument.properties.flatMap((property) =>
              property.name === undefined
                ? []
                : [property.name.getText(source)],
            )
          : [],
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return output;
};

/**
 * The shipped render script decodes a production's declared audio assets and
 * hands them to the mix.
 *
 * `renderProductionSound` takes decoded mono samples per asset and never a
 * path, so an authored cue is only audible as authored if the caller that
 * renders the film's sound decodes the asset first. Without that call the cue
 * still mixes -- as the bus stand-in -- which is exactly why the gap is
 * invisible to any test that only asks whether the render produced audio. This
 * pins the wiring itself.
 *
 * It also pins where the bytes come from. The project's `contentInputs()` is
 * the owned-file reader with its path fence already applied; a second read
 * through `fs` would be a second, unreviewed way into the same tree, so the
 * resolver is asserted to have no such call at all.
 *
 * The scaffold is inspected as the bytes a generated project receives, because
 * that copy is what every production actually runs.
 *
 * Scenarios:
 *
 * 1. One resolver answers for both uses: the plan's asset identities are derived
 *    from the same resolution that produces the samples, so a plan cannot
 *    record a format the mix did not read.
 * 2. That resolver reads project-owned bytes through `contentInputs()`, decodes
 *    them with the package-owned decoder, and opens no file of its own.
 * 3. The film's sound resolves its declared assets and passes them to the mix as
 *    `assets`, beside -- not instead of -- the synthesized dialogue.
 * 4. The mix is called exactly once, so that one call is the film's sound.
 */
export const test_cli_scaffold_sound_asset_wiring = (): void => {
  const files = renderScaffold({ name: "sound-asset-film" });
  const render = ts.createSourceFile(
    "scripts/render.ts",
    files["scripts/render.ts"]!,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const identities = callees(
    functionBody(render, "productionAudioAssets"),
    render,
  );
  const resolver = callees(
    functionBody(render, "productionAudioSources"),
    render,
  );
  const sound = functionBody(render, "produceProductionSound");
  const soundCalls = callees(sound, render);
  const mixCalls = callArgumentKeys(sound, render, "renderProductionSound");

  TestValidator.equals(
    "the render script decodes declared audio assets into the mix",
    namedFacts([
      [
        "thePlanIdentitiesComeFromTheSameResolutionAsTheSamples",
        () => identities.includes("productionAudioSources"),
      ],
      [
        "theResolverReadsProjectOwnedBytes",
        () => resolver.includes("project.contentInputs"),
      ],
      // A decoder that opened its own file would need its own escape check, and
      // a second escape check is a second thing that can be wrong.
      [
        "andOpensNoFileOfItsOwn",
        () =>
          resolver.some(
            (callee) =>
              callee.startsWith("fs.") ||
              callee === "readFileSync" ||
              callee === "readAutoMovieProductionOwnedFile",
          ) === false,
      ],
      [
        "andDecodesThroughThePackageOwnedDecoder",
        () => resolver.includes("decodeProductionAudioAsset"),
      ],
      [
        "theFilmsSoundResolvesItsDeclaredAssets",
        () => soundCalls.includes("productionAudioSources"),
      ],
      ["theMixIsCalledExactlyOnce", () => mixCalls.length === 1],
      ["andIsHandedThoseAssets", () => mixCalls[0]!.includes("assets")],
      // Beside the dialogue, not instead of it: both buffers reach the same mix.
      ["besideTheSynthesizedDialogue", () => mixCalls[0]!.includes("dialogue")],
    ]),
    {
      thePlanIdentitiesComeFromTheSameResolutionAsTheSamples: true,
      theResolverReadsProjectOwnedBytes: true,
      andOpensNoFileOfItsOwn: true,
      andDecodesThroughThePackageOwnedDecoder: true,
      theFilmsSoundResolvesItsDeclaredAssets: true,
      theMixIsCalledExactlyOnce: true,
      andIsHandedThoseAssets: true,
      besideTheSynthesizedDialogue: true,
    },
  );
};
