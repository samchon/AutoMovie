import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const readPackageFile = (...segments: string[]): string =>
  fs.readFileSync(path.join(ROOT, ...segments), "utf8");

/** Inventory every fetch call and its exact options without crossing calls. */
const fetchCallContracts = (
  file: string,
  source: string,
): Array<{
  argumentCount: number;
  callee: string;
  optionCount: number | null;
  options: string[];
  signal: string | null;
}> => {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const calls: Array<{
    argumentCount: number;
    callee: string;
    optionCount: number | null;
    options: string[];
    signal: string | null;
  }> = [];
  const visit = (node: ts.Node): void => {
    const fetchCall =
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) && node.expression.text === "fetch") ||
        (ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "fetch") ||
        (ts.isElementAccessExpression(node.expression) &&
          ts.isStringLiteralLike(node.expression.argumentExpression) &&
          node.expression.argumentExpression.text === "fetch"));
    if (fetchCall && ts.isCallExpression(node)) {
      const options = node.arguments[1];
      const properties =
        options !== undefined && ts.isObjectLiteralExpression(options)
          ? options.properties
          : null;
      const named = (properties ?? []).map((property) =>
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) ||
          ts.isStringLiteralLike(property.name))
          ? property.name.text
          : property.getText(parsed),
      );
      const onlyOption = properties?.length === 1 ? properties[0] : undefined;
      const signal =
        onlyOption !== undefined &&
        ts.isPropertyAssignment(onlyOption) &&
        (ts.isIdentifier(onlyOption.name) ||
          ts.isStringLiteralLike(onlyOption.name)) &&
        onlyOption.name.text === "signal"
          ? onlyOption
          : undefined;
      calls.push({
        argumentCount: node.arguments.length,
        callee: node.expression.getText(parsed),
        optionCount: properties?.length ?? null,
        options: named,
        signal: signal?.initializer.getText(parsed) ?? null,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return calls;
};

/** Bind every frame-processing call in capture-smoke main to validated input. */
const captureFrameConsumerContracts = (
  source: string,
): {
  consumers: Array<{
    arguments: string[];
    assertedGets: number;
    name: string;
  }>;
  mainCount: number;
} => {
  const parsed = ts.createSourceFile(
    "packages/playground/scripts/capture-smoke.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const mains: ts.Expression[] = [];
  for (const statement of parsed.statements) {
    if (ts.isVariableStatement(statement) === false) continue;
    for (const declaration of statement.declarationList.declarations)
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "main" &&
        declaration.initializer !== undefined
      )
        mains.push(declaration.initializer);
  }
  const consumers: Array<{
    arguments: string[];
    assertedGets: number;
    name: string;
  }> = [];
  if (mains.length === 1) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "equalBytes" ||
          node.expression.text === "histogram")
      ) {
        let assertedGets = 0;
        const countAssertedGets = (child: ts.Node): void => {
          if (
            ts.isNonNullExpression(child) &&
            ts.isCallExpression(child.expression) &&
            ts.isPropertyAccessExpression(child.expression.expression) &&
            child.expression.expression.name.text === "get"
          )
            ++assertedGets;
          ts.forEachChild(child, countAssertedGets);
        };
        countAssertedGets(node);
        consumers.push({
          arguments: node.arguments.map((argument) => argument.getText(parsed)),
          assertedGets,
          name: node.expression.text,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(mains[0]!);
  }
  return { consumers, mainCount: mains.length };
};

/** Trace structural pixel observations through capture-smoke main. */
const captureObservationContracts = (
  source: string,
): {
  checks: Array<[string, string]>;
  consoleReports: Array<Array<[string, string]>>;
  failureGuards: Array<{
    condition: string;
    constructor: string | null;
    head: string | null;
    spans: Array<{ expression: string; literal: string }>;
  }>;
  mainCount: number;
  observations: Array<[string, string]>;
  outerTryCount: number;
  pixels: Array<[string, string]>;
} => {
  const parsed = ts.createSourceFile(
    "packages/playground/scripts/capture-smoke.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const mains: ts.Expression[] = [];
  for (const statement of parsed.statements) {
    if (ts.isVariableStatement(statement) === false) continue;
    for (const declaration of statement.declarationList.declarations)
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "main" &&
        declaration.initializer !== undefined
      )
        mains.push(declaration.initializer);
  }
  const checks: Array<[string, string]> = [];
  const consoleReports: Array<Array<[string, string]>> = [];
  const failureGuards: Array<{
    condition: string;
    constructor: string | null;
    head: string | null;
    spans: Array<{ expression: string; literal: string }>;
  }> = [];
  const observations: Array<[string, string]> = [];
  const pixels: Array<[string, string]> = [];
  const compact = (node: ts.Node): string =>
    node.getText(parsed).replace(/\s+/g, " ");
  const outerTries =
    mains.length === 1 &&
    (ts.isArrowFunction(mains[0]!) || ts.isFunctionExpression(mains[0]!)) &&
    ts.isBlock(mains[0]!.body)
      ? mains[0]!.body.statements.filter(ts.isTryStatement)
      : [];
  if (outerTries.length === 1) {
    const statements = outerTries[0]!.tryBlock.statements;
    for (const statement of statements) {
      if (
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.length === 1
      ) {
        const declaration = statement.declarationList.declarations[0]!;
        if (
          ts.isIdentifier(declaration.name) === false ||
          declaration.initializer === undefined
        )
          continue;
        if (
          [
            "maskSubjectPixels",
            "maskBlackPixels",
            "poseWhitePixels",
            "poseMaskPalettePixels",
          ].includes(declaration.name.text)
        )
          pixels.push([
            declaration.name.text,
            compact(declaration.initializer),
          ]);
        if (
          declaration.name.text === "observations" &&
          ts.isObjectLiteralExpression(declaration.initializer)
        )
          for (const property of declaration.initializer.properties) {
            if (ts.isShorthandPropertyAssignment(property))
              observations.push([property.name.text, property.name.text]);
            else if (
              ts.isPropertyAssignment(property) &&
              (ts.isIdentifier(property.name) ||
                ts.isStringLiteralLike(property.name))
            )
              observations.push([
                property.name.text,
                compact(property.initializer),
              ]);
            else observations.push([compact(property), compact(property)]);
          }
        continue;
      }
      if (
        ts.isExpressionStatement(statement) &&
        ts.isBinaryExpression(statement.expression) &&
        statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isElementAccessExpression(statement.expression.left) &&
        ts.isIdentifier(statement.expression.left.expression) &&
        statement.expression.left.expression.text === "checks" &&
        ts.isStringLiteralLike(statement.expression.left.argumentExpression) &&
        [
          "mask subject color covers >= 0.3% of the frame",
          "mask background is dominant black",
          "pose skeleton draws white lines (0.02%..20%)",
          "pose carries no mask palette",
        ].includes(statement.expression.left.argumentExpression.text)
      ) {
        checks.push([
          statement.expression.left.argumentExpression.text,
          compact(statement.expression.right),
        ]);
        continue;
      }
      if (
        ts.isExpressionStatement(statement) &&
        ts.isCallExpression(statement.expression) &&
        ts.isPropertyAccessExpression(statement.expression.expression) &&
        ts.isIdentifier(statement.expression.expression.expression) &&
        statement.expression.expression.expression.text === "console" &&
        statement.expression.expression.name.text === "log"
      ) {
        const serialized = statement.expression.arguments[0];
        const object =
          serialized !== undefined &&
          ts.isCallExpression(serialized) &&
          ts.isPropertyAccessExpression(serialized.expression) &&
          ts.isIdentifier(serialized.expression.expression) &&
          serialized.expression.expression.text === "JSON" &&
          serialized.expression.name.text === "stringify"
            ? serialized.arguments[0]
            : undefined;
        if (object !== undefined && ts.isObjectLiteralExpression(object))
          consoleReports.push(
            object.properties.map((property): [string, string] => {
              if (ts.isShorthandPropertyAssignment(property))
                return [property.name.text, property.name.text];
              if (
                ts.isPropertyAssignment(property) &&
                (ts.isIdentifier(property.name) ||
                  ts.isStringLiteralLike(property.name))
              )
                return [property.name.text, compact(property.initializer)];
              return [compact(property), compact(property)];
            }),
          );
        continue;
      }
      if (ts.isIfStatement(statement)) {
        const thrown = ts.isThrowStatement(statement.thenStatement)
          ? statement.thenStatement.expression
          : undefined;
        const argument =
          thrown !== undefined &&
          ts.isNewExpression(thrown) &&
          thrown.arguments?.length === 1
            ? thrown.arguments[0]
            : undefined;
        failureGuards.push({
          condition: compact(statement.expression),
          constructor:
            thrown !== undefined && ts.isNewExpression(thrown)
              ? compact(thrown.expression)
              : null,
          head: ts.isTemplateExpression(argument) ? argument.head.text : null,
          spans: ts.isTemplateExpression(argument)
            ? argument.templateSpans.map((span) => ({
                expression: compact(span.expression),
                literal: span.literal.text,
              }))
            : [],
        });
      }
    }
  }
  return {
    checks,
    consoleReports,
    failureGuards,
    mainCount: mains.length,
    observations,
    outerTryCount: outerTries.length,
    pixels,
  };
};

/** Inspect one CommonJS launcher bundle lifecycle structurally. */
const launcherBundleContract = (
  file: string,
  source: string,
): {
  bundle: {
    constDeclarations: number;
    declarations: number;
    initializer: string | null;
    writes: number;
  };
  cryptoImports: number;
  fixedBundlePaths: string[];
  lifecycles: Array<{
    bodyActions: string[];
    outerCatch: {
      actions: string[];
      parameter: string;
    } | null;
    tries: Array<{
      actions: string[];
      buildOutfiles: string[];
      catchClause: boolean;
      finallyActions: string[];
      unsafeBuildOptions: string[];
    }>;
  }>;
} => {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const squash = (node: ts.Node): string =>
    node.getText(parsed).replace(/\s+/g, "");
  let bundleInitializer: string | null = null;
  let bundleConstDeclarations = 0;
  let bundleDeclarations = 0;
  let bundleWrites = 0;
  let cryptoImports = 0;
  const fixedBundlePaths: string[] = [];
  const lifecycles: Array<{
    bodyActions: string[];
    outerCatch: {
      actions: string[];
      parameter: string;
    } | null;
    tries: Array<{
      actions: string[];
      buildOutfiles: string[];
      catchClause: boolean;
      finallyActions: string[];
      unsafeBuildOptions: string[];
    }>;
  }> = [];
  for (const statement of parsed.statements)
    if (ts.isVariableStatement(statement)) {
      const constant =
        (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "bundlePath"
        ) {
          if (constant) ++bundleConstDeclarations;
          bundleInitializer =
            declaration.initializer === undefined
              ? null
              : squash(declaration.initializer);
        }
        if (
          constant &&
          ts.isObjectBindingPattern(declaration.name) &&
          declaration.name.elements.length === 1 &&
          declaration.name.elements[0]?.propertyName === undefined &&
          declaration.name.elements[0]?.dotDotDotToken === undefined &&
          declaration.name.elements[0]?.initializer === undefined &&
          ts.isIdentifier(declaration.name.elements[0]!.name) &&
          declaration.name.elements[0]!.name.text === "randomUUID" &&
          declaration.initializer !== undefined &&
          squash(declaration.initializer) === 'require("crypto")'
        )
          ++cryptoImports;
      }
    }
  const visit = (node: ts.Node): void => {
    if (
      ((ts.isVariableDeclaration(node) ||
        ts.isParameter(node) ||
        ts.isBindingElement(node)) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "bundlePath") ||
      ((ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node)) &&
        node.name?.text === "bundlePath")
    )
      ++bundleDeclarations;
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      let writesBundle = false;
      const findBundle = (target: ts.Node): void => {
        if (ts.isIdentifier(target) && target.text === "bundlePath")
          writesBundle = true;
        else ts.forEachChild(target, findBundle);
      };
      findBundle(node.left);
      if (writesBundle) ++bundleWrites;
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      ts.isIdentifier(node.operand) &&
      node.operand.text === "bundlePath"
    )
      ++bundleWrites;
    if (
      ts.isStringLiteralLike(node) &&
      /^\.(?:capture-smoke|render-and-see|render-sequence-and-see)\.cjs$/.test(
        node.text,
      )
    )
      fixedBundlePaths.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  for (const statement of parsed.statements) {
    if (
      ts.isExpressionStatement(statement) === false ||
      ts.isCallExpression(statement.expression) === false ||
      ts.isPropertyAccessExpression(statement.expression.expression) ===
        false ||
      statement.expression.expression.name.text !== "catch" ||
      ts.isCallExpression(statement.expression.expression.expression) === false
    )
      continue;
    const outerCall = statement.expression;
    const invocation = statement.expression.expression.expression;
    const wrapped = ts.isParenthesizedExpression(invocation.expression)
      ? invocation.expression.expression
      : invocation.expression;
    if (
      ts.isArrowFunction(wrapped) === false ||
      wrapped.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
      ) !== true ||
      ts.isBlock(wrapped.body) === false ||
      wrapped.parameters.length !== 0 ||
      invocation.arguments.length !== 0
    )
      continue;
    const bodyActions = wrapped.body.statements.map((action) =>
      ts.isTryStatement(action) ? "try" : squash(action),
    );
    const tries = wrapped.body.statements
      .filter(ts.isTryStatement)
      .map((tryStatement) => {
        const buildOutfiles: string[] = [];
        const unsafeBuildOptions: string[] = [];
        const actions = tryStatement.tryBlock.statements.map((action) => {
          if (
            ts.isExpressionStatement(action) &&
            ts.isAwaitExpression(action.expression) &&
            ts.isCallExpression(action.expression.expression)
          ) {
            const call = action.expression.expression;
            if (
              ts.isPropertyAccessExpression(call.expression) &&
              ts.isIdentifier(call.expression.expression) &&
              call.expression.expression.text === "esbuild" &&
              call.expression.name.text === "build" &&
              call.arguments.length === 1
            ) {
              const options = call.arguments[0];
              if (
                options !== undefined &&
                ts.isObjectLiteralExpression(options)
              )
                for (const property of options.properties) {
                  if (
                    ts.isPropertyAssignment(property) &&
                    (ts.isIdentifier(property.name) ||
                      ts.isStringLiteralLike(property.name)) &&
                    property.name.text === "outfile"
                  )
                    buildOutfiles.push(squash(property.initializer));
                  else if (
                    ts.isSpreadAssignment(property) ||
                    (ts.isPropertyAssignment(property) &&
                      ts.isComputedPropertyName(property.name)) ||
                    ((ts.isShorthandPropertyAssignment(property) ||
                      ts.isMethodDeclaration(property) ||
                      ts.isGetAccessorDeclaration(property) ||
                      ts.isSetAccessorDeclaration(property)) &&
                      property.name.getText(parsed) === "outfile")
                  )
                    unsafeBuildOptions.push(squash(property));
                }
              return "build";
            }
            if (
              ts.isPropertyAccessExpression(call.expression) &&
              call.expression.name.text === "main" &&
              ts.isCallExpression(call.expression.expression) &&
              ts.isIdentifier(call.expression.expression.expression) &&
              call.expression.expression.expression.text === "require" &&
              call.expression.expression.arguments.length === 1 &&
              call.expression.expression.arguments[0]?.getText(parsed) ===
                "bundlePath" &&
              call.arguments.length === 0
            )
              return "main";
          }
          return squash(action);
        });
        return {
          actions,
          buildOutfiles,
          catchClause: tryStatement.catchClause !== undefined,
          finallyActions:
            tryStatement.finallyBlock?.statements.map((action) =>
              squash(action),
            ) ?? [],
          unsafeBuildOptions,
        };
      });
    const catchHandler = outerCall.arguments[0];
    const outerCatch =
      catchHandler !== undefined &&
      ts.isArrowFunction(catchHandler) &&
      catchHandler.parameters.length === 1 &&
      ts.isIdentifier(catchHandler.parameters[0]!.name) &&
      ts.isBlock(catchHandler.body)
        ? {
            actions: catchHandler.body.statements.map((action) =>
              squash(action),
            ),
            parameter: catchHandler.parameters[0]!.name.text,
          }
        : null;
    lifecycles.push({
      bodyActions,
      outerCatch,
      tries,
    });
  }
  return {
    bundle: {
      constDeclarations: bundleConstDeclarations,
      declarations: bundleDeclarations,
      initializer: bundleInitializer,
      writes: bundleWrites,
    },
    cryptoImports,
    fixedBundlePaths,
    lifecycles,
  };
};

