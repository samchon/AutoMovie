import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node
    .getText(source)
    .replace(/\/\/[^\r\n]*/g, "")
    .replace(/\s+/g, "");

const action = (statement: ts.Statement, source: ts.SourceFile): string => {
  if (
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.length === 1 &&
    ts.isIdentifier(statement.declarationList.declarations[0]!.name)
  )
    return statement.declarationList.declarations[0]!.name.text;
  if (ts.isTryStatement(statement)) return "try";
  if (ts.isIfStatement(statement)) return "if";
  if (ts.isForOfStatement(statement)) return "for";
  if (ts.isExpressionStatement(statement)) {
    const expression = ts.isAwaitExpression(statement.expression)
      ? statement.expression.expression
      : statement.expression;
    if (ts.isCallExpression(expression))
      return compact(expression.expression, source);
  }
  return compact(statement, source);
};

interface ICaptureHeadCleanupContract {
  cleanupCalls: Array<{
    call: string;
    failure: string | null;
    resource: string | null;
  }>;
  fences: Array<{
    catch: string | null;
    finally: string;
    resource: string | null;
    tryActions: string[];
  }>;
  imports: string[];
  topLevelActions: string[];
}

/** Bind root preparation and complete page/browser cleanup ownership. */
const captureHeadCleanupContract = (
  text: string,
): ICaptureHeadCleanupContract => {
  const source = ts.createSourceFile(
    "packages/playground/scripts/capture-head.mjs",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const imports = source.statements.flatMap((statement) =>
    ts.isImportDeclaration(statement) &&
    compact(statement.moduleSpecifier, source) ===
      '"./preserveCleanupFailure.mjs"'
      ? [compact(statement, source)]
      : [],
  );
  const topLevelActions: string[] = [];
  let lifecycleStarted = false;
  for (const statement of source.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      compact(statement, source) === "cleanDir(outDir);"
    )
      lifecycleStarted = true;
    if (lifecycleStarted) topLevelActions.push(action(statement, source));
  }

  const cleanupCalls: ICaptureHeadCleanupContract["cleanupCalls"] = [];
  const fences: ICaptureHeadCleanupContract["fences"] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTryStatement(node) && node.finallyBlock !== undefined) {
      const policy = node.finallyBlock.statements
        .filter(ts.isExpressionStatement)
        .map((statement) =>
          ts.isAwaitExpression(statement.expression)
            ? statement.expression.expression
            : statement.expression,
        )
        .find(
          (expression): expression is ts.CallExpression =>
            ts.isCallExpression(expression) &&
            ts.isIdentifier(expression.expression) &&
            expression.expression.text === "preserveCleanupFailure",
        );
      if (policy !== undefined)
        fences.push({
          catch:
            node.catchClause === undefined
              ? null
              : compact(node.catchClause, source),
          finally: compact(node.finallyBlock, source),
          resource:
            policy.arguments[1] === undefined
              ? null
              : compact(policy.arguments[1], source),
          tryActions: node.tryBlock.statements.map((statement) =>
            action(statement, source),
          ),
        });
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "close"
    ) {
      let cursor: ts.Node | undefined = node;
      let owner: ts.CallExpression | undefined;
      while (cursor !== undefined) {
        if (
          ts.isArrowFunction(cursor) &&
          ts.isCallExpression(cursor.parent) &&
          cursor.parent.arguments[2] === cursor &&
          ts.isIdentifier(cursor.parent.expression) &&
          cursor.parent.expression.text === "preserveCleanupFailure"
        ) {
          owner = cursor.parent;
          break;
        }
        cursor = cursor.parent;
      }
      cleanupCalls.push({
        call: compact(node, source),
        failure:
          owner?.arguments[0] === undefined
            ? null
            : compact(owner.arguments[0], source),
        resource:
          owner?.arguments[1] === undefined
            ? null
            : compact(owner.arguments[1], source),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { cleanupCalls, fences, imports, topLevelActions };
};

/** Head capture releases its page and browser without losing primary errors. */
export const test_workspace_capture_head_cleanup = (): void => {
  const source = fs.readFileSync(
    path.join(ROOT, "packages", "playground", "scripts", "capture-head.mjs"),
    "utf8",
  );
  TestValidator.equals(
    "capture head fences page and browser cleanup",
    captureHeadCleanupContract(source),
    {
      cleanupCalls: [
        {
          call: "page.close()",
          failure: "pageFailure",
          resource: '"captureheadpage"',
        },
        {
          call: "browser.close()",
          failure: "browserFailure",
          resource: '"captureheadbrowser"',
        },
      ],
      fences: [
        {
          catch: "catch(error){browserFailure={error};throwerror;}",
          finally:
            '{awaitpreserveCleanupFailure(browserFailure,"captureheadbrowser",()=>browser.close(),);}',
          resource: '"captureheadbrowser"',
          tryActions: ["page", "pageFailure", "try"],
        },
        {
          catch: "catch(error){pageFailure={error};throwerror;}",
          finally:
            '{awaitpreserveCleanupFailure(pageFailure,"captureheadpage",()=>page.close(),);}',
          resource: '"captureheadpage"',
          tryActions: [
            "page.goto",
            "page.waitForFunction",
            "page.addStyleTag",
            "settle",
            "if",
            "page.evaluate",
            "settle",
            "for",
            "page.evaluate",
            "settle",
            "fs.writeFileSync",
          ],
        },
      ],
      imports: [
        'import{preserveCleanupFailure}from"./preserveCleanupFailure.mjs";',
      ],
      topLevelActions: [
        "cleanDir",
        "browser",
        "browserFailure",
        "try",
        "console.log",
      ],
    },
  );
};
