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

interface ICaptureShotsCleanupContract {
  cleanupCalls: Array<{
    call: string;
    failure: string | null;
    resource: string | null;
  }>;
  fences: Array<{ catch: string | null; finally: string }>;
  functions: Record<
    "capture" | "preserveCleanupFailure",
    Array<{
      async: boolean;
      body: string;
      exported: boolean;
      parameters: string[];
    }>
  >;
  imports: string[];
  policyCalls: string[][];
  topLevelActions: string[];
}

/** Bind direct-script encoder, page, and browser cleanup ownership. */
const captureShotsCleanupContract = (
  captureText: string,
  policyText: string,
): ICaptureShotsCleanupContract => {
  const capture = ts.createSourceFile(
    "packages/playground/scripts/capture-shots.mjs",
    captureText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const policy = ts.createSourceFile(
    "packages/playground/scripts/preserveCleanupFailure.mjs",
    policyText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const functions: ICaptureShotsCleanupContract["functions"] = {
    capture: [],
    preserveCleanupFailure: [],
  };
  const collectFunction = (
    source: ts.SourceFile,
    name: keyof typeof functions,
  ): void => {
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name &&
        node.initializer !== undefined &&
        ts.isArrowFunction(node.initializer)
      )
        functions[name].push({
          async:
            node.initializer.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
            ) === true,
          body: compact(node.initializer.body, source),
          exported:
            ts.isVariableDeclarationList(node.parent) &&
            ts.isVariableStatement(node.parent.parent) &&
            node.parent.parent.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
            ) === true,
          parameters: node.initializer.parameters.map((parameter) =>
            compact(parameter, source),
          ),
        });
      ts.forEachChild(node, visit);
    };
    visit(source);
  };
  collectFunction(capture, "capture");
  collectFunction(policy, "preserveCleanupFailure");

  const imports = capture.statements.flatMap((statement) =>
    ts.isImportDeclaration(statement) &&
    compact(statement.moduleSpecifier, capture) ===
      '"./preserveCleanupFailure.mjs"'
      ? [compact(statement, capture)]
      : [],
  );
  const topLevelActions: string[] = [];
  for (const statement of capture.statements) {
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (
          ts.isIdentifier(declaration.name) &&
          ["browser", "capture", "browserFailure"].includes(
            declaration.name.text,
          )
        )
          topLevelActions.push(declaration.name.text);
    if (ts.isTryStatement(statement)) topLevelActions.push("try");
    if (
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      compact(statement.expression.expression, capture) === "console.log"
    )
      topLevelActions.push(compact(statement, capture));
  }

  const cleanupCalls: ICaptureShotsCleanupContract["cleanupCalls"] = [];
  const fences: ICaptureShotsCleanupContract["fences"] = [];
  const policyCalls: string[][] = [];
  const visitCapture = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.finallyBlock !== undefined &&
      compact(node.finallyBlock, capture).includes("preserveCleanupFailure")
    )
      fences.push({
        catch:
          node.catchClause === undefined
            ? null
            : compact(node.catchClause, capture),
        finally: compact(node.finallyBlock, capture),
      });
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "preserveCleanupFailure"
    )
      policyCalls.push(
        node.arguments.map((argument) => compact(argument, capture)),
      );
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["close", "delete"].includes(node.expression.name.text)
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
        call: compact(node, capture),
        failure:
          owner?.arguments[0] === undefined
            ? null
            : compact(owner.arguments[0], capture),
        resource:
          owner?.arguments[1] === undefined
            ? null
            : compact(owner.arguments[1], capture),
      });
    }
    ts.forEachChild(node, visitCapture);
  };
  visitCapture(capture);
  return {
    cleanupCalls,
    fences,
    functions,
    imports,
    policyCalls,
    topLevelActions,
  };
};