/** A source-level template interpolation without a live template expression. */
const templateExpression = (expression: string): string =>
  "$" + "{" + expression + "}";

/** Directory names directly under `segments`, in code-unit order. */
const directories = (...segments: string[]): string[] =>
  fs
    .readdirSync(path.join(ROOT, ...segments), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareCodeUnits);

/** Module names one package's `src/index.ts` re-exports, in code-unit order. */
const exportedModules = (pkg: string): string[] =>
  [
    ...readPackageFile("packages", pkg, "src", "index.ts").matchAll(
      /^export \* from "\.\/([^"]+)";$/gm,
    ),
  ]
    .map((line) => line[1]!)
    .sort(compareCodeUnits);

/** The names one module declares to the outside. */
const exportedNames = (pkg: string, module: string): string[] =>
  [
    ...readPackageFile("packages", pkg, "src", `${module}.ts`).matchAll(
      /^export (?:const|function|interface|type|class) ([A-Za-z_$][\w$]*)/gm,
    ),
  ].map((declaration) => declaration[1]!);

/**
 * Modules whose surface table names none of their exports.
 *
 * A table of functions cannot be compared with a list of filenames directly, so
 * the question asked is the one a reader would ask: does this document mention
 * anything this module exports? A module the table forgot answers no.
 */
