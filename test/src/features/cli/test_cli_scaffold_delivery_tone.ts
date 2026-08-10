import { renderScaffold } from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import ts from "typescript-compiler";

/**
 * The capture host and the viewer page agree on one delivery tone curve.
 *
 * `IAutoMovieRenderSpec.toneMapping` is the delivery default for a scene that
 * declares no environment of its own, and the viewer cannot read a render spec:
 * it only ever sees the page it was opened with. So the curve travels on the
 * URL, and the whole contract is that the value the capture host puts there is
 * one the page accepts. Miss that by a spelling and nothing breaks loudly — the
 * page falls back to `undefined`, `applyRendererEnvironment` leaves the
 * renderer's own curve alone, and every delivered frame is photographed under a
 * curve nobody chose.
 *
 * The rendered scaffold is the surface under test, not the template, because a
 * generated project is what actually renders.
 *
 * Scenarios:
 *
 * 1. The capture host declares exactly one delivery curve, and it is a member of
 *    the closed union the render spec states.
 * 2. The shot page's URL carries that curve as `tone`, and the turntable page's
 *    does not: an isolated model honors no delivery, so a parameter there would
 *    name something nothing reads.
 * 3. The shot and film viewer pages both parse `tone`, and the set of values they
 *    accept contains the value the capture host sends.
 * 4. The curve is part of the capture page identity, so a page drawn under one
 *    delivery is never reused to serve another.
 * 5. The render job re-reads a committed bundle manifest and refuses when the
 *    curve it requested is not the curve the render spec sealed, which is what
 *    stops the two spellings drifting apart in silence.
 */
export const test_cli_scaffold_delivery_tone = (): void => {
  const files = renderScaffold({ name: "tone-film" });
  const capture = files["scripts/capture.ts"]!;
  const render = files["scripts/render.ts"]!;

  const declared = declaredToneMapping(capture);
  TestValidator.equals(
    "the capture host declares exactly one delivery curve from the closed union",
    {
      declarations: declared.length,
      value: declared[0],
      member: ["none", "acesFilmic"].includes(declared[0] ?? ""),
    },
    { declarations: 1, value: "none", member: true },
  );

  const branches = capturePageBranches(capture);
  TestValidator.equals(
    "the shot page carries the delivery curve and the turntable page does not",
    branches,
    {
      shot: ["shot", "tone"],
      asset: ["asset", "elevation", "pose"],
    },
  );

  const accepted = (page: "shot" | "film"): string[] =>
    acceptedToneValues(files[`viewer/src/${page}.ts`]!);
  TestValidator.equals(
    "both viewer pages accept exactly the curve the capture host sends",
    {
      shot: accepted("shot"),
      film: accepted("film"),
      shotAccepts: accepted("shot").includes(declared[0] ?? ""),
      filmAccepts: accepted("film").includes(declared[0] ?? ""),
    },
    {
      shot: ["acesFilmic", "none"],
      film: ["acesFilmic", "none"],
      shotAccepts: true,
      filmAccepts: true,
    },
  );

  TestValidator.equals(
    "the delivery curve is part of the identity that decides page reuse",
    capturePageKeyFields(capture),
    [
      "subject",
      "productionId",
      "compileFingerprint",
      "toneMapping",
      "width",
      "height",
    ],
  );

  TestValidator.equals(
    "the render job refuses a manifest whose sealed curve is not the one it asked for",
    {
      comparisons: toneDriftComparisons(render),
      called: render.includes(
        "assertCapturedDeliveryToneMapping(project, frames)",
      ),
      unverifiable: render.includes(
        "committed no verifiable render bundle, so the delivery tone mapping",
      ),
    },
    {
      comparisons: [
        // A frame that produced no receipt names no bundle, and a bundle that
        // does not verify is not evidence about anything, so both are skipped
        // before the drift comparison. Reaching the end of the walk without one
        // is what makes "checked nothing" a refusal rather than a pass.
        ["frame.receipt", "===", "null"],
        ["manifest", "===", "null"],
        [
          "manifest.renderSpec.toneMapping",
          "===",
          "PRODUCTION_DELIVERY_TONE_MAPPING",
        ],
      ],
      called: true,
      unverifiable: true,
    },
  );
};

