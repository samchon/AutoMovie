import { renderScaffold } from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

/** Repository root, four levels above `test/src/features/cli`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const templateExpression = (expression: string): string =>
  "$" + "{" + expression + "}";

const namedArrows = (
  source: ts.SourceFile,
): Map<string, ts.ArrowFunction[]> => {
  const output = new Map<string, ts.ArrowFunction[]>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.initializer === undefined ||
        !ts.isArrowFunction(declaration.initializer)
      )
        continue;
      const entries = output.get(declaration.name.text) ?? [];
      entries.push(declaration.initializer);
      output.set(declaration.name.text, entries);
    }
  }
  return output;
};

/** Inventory every production capture cleanup policy call by owning function. */
const captureCleanupContract = (
  text: string,
): {
  catchBodies: Record<string, string[][]>;
  closeCalls: Array<{
    call: string;
    owner: string;
    protected: boolean;
    region: "body" | "catch" | "finally" | "try";
  }>;
  closeBodies: string[];
  policyBodies: string[];
  policyClasses: string[];
  policyParameters: string[][];
  preserveCalls: Array<{
    call: string;
    owner: string;
    region: "body" | "catch" | "finally" | "try";
  }>;
} => {
  const source = ts.createSourceFile(
    "scripts/capture.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows = namedArrows(source);
  const owners = [
    "startSession",
    "capturePage",
    "closeProductionFrameCapture",
    "captureProductionFrame",
  ];
  const preserveCalls: Array<{
    call: string;
    owner: string;
    region: "body" | "catch" | "finally" | "try";
  }> = [];
  const catchBodies: Record<string, string[][]> = {};
  const closeCalls: Array<{
    call: string;
    owner: string;
    protected: boolean;
    region: "body" | "catch" | "finally" | "try";
  }> = [];
  for (const owner of owners)
    for (const arrow of arrows.get(owner) ?? []) {
      catchBodies[owner] ??= [];
      const regionOf = (
        node: ts.Node,
      ): "body" | "catch" | "finally" | "try" => {
        let cursor: ts.Node | undefined = node;
        let region: "body" | "catch" | "finally" | "try" = "body";
        while (cursor !== undefined && cursor !== arrow.body) {
          if (ts.isCatchClause(cursor)) region = "catch";
          else if (
            ts.isBlock(cursor) &&
            cursor.parent !== undefined &&
            ts.isTryStatement(cursor.parent)
          )
            region = cursor.parent.finallyBlock === cursor ? "finally" : "try";
          cursor = cursor.parent;
        }
        return region;
      };
      const protectedByPolicy = (node: ts.Node): boolean => {
        let cursor: ts.Node | undefined = node.parent;
        while (cursor !== undefined && cursor !== arrow.body) {
          if (
            ts.isCallExpression(cursor) &&
            ts.isIdentifier(cursor.expression) &&
            cursor.expression.text === "preserveProductionCaptureCleanup"
          )
            return true;
          cursor = cursor.parent;
        }
        return false;
      };
      const visit = (node: ts.Node): void => {
        if (ts.isCatchClause(node))
          catchBodies[owner]!.push(
            node.block.statements.map((statement) =>
              compact(statement, source),
            ),
          );
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "preserveProductionCaptureCleanup"
        )
          preserveCalls.push({
            call: compact(node, source),
            owner,
            region: regionOf(node),
          });
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "close"
        )
          closeCalls.push({
            call: compact(node, source),
            owner,
            protected: protectedByPolicy(node),
            region: regionOf(node),
          });
        ts.forEachChild(node, visit);
      };
      visit(arrow.body);
    }
  const policy = arrows.get("preserveProductionCaptureCleanup") ?? [];
  const close = arrows.get("closeProductionFrameCapture") ?? [];
  const policyClasses = source.statements.flatMap((statement) =>
    ts.isClassDeclaration(statement) &&
    statement.name?.text === "ProductionCaptureCleanupError"
      ? [
          statement.heritageClauses
            ?.flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
            .join(",") ?? "",
        ]
      : [],
  );
  return {
    catchBodies,
    closeCalls,
    closeBodies: close.map((arrow) => compact(arrow.body, source)),
    policyBodies: policy.map((arrow) => compact(arrow.body, source)),
    policyClasses,
    policyParameters: policy.map((arrow) =>
      arrow.parameters.map((parameter) => compact(parameter, source)),
    ),
    preserveCalls,
  };
};