const unmentionedModules = (pkg: string, document: string): string[] =>
  exportedModules(pkg).filter(
    (module) =>
      !exportedNames(pkg, module).some((name) => document.includes(name)),
  );

/**
 * The public entry documents must describe the product that shipped.
 *
 * These files are what a new contributor and a fresh agent read first, and
 * every claim in them is checkable against the tree beside them. They have
 * drifted repeatedly: retired command and agent surfaces outlived their removal
 * (#1385), a dependency the package no longer carries was still advertised, two
 * folds were documented as absent while their directories sat in `src`, the
 * tool counts stopped one release behind the surface, and a verb the harness
 * never had was taught as vocabulary (#1394). Prose cannot be trusted to age,
 * so each assertion reads the claim and the thing claimed.
 *
 * The negative halves are not decoration. A stale sentence usually survives
 * beside its correction rather than instead of it -- the interface README
 * asserted a `typia` dependency on line 5 and denied it on line 23 -- so a
 * positive-only pin passes while the contradiction ships.
 *
 * Scenarios:
 *
 * 1. The starter command names the published CLI binary, and no public entry
 *    document names a retired command or agent surface.
 * 2. The engine README documents the physics and topology tiers it implements, and
 *    the public violation kind calls physics a plausibility warning.
 * 3. The interface README claims no runtime dependency and names the harness and
 *    cinematics folds, with the removed `typia` claim asserted ABSENT.
 * 4. Its domain-folder table names every folder `packages/interface/src` ships,
 *    compared against the directory listing rather than against prose. `core/`
 *    was missing from the table until this comparison existed.
 * 5. The same comparison for the three other documents that enumerate a surface
 *    (#1398): the root package table against `packages/`, the engine module
 *    table against `packages/engine/src`, and the render and viewer surface
 *    tables against what their `index.ts` exports. A function table cannot be
 *    diffed against filenames, so the question asked of those two is whether
 *    the document mentions ANY name a module exports; a module it forgot
 *    answers no. All three had fallen behind, the root one omitting the very
 *    package whose binary the same file twice tells the reader to run.
 * 6. No package entry document points into `.wiki/`, which is gitignored: it ships
 *    in no tarball and exists in no clone, so such a pointer is dead for every
 *    reader who is not the author on the machine that wrote it.
 * 7. The mcp README names the exact five-tool evidence surface and the sole
 *    published binary while retired application families remain absent.
 * 8. The performance stage's JSDoc names real verbs only.
 * 9. The region contract documents the `fullBody` locomote default and
 *    content-aware layering -- both asserted PRESENT, both with the pre-#1383
 *    sentence they replaced asserted absent. The text is flattened across
 *    whitespace AND asterisks first, because a JSDoc continuation prefix would
 *    otherwise land mid-sentence.
 * 10. The root, interface, and engine READMEs teach coding-agent-owned files,
 *     deterministic delivery, and the narrow MCP evidence boundary without the
 *     retired authoring application or diffusion-only product claims (#1443).
 * 11. Root, interface, and MCP package manifests advertise that same current
 *     product boundary instead of the retired structured-output authoring
 *     engine (#1444).
 * 12. The packed-tarball client drives that same five-tool surface and keeps the
 *     removed compatibility servers and MCP-owned coding operations out.
 * 13. The native render loader stays inside the 100% coverage gate through its
 *     render source root, exact file include, and `.cjs` extension token.
 * 14. The packaged E2E process wrapper preserves stdout and stderr and names
 *     timeout, spawn-error, signal, missing-status, and exit-status failures,
 *     with every spawned process routed through that shared evidence.
 * 15. The real capture smoke observes an auto-launched Vite process and reports
 *     early spawn/exit evidence instead of waiting for the readiness timeout.
 * 16. The packaged starter verifier expects the versioned compile manifest's
 *     canonical shot entries with both their IDs and generated relative paths.
 * 17. Every capture-smoke readiness fetch and poll delay is bounded by the probe
 *     budget or the remaining advertised server-readiness deadline.
 * 18. Capture readiness requires the versioned identity marker served by the
 *     canonical stickman page, not an arbitrary successful HTTP response.
 * 19. Every expected capture-smoke frame is validated with run/name/inventory
 *     evidence before byte comparison or PNG parsing.
 * 20. Structural mask and pose checks preserve their measured pixel counts and
 *     fractions in both structured output and thrown failure evidence.
 * 21. Playground TypeScript launchers use unique same-directory bundles and clean
 *     them after build failure as well as main completion.
 */