/**
 * Every strict comparison the drift assertion makes, as operand text.
 *
 * Read from the syntax rather than matched as a source substring, so wrapping
 * the expression differently does not turn the guard red while leaving the
 * behaviour it guards untouched.
 */
const toneDriftComparisons = (text: string): string[][] => {
  const source = parse("scripts/render.ts", text);
  const comparisons: string[][] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "assertCapturedDeliveryToneMapping"
    ) {
      const collect = (current: ts.Node): void => {
        if (
          ts.isBinaryExpression(current) &&
          (current.operatorToken.kind ===
            ts.SyntaxKind.ExclamationEqualsEqualsToken ||
            current.operatorToken.kind ===
              ts.SyntaxKind.EqualsEqualsEqualsToken)
        )
          comparisons.push([
            compact(current.left, source),
            current.operatorToken.getText(source),
            compact(current.right, source),
          ]);
        ts.forEachChild(current, collect);
      };
      collect(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return comparisons;
};

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

/** Every string literal the capture host declares as its delivery curve. */
const declaredToneMapping = (text: string): string[] => {
  const source = parse("scripts/capture.ts", text);
  const values: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "PRODUCTION_DELIVERY_TONE_MAPPING" &&
      node.initializer !== undefined &&
      ts.isStringLiteral(node.initializer)
    )
      values.push(node.initializer.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
};

/**
 * The search parameters each capture-page branch sets, in the order it sets
 * them.
 *
 * Read from the `if (input.target.kind === "shot")` statement rather than from
 * the file as a whole, so the case actually distinguishes the two pages instead
 * of asserting that the word `tone` appears somewhere.
 */
const capturePageBranches = (
  text: string,
): { shot: string[]; asset: string[] } => {
  const source = parse("scripts/capture.ts", text);
  let branches: { shot: string[]; asset: string[] } | null = null;
  const visit = (node: ts.Node): void => {
    if (
      branches === null &&
      ts.isIfStatement(node) &&
      node.expression
        .getText(source)
        .includes('input.target.kind === "shot"') &&
      node.elseStatement !== undefined
    )
      branches = {
        shot: searchParams(node.thenStatement, source),
        asset: searchParams(node.elseStatement, source),
      };
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (branches === null)
    throw new Error(
      "scripts/capture.ts no longer branches its viewer URL on the target kind",
    );
  return branches;
};

const searchParams = (node: ts.Node, source: ts.SourceFile): string[] => {
  const names: string[] = [];
  const visit = (current: ts.Node): void => {
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      current.expression.name.text === "set" &&
      current.expression.expression.getText(source).endsWith("searchParams") &&
      current.arguments[0] !== undefined &&
      ts.isStringLiteral(current.arguments[0])
    )
      names.push(current.arguments[0].text);
    ts.forEachChild(current, visit);
  };
  visit(node);
  return names;
};

/** Every literal one viewer page compares its `tone` parameter against. */
const acceptedToneValues = (text: string): string[] => {
  const source = parse("viewer/src/page.ts", text);
  const values = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      node.left.getText(source) === "requestedTone" &&
      ts.isStringLiteral(node.right)
    )
      values.add(node.right.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...values].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
};

/** The fields of the object literal that keys one reusable capture page. */
const capturePageKeyFields = (text: string): string[] => {
  const source = parse("scripts/capture.ts", text);
  let fields: string[] | null = null;
  const visit = (node: ts.Node): void => {
    if (
      fields === null &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "capturePageKey"
    ) {
      const literals: string[] = [];
      const collect = (current: ts.Node): void => {
        if (literals.length === 0 && ts.isObjectLiteralExpression(current))
          literals.push(
            ...current.properties.flatMap((property) =>
              property.name === undefined
                ? []
                : [property.name.getText(source)],
            ),
          );
        ts.forEachChild(current, collect);
      };
      collect(node);
      fields = literals;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (fields === null)
    throw new Error("scripts/capture.ts no longer keys its reusable pages");
  return fields;
};

const parse = (name: string, text: string): ts.SourceFile =>
  ts.createSourceFile(
    name,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
