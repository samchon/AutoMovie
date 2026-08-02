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
        const templateArgument =
          argument !== undefined && ts.isTemplateExpression(argument)
            ? argument
            : undefined;
        failureGuards.push({
          condition: compact(statement.expression),
          constructor:
            thrown !== undefined && ts.isNewExpression(thrown)
              ? compact(thrown.expression)
              : null,
          head: templateArgument?.head.text ?? null,
          spans:
            templateArgument?.templateSpans.map((span) => ({
              expression: compact(span.expression),
              literal: span.literal.text,
            })) ?? [],
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

/** Bind the packaged asset captures to the canonical review-view inventory. */
const packagedAssetReviewContract = (
  tgzSource: string,
  reviewSource: string,
): {
  aligned: boolean;
  canonical: {
    conditionals: Array<{
      condition: string;
      whenFalse: Array<Array<[string, string]>>;
      whenTrue: Array<Array<[string, string]>>;
    }>;
    declarations: number;
    spreads: string[];
    views: Array<Array<[string, string]>>;
  };
  captureLoops: Array<{
    assetGuard: string | null;
    assertion: {
      condition: string;
      detail: string;
      name: string;
    } | null;
    bodyStatementCount: number;
    capture: string | null;
    expression: string;
    initializer: string;
    model: string | null;
    modelAssertion: {
      condition: string;
      detail: string;
      name: string;
    } | null;
    modelInventory: string | null;
    outerBodyStatementCount: number;
    outerExpression: string;
    outerInitializer: string;
  }>;
  captureHost: {
    applications: string[];
    assertionFailures: string[];
    cleanup: Array<{
      catch: boolean;
      finally: string[];
    }>;
    imports: Array<{
      module: string;
      names: string[];
    }>;
    verifierCommands: string[];
  };
  embeddedScripts: number;
  guideLoops: Array<{
    body: string;
    expression: string;
    initializer: string;
  }>;
  packaged: {
    conditionals: Array<{
      condition: string;
      whenFalse: Array<Array<[string, string]>>;
      whenTrue: Array<Array<[string, string]>>;
    }>;
    declarations: number;
    spreads: string[];
    views: Array<Array<[string, string]>>;
  };
  reviewFlows: Array<{
    before: number | null;
    capture: number | null;
    models: number | null;
    views: number | null;
  }>;
  reviewPhases: number;
} => {
  interface IArrayContract {
    conditionals: Array<{
      condition: string;
      whenFalse: Array<Array<[string, string]>>;
      whenTrue: Array<Array<[string, string]>>;
    }>;
    declarations: number;
    spreads: string[];
    views: Array<Array<[string, string]>>;
  }
  const parse = (file: string, source: string, kind: ts.ScriptKind) =>
    ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const arrayContract = (
    arrays: ts.ArrayLiteralExpression[],
    parsed: ts.SourceFile,
  ): IArrayContract => {
    const compact = (node: ts.Node): string =>
      node.getText(parsed).replace(/\s+/g, "");
    const properties = (
      array: ts.ArrayLiteralExpression,
    ): Array<Array<[string, string]>> =>
      array.elements.map((element) => {
        if (ts.isObjectLiteralExpression(element) === false)
          return [[compact(element), compact(element)]];
        return element.properties.map((property): [string, string] => {
          if (
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) ||
              ts.isStringLiteralLike(property.name))
          )
            return [
              property.name.text,
              compact(property.initializer).replace(/asconst$/u, ""),
            ];
          return [compact(property), compact(property)];
        });
      });
    const conditionals: IArrayContract["conditionals"] = [];
    const spreads: string[] = [];
    const views: Array<Array<[string, string]>> = [];
    for (const array of arrays)
      for (const element of array.elements) {
        if (ts.isSpreadElement(element)) {
          spreads.push(compact(element));
          if (
            ts.isConditionalExpression(element.expression) &&
            ts.isArrayLiteralExpression(element.expression.whenTrue) &&
            ts.isArrayLiteralExpression(element.expression.whenFalse)
          )
            conditionals.push({
              condition: compact(element.expression.condition),
              whenFalse: properties(element.expression.whenFalse),
              whenTrue: properties(element.expression.whenTrue),
            });
          continue;
        }
        if (ts.isObjectLiteralExpression(element) === false) {
          views.push([[compact(element), compact(element)]]);
          continue;
        }
        views.push(
          element.properties.flatMap((property): Array<[string, string]> => {
            if (
              ts.isPropertyAssignment(property) &&
              (ts.isIdentifier(property.name) ||
                ts.isStringLiteralLike(property.name))
            ) {
              return [
                [
                  property.name.text,
                  compact(property.initializer).replace(/asconst$/u, ""),
                ],
              ];
            }
            return [[compact(property), compact(property)]];
          }),
        );
      }
    return { conditionals, declarations: arrays.length, spreads, views };
  };

  const reviewParsed = parse(
    "AutoMovieProductionReviewService.ts",
    reviewSource,
    ts.ScriptKind.TS,
  );
  const canonicalArrays: ts.ArrayLiteralExpression[] = [];
  const visitCanonical = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "required" &&
      node.type?.getText(reviewParsed) === "IRequiredAssetReviewView[]" &&
      node.initializer !== undefined &&
      ts.isArrayLiteralExpression(node.initializer)
    )
      canonicalArrays.push(node.initializer);
    ts.forEachChild(node, visitCanonical);
  };
  visitCanonical(reviewParsed);
  const canonical = arrayContract(canonicalArrays, reviewParsed);

  const tgzParsed = parse("internals/e2e-tgz.mjs", tgzSource, ts.ScriptKind.JS);
  const embeddedSources: string[] = [];
  for (const statement of tgzParsed.statements) {
    if (ts.isVariableStatement(statement) === false) continue;
    for (const declaration of statement.declarationList.declarations)
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "STARTER_VERIFY_SOURCE" &&
        declaration.initializer !== undefined &&
        ts.isNoSubstitutionTemplateLiteral(declaration.initializer)
      )
        embeddedSources.push(declaration.initializer.text);
  }
  const packagedArrays: Array<{
    array: ts.ArrayLiteralExpression;
    parsed: ts.SourceFile;
  }> = [];
  const captureLoops: Array<{
    assetGuard: string | null;
    assertion: {
      condition: string;
      detail: string;
      name: string;
    } | null;
    bodyStatementCount: number;
    capture: string | null;
    expression: string;
    initializer: string;
    model: string | null;
    modelAssertion: {
      condition: string;
      detail: string;
      name: string;
    } | null;
    modelInventory: string | null;
    outerBodyStatementCount: number;
    outerExpression: string;
    outerInitializer: string;
  }> = [];
  const guideLoops: Array<{
    body: string;
    expression: string;
    initializer: string;
  }> = [];
  const applications: string[] = [];
  const assertionFailures: string[] = [];
  const captureImports: Array<{
    module: string;
    names: string[];
  }> = [];
  const captureCleanup: Array<{
    catch: boolean;
    finally: string[];
  }> = [];
  const reviewFlows: Array<{
    before: number | null;
    capture: number | null;
    models: number | null;
    views: number | null;
  }> = [];
  let reviewPhases = 0;
  for (const embedded of embeddedSources) {
    const parsed = parse(
      "verify-packaged-starter.mjs",
      embedded,
      ts.ScriptKind.JS,
    );
    const compact = (node: ts.Node): string =>
      node.getText(parsed).replace(/\s+/g, "");
    for (const statement of parsed.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        statement.importClause?.namedBindings !== undefined &&
        ts.isNamedImports(statement.importClause.namedBindings) &&
        compact(statement.moduleSpecifier) === '"./scripts/capture.ts"'
      )
        captureImports.push({
          module: compact(statement.moduleSpecifier),
          names: statement.importClause.namedBindings.elements.map((element) =>
            compact(element),
          ),
        });
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations)
          if (
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === "app" &&
            declaration.initializer !== undefined
          )
            applications.push(compact(declaration.initializer));
          else if (
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === "assert" &&
            declaration.initializer !== undefined &&
            ts.isArrowFunction(declaration.initializer) &&
            ts.isBlock(declaration.initializer.body)
          )
            assertionFailures.push(
              ...declaration.initializer.body.statements
                .filter(ts.isIfStatement)
                .map((failure) => compact(failure.thenStatement)),
            );
    }
    for (const statement of parsed.statements)
      if (
        ts.isForOfStatement(statement) &&
        compact(statement.statement).includes("app.getGuideDocument({name})")
      )
        guideLoops.push({
          body: compact(statement.statement),
          expression: compact(statement.expression),
          initializer: compact(statement.initializer),
        });
    for (const statement of parsed.statements) {
      if (
        ts.isIfStatement(statement) === false ||
        compact(statement.expression) !== 'phase==="review"' ||
        ts.isBlock(statement.thenStatement) === false
      )
        continue;
      ++reviewPhases;
      const flow = {
        before: null as number | null,
        capture: null as number | null,
        models: null as number | null,
        views: null as number | null,
      };
      let modelInventory: string | null = null;
      statement.thenStatement.statements.forEach((action, index) => {
        if (ts.isVariableStatement(action))
          for (const declaration of action.declarationList.declarations) {
            if (
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === "packagedAssetReviewViews" &&
              declaration.initializer !== undefined &&
              ts.isArrowFunction(declaration.initializer) &&
              ts.isArrayLiteralExpression(declaration.initializer.body)
            ) {
              flow.views = index;
              packagedArrays.push({
                array: declaration.initializer.body,
                parsed,
              });
            }
            if (
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === "before"
            )
              flow.before = index;
            if (
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === "compiledModels" &&
              declaration.initializer !== undefined
            ) {
              flow.models = index;
              modelInventory = compact(declaration.initializer);
            }
          }
        const captureTry = ts.isTryStatement(action) ? action : undefined;
        const captureAction = (
          captureTry?.tryBlock.statements ??
          ts.factory.createNodeArray([action])
        ).find(
          (candidate): candidate is ts.ForOfStatement =>
            ts.isForOfStatement(candidate) &&
            compact(candidate.expression) === "before.reviews.entries",
        );
        if (captureAction === undefined) return;
        flow.capture = index;
        if (captureTry !== undefined)
          captureCleanup.push({
            catch: captureTry.catchClause !== undefined,
            finally:
              captureTry.finallyBlock?.statements.map((statement) =>
                compact(statement),
              ) ?? [],
          });
        const outerBody = ts.isBlock(captureAction.statement)
          ? captureAction.statement.statements
          : ts.factory.createNodeArray([captureAction.statement]);
        const assetGuard = outerBody.find(
          (statement): statement is ts.IfStatement =>
            ts.isIfStatement(statement) &&
            compact(statement.expression) === 'entry.target.kind!=="asset"',
        );
        const modelDeclaration = outerBody
          .filter(ts.isVariableStatement)
          .flatMap((statement) => [...statement.declarationList.declarations])
          .find(
            (declaration) =>
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === "model",
          );
        const modelAssertionCall = outerBody
          .filter(ts.isExpressionStatement)
          .map((statement) => statement.expression)
          .find(
            (expression): expression is ts.CallExpression =>
              ts.isCallExpression(expression) &&
              ts.isIdentifier(expression.expression) &&
              expression.expression.text === "assert" &&
              expression.arguments[1] !== undefined &&
              compact(expression.arguments[1]) === "model!==undefined",
          );
        const inner = outerBody.find(
          (statement): statement is ts.ForOfStatement =>
            ts.isForOfStatement(statement) &&
            compact(statement.expression) === "packagedAssetReviewViews(model)",
        );
        const body =
          inner === undefined
            ? ts.factory.createNodeArray<ts.Statement>()
            : ts.isBlock(inner.statement)
              ? inner.statement.statements
              : ts.factory.createNodeArray([inner.statement]);
        const first = body[0];
        const second = body[1];
        const captureDeclaration =
          first !== undefined && ts.isVariableStatement(first)
            ? first.declarationList.declarations[0]
            : undefined;
        const assertionCall =
          second !== undefined &&
          ts.isExpressionStatement(second) &&
          ts.isCallExpression(second.expression) &&
          ts.isIdentifier(second.expression.expression) &&
          second.expression.expression.text === "assert"
            ? second.expression
            : undefined;
        captureLoops.push({
          assetGuard: assetGuard === undefined ? null : compact(assetGuard),
          assertion:
            assertionCall?.arguments.length === 3
              ? {
                  condition: compact(assertionCall.arguments[1]!),
                  detail: compact(assertionCall.arguments[2]!),
                  name: compact(assertionCall.arguments[0]!),
                }
              : null,
          bodyStatementCount: body.length,
          capture:
            captureDeclaration?.initializer === undefined
              ? null
              : compact(captureDeclaration.initializer),
          expression: inner === undefined ? "" : compact(inner.expression),
          initializer: inner === undefined ? "" : compact(inner.initializer),
          model:
            modelDeclaration?.initializer === undefined
              ? null
              : compact(modelDeclaration.initializer),
          modelAssertion:
            modelAssertionCall?.arguments.length === 3
              ? {
                  condition: compact(modelAssertionCall.arguments[1]!),
                  detail: compact(modelAssertionCall.arguments[2]!),
                  name: compact(modelAssertionCall.arguments[0]!),
                }
              : null,
          modelInventory,
          outerBodyStatementCount: outerBody.length,
          outerExpression: compact(captureAction.expression),
          outerInitializer: compact(captureAction.initializer),
        });
      });
      reviewFlows.push(flow);
    }
  }
  const packaged = packagedArrays.reduce<IArrayContract>(
    (output, entry) => {
      const current = arrayContract([entry.array], entry.parsed);
      output.conditionals.push(...current.conditionals);
      output.declarations += current.declarations;
      output.spreads.push(...current.spreads);
      output.views.push(...current.views);
      return output;
    },
    { conditionals: [], declarations: 0, spreads: [], views: [] },
  );
  return {
    aligned:
      JSON.stringify({
        conditionals: packaged.conditionals,
        views: packaged.views,
      }) ===
      JSON.stringify({
        conditionals: canonical.conditionals,
        views: canonical.views,
      }),
    canonical,
    captureLoops,
    captureHost: {
      applications,
      assertionFailures,
      cleanup: captureCleanup,
      imports: captureImports,
      verifierCommands: [
        ...tgzSource.matchAll(
          /"(npm exec -- tsx verify-packaged-starter\.mjs (?:review|final))"/g,
        ),
      ].map((match) => match[1]!),
    },
    embeddedScripts: embeddedSources.length,
    guideLoops,
    packaged,
    reviewFlows,
    reviewPhases,
  };
};