interface ICleanupLifecycle {
  actions: string[];
  catches: string[];
  failure: {
    count: number;
    initializer: string | null;
    kind: "const" | "let" | "var" | null;
    type: string | null;
  };
  finally: string[];
  operationCalls: Array<{ callee: string; guarded: boolean }>;
  tries: number;
  tryActions: string[];
  writes: string[];
}

/** Bind one top-level/phase cleanup fence and its failure ownership. */
const cleanupLifecycle = (
  source: ts.SourceFile,
  statements: ts.NodeArray<ts.Statement>,
  failureName: string,
  operation: "captureFrame" | "main",
): ICleanupLifecycle => {
  const declarations = statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .filter(
      (declaration) =>
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === failureName,
    );
  const declaration = declarations.length === 1 ? declarations[0]! : undefined;
  const declarationList = declaration?.parent;
  const kind =
    declarationList === undefined ||
    !ts.isVariableDeclarationList(declarationList)
      ? null
      : declarationList.flags & ts.NodeFlags.Const
        ? "const"
        : declarationList.flags & ts.NodeFlags.Let
          ? "let"
          : "var";
  const tries = statements.filter(
    (statement): statement is ts.TryStatement =>
      ts.isTryStatement(statement) &&
      statement.finallyBlock
        ?.getText(source)
        .includes("closeProductionFrameCapture") === true,
  );
  const action = (statement: ts.Statement): string => {
    if (ts.isImportDeclaration(statement))
      return `import:${compact(statement.moduleSpecifier, source)}`;
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.length === 1 &&
      ts.isIdentifier(statement.declarationList.declarations[0]!.name)
    )
      return statement.declarationList.declarations[0]!.name.text;
    if (ts.isInterfaceDeclaration(statement))
      return `interface:${statement.name.text}`;
    if (ts.isForOfStatement(statement)) return "for";
    if (ts.isIfStatement(statement)) return "if";
    if (ts.isExpressionStatement(statement)) {
      const expression = ts.isAwaitExpression(statement.expression)
        ? statement.expression.expression
        : statement.expression;
      if (ts.isCallExpression(expression))
        return compact(expression.expression, source);
    }
    return compact(statement, source);
  };
  const writes: string[] = [];
  const visitWrites = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      ts.isIdentifier(node.left) &&
      node.left.text === failureName &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    )
      writes.push(compact(node, source));
    ts.forEachChild(node, visitWrites);
  };
  statements.forEach(visitWrites);
  const operationCalls: Array<{ callee: string; guarded: boolean }> = [];
  const visitOperations = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const matches =
        operation === "main"
          ? ts.isIdentifier(node.expression) && node.expression.text === "main"
          : ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "captureFrame";
      if (matches) {
        let cursor: ts.Node | undefined = node;
        let guarded = false;
        while (cursor !== undefined) {
          if (tries.some((statement) => statement.tryBlock === cursor)) {
            guarded = true;
            break;
          }
          cursor = cursor.parent;
        }
        operationCalls.push({
          callee: compact(node.expression, source),
          guarded,
        });
      }
    }
    ts.forEachChild(node, visitOperations);
  };
  statements.forEach(visitOperations);
  return {
    actions: statements.map(action),
    catches: tries.flatMap(
      (statement) =>
        statement.catchClause?.block.statements.map((entry) =>
          compact(entry, source),
        ) ?? [],
    ),
    failure: {
      count: declarations.length,
      initializer:
        declaration?.initializer === undefined
          ? null
          : compact(declaration.initializer, source),
      kind,
      type:
        declaration?.type === undefined
          ? null
          : compact(declaration.type, source),
    },
    finally: tries.flatMap(
      (statement) =>
        statement.finallyBlock?.statements.map((entry) =>
          compact(entry, source),
        ) ?? [],
    ),
    operationCalls,
    tries: tries.length,
    tryActions: tries.flatMap((statement) =>
      statement.tryBlock.statements.map(action),
    ),
    writes,
  };
};

/**
 * Production capture cleanup remains observable without replacing an earlier
 * session, page, command, or packaged-review failure.
 */