export const test_workspace_public_contracts = (): void => {
  const rootReadme = readPackageFile("README.md");
  const engineReadme = readPackageFile("packages", "engine", "README.md");
  const interfaceReadme = readPackageFile("packages", "interface", "README.md");
  const mcpReadme = readPackageFile("packages", "mcp", "README.md");
  const mcpApplication = readPackageFile(
    "packages",
    "mcp",
    "src",
    "AutoMovieApplication.ts",
  );
  const tgzE2e = readPackageFile("internals", "e2e-tgz.mjs");
  const playgroundCaptureSmoke = readPackageFile(
    "packages",
    "playground",
    "scripts",
    "capture-smoke.ts",
  );
  const playgroundStickman = readPackageFile(
    "packages",
    "playground",
    "stickman.html",
  );
  const playgroundLaunchers = [
    ["capture-smoke.cjs", "capture-smoke"],
    ["render-and-see.cjs", "render-and-see"],
    ["render-sequence-and-see.cjs", "render-sequence-and-see"],
  ].map(([file, prefix]) => ({
    file: file!,
    prefix: prefix!,
    source: readPackageFile("packages", "playground", "scripts", file!),
  }));
  const devServerFailureOffset = playgroundCaptureSmoke.indexOf(
    "const devServerFailure =",
  );
  const devServerFailureSource =
    devServerFailureOffset < 0
      ? ""
      : playgroundCaptureSmoke.slice(
          devServerFailureOffset,
          playgroundCaptureSmoke.indexOf("\n\n/**", devServerFailureOffset),
        );
  const requireCapturedFrameOffset = playgroundCaptureSmoke.indexOf(
    "const requireCapturedFrame =",
  );
  const requireCapturedFrameEnd = playgroundCaptureSmoke.indexOf(
    "\n\n/**",
    requireCapturedFrameOffset,
  );
  const requireCapturedFrameSource =
    requireCapturedFrameOffset < 0 || requireCapturedFrameEnd < 0
      ? ""
      : playgroundCaptureSmoke.slice(
          requireCapturedFrameOffset,
          requireCapturedFrameEnd,
        );
  const ensureDevServerOffset = playgroundCaptureSmoke.indexOf(
    "const ensureDevServer =",
  );
  const ensureDevServerSource =
    ensureDevServerOffset < 0
      ? ""
      : playgroundCaptureSmoke.slice(
          ensureDevServerOffset,
          playgroundCaptureSmoke.indexOf(
            "\n\nconst answers =",
            ensureDevServerOffset,
          ),
        );
  const answersOffset = playgroundCaptureSmoke.indexOf("const answers =");
  const answersEnd = playgroundCaptureSmoke.indexOf("\n\n/**", answersOffset);
  const answersSource =
    answersOffset < 0 || answersEnd < 0
      ? ""
      : playgroundCaptureSmoke.slice(answersOffset, answersEnd);
  const failureAfterCloseOffset = ensureDevServerSource.indexOf(
    "const failureAfterClose =",
  );
  const failureAfterCloseSource =
    failureAfterCloseOffset < 0
      ? ""
      : ensureDevServerSource.slice(
          failureAfterCloseOffset,
          ensureDevServerSource.indexOf(
            "\n  const deadline =",
            failureAfterCloseOffset,
          ),
        );
  const readinessLoopOffset = ensureDevServerSource.indexOf("while (true)");
  const readinessLoopSource =
    readinessLoopOffset < 0
      ? ""
      : ensureDevServerSource.slice(
          readinessLoopOffset,
          ensureDevServerSource.indexOf(
            "\n  const failure = await failureAfterClose();",
            readinessLoopOffset,
          ),
        );
  const compiledShotOracleOffset = tgzE2e.indexOf(
    "const canonicalCompiledShots =",
  );
  const compiledShotConstantEnd = tgzE2e.indexOf(
    "\n];",
    compiledShotOracleOffset,
  );
  const compiledShotConstantSource =
    compiledShotOracleOffset < 0 || compiledShotConstantEnd < 0
      ? ""
      : tgzE2e.slice(
          compiledShotOracleOffset,
          compiledShotConstantEnd + "\n];".length,
        );
  const compiledShotAssertionOffset = tgzE2e.indexOf(
    'assert(\n  "starter-compiled-shot-order"',
    compiledShotConstantEnd,
  );
  const compiledShotAssertionEnd = tgzE2e.indexOf(
    "\n);",
    compiledShotAssertionOffset,
  );
  const compiledShotAssertionSource =
    compiledShotAssertionOffset < 0 || compiledShotAssertionEnd < 0
      ? ""
      : tgzE2e.slice(
          compiledShotAssertionOffset,
          compiledShotAssertionEnd + "\n);".length,
        );
  const sourceSection = (start: string, end: string): string => {
    const startOffset = tgzE2e.indexOf(start);
    const endOffset = tgzE2e.indexOf(end, startOffset + start.length);
    return startOffset < 0 || endOffset < 0
      ? ""
      : tgzE2e.slice(startOffset, endOffset);
  };
  const writeCommandOutputSource = sourceSection(
    "const writeCommandOutput =",
    "\nconst commandTermination =",
  );
  const commandTerminationSource = sourceSection(
    "const commandTermination =",
    "\nconst commandSucceeded =",
  );
  const commandTerminationReturnSource =
    commandTerminationSource.match(
      /return \[([\s\S]*?)\]\.join\("; "\);/,
    )?.[1] ?? "";
  const failCommandSource = sourceSection(
    "const failCommand =",
    "\nconst run =",
  );
  const runSource = sourceSection(
    "const run =",
    "\nconst runExpectedFailure =",
  );
  const expectedFailureSource = sourceSection(
    "const runExpectedFailure =",
    "\nconst runJson =",
  );
  const runJsonSource = sourceSection(
    "const runJson =",
    "\nconst CLIENT_SOURCE =",
  );
  const clientSpawnSource = sourceSection(
    "const clientTimeout =",
    "\n  // 5. Generate",
  );
  type PackageMetadata = {
    description: string;
    keywords: string[];
  };
  const rootPackage = JSON.parse(
    readPackageFile("package.json"),
  ) as PackageMetadata;
  const interfacePackage = JSON.parse(
    readPackageFile("packages", "interface", "package.json"),
  ) as PackageMetadata;
  const mcpPackage = JSON.parse(
    readPackageFile("packages", "mcp", "package.json"),
  ) as PackageMetadata & {
    bin: Record<string, string>;
    publishConfig: { bin: Record<string, string> };
  };
  const testPackage = JSON.parse(readPackageFile("test", "package.json")) as {
    scripts: { coverage: string };
  };
  const authoringContract = readPackageFile(
    "packages",
    "interface",
    "src",
    "authoring",
    "IAutoMovieAuthoring.ts",
  );
  const actionCall = readPackageFile(
    "packages",
    "interface",
    "src",
    "harness",
    "IAutoMovieActionCall.ts",
  );
  const bodyRegion = readPackageFile(
    "packages",
    "interface",
    "src",
    "skeleton",
    "AutoMovieBodyRegion.ts",
  );
  const violationKind = readPackageFile(
    "packages",
    "interface",
    "src",
    "validation",
    "AutoMovieViolationKind.ts",
  );
  const violationContract = readPackageFile(
    "packages",
    "interface",
    "src",
    "validation",
    "IAutoMovieConstraintViolation.ts",
  );
  // Every document this scenario reads, so the retired-surface sweep covers
  // the same set the paragraph above claims for it: four READMEs, the harness
  // application and action-call contracts, the body-region enum, and the two
  // validation types. They reach a reader through different doors, and a
  // retired command name is equally wrong behind any of them.
  const publicContract = [
    rootReadme,
    engineReadme,
    interfaceReadme,
    mcpReadme,
    authoringContract,
    actionCall,
    bodyRegion,
    violationKind,
    violationContract,
  ].join("\n");

  TestValidator.equals(
    "the starter command names the published CLI binary",
    rootReadme.includes("npx create-automovie <dir>"),
    true,
  );
  TestValidator.equals(
    "public entry docs do not name retired command or agent surfaces",
    publicContract.match(/npx autobe|@automovie\/agent|MicroAgentica/g) ?? [],
    [],
  );
  TestValidator.equals(
    "the engine documents implemented physics and topology tiers",
    [
      engineReadme.includes("Tier 3 (physics)"),
      engineReadme.includes("Tier 5 (topology)"),
      engineReadme.includes("warning만 있으면 성공"),
    ],
    [true, true, true],
  );
  TestValidator.equals(
    "the public violation kind calls physics a plausibility warning",
    violationKind.includes("physical-plausibility warning"),
    true,
  );

  // #1394: the contract docs drifted from the shipped surface once (a removed
  // typia dependency, a harness folder claimed absent, pre-#1392 tool counts,
  // a verb that does not exist, and pre-#1383 region semantics). Pin the truth.
  TestValidator.equals(
    "the interface documents no runtime dependency and its harness folder",
    [
      interfaceReadme.includes("런타임 의존은 없다"),
      interfaceReadme.includes("`harness/`"),
      interfaceReadme.includes("`cinematics/`"),
      interfaceReadme.includes("의존성은 `typia`"),
    ],
    [true, true, true, false],
  );
  // The domain-folder table is a claim about the package's own layout, so read
  // the layout instead of trusting the prose. The table omitted `harness/` and
  // `cinematics/` until #1394, and `core/` (the node, track, and channel
  // primitives every other fold builds on) until the follow-up.
  TestValidator.equals(
    "the interface README's folder table matches the shipped folders",
    [...interfaceReadme.matchAll(/^\| `([^`]+)\/`[ \t]+\|/gm)]
      .map((row) => row[1]!)
      .sort(compareCodeUnits),
    fs
      .readdirSync(path.join(ROOT, "packages", "interface", "src"), {
        withFileTypes: true,
      })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareCodeUnits),
  );
  // #1398: the same comparison, for the three other documents that enumerate a
  // surface. Every one of them had fallen behind: the root table omitted the
  // package whose binary the same file tells you to run, the engine table
  // documented seven of thirteen folders including neither `film/` nor
  // `perform/`, and the render and viewer tables missed five modules each.
  TestValidator.equals(
    "the root package table names every workspace package",
    [...rootReadme.matchAll(/^\| \[`(?:(?:@automovie\/)?([a-z][a-z-]+))`\]/gm)]
      .map((row) => row[1]!)
      .sort(compareCodeUnits),
    directories("packages"),
  );
  TestValidator.equals(
    "the engine README's module table matches the shipped folders",
    [...engineReadme.matchAll(/^\| `([^`]+)\/`[ \t]+\|/gm)]
      .map((row) => row[1]!)
      .sort(compareCodeUnits),
    directories("packages", "engine", "src"),
  );
  TestValidator.equals(
    "the render and viewer surface tables name every module they export",
    // The module counts ride along so the comparison cannot go vacuous: an
    // `index.ts` written in a re-export style the extractor does not know
    // would otherwise leave nothing to check and pass.
    ["render", "viewer"].map((pkg) => ({
      modules: exportedModules(pkg).length > 0,
      unmentioned: unmentionedModules(
        pkg,
        readPackageFile("packages", pkg, "README.md"),
      ),
    })),
    [
      { modules: true, unmentioned: [] },
      { modules: true, unmentioned: [] },
    ],
  );
  TestValidator.equals(
    "no package entry document points into the gitignored wiki",
    directories("packages")
      .filter((pkg) =>
        readPackageFile("packages", pkg, "README.md").includes(".wiki/"),
      )
      .concat(rootReadme.includes(".wiki/") ? ["<root>"] : []),
    [],
  );
  TestValidator.equals(
    "the mcp README counts the surface it actually ships",
    [
      mcpReadme.includes("exactly five MCP tools"),
      mcpReadme.includes("captureFrame"),
      mcpReadme.includes("repaintShot"),
    ],
    [true, true, true],
  );
  TestValidator.equals(
    "public entry READMEs teach the coding-agent and five-tool product contract",
    [
      rootReadme.includes("Coding-agent-native deterministic filmmaking"),
      rootReadme.includes('`visualDelivery: "deterministic"`'),
      rootReadme.includes('`visualDelivery: "repainted"`'),
      rootReadme.includes(
        "Design, source, asset, shot, sequence, optional rendition, and film reviews",
      ),
      rootReadme.includes("default, zero-configuration path"),
      rootReadme.includes("optional host-adapter lane"),
      rootReadme.includes("immutable provenance receipt"),
      rootReadme.includes("MCP has no design setter, compiler, renderer"),
      interfaceReadme.includes("다섯 MCP 지식·증거·리뷰 계약"),
      interfaceReadme.includes("MCP에는 그중 정확한 다섯 도구 계약만 반영"),
      engineReadme.includes("이 엔진의 두 번째 저작 API가 아니다"),
      engineReadme.includes("npx create-automovie <dir>"),
    ],
    [true, true, true, true, true, true, true, true, true, true, true, true],
  );
  TestValidator.equals(
    "public entry READMEs reject retired MCP authoring and diffusion-only claims",
    [rootReadme, interfaceReadme, engineReadme]
      .join("\n")
      .match(
        /An MCP server for deterministic motion-control video|MCP motion authoring surface|not a replacement for diffusion|MCP surface is the product boundary|structured-output 스키마가 곧|16개 MCP|3단 MCP 표면|stage\/block\/perform 데이터 계약|슬레이트 상태·트랜잭션|enact가 그 다리|npx automovie start <dir>/g,
      ) ?? [],
    [],
  );
  TestValidator.equals(
    "package manifests advertise the current product and ownership boundaries",
    {
      root: {
        description: rootPackage.description,
        keywords: rootPackage.keywords,
      },
      interface: {
        description: interfacePackage.description,
        keywords: interfacePackage.keywords,
      },
      mcp: {
        description: mcpPackage.description,
        keywords: mcpPackage.keywords,
      },
    },
    {
      root: {
        description:
          "Coding-agent-native deterministic filmmaking: tracked authoring, compilation, rendering, review, and delivery.",
        keywords: [
          "coding-agent",
          "deterministic",
          "filmmaking",
          "animation",
          "rendering",
        ],
      },
      interface: {
        description:
          "AutoMovie type contracts for code-native authoring, deterministic film data, production evidence, review, and delivery.",
        keywords: [
          "animation",
          "filmmaking",
          "production",
          "typescript",
          "types",
        ],
      },
      mcp: {
        description:
          "AutoMovie MCP boundary for session knowledge, host evidence, optional repaint receipts, and verdict-last review.",
        keywords: [
          "mcp",
          "model-context-protocol",
          "evidence",
          "review",
          "filmmaking",
        ],
      },
    },
  );
  TestValidator.equals(
    "package manifests reject retired structured-output motion-authoring claims",
    [rootPackage, interfacePackage, mcpPackage]
      .flatMap((manifest) => [manifest.description, ...manifest.keywords])
      .join("\n")
      .match(
        /LLM structured-output|function-calling|structured-output|motion-control engine as Model Context Protocol tools/g,
      ) ?? [],
    [],
  );
  TestValidator.equals(
    "packaged E2E names every process termination reason",
    {
      timeout:
        commandTerminationSource.match(
          /errorCode === "ETIMEDOUT"\s*\?\s*(`[^`]+`)/,
        )?.[1] ?? null,
      spawnError:
        commandTerminationSource.match(
          /result\.error !== undefined\s*\?\s*("[^"]+")/,
        )?.[1] ?? null,
      signal:
        commandTerminationSource.match(
          /result\.signal !== null\s*\?\s*("[^"]+")/,
        )?.[1] ?? null,
      missingStatus:
        commandTerminationSource.match(
          /typeof result\.status !== "number"\s*\?\s*("[^"]+")/,
        )?.[1] ?? null,
      exitStatus:
        commandTerminationSource.match(
          /:\s*(`exited with status \$\{result\.status\}`)/,
        )?.[1] ?? null,
    },
    {
      timeout: "`timed out after " + templateExpression("timeout") + " ms`",
      spawnError: '"failed to spawn"',
      signal: '"terminated by signal"',
      missingStatus: '"terminated without status"',
      exitStatus:
        "`exited with status " + templateExpression("result.status") + "`",
    },
  );
  TestValidator.equals(
    "packaged E2E prints every process termination field",
    {
      order: [
        ["reason", "reason"],
        ["timeout", "`timeout=" + templateExpression("timeout") + " ms`"],
        [
          "status",
          "`status=" +
            templateExpression(
              'typeof result.status === "number" ? result.status : "none"',
            ) +
            "`",
        ],
        [
          "signal",
          "`signal=" + templateExpression('result.signal ?? "none"') + "`",
        ],
        ["error", "`error=" + templateExpression("errorCode") + "`"],
        [
          "message",
          "`message=" +
            templateExpression(
              '\n      result.error === undefined ? "none" : JSON.stringify(result.error.message)\n    ',
            ) +
            "`",
        ],
      ]
        .filter(([, field]) => commandTerminationReturnSource.includes(field!))
        .sort(
          ([, left], [, right]) =>
            commandTerminationReturnSource.indexOf(left!) -
            commandTerminationReturnSource.indexOf(right!),
        )
        .map(([name]) => name),
      reason:
        commandTerminationReturnSource.match(/^\s*(reason),/m)?.[1] ?? null,
      timeout:
        commandTerminationReturnSource.match(
          /`timeout=\$\{timeout\} ms`/,
        )?.[0] ?? null,
      status:
        commandTerminationReturnSource.match(
          /`status=\$\{typeof result\.status === "number" \? result\.status : "none"\}`/,
        )?.[0] ?? null,
      signal:
        commandTerminationReturnSource.match(
          /`signal=\$\{result\.signal \?\? "none"\}`/,
        )?.[0] ?? null,
      error:
        commandTerminationReturnSource.match(/`error=\$\{errorCode\}`/)?.[0] ??
        null,
      message:
        commandTerminationReturnSource.match(
          /`message=\$\{[\s\S]*?JSON\.stringify\(result\.error\.message\)[\s\S]*?\}`/,
        )?.[0] ?? null,
    },
    {
      order: ["reason", "timeout", "status", "signal", "error", "message"],
      reason: "reason",
      timeout: "`timeout=" + templateExpression("timeout") + " ms`",
      status:
        "`status=" +
        templateExpression(
          'typeof result.status === "number" ? result.status : "none"',
        ) +
        "`",
      signal: "`signal=" + templateExpression('result.signal ?? "none"') + "`",
      error: "`error=" + templateExpression("errorCode") + "`",
      message:
        "`message=" +
        templateExpression(
          '\n      result.error === undefined ? "none" : JSON.stringify(result.error.message)\n    ',
        ) +
        "`",
    },
  );
  TestValidator.equals(
    "packaged E2E writes both captured streams before shared failure evidence",
    {
      streams: [
        ...writeCommandOutputSource.matchAll(
          /process\.stderr\.write\(result\.(stdout|stderr) \?\? ""\);/g,
        ),
      ].map((match) => match[1]),
      failureWriters: [
        ...failCommandSource.matchAll(/writeCommandOutput\((\w+)\);/g),
      ].map((match) => match[1]),
      failureOrder: [
        ["writeCommandOutput", "writeCommandOutput(result);"],
        ["fail", "fail("],
      ]
        .filter(([, call]) => failCommandSource.includes(call!))
        .sort(
          ([, left], [, right]) =>
            failCommandSource.indexOf(left!) -
            failCommandSource.indexOf(right!),
        )
        .map(([name]) => name),
    },
    {
      streams: ["stdout", "stderr"],
      failureWriters: ["result"],
      failureOrder: ["writeCommandOutput", "fail"],
    },
  );
  TestValidator.equals(
    "packaged E2E routes every spawned process through shared failure evidence",
    {
      counts: {
        spawned: (tgzE2e.match(/\bspawnSync\(/g) ?? []).length,
        routed: (tgzE2e.match(/\bfailCommand\(/g) ?? []).length,
      },
      sites: [
        {
          site: "run",
          spawned: runSource.match(/const (\w+) = spawnSync\(/)?.[1] ?? null,
          routed:
            runSource.match(/failCommand\(label, (\w+), timeout\)/)?.[1] ??
            null,
        },
        {
          site: "runExpectedFailure",
          spawned:
            expectedFailureSource.match(/const (\w+) = spawnSync\(/)?.[1] ??
            null,
          routed:
            expectedFailureSource.match(
              /failCommand\(\s*label,\s*(\w+),\s*timeout,/,
            )?.[1] ?? null,
        },
        {
          site: "runJson",
          spawned:
            runJsonSource.match(/const (\w+) = spawnSync\(/)?.[1] ?? null,
          routed:
            runJsonSource.match(/failCommand\(label, (\w+), timeout\)/)?.[1] ??
            null,
        },
        {
          site: "stdioClient",
          spawned:
            clientSpawnSource.match(/const (\w+) = spawnSync\(/)?.[1] ?? null,
          routed:
            clientSpawnSource.match(
              /failCommand\(\s*"stdio client assertions",\s*(\w+),/,
            )?.[1] ?? null,
        },
      ],
      retiredFallbacks: tgzE2e.match(/status \?\? "signal"/g) ?? [],
    },
    {
      counts: { spawned: 4, routed: 4 },
      sites: [
        { site: "run", spawned: "result", routed: "result" },
        {
          site: "runExpectedFailure",
          spawned: "result",
          routed: "result",
        },
        { site: "runJson", spawned: "result", routed: "result" },
        { site: "stdioClient", spawned: "client", routed: "client" },
      ],
      retiredFallbacks: [],
    },
  );
  TestValidator.equals(
    "packaged E2E preserves expected-failure output requirements",
    tgzE2e.match(
      /expected a normal non-zero exit containing \$\{JSON\.stringify\(/g,
    ) ?? [],
    ["expected a normal non-zero exit containing $" + "{JSON.stringify("],
  );
  TestValidator.equals(
    "real capture smoke reports an early Vite failure before timeout",
    {
      stdio:
        ensureDevServerSource.match(
          /stdio: \["ignore", "pipe", "pipe"\]/,
        )?.[0] ?? null,
      encodedChannels: [
        ...ensureDevServerSource.matchAll(
          /child\.(stdout|stderr)\.setEncoding\("utf8"\);/g,
        ),
      ].map((match) => match[1]),
      capturedChannels: [
        ...ensureDevServerSource.matchAll(
          /child\.(stdout|stderr)\.on\("data", \(chunk: string\) => \{\s*(stdout|stderr) = appendDevServerOutput\((stdout|stderr), chunk\);\s*\}\);/g,
        ),
      ].map((match) => ({
        appended: match[3],
        buffer: match[2],
        stream: match[1],
      })),
      observers: [
        ...ensureDevServerSource.matchAll(
          /child\.once\("(error|exit|close)",/g,
        ),
      ].map((match) => match[1]),
      exitSnapshotFields: ["child.exitCode", "child.signalCode"].filter(
        (field) => ensureDevServerSource.includes(field),
      ),
      failureChecks: (
        ensureDevServerSource.match(/await failureAfterClose\(\)/g) ?? []
      ).length,
      drainedFailure: {
        closeResolution:
          /const closed = new Promise<undefined>\(\(resolve\) => \{\s*child\.once\("close", \(code, signal\) => \{\s*exit = \{ code, signal \};\s*resolve\(undefined\);\s*\}\);\s*\}\);/.test(
            ensureDevServerSource,
          ),
        terminalGate: failureAfterCloseSource.includes(
          "if (error === null && currentExit() === null) return null;",
        ),
        waitsForClose:
          failureAfterCloseSource.indexOf("await closed;") >= 0 &&
          failureAfterCloseSource.indexOf("await closed;") <
            failureAfterCloseSource.indexOf("return devServerFailure({"),
      },
      readinessOrder: (() => {
        const offsets = [
          "const answered = await answers(",
          "const failure = await failureAfterClose();",
          "if (failure !== null)",
          "if (answered)",
          "setTimeout(resolve, delay);",
        ].map((marker) => readinessLoopSource.indexOf(marker));
        return {
          allPresent: offsets.every((offset) => offset >= 0),
          increasing: offsets.every(
            (offset, index) => index === 0 || offset > offsets[index - 1]!,
          ),
        };
      })(),
      failureReasons: ["failed to spawn", "exited before readiness"].filter(
        (reason) => devServerFailureSource.includes(reason),
      ),
      failureFields: [
        "error=",
        "message=",
        "status=",
        "signal=",
        "stdout=",
        "stderr=",
      ].filter((field) => devServerFailureSource.includes(field)),
      timeout: {
        aliveOnly: ensureDevServerSource.includes(
          "dev server remained alive but did not answer",
        ),
        output: ["stdout=", "stderr="].filter((field) =>
          ensureDevServerSource
            .slice(ensureDevServerSource.lastIndexOf("child.kill();"))
            .includes(field),
        ),
      },
      childKills: (ensureDevServerSource.match(/child\.kill\(\)/g) ?? [])
        .length,
    },
    {
      stdio: 'stdio: ["ignore", "pipe", "pipe"]',
      encodedChannels: ["stdout", "stderr"],
      capturedChannels: [
        { appended: "stdout", buffer: "stdout", stream: "stdout" },
        { appended: "stderr", buffer: "stderr", stream: "stderr" },
      ],
      observers: ["error", "exit", "close"],
      exitSnapshotFields: ["child.exitCode", "child.signalCode"],
      failureChecks: 2,
      drainedFailure: {
        closeResolution: true,
        terminalGate: true,
        waitsForClose: true,
      },
      readinessOrder: { allPresent: true, increasing: true },
      failureReasons: ["failed to spawn", "exited before readiness"],
      failureFields: [
        "error=",
        "message=",
        "status=",
        "signal=",
        "stdout=",
        "stderr=",
      ],
      timeout: { aliveOnly: true, output: ["stdout=", "stderr="] },
      childKills: 4,
    },
  );
  TestValidator.equals(
    "packaged starter verifier accepts versioned compiled shot entries",
    {
      entries: [
        ...compiledShotConstantSource.matchAll(
          /\{ id: "([^"]+)", path: "([^"]+)" \}/g,
        ),
      ].map((match) => ({ id: match[1], path: match[2] })),
      boundaries: {
        adjacent:
          compiledShotConstantEnd >= 0 &&
          compiledShotAssertionOffset ===
            compiledShotConstantEnd + "\n];\n".length,
        assertion: compiledShotAssertionSource.endsWith("\n);"),
        constant: compiledShotConstantSource.endsWith("\n];"),
      },
      comparison:
        compiledShotAssertionSource.match(
          /^assert\(\s*"starter-compiled-shot-order",\s*(JSON\.stringify\(compiled\.shots\) ===\s*JSON\.stringify\(canonicalCompiledShots\)),/,
        )?.[0] ?? null,
      labeledAssertions: (
        tgzE2e.match(/assert\(\s*"starter-compiled-shot-order"/g) ?? []
      ).length,
    },
    {
      entries: [
        { id: "answer", path: "shots/answer.json" },
        { id: "opening", path: "shots/opening.json" },
      ],
      boundaries: { adjacent: true, assertion: true, constant: true },
      comparison:
        'assert(\n  "starter-compiled-shot-order",\n  JSON.stringify(compiled.shots) === JSON.stringify(canonicalCompiledShots),',
      labeledAssertions: 1,
    },
  );
  TestValidator.equals(
    "real capture smoke binds readiness probes to its deadline",
    {
      constants: [
        ...playgroundCaptureSmoke.matchAll(
          /const (DEV_SERVER_(?:POLL_INTERVAL|PROBE_TIMEOUT|READY_TIMEOUT)_MS) = ([\d_]+);/g,
        ),
      ].map((match) => [match[1], match[2]]),
      fetchCalls: fetchCallContracts(
        "packages/playground/scripts/capture-smoke.ts",
        playgroundCaptureSmoke,
      ),
      answersSignature:
        /const answers = async \(\s*base: string,\s*timeoutMs: number,?\s*\): Promise<boolean>/.test(
          answersSource,
        ),
      reuse: ensureDevServerSource.includes(
        "if (await answers(base, DEV_SERVER_PROBE_TIMEOUT_MS))",
      ),
      loop: /while \(true\) \{\s*const remaining = deadline - Date\.now\(\);\s*if \(remaining <= 0\) break;\s*const answered = await answers\(\s*base,\s*Math\.min\(DEV_SERVER_PROBE_TIMEOUT_MS, remaining\),\s*\);/.test(
        ensureDevServerSource,
      ),
      delay:
        /const delay = Math\.min\(\s*DEV_SERVER_POLL_INTERVAL_MS,\s*deadline - Date\.now\(\),?\s*\);\s*if \(delay > 0\)\s*await new Promise\(\(resolve\) => \{\s*setTimeout\(resolve, delay\);/.test(
          readinessLoopSource,
        ),
      deadline: ensureDevServerSource.includes(
        "const deadline = Date.now() + DEV_SERVER_READY_TIMEOUT_MS;",
      ),
    },
    {
      constants: [
        ["DEV_SERVER_POLL_INTERVAL_MS", "500"],
        ["DEV_SERVER_PROBE_TIMEOUT_MS", "2_000"],
        ["DEV_SERVER_READY_TIMEOUT_MS", "30_000"],
      ],
      fetchCalls: [
        {
          argumentCount: 2,
          callee: "fetch",
          optionCount: 1,
          options: ["signal"],
          signal: "AbortSignal.timeout(timeoutMs)",
        },
      ],
      answersSignature: true,
      reuse: true,
      loop: true,
      delay: true,
      deadline: true,
    },
  );
  TestValidator.equals(
    "real capture smoke verifies the playground readiness identity",
    {
      sourceMarker:
        playgroundCaptureSmoke.match(
          /const DEV_SERVER_READY_MARKER = "([^"]+)";/,
        )?.[1] ?? null,
      htmlMarker:
        playgroundStickman.match(
          /<meta\s+name="automovie-capture-ready"\s+content="([^"]+)"\s*\/>/,
        )?.[1] ?? null,
      responseContract:
        /if \(!response\.ok\) return false;\s*return \(await response\.text\(\)\)\.includes\(DEV_SERVER_READY_MARKER\);/.test(
          answersSource,
        ),
      readinessCalls: (ensureDevServerSource.match(/await answers\(/g) ?? [])
        .length,
    },
    {
      sourceMarker: "automovie-stickman-capture-v1",
      htmlMarker: "automovie-stickman-capture-v1",
      responseContract: true,
      readinessCalls: 2,
    },
  );
  TestValidator.equals(
    "real capture smoke diagnoses every missing pass output",
    {
      evidence: {
        run: requireCapturedFrameSource.includes("runIndex + 1"),
        name: requireCapturedFrameSource.includes("JSON.stringify(name)"),
        inventory: requireCapturedFrameSource.includes(
          "[...(run?.keys() ?? [])]",
        ),
      },
      consumerContract: captureFrameConsumerContracts(playgroundCaptureSmoke),
    },
    {
      evidence: { run: true, name: true, inventory: true },
      consumerContract: {
        consumers: [
          {
            arguments: [
              "requireCapturedFrame(runs, 0, name)",
              "requireCapturedFrame(runs, 1, name)",
            ],
            assertedGets: 0,
            name: "equalBytes",
          },
          {
            arguments: [
              'requireCapturedFrame(runs, 0, "frame_00000.mask.png")',
            ],
            assertedGets: 0,
            name: "histogram",
          },
          {
            arguments: [
              'requireCapturedFrame(runs, 0, "frame_00000.pose.png")',
            ],
            assertedGets: 0,
            name: "histogram",
          },
          {
            arguments: [
              'requireCapturedFrame(runs, 0, "frame_00000.png")',
              'requireCapturedFrame(runs, 0, "frame_00000.mask.png")',
            ],
            assertedGets: 0,
            name: "equalBytes",
          },
        ],
        mainCount: 1,
      },
    },
  );
  TestValidator.equals(
    "real capture smoke preserves structural threshold observations",
    captureObservationContracts(playgroundCaptureSmoke),
    {
      checks: [
        [
          "mask subject color covers >= 0.3% of the frame",
          "observations.maskSubjectFraction >= 0.003",
        ],
        [
          "mask background is dominant black",
          "observations.maskBlackFraction >= 0.25",
        ],
        [
          "pose skeleton draws white lines (0.02%..20%)",
          "observations.poseWhiteFraction >= 0.0002 && observations.poseWhiteFraction <= 0.2",
        ],
        [
          "pose carries no mask palette",
          "observations.poseMaskPalettePixels === 0",
        ],
      ],
      consoleReports: [
        [
          ["route", "route"],
          ["server", 'server.spawned ? "spawned" : "reused"'],
          ["checks", "checks"],
          ["observations", "observations"],
        ],
      ],
      failureGuards: [
        {
          condition: "failed.length > 0",
          constructor: "Error",
          head: "capture smoke failed: ",
          spans: [
            {
              expression: 'failed.map(([name]) => name).join("; ")',
              literal: "; observations=",
            },
            {
              expression: "JSON.stringify(observations)",
              literal: "",
            },
          ],
        },
      ],
      mainCount: 1,
      observations: [
        ["maskBlackFraction", "maskBlackPixels / total"],
        ["maskBlackPixels", "maskBlackPixels"],
        ["maskSubjectFraction", "maskSubjectPixels / total"],
        ["maskSubjectPixels", "maskSubjectPixels"],
        ["poseMaskPalettePixels", "poseMaskPalettePixels"],
        ["poseWhiteFraction", "poseWhitePixels / total"],
        ["poseWhitePixels", "poseWhitePixels"],
      ],
      outerTryCount: 1,
      pixels: [
        ["maskSubjectPixels", "mask.get(subjectKey) ?? 0"],
        ["maskBlackPixels", "mask.get(rgbKey(0, 0, 0)) ?? 0"],
        ["poseWhitePixels", "pose.get(rgbKey(255, 255, 255)) ?? 0"],
        ["poseMaskPalettePixels", "pose.get(subjectKey) ?? 0"],
      ],
    },
  );
  TestValidator.equals(
    "playground launchers isolate and always clean temporary bundles",
    playgroundLaunchers.map(({ file, source }) => ({
      file,
      contract: launcherBundleContract(file, source),
    })),
    playgroundLaunchers.map(({ file, prefix }) => ({
      file,
      contract: {
        bundle: {
          constDeclarations: 1,
          declarations: 1,
          initializer:
            "path.join(__dirname,`." +
            prefix +
            "-" +
            templateExpression("process.pid") +
            "-" +
            templateExpression("randomUUID()") +
            ".cjs`)",
          writes: 0,
        },
        cryptoImports: 1,
        fixedBundlePaths: [],
        lifecycles: [
          {
            bodyActions: ["try"],
            outerCatch: {
              actions: ["console.error(error);", "process.exit(1);"],
              parameter: "error",
            },
            tries: [
              {
                actions: ["build", "main"],
                buildOutfiles: ["bundlePath"],
                catchClause: false,
                finallyActions: ["fs.rmSync(bundlePath,{force:true});"],
                unsafeBuildOptions: [],
              },
            ],
          },
        ],
      },
    })),
  );
  const mcpMethods = [
    ...mcpApplication.matchAll(
      /^\u0020{2}public (?:async )?([a-z][A-Za-z0-9]*)\s*\(/gm,
    ),
  ]
    .map((match) => match[1]!)
    .filter((name) => name !== "constructor")
    .sort(compareCodeUnits);
  const mcpToolGuideKeys = [
    ...mcpApplication
      .match(
        /export const AUTOMOVIE_TOOL_GUIDES = \{([\s\S]*?)\n\} as const/,
      )![1]!
      .matchAll(/^\u0020{2}([a-z][A-Za-z0-9]*):/gm),
  ]
    .map((match) => match[1]!)
    .sort(compareCodeUnits);
  const packedToolNames = [
    ...tgzE2e
      .match(/const expectedTools = \[([\s\S]*?)\n\u0020{2}\];/)![1]!
      .matchAll(/^\u0020{4}"([a-z][A-Za-z0-9]*)",$/gm),
  ]
    .map((match) => match[1]!)
    .sort(compareCodeUnits);
  TestValidator.equals(
    "public README tool tables derive their complete surface from the application",
    {
      methods: mcpMethods,
      guides: mcpToolGuideKeys,
      tables: [rootReadme, mcpReadme].map((document) =>
        [...document.matchAll(/^\| `([a-z][A-Za-z0-9]*)`\s+\|/gm)]
          .map((match) => match[1]!)
          .sort(compareCodeUnits),
      ),
    },
    {
      methods: mcpToolGuideKeys,
      guides: mcpToolGuideKeys,
      tables: [mcpToolGuideKeys, mcpToolGuideKeys],
    },
  );
  TestValidator.equals(
    "the native render loader stays inside the 100% coverage gate",
    testPackage.scripts.coverage.match(
      /--src packages\/render(?= )|--include "packages\/render\/gltfTransformCore\.cjs"|--extension \.cjs(?= |$)/g,
    ) ?? [],
    [
      "--src packages/render",
      '--include "packages/render/gltfTransformCore.cjs"',
      "--extension .cjs",
    ],
  );
  TestValidator.equals(
    "retired MCP and interface application families and binaries stay absent",
    {
      sources: [
        "AutoMovieLegacyApplication.ts",
        "AutoMovieGatewayApplication.ts",
        "AutoMovieLegacyGatewayApplication.ts",
        "AutoMovieProductionApplication.ts",
        "createAutoMovieProductionMcpServer.ts",
        "bin-production.ts",
        "bin-granular.ts",
      ].filter((file) =>
        fs.existsSync(path.join(ROOT, "packages", "mcp", "src", file)),
      ),
      interfaceApplications: [
        "IAutoMovieScriptApplication.ts",
        "IAutoMovieForgeApplication.ts",
        "IAutoMovieStagingApplication.ts",
        "IAutoMovieBlockingApplication.ts",
        "IAutoMoviePerformanceApplication.ts",
        "IAutoMovieReviewApplication.ts",
        "IAutoMovieAssembleApplication.ts",
      ].filter((file) =>
        fs.existsSync(
          path.join(ROOT, "packages", "interface", "src", "harness", file),
        ),
      ),
      interfaceApplicationExports:
        readPackageFile(
          "packages",
          "interface",
          "src",
          "harness",
          "index.ts",
        ).match(/IAutoMovie\w+Application/g) ?? [],
      bins: mcpPackage.bin,
      publishedBins: mcpPackage.publishConfig.bin,
      retiredNamesInReadme:
        mcpReadme.match(
          /openProject|inspectProject|compileProject|queryGeometry|previewFrame|automovie-mcp-(?:legacy|production|granular)/g,
        ) ?? [],
      packedTools: packedToolNames,
      retiredNamesInTgzE2e:
        tgzE2e.match(
          /AutoMovieLegacyApplication|tools\.length === (?:4|15)|name: "(?:execute|openProject|nextSteps|compileProject|queryGeometry|previewFrame)"|app\.(?:openProject|inspectProject|compileProject|queryGeometry)/g,
        ) ?? [],
      retiredCoverageExcludes:
        testPackage.scripts.coverage.match(
          /bin-(?:granular|production)\.ts/g,
        ) ?? [],
    },
    {
      sources: [],
      interfaceApplications: [],
      interfaceApplicationExports: [],
      bins: { "automovie-mcp": "lib/bin.js" },
      publishedBins: { "automovie-mcp": "lib/bin.js" },
      retiredNamesInReadme: [],
      packedTools: mcpToolGuideKeys,
      retiredNamesInTgzE2e: [],
      retiredCoverageExcludes: [],
    },
  );
  TestValidator.equals(
    "the performance stage names real verbs only",
    authoringContract.includes("walkTo"),
    false,
  );
  TestValidator.equals(
    "the region contract documents fullBody locomote and content-aware layering",
    (() => {
      // JSDoc continuation prefixes (" * ") would land mid-sentence after a
      // whitespace-only flatten, so fold runs of whitespace AND asterisks.
      const flatCall = actionCall.replace(/[\s*]+/g, " ");
      const flatRegion = bodyRegion.replace(/[\s*]+/g, " ");
      return [
        flatCall.includes("a `locomote` is `lowerBody`"),
        flatCall.includes("a `locomote` is `fullBody`"),
        flatCall.includes("Overlap is judged on the content surviving those"),
        flatRegion.includes("cannot co-occur with any other region"),
        flatRegion.includes(
          "co-occurs with another region only while their surviving content",
        ),
      ];
    })(),
    [false, true, true, false, true],
  );
};