/** The multi-shot command releases every acquired resource primary-first. */
export const test_workspace_capture_shots_cleanup = (): void => {
  const capture = fs.readFileSync(
    path.join(ROOT, "packages", "playground", "scripts", "capture-shots.mjs"),
    "utf8",
  );
  const policy = fs.readFileSync(
    path.join(
      ROOT,
      "packages",
      "playground",
      "scripts",
      "preserveCleanupFailure.mjs",
    ),
    "utf8",
  );
  TestValidator.equals(
    "capture shots fences encoder, page, and browser cleanup",
    captureShotsCleanupContract(capture, policy),
    {
      cleanupCalls: [
        {
          call: "enc.delete()",
          failure: "encoderFailure",
          resource: '"captureencoder"',
        },
        {
          call: "pg.close()",
          failure: "pageFailure",
          resource: '"capturepage"',
        },
        {
          call: "browser.close()",
          failure: "browserFailure",
          resource: '"capturebrowser"',
        },
      ],
      fences: [
        {
          catch: "catch(error){pageFailure={error};throwerror;}",
          finally:
            '{awaitpreserveCleanupFailure(pageFailure,"capturepage",()=>pg.close());}',
        },
        {
          catch: "catch(error){encoderFailure={error};throwerror;}",
          finally:
            '{awaitpreserveCleanupFailure(encoderFailure,"captureencoder",()=>enc.delete(),);}',
        },
        {
          catch: "catch(error){browserFailure={error};throwerror;}",
          finally:
            '{awaitpreserveCleanupFailure(browserFailure,"capturebrowser",()=>browser.close(),);}',
        },
      ],
      functions: {
        capture: [
          {
            async: true,
            body: '{constW=even(w);constH=even(h);constdest=path.join(shotsDir,out);fs.mkdirSync(path.dirname(dest),{recursive:true});constpg=awaitbrowser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1,});letcompletion;letpageFailure;try{constsep=q?"&":"";awaitpg.goto(`${BASE}/${page}?${q}${sep}cap=1&w=${W}&h=${H}`,{waitUntil:"load",});awaitpg.waitForFunction(()=>typeofwindow.__afSeek==="function");awaitpg.addStyleTag({content:"#clips{display:none!important}"});constview=pg.locator("#view");constenc=awaitHME.createH264MP4Encoder();letencoderFailure;try{enc.width=W;enc.height=H;enc.frameRate=fps;enc.quantizationParameter=20;enc.initialize();constt0=Date.now();for(leti=0;i<n;i++){constt=(dur*i)/(n-1);awaitpg.evaluate((tt)=>window.__afSeek(tt),t);constbuf=awaitview.screenshot({type:"png"});constpng=PNG.sync.read(buf);enc.addFrameRgba(newUint8Array(png.data));}enc.finalize();fs.writeFileSync(dest,Buffer.from(enc.FS.readFile(enc.outputFilename)));completion=`wrote${out}(${n}frames@${fps}fps,${((Date.now()-t0)/1000).toFixed(1)}s)`;}catch(error){encoderFailure={error};throwerror;}finally{awaitpreserveCleanupFailure(encoderFailure,"captureencoder",()=>enc.delete(),);}}catch(error){pageFailure={error};throwerror;}finally{awaitpreserveCleanupFailure(pageFailure,"capturepage",()=>pg.close());}console.log(completion);}',
            exported: false,
            parameters: ["[page,q,dur,n,w,h,out,fps]"],
          },
        ],
        preserveCleanupFailure: [
          {
            async: true,
            body: "{try{awaitcleanup();}catch(cleanupError){if(failure===undefined)throwcleanupError;thrownewAggregateError([failure.error,cleanupError],`${resource}cleanupfailedaftertheoperationfailed.`,);}}",
            exported: true,
            parameters: ["failure", "resource", "cleanup"],
          },
        ],
      },
      imports: [
        'import{preserveCleanupFailure}from"./preserveCleanupFailure.mjs";',
      ],
      policyCalls: [
        ["encoderFailure", '"captureencoder"', "()=>enc.delete()"],
        ["pageFailure", '"capturepage"', "()=>pg.close()"],
        ["browserFailure", '"capturebrowser"', "()=>browser.close()"],
      ],
      topLevelActions: [
        "browser",
        "capture",
        "browserFailure",
        "try",
        'console.log("done");',
      ],
    },
  );
};