/** Inspect one render playground's exact raster argument validator. */
const renderRasterArgumentContract = (
  file: string,
  source: string,
): {
  helper: {
    bodies: string[][];
    count: number;
    guards: Array<{
      condition: string;
      error: string | null;
    }>;
    parameters: string[][];
    parsed: string[];
    returns: string[];
  };
  legacyHelpers: {
    even: number;
    positiveInteger: number;
  };
  numberParser: {
    bodies: string[][];
    count: number;
    parameters: string[][];
  };
  parseArgs: {
    count: number;
    dimensions: Array<[string, string]>;
    directReturns: number;
    unsafeProperties: string[];
  };
} => {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const compact = (node: ts.Node): string =>
    node.getText(parsed).replace(/\s+/g, "");
  let even = 0;
  let helperCount = 0;
  let parseArgsCount = 0;
  let positiveInteger = 0;
  let directReturns = 0;
  const dimensions: Array<[string, string]> = [];
  const helperBodies: string[][] = [];
  const guards: Array<{ condition: string; error: string | null }> = [];
  const parameters: string[][] = [];
  const parsedValues: string[] = [];
  const returns: string[] = [];
  const unsafeProperties: string[] = [];
  const numberParserBodies: string[][] = [];
  const numberParserParameters: string[][] = [];
  for (const statement of parsed.statements) {
    if (ts.isVariableStatement(statement) === false) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) === false) continue;
      if (declaration.name.text === "even") ++even;
      if (declaration.name.text === "positiveInteger") ++positiveInteger;
      if (
        declaration.initializer === undefined ||
        (ts.isArrowFunction(declaration.initializer) === false &&
          ts.isFunctionExpression(declaration.initializer) === false) ||
        ts.isBlock(declaration.initializer.body) === false
      )
        continue;
      const body = declaration.initializer.body;
      if (declaration.name.text === "positiveNumber") {
        numberParserBodies.push(
          body.statements.map((action) => compact(action)),
        );
        numberParserParameters.push(
          declaration.initializer.parameters.map((parameter) =>
            compact(parameter),
          ),
        );
      }
      if (declaration.name.text === "positiveEvenInteger") {
        ++helperCount;
        helperBodies.push(body.statements.map((action) => compact(action)));
        parameters.push(
          declaration.initializer.parameters.map((parameter) =>
            compact(parameter),
          ),
        );
        for (const action of body.statements) {
          if (
            ts.isVariableStatement(action) &&
            action.declarationList.declarations.length === 1 &&
            ts.isIdentifier(action.declarationList.declarations[0]!.name) &&
            action.declarationList.declarations[0]!.name.text === "parsed" &&
            action.declarationList.declarations[0]!.initializer !== undefined
          )
            parsedValues.push(
              compact(action.declarationList.declarations[0]!.initializer!),
            );
          if (ts.isIfStatement(action)) {
            const thrown = ts.isThrowStatement(action.thenStatement)
              ? action.thenStatement.expression
              : undefined;
            const argument =
              thrown !== undefined &&
              ts.isNewExpression(thrown) &&
              thrown.arguments?.length === 1
                ? thrown.arguments[0]
                : undefined;
            guards.push({
              condition: compact(action.expression),
              error: argument === undefined ? null : compact(argument),
            });
          }
          if (ts.isReturnStatement(action) && action.expression !== undefined)
            returns.push(compact(action.expression));
        }
      }
      if (declaration.name.text !== "parseArgs") continue;
      ++parseArgsCount;
      for (const action of body.statements) {
        if (ts.isReturnStatement(action) === false) continue;
        ++directReturns;
        if (
          action.expression === undefined ||
          ts.isObjectLiteralExpression(action.expression) === false
        )
          continue;
        for (const property of action.expression.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) ||
              ts.isStringLiteralLike(property.name)) &&
            (property.name.text === "width" || property.name.text === "height")
          )
            dimensions.push([
              property.name.text,
              compact(property.initializer),
            ]);
          else if (
            ts.isSpreadAssignment(property) ||
            (ts.isSpreadAssignment(property) === false &&
              ts.isComputedPropertyName(property.name)) ||
            ((ts.isShorthandPropertyAssignment(property) ||
              ts.isMethodDeclaration(property) ||
              ts.isGetAccessorDeclaration(property) ||
              ts.isSetAccessorDeclaration(property)) &&
              (property.name.getText(parsed) === "width" ||
                property.name.getText(parsed) === "height"))
          )
            unsafeProperties.push(compact(property));
        }
      }
    }
  }
  return {
    helper: {
      bodies: helperBodies,
      count: helperCount,
      guards,
      parameters,
      parsed: parsedValues,
      returns,
    },
    legacyHelpers: { even, positiveInteger },
    numberParser: {
      bodies: numberParserBodies,
      count: numberParserBodies.length,
      parameters: numberParserParameters,
    },
    parseArgs: {
      count: parseArgsCount,
      dimensions,
      directReturns,
      unsafeProperties,
    },
  };
};

