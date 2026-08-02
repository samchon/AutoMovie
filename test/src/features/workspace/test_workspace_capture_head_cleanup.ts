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
  declarations: Array<{
    initializer: string | null;
    kind: "const" | "let" | "var";
    name: string;
    owner: string | null;
  }>;
  failureWrites: string[];
  fences: Array<{
    catch: string | null;
    finally: string;
    resource: string | null;
    tryActions: string[];
  }>;
  imports: string[];
  operationCalls: Array<{ call: string; owner: string | null }>;
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
  const declarations: ICaptureHeadCleanupContract["declarations"] = [];
  const failureWrites: string[] = [];
  const fences: ICaptureHeadCleanupContract["fences"] = [];
  const operationCalls: ICaptureHeadCleanupContract["operationCalls"] = [];
  const cleanupPolicy = (node: ts.TryStatement): ts.CallExpression | null =>
    node.finallyBlock?.statements
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
      ) ?? null;
  const resourceOf = (node: ts.TryStatement): string | null => {
    const policy = cleanupPolicy(node);
    return policy?.arguments[1] === undefined
      ? null
      : compact(policy.arguments[1], source);
  };
  const owningFence = (node: ts.Node): string | null => {
    let cursor: ts.Node | undefined = node;
    while (cursor?.parent !== undefined) {
      if (
        ts.isArrowFunction(cursor) &&
        ts.isPropertyAssignment(cursor.parent) &&
        ts.isIdentifier(cursor.parent.name) &&
        cursor.parent.name.text === "screenshot"
      )
        return '"modecallback"';
      if (
        ts.isBlock(cursor.parent) &&
        ts.isTryStatement(cursor.parent.parent) &&
        cursor.parent.parent.tryBlock === cursor.parent
      )
        return resourceOf(cursor.parent.parent);
      cursor = cursor.parent;
    }
    return null;
  };
  const isFailureTarget = (node: ts.Node): boolean => {
    const target = compact(node, source);
    return ["browserFailure", "pageFailure"].some(
      (name) =>
        target === name ||
        target.startsWith(`${name}.`) ||
        target.startsWith(`${name}[`) ||
        target.includes(name),
    );
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      ["browser", "browserFailure", "page", "pageFailure"].includes(
        node.name.text,
      ) &&
      ts.isVariableDeclarationList(node.parent) &&
      ts.isVariableStatement(node.parent.parent)
    )
      declarations.push({
        initializer:
          node.initializer === undefined
            ? null
            : compact(node.initializer, source),
        kind:
          node.parent.flags & ts.NodeFlags.Const
            ? "const"
            : node.parent.flags & ts.NodeFlags.Let
              ? "let"
              : "var",
        name: node.name.text,
        owner: owningFence(node),
      });
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer !== undefined &&
      isFailureTarget(node.name)
    )
      failureWrites.push(compact(node, source));
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      isFailureTarget(node.left)
    )
      failureWrites.push(compact(node, source));
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      isFailureTarget(node.operand)
    )
      failureWrites.push(compact(node, source));
    if (
      (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
      isFailureTarget(node.initializer)
    )
      failureWrites.push(compact(node.initializer, source));
    if (ts.isDeleteExpression(node) && isFailureTarget(node.expression))
      failureWrites.push(compact(node, source));
    if (ts.isTryStatement(node) && node.finallyBlock !== undefined) {
      const policy = cleanupPolicy(node);
      if (policy !== null)
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
    if (ts.isCallExpression(node)) {
      const callee = compact(node.expression, source);
      if (
        [
          "browser.newPage",
          "cleanDir",
          "fs.writeFileSync",
          "mode.screenshot",
          "page.addStyleTag",
          "page.evaluate",
          "page.goto",
          "page.waitForFunction",
          "settle",
        ].includes(callee) ||
        (callee.startsWith("page.locator(") && callee.endsWith(").screenshot"))
      )
        operationCalls.push({
          call: compact(node, source),
          owner: owningFence(node),
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
  return {
    cleanupCalls,
    declarations,
    failureWrites,
    fences,
    imports,
    operationCalls,
    topLevelActions,
  };
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
      declarations: [
        {
          initializer:
            "awaitchromium.launch({executablePath:CHROME,headless:true,})",
          kind: "const",
          name: "browser",
          owner: null,
        },
        {
          initializer: null,
          kind: "let",
          name: "browserFailure",
          owner: null,
        },
        {
          initializer:
            "awaitbrowser.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1,})",
          kind: "const",
          name: "page",
          owner: '"captureheadbrowser"',
        },
        {
          initializer: null,
          kind: "let",
          name: "pageFailure",
          owner: '"captureheadbrowser"',
        },
      ],
      failureWrites: ["pageFailure={error}", "browserFailure={error}"],
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
      operationCalls: [
        {
          call: 'page.locator("#view").screenshot({type:"png"})',
          owner: '"modecallback"',
        },
        {
          call: 'page.locator("#view").screenshot({type:"png"})',
          owner: '"modecallback"',
        },
        {
          call: 'page.locator("#viewport").screenshot({type:"png"})',
          owner: '"modecallback"',
        },
        {
          call: "cleanDir(outDir)",
          owner: null,
        },
        {
          call: "browser.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1,})",
          owner: '"captureheadbrowser"',
        },
        {
          call: 'page.goto(`${BASE}/head.html`,{waitUntil:"load"})',
          owner: '"captureheadpage"',
        },
        {
          call: "page.waitForFunction(()=>window.__faceEditor?.setView&&window.__faceEditor?.setOverlay&&window.__faceEditor?.setCutaway,)",
          owner: '"captureheadpage"',
        },
        {
          call: "page.addStyleTag({content:`#panel,#strip,#hud{display:none!important;}#stage{grid-template-columns:1fr!important;}#workbench{grid-template-rows:1fr!important;}`,})",
          owner: '"captureheadpage"',
        },
        {
          call: "page.evaluate(()=>newPromise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)),),)",
          owner: '"captureheadpage"',
        },
        {
          call: "page.evaluate(()=>{window.__noSculpt=true;})",
          owner: '"captureheadpage"',
        },
        {
          call: "page.evaluate((preset)=>window.__faceEditor.setPreset(preset),PRESET,)",
          owner: '"captureheadpage"',
        },
        {
          call: "settle()",
          owner: '"captureheadpage"',
        },
        {
          call: "cleanDir(modeDir)",
          owner: '"captureheadpage"',
        },
        {
          call: 'page.evaluate(([nextView,overlay,cutaway])=>{window.__faceEditor.setOverlay(overlay);window.__faceEditor.setView(nextView);window.__faceEditor.setCutaway(cutaway);},[view,mode.overlay,mode.cutaway==="view"?cutawayForView(view):mode.cutaway,],)',
          owner: '"captureheadpage"',
        },
        {
          call: "settle()",
          owner: '"captureheadpage"',
        },
        {
          call: "mode.screenshot(page)",
          owner: '"captureheadpage"',
        },
        {
          call: "fs.writeFileSync(path.join(modeDir,`${view}.png`),buf)",
          owner: '"captureheadpage"',
        },
        {
          call: 'page.evaluate(()=>{window.__faceEditor.setOverlay(0);window.__faceEditor.setView("front");})',
          owner: '"captureheadpage"',
        },
        {
          call: "settle()",
          owner: '"captureheadpage"',
        },
        {
          call: 'fs.writeFileSync(path.join(shotsDir,"head-latest.png"),awaitpage.locator("#view").screenshot({type:"png"}),)',
          owner: '"captureheadpage"',
        },
        {
          call: 'page.locator("#view").screenshot({type:"png"})',
          owner: '"captureheadpage"',
        },
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
