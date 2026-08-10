import { renderScaffold } from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import ts from "typescript-compiler";

/**
 * Every scaffold viewer page answers the whole capture hook.
 *
 * The hook is the only thing a headless capture can ask a page, and nothing in
 * this suite type-checks the generated viewer, so a member added to one page
 * and forgotten on another compiles nowhere and fails at capture time as
 * `undefined is not a function`. That is not hypothetical: a curve added to the
 * shot page and referenced from the film page shipped as an unresolved
 * identifier in exactly this blind spot.
 *
 * The contract is member-for-member with `IAutoMovieCaptureHook`, read from the
 * interface rather than from a list written here, so extending the hook is one
 * edit and forgetting a page is a red case.
 *
 * The rendered scaffold is the surface under test, not the template, because a
 * generated project is what actually captures.
 *
 * Scenarios:
 *
 * 1. The three viewer entry points each assign `window.__automovieCapture` exactly
 *    once, with an object literal rather than a value assembled somewhere the
 *    check cannot read.
 * 2. Each of those literals declares exactly the members `IAutoMovieCaptureHook`
 *    declares: no page is missing one, and no page invents one the type does
 *    not carry.
 * 3. The hook declares the two evidence members this cycle added beside `ready`
 *    and `seek`, so the guard would notice them being dropped as readily as it
 *    notices a page falling behind them.
 */
export const test_cli_scaffold_viewer_capture_hook = (): void => {
  const files = renderScaffold({ name: "hook-film" });
  const declared = hookMembers(files["viewer/src/viewerDocument.ts"]!);

  TestValidator.equals(
    "the hook carries the seek contract and the evidence beside it",
    declared,
    ["observe", "ready", "seek", "sidecar"],
  );

  const pages = ["asset", "film", "shot"] as const;
  TestValidator.equals(
    "every viewer entry point answers the whole hook, exactly once",
    pages.map((page) => ({
      page,
      ...assignedHook(files[`viewer/src/${page}.ts`]!, page),
    })),
    pages.map((page) => ({
      page,
      assignments: 1,
      members: declared,
    })),
  );
};

/** Member names `IAutoMovieCaptureHook` declares, ascending. */
const hookMembers = (text: string): string[] => {
  const source = parse("viewer/src/viewerDocument.ts", text);
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isInterfaceDeclaration(node) &&
      node.name.text === "IAutoMovieCaptureHook"
    )
      for (const member of node.members)
        if (member.name !== undefined && ts.isIdentifier(member.name))
          names.push(member.name.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (names.length === 0)
    throw new Error(
      "viewer/src/viewerDocument.ts no longer declares IAutoMovieCaptureHook",
    );
  return names.sort(compareNames);
};

/**
 * Every `window.__automovieCapture = { ... }` assignment one page makes, and
 * the members of the last one, ascending.
 *
 * Read from the assignment's own object literal rather than from the file text,
 * so a page that renames a local or reorders its members stays green while a
 * page that stops answering a member goes red.
 */
const assignedHook = (
  text: string,
  page: string,
): { assignments: number; members: string[] } => {
  const source = parse(`viewer/src/${page}.ts`, text);
  let assignments = 0;
  let members: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      node.left.getText(source) === "window.__automovieCapture"
    ) {
      ++assignments;
      if (ts.isObjectLiteralExpression(node.right) === false)
        throw new Error(
          `viewer/src/${page}.ts assigns the capture hook from something this guard cannot read`,
        );
      members = node.right.properties.flatMap((property) =>
        property.name !== undefined && ts.isIdentifier(property.name)
          ? [property.name.text]
          : [],
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { assignments, members: members.sort(compareNames) };
};

const parse = (name: string, text: string): ts.SourceFile =>
  ts.createSourceFile(name, text, ts.ScriptTarget.ESNext, true);

const compareNames = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