/** Inspect the shared primary-first cleanup failure policy. */
const cleanupFailurePolicyContract = (
  source: string,
): {
  bodies: string[][];
  parameters: string[][];
} => {
  const parsed = ts.createSourceFile(
    "preserveCleanupFailure.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const compact = (node: ts.Node): string =>
    node.getText(parsed).replace(/\s+/g, "");
  const bodies: string[][] = [];
  const parameters: string[][] = [];
  for (const statement of parsed.statements) {
    if (ts.isVariableStatement(statement) === false) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) === false ||
        declaration.name.text !== "preserveCleanupFailure" ||
        declaration.initializer === undefined ||
        ts.isArrowFunction(declaration.initializer) === false ||
        ts.isBlock(declaration.initializer.body) === false
      )
        continue;
      parameters.push(
        declaration.initializer.parameters.map((parameter) =>
          compact(parameter),
        ),
      );
      bodies.push(
        declaration.initializer.body.statements.map((statement) =>
          compact(statement),
        ),
      );
    }
  }
  return { bodies, parameters };
};

/** Inspect every render cleanup fence that delegates failure precedence. */
const renderCleanupFailureContract = (
  file: string,
  source: string,
): {
  imports: number;
  lifecycles: Array<{
    catchActions: string[];
    catchParameter: string | null;
    finallyActions: string[];
    tryMarkers: string[];
  }>;
} => {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const compact = (node: ts.Node): string =>
    node.getText(parsed).replace(/\s+/g, "");
  const imports = parsed.statements.filter((statement) => {
    if (
      ts.isImportDeclaration(statement) === false ||
      compact(statement.moduleSpecifier) !== '"./preserveCleanupFailure"'
    )
      return false;
    const bindings = statement.importClause?.namedBindings;
    return (
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.length === 1 &&
      bindings.elements[0]!.name.text === "preserveCleanupFailure"
    );
  }).length;
  const lifecycles: Array<{
    catchActions: string[];
    catchParameter: string | null;
    finallyActions: string[];
    tryMarkers: string[];
  }> = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined
    ) {
      const finallyActions = node.finallyBlock.statements
        .map((statement) => compact(statement))
        .filter((statement) => statement.includes("preserveCleanupFailure"));
      if (finallyActions.length > 0)
        lifecycles.push({
          catchActions: node.catchClause.block.statements.map((statement) =>
            compact(statement),
          ),
          catchParameter:
            node.catchClause.variableDeclaration === undefined
              ? null
              : compact(node.catchClause.variableDeclaration),
          finallyActions,
          tryMarkers: node.tryBlock.statements
            .map((statement) => compact(statement))
            .filter((statement) => statement === "encoder.initialize();"),
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  lifecycles.sort((left, right) =>
    compareCodeUnits(left.finallyActions[0]!, right.finallyActions[0]!),
  );
  return { imports, lifecycles };
};

/** Inspect the capture smoke's nested server, browser, and session fences. */
const captureSmokeCleanupContract = (
  source: string,
): {
  imports: number;
  lifecycles: Record<
    "browser" | "server" | "session",
    {
      catchActions: string[];
      catchParameter: string | null;
      finallyActions: string[];
      tryActions: string[];
    } | null
  >;
  loop: {
    bodyActions: string[];
    condition: string | null;
    count: number;
    incrementor: string | null;
    initializer: string | null;
  };
  mainCount: number;
  resources: Record<
    | "browser"
    | "browserFailure"
    | "frames"
    | "runs"
    | "server"
    | "serverFailure"
    | "session"
    | "sessionFailure",
    { count: number; initializer: string | null }
  >;
} => {
  const parsed = ts.createSourceFile(
    "packages/playground/scripts/capture-smoke.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const compact = (node: ts.Node): string =>
    node.getText(parsed).replace(/\s+/g, "");
  const imports = parsed.statements.filter((statement) => {
    if (
      ts.isImportDeclaration(statement) === false ||
      compact(statement.moduleSpecifier) !== '"./preserveCleanupFailure"'
    )
      return false;
    const bindings = statement.importClause?.namedBindings;
    return (
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.length === 1 &&
      bindings.elements[0]!.name.text === "preserveCleanupFailure"
    );
  }).length;
  const mains: ts.Block[] = [];
  for (const statement of parsed.statements) {
    if (ts.isVariableStatement(statement) === false) continue;
    for (const declaration of statement.declarationList.declarations)
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "main" &&
        declaration.initializer !== undefined &&
        ts.isArrowFunction(declaration.initializer) &&
        ts.isBlock(declaration.initializer.body)
      )
        mains.push(declaration.initializer.body);
  }
  const main = mains.length === 1 ? mains[0]! : undefined;
  const directTries = (statements: ts.NodeArray<ts.Statement> | undefined) =>
    statements?.filter(ts.isTryStatement) ?? [];
  const serverTries = directTries(main?.statements);
  const server = serverTries.length === 1 ? serverTries[0]! : undefined;
  const browserTries = directTries(server?.tryBlock.statements);
  const browser = browserTries.length === 1 ? browserTries[0]! : undefined;
  const loops = browser?.tryBlock.statements.filter(ts.isForStatement) ?? [];
  const loop = loops.length === 1 ? loops[0]! : undefined;
  const loopBody =
    loop !== undefined && ts.isBlock(loop.statement)
      ? loop.statement.statements
      : undefined;
  const sessionTries = directTries(loopBody);
  const session = sessionTries.length === 1 ? sessionTries[0]! : undefined;
  const action = (statement: ts.Statement): string => {
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.length === 1
    ) {
      const declaration = statement.declarationList.declarations[0]!;
      if (ts.isIdentifier(declaration.name)) return declaration.name.text;
    }
    if (ts.isTryStatement(statement)) return "try";
    if (ts.isForStatement(statement))
      return `for(${statement.initializer === undefined ? "" : compact(statement.initializer)};${statement.condition === undefined ? "" : compact(statement.condition)};${statement.incrementor === undefined ? "" : compact(statement.incrementor)})`;
    return compact(statement);
  };
  const lifecycle = (
    statement: ts.TryStatement | undefined,
  ): {
    catchActions: string[];
    catchParameter: string | null;
    finallyActions: string[];
    tryActions: string[];
  } | null =>
    statement?.catchClause === undefined || statement.finallyBlock === undefined
      ? null
      : {
          catchActions: statement.catchClause.block.statements.map(compact),
          catchParameter:
            statement.catchClause.variableDeclaration === undefined
              ? null
              : compact(statement.catchClause.variableDeclaration),
          finallyActions: statement.finallyBlock.statements.map(compact),
          tryActions: statement.tryBlock.statements.map(action),
        };
  const binding = (
    statements: ts.NodeArray<ts.Statement> | undefined,
    name: string,
  ): { count: number; initializer: string | null } => {
    const declarations = (statements ?? []).flatMap((statement) =>
      ts.isVariableStatement(statement)
        ? [...statement.declarationList.declarations].filter(
            (declaration) =>
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === name,
          )
        : [],
    );
    return {
      count: declarations.length,
      initializer:
        declarations.length === 1 && declarations[0]!.initializer !== undefined
          ? compact(declarations[0]!.initializer!)
          : null,
    };
  };
  return {
    imports,
    lifecycles: {
      browser: lifecycle(browser),
      server: lifecycle(server),
      session: lifecycle(session),
    },
    loop: {
      bodyActions: loopBody?.map(action) ?? [],
      condition: loop?.condition === undefined ? null : compact(loop.condition),
      count: loops.length,
      incrementor:
        loop?.incrementor === undefined ? null : compact(loop.incrementor),
      initializer:
        loop?.initializer === undefined ? null : compact(loop.initializer),
    },
    mainCount: mains.length,
    resources: {
      browser: binding(server?.tryBlock.statements, "browser"),
      browserFailure: binding(server?.tryBlock.statements, "browserFailure"),
      frames: binding(loopBody, "frames"),
      runs: binding(server?.tryBlock.statements, "runs"),
      server: binding(main?.statements, "server"),
      serverFailure: binding(main?.statements, "serverFailure"),
      session: binding(loopBody, "session"),
      sessionFailure: binding(loopBody, "sessionFailure"),
    },
  };
};

/** Inspect one render playground's browser, page and session cleanup fences. */
const renderBrowserLifecycleContract = (
  file: string,
  source: string,
  functionName: string,
): Array<{
  browser: string | null;
  declarations: Array<{
    count: number;
    initializer: string | null;
    kind: string | null;
    name: string;
    pageArgument: string | null;
  }>;
  directActions: string[];
  outerCatch: boolean;
  outerFinally: string[];
  outerTryActions: string[];
  page: string | null;
  pageCatch: boolean;
  pageFinally: string[];
  pageTryActions: string[];
  sessionCatch: boolean;
  sessionFinally: string[];
  writes: Record<string, string[]>;
}> => {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const compact = (node: ts.Node): string =>
    node.getText(parsed).replace(/\s+/g, "");
  const variable = (
    statements: ts.NodeArray<ts.Statement>,
    name: string,
  ): ts.VariableDeclaration | undefined =>
    statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .find(
        (declaration) =>
          ts.isIdentifier(declaration.name) && declaration.name.text === name,
      );
  const declarationCount = (root: ts.Node, name: string): number => {
    let count = 0;
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name
      )
        ++count;
      ts.forEachChild(node, visit);
    };
    visit(root);
    return count;
  };
  const declarationKind = (
    declaration: ts.VariableDeclaration | undefined,
  ): string | null => {
    const list = declaration?.parent;
    if (list === undefined || ts.isVariableDeclarationList(list) === false)
      return null;
    if ((list.flags & ts.NodeFlags.Const) !== 0) return "const";
    if ((list.flags & ts.NodeFlags.Let) !== 0) return "let";
    return "var";
  };
  const action = (statement: ts.Statement): string => {
    if (ts.isTryStatement(statement)) return "try";
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.length === 1 &&
      ts.isIdentifier(statement.declarationList.declarations[0]!.name)
    )
      return statement.declarationList.declarations[0]!.name.text;
    return compact(statement);
  };
  const contracts: Array<{
    browser: string | null;
    declarations: Array<{
      count: number;
      initializer: string | null;
      kind: string | null;
      name: string;
      pageArgument: string | null;
    }>;
    directActions: string[];
    outerCatch: boolean;
    outerFinally: string[];
    outerTryActions: string[];
    page: string | null;
    pageCatch: boolean;
    pageFinally: string[];
    pageTryActions: string[];
    sessionCatch: boolean;
    sessionFinally: string[];
    writes: Record<string, string[]>;
  }> = [];
  for (const statement of parsed.statements) {
    if (ts.isVariableStatement(statement) === false) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) === false ||
        declaration.name.text !== functionName ||
        declaration.initializer === undefined ||
        ts.isArrowFunction(declaration.initializer) === false ||
        declaration.initializer.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
        ) !== true ||
        ts.isBlock(declaration.initializer.body) === false
      )
        continue;
      const functionBody = declaration.initializer.body;
      const body = functionBody.statements;
      const outerTries = body.filter(ts.isTryStatement);
      const outer = outerTries.length === 1 ? outerTries[0]! : undefined;
      const pageTries =
        outer?.tryBlock.statements.filter(ts.isTryStatement) ?? [];
      const pageTry = pageTries.length === 1 ? pageTries[0]! : undefined;
      const sessionTries =
        pageTry?.tryBlock.statements.filter(ts.isTryStatement) ?? [];
      const sessionTry =
        sessionTries.length === 1 ? sessionTries[0]! : undefined;
      const browser = variable(body, "browser");
      const page =
        outer === undefined
          ? undefined
          : variable(outer.tryBlock.statements, "page");
      const closePage =
        outer === undefined
          ? undefined
          : variable(outer.tryBlock.statements, "closePage");
      const session =
        pageTry === undefined
          ? undefined
          : variable(pageTry.tryBlock.statements, "session");
      const browserFailure = variable(body, "browserFailure");
      const pageFailure =
        outer === undefined
          ? undefined
          : variable(outer.tryBlock.statements, "pageFailure");
      const sessionFailure =
        pageTry === undefined
          ? undefined
          : variable(pageTry.tryBlock.statements, "sessionFailure");
      const tracked = [
        "browser",
        "page",
        "closePage",
        "session",
        "browserFailure",
        "pageFailure",
        "sessionFailure",
      ];
      const writes = Object.fromEntries(
        tracked.map((name) => [name, [] as string[]]),
      );
      const visitWrites = (node: ts.Node): void => {
        const writtenBindings = (target: ts.Expression): string[] => {
          if (ts.isIdentifier(target))
            return tracked.includes(target.text) ? [target.text] : [];
          if (
            ts.isParenthesizedExpression(target) ||
            ts.isAsExpression(target) ||
            ts.isTypeAssertionExpression(target) ||
            ts.isSatisfiesExpression(target) ||
            ts.isNonNullExpression(target)
          )
            return writtenBindings(target.expression);
          if (ts.isPropertyAccessExpression(target))
            return writtenBindings(target.expression);
          if (ts.isElementAccessExpression(target))
            return writtenBindings(target.expression);
          if (ts.isArrayLiteralExpression(target))
            return target.elements.flatMap((element) =>
              ts.isOmittedExpression(element)
                ? []
                : ts.isSpreadElement(element)
                  ? writtenBindings(element.expression)
                  : writtenBindings(element),
            );
          if (ts.isObjectLiteralExpression(target))
            return target.properties.flatMap((property) => {
              if (ts.isShorthandPropertyAssignment(property))
                return tracked.includes(property.name.text)
                  ? [property.name.text]
                  : [];
              if (ts.isPropertyAssignment(property))
                return writtenBindings(property.initializer);
              if (ts.isSpreadAssignment(property))
                return writtenBindings(property.expression);
              return [];
            });
          return [];
        };
        if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        )
          for (const name of new Set(writtenBindings(node.left)))
            writes[name]!.push(compact(node));
        else if (
          (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
          ts.isVariableDeclarationList(node.initializer) === false
        )
          for (const name of new Set(writtenBindings(node.initializer)))
            writes[name]!.push(compact(node));
        else if (
          (ts.isPrefixUnaryExpression(node) ||
            ts.isPostfixUnaryExpression(node)) &&
          (node.operator === ts.SyntaxKind.PlusPlusToken ||
            node.operator === ts.SyntaxKind.MinusMinusToken)
        )
          for (const name of new Set(writtenBindings(node.operand)))
            writes[name]!.push(compact(node));
        ts.forEachChild(node, visitWrites);
      };
      visitWrites(functionBody);
      const bindings = [
        ["browser", browser],
        ["page", page],
        ["closePage", closePage],
        ["session", session],
        ["browserFailure", browserFailure],
        ["pageFailure", pageFailure],
        ["sessionFailure", sessionFailure],
      ] as const;
      const awaitedCall = (
        binding: ts.VariableDeclaration | undefined,
      ): ts.CallExpression | undefined => {
        const initializer = binding?.initializer;
        if (
          initializer === undefined ||
          ts.isAwaitExpression(initializer) === false ||
          ts.isCallExpression(initializer.expression) === false
        )
          return undefined;
        return initializer.expression;
      };
      const pageArgument = (
        binding: ts.VariableDeclaration | undefined,
      ): string | null => {
        const argument = awaitedCall(binding)?.arguments[0];
        if (
          argument === undefined ||
          ts.isObjectLiteralExpression(argument) === false
        )
          return null;
        if (
          argument.properties.some(
            (property) =>
              ts.isSpreadAssignment(property) ||
              (ts.isShorthandPropertyAssignment(property) === false &&
                ts.isComputedPropertyName(property.name)),
          )
        )
          return null;
        const pageProperties = argument.properties.filter(
          (property) =>
            (ts.isShorthandPropertyAssignment(property) ||
              ts.isPropertyAssignment(property) ||
              ts.isMethodDeclaration(property) ||
              ts.isGetAccessorDeclaration(property) ||
              ts.isSetAccessorDeclaration(property)) &&
            (ts.isIdentifier(property.name) ||
              ts.isStringLiteralLike(property.name)) &&
            property.name.text === "page",
        );
        return pageProperties.length === 1 &&
          ts.isShorthandPropertyAssignment(pageProperties[0]!)
          ? pageProperties[0]!.name.text
          : null;
      };
      contracts.push({
        browser:
          browser?.initializer === undefined
            ? null
            : compact(browser.initializer),
        declarations: bindings.map(([name, binding]) => ({
          count: declarationCount(functionBody, name),
          initializer:
            binding?.initializer === undefined
              ? null
              : name === "session" && awaitedCall(binding) !== undefined
                ? compact(awaitedCall(binding)!.expression)
                : compact(binding.initializer),
          kind: declarationKind(binding),
          name,
          pageArgument: name === "session" ? pageArgument(binding) : null,
        })),
        directActions: body.map(action),
        outerCatch: outer?.catchClause !== undefined,
        outerFinally:
          outer?.finallyBlock?.statements.map((statement) =>
            compact(statement),
          ) ?? [],
        outerTryActions: outer?.tryBlock.statements.map(action) ?? [],
        page:
          page?.initializer === undefined ? null : compact(page.initializer),
        pageCatch: pageTry?.catchClause !== undefined,
        pageFinally:
          pageTry?.finallyBlock?.statements.map((statement) =>
            compact(statement),
          ) ?? [],
        pageTryActions: pageTry?.tryBlock.statements.map(action) ?? [],
        sessionCatch: sessionTry?.catchClause !== undefined,
        sessionFinally:
          sessionTry?.finallyBlock?.statements.map((statement) =>
            compact(statement),
          ) ?? [],
        writes,
      });
    }
  }
  return contracts;
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
 * 22. Render harnesses close a successfully launched browser when page creation
 *     fails, without weakening the later page/session ownership handoff.
 * 23. Render session, page, browser, and encoder cleanup retain an earlier
 *     operation failure in deterministic primary-first order.
 * 24. Capture smoke session, browser, and server cleanup use the same failure
 *     precedence without moving successful frames outside their session fence.
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
  const mcpProductionReviewService = readPackageFile(
    "packages",
    "mcp",
    "src",
    "production",
    "AutoMovieProductionReviewService.ts",
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
  const playgroundRenderSources = [
    "render-and-see.ts",
    "render-sequence-and-see.ts",
  ].map((file) => ({
    file,
    source: readPackageFile("packages", "playground", "scripts", file),
  }));
  const playgroundCleanupFailurePolicy = readPackageFile(
    "packages",
    "playground",
    "scripts",
    "preserveCleanupFailure.ts",
  );
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
  TestValidator.equals(
    "render playgrounds preserve exact positive even raster arguments",
    playgroundRenderSources.map(({ file, source }) => ({
      file,
      contract: renderRasterArgumentContract(file, source),
    })),
    playgroundRenderSources.map(({ file }) => ({
      file,
      contract: {
        helper: {
          bodies: [
            [
              "constparsed=positiveNumber(value,fallback,label);",
              "if(!Number.isInteger(parsed)||parsed%2!==0)thrownewError(`" +
                templateExpression("label") +
                "mustbeapositiveeveninteger`);",
              "returnparsed;",
            ],
          ],
          count: 1,
          guards: [
            {
              condition: "!Number.isInteger(parsed)||parsed%2!==0",
              error:
                "`" +
                templateExpression("label") +
                "mustbeapositiveeveninteger`",
            },
          ],
          parameters: [
            ["value:string|undefined", "fallback:number", "label:string"],
          ],
          parsed: ["positiveNumber(value,fallback,label)"],
          returns: ["parsed"],
        },
        legacyHelpers: { even: 0, positiveInteger: 0 },
        numberParser: {
          bodies: [
            [
              "if(value===undefined)returnfallback;",
              "constparsed=Number(value);",
              "if(!Number.isFinite(parsed)||parsed<=0)thrownewError(`" +
                templateExpression("label") +
                "mustbeapositivefinitenumber`);",
              "returnparsed;",
            ],
          ],
          count: 1,
          parameters: [
            ["value:string|undefined", "fallback:number", "label:string"],
          ],
        },
        parseArgs: {
          count: 1,
          dimensions: [
            ["width", 'positiveEvenInteger(flags.width,640,"--width")'],
            ["height", 'positiveEvenInteger(flags.height,360,"--height")'],
          ] as Array<[string, string]>,
          directReturns: 1,
          unsafeProperties: [],
        },
      },
    })),
  );
  TestValidator.equals(
    "render playgrounds fence page creation with browser cleanup",
    playgroundRenderSources.map(({ file, source }) => ({
      file,
      contract: renderBrowserLifecycleContract(
        file,
        source,
        file === "render-and-see.ts"
          ? "captureRenderAndSee"
          : "captureSequenceRenderAndSee",
      ),
    })),
    playgroundRenderSources.map(({ file }) => ({
      file,
      contract: [
        {
          browser:
            "awaitchromium.launch({executablePath:options.chrome,headless:true,})",
          declarations: [
            {
              count: 1,
              initializer:
                "awaitchromium.launch({executablePath:options.chrome,headless:true,})",
              kind: "const",
              name: "browser",
              pageArgument: null,
            },
            {
              count: 1,
              initializer:
                "awaitbrowser.newPage({viewport:{width:options.width,height:options.height},deviceScaleFactor:1,})",
              kind: "const",
              name: "page",
              pageArgument: null,
            },
            {
              count: 1,
              initializer: "true",
              kind: "let",
              name: "closePage",
              pageArgument: null,
            },
            {
              count: 1,
              initializer:
                file === "render-and-see.ts"
                  ? "createHeadlessCaptureAdapter"
                  : "openSequenceCaptureSession",
              kind: "const",
              name: "session",
              pageArgument: "page",
            },
            {
              count: 1,
              initializer: null,
              kind: "let",
              name: "browserFailure",
              pageArgument: null,
            },
            {
              count: 1,
              initializer: null,
              kind: "let",
              name: "pageFailure",
              pageArgument: null,
            },
            {
              count: 1,
              initializer: null,
              kind: "let",
              name: "sessionFailure",
              pageArgument: null,
            },
          ],
          directActions: ["route", "browser", "browserFailure", "try"],
          outerCatch: true,
          outerFinally: [
            `awaitpreserveCleanupFailure(browserFailure,"${
              file === "render-and-see.ts" ? "render" : "sequence"
            }capturebrowser",()=>browser.close(),);`,
          ],
          outerTryActions: [
            "page",
            "captured",
            "closePage",
            "pageFailure",
            "try",
          ],
          page: "awaitbrowser.newPage({viewport:{width:options.width,height:options.height},deviceScaleFactor:1,})",
          pageCatch: true,
          pageFinally: [
            `awaitpreserveCleanupFailure(pageFailure,"${
              file === "render-and-see.ts" ? "render" : "sequence"
            }capturepage",()=>closePage?page.close():undefined,);`,
          ],
          pageTryActions: [
            "session",
            "closePage=false;",
            "sessionFailure",
            "try",
          ],
          sessionCatch: true,
          sessionFinally: [
            `awaitpreserveCleanupFailure(sessionFailure,"${
              file === "render-and-see.ts" ? "render" : "sequence"
            }capturesession",()=>session.close(),);`,
          ],
          writes: {
            browser: [],
            browserFailure: ["browserFailure={error}"],
            closePage: ["closePage=false"],
            page: [],
            pageFailure: ["pageFailure={error}"],
            session: [],
            sessionFailure: ["sessionFailure={error}"],
          },
        },
      ],
    })),
  );
  TestValidator.equals(
    "render playgrounds preserve primary failures during cleanup",
    {
      policy: cleanupFailurePolicyContract(playgroundCleanupFailurePolicy),
      renderers: playgroundRenderSources.map(({ file, source }) => ({
        file,
        contract: renderCleanupFailureContract(file, source),
      })),
    },
    {
      policy: {
        bodies: [
          [
            "try{awaitcleanup();}catch(cleanupError){if(failure===undefined)throwcleanupError;thrownewAggregateError([failure.error,cleanupError],`" +
              templateExpression("resource") +
              "cleanupfailedaftertheoperationfailed.`,);}",
          ],
        ],
        parameters: [
          [
            "failure:IAutoMoviePlaygroundOperationFailure|undefined",
            "resource:string",
            "cleanup:()=>unknown",
          ],
        ],
      },
      renderers: playgroundRenderSources.map(({ file }) => {
        const prefix = file === "render-and-see.ts" ? "render" : "sequence";
        return {
          file,
          contract: {
            imports: 1,
            lifecycles: [
              {
                catchActions: ["browserFailure={error};", "throwerror;"],
                catchParameter: "error",
                finallyActions: [
                  `awaitpreserveCleanupFailure(browserFailure,"${prefix}capturebrowser",()=>browser.close(),);`,
                ],
                tryMarkers: [],
              },
              {
                catchActions: ["encoderFailure={error};", "throwerror;"],
                catchParameter: "error",
                finallyActions: [
                  `awaitpreserveCleanupFailure(encoderFailure,"${prefix}H.264encoder",()=>encoder.delete(),);`,
                ],
                tryMarkers: ["encoder.initialize();"],
              },
              {
                catchActions: ["pageFailure={error};", "throwerror;"],
                catchParameter: "error",
                finallyActions: [
                  `awaitpreserveCleanupFailure(pageFailure,"${prefix}capturepage",()=>closePage?page.close():undefined,);`,
                ],
                tryMarkers: [],
              },
              {
                catchActions: ["sessionFailure={error};", "throwerror;"],
                catchParameter: "error",
                finallyActions: [
                  `awaitpreserveCleanupFailure(sessionFailure,"${prefix}capturesession",()=>session.close(),);`,
                ],
                tryMarkers: [],
              },
            ],
          },
        };
      }),
    },
  );
  TestValidator.equals(
    "capture smoke preserves primary failures during nested cleanup",
    captureSmokeCleanupContract(playgroundCaptureSmoke),
    {
      imports: 1,
      lifecycles: {
        browser: {
          catchActions: ["browserFailure={error};", "throwerror;"],
          catchParameter: "error",
          finallyActions: [
            'awaitpreserveCleanupFailure(browserFailure,"capturesmokebrowser",()=>browser.close(),);',
          ],
          tryActions: ["for(letrun=0;run<2;++run)"],
        },
        server: {
          catchActions: ["serverFailure={error};", "throwerror;"],
          catchParameter: "error",
          finallyActions: [
            'awaitpreserveCleanupFailure(serverFailure,"capturesmokedevserver",()=>server.close(),);',
          ],
          tryActions: [
            "runs",
            "browser",
            "browserFailure",
            "try",
            "checks",
            "names",
            "for(constnameofnames)checks[`deterministic${name}`]=equalBytes(requireCapturedFrame(runs,0,name),requireCapturedFrame(runs,1,name),);",
            "mask",
            "pose",
            "total",
            "subject",
            "subjectKey",
            "maskSubjectPixels",
            "maskBlackPixels",
            "poseWhitePixels",
            "poseMaskPalettePixels",
            "observations",
            'checks["masksubjectcolorcovers>=0.3%oftheframe"]=observations.maskSubjectFraction>=0.003;',
            'checks["maskbackgroundisdominantblack"]=observations.maskBlackFraction>=0.25;',
            'checks["poseskeletondrawswhitelines(0.02%..20%)"]=observations.poseWhiteFraction>=0.0002&&observations.poseWhiteFraction<=0.2;',
            'checks["posecarriesnomaskpalette"]=observations.poseMaskPalettePixels===0;',
            'checks["beautydiffersfrommask(passesactuallyswitch)"]=!equalBytes(requireCapturedFrame(runs,0,"frame_00000.png"),requireCapturedFrame(runs,0,"frame_00000.mask.png"),);',
            "failed",
            'console.log(JSON.stringify({route,server:server.spawned?"spawned":"reused",checks,observations,},null,2,),);',
            'if(failed.length>0)thrownewError(`capturesmokefailed:${failed.map(([name])=>name).join(";")};observations=${JSON.stringify(observations)}`,);',
          ],
        },
        session: {
          catchActions: ["sessionFailure={error};", "throwerror;"],
          catchParameter: "error",
          finallyActions: [
            'awaitpreserveCleanupFailure(sessionFailure,"capturesmokesession",()=>session.close(),);',
          ],
          tryActions: [
            'awaitsession.captureFrame(0,0,"smoke");',
            "runs.push(frames);",
          ],
        },
      },
      loop: {
        bodyActions: ["page", "frames", "session", "sessionFailure", "try"],
        condition: "run<2",
        count: 1,
        incrementor: "++run",
        initializer: "letrun=0",
      },
      mainCount: 1,
      resources: {
        browser: {
          count: 1,
          initializer:
            "awaitchromium.launch({executablePath:chrome,headless:true,})",
        },
        browserFailure: { count: 1, initializer: null },
        frames: { count: 1, initializer: "newMap<string,Uint8Array>()" },
        runs: {
          count: 1,
          initializer: "[]",
        },
        server: { count: 1, initializer: "awaitensureDevServer(base)" },
        serverFailure: { count: 1, initializer: null },
        session: {
          count: 1,
          initializer:
            'awaitcreateHeadlessCaptureAdapter({page,url:route,passes:["beauty","mask","pose"],writeFrame:async(file,bytes)=>{frames.set(path.basename(file),bytes);},})',
        },
        sessionFailure: { count: 1, initializer: null },
      },
    },
  );
  const canonicalAssetViews: Array<Array<[string, string]>> = [
    [
      ["id", '"turntable-front"'],
      ["angleDeg", "0"],
      ["elevationDeg", "15"],
      ["pose", '"rest"'],
      ["pass", '"beauty"'],
    ],
    [
      ["id", '"turntable-right"'],
      ["angleDeg", "90"],
      ["elevationDeg", "15"],
      ["pose", '"rest"'],
      ["pass", '"beauty"'],
    ],
    [
      ["id", '"turntable-back"'],
      ["angleDeg", "180"],
      ["elevationDeg", "15"],
      ["pose", '"rest"'],
      ["pass", '"beauty"'],
    ],
    [
      ["id", '"turntable-left"'],
      ["angleDeg", "270"],
      ["elevationDeg", "15"],
      ["pose", '"rest"'],
      ["pass", '"beauty"'],
    ],
    [
      ["id", '"top-outline"'],
      ["angleDeg", "0"],
      ["elevationDeg", "65"],
      ["pose", '"rest"'],
      ["pass", '"outline"'],
    ],
  ];
  const riggedAssetViews: Array<Array<[string, string]>> = [
    [
      ["id", '"rig-rom-extremes"'],
      ["angleDeg", "0"],
      ["elevationDeg", "15"],
      ["pose", '"rom-extremes"'],
      ["pass", '"beauty"'],
    ],
  ];
  TestValidator.equals(
    "packaged review captures every queued canonical asset view",
    packagedAssetReviewContract(tgzE2e, mcpProductionReviewService),
    {
      aligned: true,
      canonical: {
        conditionals: [
          {
            condition: "model.skeleton===null",
            whenFalse: riggedAssetViews,
            whenTrue: [],
          },
        ],
        declarations: 1,
        spreads: [
          '...(model.skeleton===null?[]:[{id:"rig-rom-extremes",angleDeg:0,elevationDeg:15,pose:"rom-extremes"asconst,pass:"beauty"asconst,},])',
        ],
        views: canonicalAssetViews,
      },
      captureLoops: [
        {
          assetGuard: 'if(entry.target.kind!=="asset")continue;',
          assertion: {
            condition:
              'captured.captured&&captured.reviewTarget?.kind==="asset"&&captured.reviewTarget.id===entry.target.id&&captured.receipt!==null&&captured.frame?.width===16&&captured.frame.height===16&&captured.diagnostics.every((item)=>item.category!=="error")',
            detail: "JSON.stringify(captured.diagnostics)",
            name:
              "`starter-asset-view-captured:" +
              templateExpression("entry.target.id") +
              ":" +
              templateExpression("view.id") +
              "`",
          },
          bodyStatementCount: 2,
          capture:
            'awaitapp.captureFrame({target:{kind:"asset",id:entry.target.id,angleDeg:view.angleDeg,elevationDeg:view.elevationDeg,pose:view.pose,pass:view.pass,},})',
          expression: "packagedAssetReviewViews(model)",
          initializer: "constview",
          model: "compiledModels.get(entry.target.id)",
          modelAssertion: {
            condition: "model!==undefined",
            detail: '"reviewqueueassetisabsentfromthecurrentmodelgraph"',
            name:
              "`starter-asset-model-current:" +
              templateExpression("entry.target.id") +
              "`",
          },
          modelInventory:
            'newMap(compiled.assets.map((entry)=>[entry.id,JSON.parse(Buffer.from(project.readGeneratedFile(entry.path)).toString("utf8")),]))',
          outerBodyStatementCount: 4,
          outerExpression: "before.reviews.entries",
          outerInitializer: "constentry",
        },
      ],
      captureHost: {
        applications: [
          "newAutoMovieApplication({projectRoot:root,capture:captureProductionFrame,})",
        ],
        assertionFailures: [
          "thrownewError(`✗" +
            templateExpression("name") +
            ":" +
            templateExpression("detail") +
            "`);",
        ],
        cleanup: [
          {
            catch: false,
            finally: ["awaitcloseProductionFrameCapture();"],
          },
        ],
        imports: [
          {
            module: '"./scripts/capture.ts"',
            names: ["captureProductionFrame", "closeProductionFrameCapture"],
          },
        ],
        verifierCommands: [
          "npm exec -- tsx verify-packaged-starter.mjs review",
          "npm exec -- tsx verify-packaged-starter.mjs final",
        ],
      },
      embeddedScripts: 1,
      guideLoops: [
        {
          body: "app.getGuideDocument({name});",
          expression:
            'newSet([...Object.values(AUTOMOVIE_REVIEW_GUIDES),"CAPTURE_FRAME"])',
          initializer: "constname",
        },
      ],
      packaged: {
        conditionals: [
          {
            condition: "model.skeleton===null",
            whenFalse: riggedAssetViews,
            whenTrue: [],
          },
        ],
        declarations: 1,
        spreads: [
          '...(model.skeleton===null?[]:[{id:"rig-rom-extremes",angleDeg:0,elevationDeg:15,pose:"rom-extremes",pass:"beauty",},])',
        ],
        views: canonicalAssetViews,
      },
      reviewFlows: [{ before: 0, capture: 4, models: 3, views: 2 }],
      reviewPhases: 1,
    },
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