export const test_cli_capture_cleanup = (): void => {
  const files = renderScaffold({ name: "cleanup-film" });
  const capture = files["scripts/capture.ts"]!;
  const preview = ts.createSourceFile(
    "scripts/preview.ts",
    files["scripts/preview.ts"]!,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const render = ts.createSourceFile(
    "scripts/render.ts",
    files["scripts/render.ts"]!,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const tgz = ts.createSourceFile(
    "internals/e2e-tgz.mjs",
    fs.readFileSync(path.join(ROOT, "internals", "e2e-tgz.mjs"), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const verifierSources = tgz.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "STARTER_VERIFY_SOURCE" &&
          declaration.initializer !== undefined &&
          ts.isNoSubstitutionTemplateLiteral(declaration.initializer)
            ? [declaration.initializer.text]
            : [],
        )
      : [],
  );
  const verifier = ts.createSourceFile(
    "verify-packaged-starter.mjs",
    verifierSources.length === 1 ? verifierSources[0]! : "",
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const reviewBlocks = verifier.statements.flatMap((statement) =>
    ts.isIfStatement(statement) &&
    statement.expression.getText(verifier).replace(/\s+/g, "") ===
      'phase==="review"' &&
    ts.isBlock(statement.thenStatement)
      ? [statement.thenStatement.statements]
      : [],
  );

  TestValidator.equals(
    "capture cleanup aggregates primary and resource failures",
    captureCleanupContract(capture),
    {
      catchBodies: {
        capturePage: [
          [
            "constfailure=newError(`" +
              templateExpression(
                "errorinstanceofError?error.message:String(error)",
              ) +
              "Browserdiagnostics:" +
              templateExpression('diagnostics.join("|")||"nonereported"') +
              "`,);",
            'awaitpreserveProductionCaptureCleanup({error:failure},[{resource:"capturepage",cleanup:()=>page.close()}],);',
            "throwfailure;",
          ],
        ],
        captureProductionFrame: [
          [
            "thrownewError(`" +
              templateExpression(
                "errorinstanceofError?error.message:String(error)",
              ) +
              "Browserdiagnostics:" +
              templateExpression(
                'resident.diagnostics.join("|")||"nonereported"',
              ) +
              "`,);",
          ],
          [
            "constkey=capturePageKey(input);",
            "session.pages.delete(key);",
            'awaitpreserveProductionCaptureCleanup({error},[{resource:"capturepage",cleanup:()=>resident.page.close()}],);',
            "throwerror;",
          ],
        ],
        closeProductionFrameCapture: [
          [
            'awaitpreserveProductionCaptureCleanup(failure,[{resource:"capturesessionstartup",cleanup:()=>{throwerror;},},]);',
            "return;",
          ],
        ],
        startSession: [
          [
            'awaitpreserveProductionCaptureCleanup({error},[{resource:"captureserver",cleanup:()=>server.close()}],);',
            "throwerror;",
          ],
        ],
      },
      closeCalls: [
        {
          call: "server.close()",
          owner: "startSession",
          protected: true,
          region: "catch",
        },
        {
          call: "previous.page.close()",
          owner: "capturePage",
          protected: false,
          region: "body",
        },
        {
          call: "page.close()",
          owner: "capturePage",
          protected: true,
          region: "catch",
        },
        {
          call: "session.browser.close()",
          owner: "closeProductionFrameCapture",
          protected: true,
          region: "body",
        },
        {
          call: "session.server.close()",
          owner: "closeProductionFrameCapture",
          protected: true,
          region: "body",
        },
        {
          call: "resident.page.close()",
          owner: "captureProductionFrame",
          protected: true,
          region: "catch",
        },
      ],
      closeBodies: [
        '{constpending=sessionPromise;sessionPromise=null;sessionIdentity=null;if(pending===null)return;letsession:CaptureSession;try{session=awaitpending;}catch(error){awaitpreserveProductionCaptureCleanup(failure,[{resource:"capturesessionstartup",cleanup:()=>{throwerror;},},]);return;}awaitpreserveProductionCaptureCleanup(failure,[{resource:"capturebrowser",cleanup:()=>session.browser.close()},{resource:"captureserver",cleanup:()=>session.server.close()},]);}',
      ],
      policyBodies: [
        '{constresults=awaitPromise.allSettled(resources.map((resource)=>Promise.resolve().then(resource.cleanup)),);constcleanupFailures=results.flatMap((result,index)=>result.status==="fulfilled"?[]:[{error:result.reason,resource:resources[index]!.resource}],);if(cleanupFailures.length===0)return;if(failure===undefined&&cleanupFailures.length===1)throwcleanupFailures[0]!.error;thrownewProductionCaptureCleanupError([...(failure===undefined?[]:failure.errorinstanceofProductionCaptureCleanupError?failure.error.errors:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Productioncapturecleanupfailed' +
          templateExpression(
            'failure===undefined?"":"aftertheoperationfailed"',
          ) +
          ":" +
          templateExpression(
            'cleanupFailures.map((entry)=>entry.resource).join(",")',
          ) +
          ".`,);}",
      ],
      policyClasses: ["AggregateError"],
      policyParameters: [
        [
          "failure:ProductionCaptureFailure|undefined",
          "resources:readonlyProductionCaptureCleanup[]",
        ],
      ],
      preserveCalls: [
        {
          call: 'preserveProductionCaptureCleanup({error},[{resource:"captureserver",cleanup:()=>server.close()}],)',
          owner: "startSession",
          region: "catch",
        },
        {
          call: 'preserveProductionCaptureCleanup({error:failure},[{resource:"capturepage",cleanup:()=>page.close()}],)',
          owner: "capturePage",
          region: "catch",
        },
        {
          call: 'preserveProductionCaptureCleanup(failure,[{resource:"capturesessionstartup",cleanup:()=>{throwerror;},},])',
          owner: "closeProductionFrameCapture",
          region: "catch",
        },
        {
          call: 'preserveProductionCaptureCleanup(failure,[{resource:"capturebrowser",cleanup:()=>session.browser.close()},{resource:"captureserver",cleanup:()=>session.server.close()},])',
          owner: "closeProductionFrameCapture",
          region: "body",
        },
        {
          call: 'preserveProductionCaptureCleanup({error},[{resource:"capturepage",cleanup:()=>resident.page.close()}],)',
          owner: "captureProductionFrame",
          region: "catch",
        },
      ],
    },
  );
  TestValidator.equals(
    "capture entry points retain their primary failure through close",
    {
      packaged:
        reviewBlocks.length === 1
          ? cleanupLifecycle(
              verifier,
              reviewBlocks[0]!,
              "reviewFailure",
              "captureFrame",
            )
          : null,
      preview: cleanupLifecycle(
        preview,
        preview.statements,
        "captureFailure",
        "captureFrame",
      ),
      render: cleanupLifecycle(
        render,
        render.statements,
        "renderFailure",
        "main",
      ),
    },
    {
      packaged: {
        actions: [
          "before",
          "assert",
          "packagedAssetReviewViews",
          "compiledModels",
          "reviewFailure",
          "try",
          "for",
          "reviewed",
          "assert",
        ],
        catches: ["reviewFailure={error};", "throwerror;"],
        failure: { count: 1, initializer: null, kind: "let", type: null },
        finally: ["awaitcloseProductionFrameCapture(reviewFailure);"],
        operationCalls: [{ callee: "app.captureFrame", guarded: true }],
        tries: 1,
        tryActions: ["for"],
        writes: ["reviewFailure={error}"],
      },
      preview: {
        actions: [
          'import:"@automovie/interface"',
          'import:"@automovie/mcp"',
          'import:"../automovie.config"',
          'import:"./capture"',
          "args",
          "options",
          "positional",
          "for",
          "time",
          "shot",
          "passValue",
          "passes",
          "if",
          "pass",
          "width",
          "height",
          "app",
          "app.getGuideDocument",
          "app.getGuideDocument",
          "captureFailure",
          "try",
        ],
        catches: ["captureFailure={error};", "throwerror;"],
        failure: {
          count: 1,
          initializer: null,
          kind: "let",
          type: "{error:unknown}|undefined",
        },
        finally: ["awaitcloseProductionFrameCapture(captureFailure);"],
        operationCalls: [{ callee: "app.captureFrame", guarded: true }],
        tries: 1,
        tryActions: ["output", "process.stdout.write", "if"],
        writes: ["captureFailure={error}"],
      },
      render: {
        actions: [
          'import:"@automovie/engine"',
          'import:"@automovie/interface"',
          'import:"@automovie/mcp"',
          'import:"h264-mp4-encoder"',
          'import:"mp4box"',
          'import:"node:crypto"',
          'import:"node:fs"',
          'import:"node:module"',
          'import:"node:path"',
          'import:"node:url"',
          'import:"node:util"',
          'import:"pngjs"',
          'import:"../automovie.config"',
          'import:"./assertProxyBundle"',
          'import:"./capture"',
          'import:"./dialogueCacheSnapshot"',
          'import:"./publishProxyBundle"',
          'import:"./renderAttemptSnapshot"',
          'import:"./renderChunkSnapshot"',
          'import:"./renderGcSnapshot"',
          'import:"./renderLiveness"',
          'import:"./renderPlanSnapshot"',
          'import:"./renderTemporarySnapshot"',
          'import:"./runtimePackageSnapshot"',
          "root",
          "productionId",
          "tierName",
          "renderTier",
          "productionSegment",
          "renderLivenessScope",
          "productionStateRoot",
          "renderJobRoot",
          "stateRoot",
          "planPath",
          "action",
          "require",
          "resolveImportEntry",
          "heldChunkLocks",
          "heldChunkAttempts",
          "KOKORO_MODEL",
          "KOKORO_MODEL_REVISION",
          "KOKORO_DEVICE",
          "KOKORO_VOICE",
          "RENDER_LOCK_JSON_MAX_BYTES",
          "interface:IRenderChunkLockOwner",
          "main",
          "sourceFingerprint",
          "captureReviewEvidence",
          "currentPlan",
          "productionAudioAssets",
          "renderSourceDigest",
          "productionSoundRuntimeIdentity",
          "resolvedPackageIdentity",
          "resolvedPackageSnapshot",
          "packageSnapshotIdentity",
          "onnxRuntimeNodeIdentity",
          "renderShotFingerprints",
          "renderStatus",
          "currentReceipt",
          "currentChunk",
          "acquireChunk",
          "renderChunk",
          "failChunk",
          "releaseChunk",
          "releaseOwnedChunkClaim",
          "finalize",
          "publishProxyTierBundle",
          "assertMatchingProxyPublication",
          "encodeChunkFrames",
          "encodePngFrames",
          "interface:IProductionSoundBundle",
          "interface:IKokoroCacheRecord",
          "interface:IKokoroRuntime",
          "interface:IKokoroTextSplitter",
          "interface:IKokoroLoadedRuntime",
          "produceProductionSound",
          "synthesizeProductionDialogue",
          "validatedDialogueCache",
          "loadPinnedKokoroRuntime",
          "kokoroBaseRuntimeAssets",
          "kokoroModelCacheAssets",
          "validPhonemeChunks",
          "encodeProductionOpus",
          "encodeSoundRaster",
          "concatenateFloat32",
          "assertDeliverableProbe",
          "composite",
          "hasVisiblePixelVariance",
          "productionApplication",
          "productionServices",
          "readPlan",
          "currentStoredPlan",
          "stalePlanRows",
          "currentRenderPlanInputs",
          "renderRuntimeIdentity",
          "productionEncoderIdentity",
          "chunkDirectory",
          "renderGarbageCollection",
          "collectRenderGarbage",
          "gcCandidateKey",
          "assertNoLiveRenderWorkers",
          "renderPublicationFingerprint",
          "physicalFiles",
          "normalizeSlash",
          "recoverAbandonedTemporaryDirectories",
          "quarantineStaleSlotOutputs",
          "captureCurrentChunkPointer",
          "currentPublicationProtectsTree",
          "attemptPath",
          "legacyLockPath",
          "chunkLockDirectory",
          "chunkLockClaims",
          "listFiles",
          "readRegularInside",
          "captureExistingRenderStateTarget",
          "captureExistingRenderTarget",
          "captureAbandonedRenderStateTarget",
          "readCapturedRenderJson",
          "removeCapturedRenderStateTarget",
          "quarantine",
          "processAlive",
          "writeRenderFile",
          "readJson",
          "readRendererJson",
          "integerOption",
          "stringOption",
          "compareCodeUnits",
          "reviewTargetLabel",
          "output",
          "renderProgress",
          "renderFailure",
          "try",
        ],
        catches: ["renderFailure={error};", "throwerror;"],
        failure: {
          count: 1,
          initializer: null,
          kind: "let",
          type: "{error:unknown}|undefined",
        },
        finally: ["awaitcloseProductionFrameCapture(renderFailure);"],
        operationCalls: [{ callee: "main", guarded: true }],
        tries: 1,
        tryActions: ["main"],
        writes: ["renderFailure={error}"],
      },
    },
  );
};
