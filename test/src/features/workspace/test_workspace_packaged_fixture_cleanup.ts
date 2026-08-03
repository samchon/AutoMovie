import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript-compiler";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

interface IPackagedFixtureCleanupContract {
  bindings: string[];
  failures: string[];
  import: string[];
  lifecycles: Array<{
    catchActions: string[];
    finallyActions: string[];
  }>;
}

/** Inventory every outer packaged-E2E fixture cleanup and its failure owner. */
const packagedFixtureCleanupContract = (
  text: string,
): IPackagedFixtureCleanupContract => {
  const source = ts.createSourceFile(
    "internals/e2e-tgz.mjs",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const failureNames = new Set([
    "captureConfigFailure",
    "captureExecutableFailure",
    "captureReceiptFailure",
    "onnxNativeBindingFailure",
    "packagedE2eFailure",
    "packagedPresenceFailure",
    "packagedSentinelFailure",
    "staleRenderRuntimeFailure",
    "tamperedRenderPlanFailure",
  ]);
  const failures: string[] = [];
  const lifecycles: IPackagedFixtureCleanupContract["lifecycles"] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      failureNames.has(node.name.text)
    ) {
      if (ts.isVariableDeclarationList(node.parent) === false)
        throw new Error("Packaged cleanup failure has no declaration list.");
      failures.push(
        `${
          node.parent.flags & ts.NodeFlags.Const
            ? "const"
            : node.parent.flags & ts.NodeFlags.Let
              ? "let"
              : "var"
        }:${compact(node, source)}`,
      );
    }
    if (ts.isTryStatement(node) && node.finallyBlock !== undefined)
      lifecycles.push({
        catchActions:
          node.catchClause?.block.statements.map((statement) =>
            compact(statement, source),
          ) ?? [],
        finallyActions: node.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
      });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    bindings: source.statements.flatMap((statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          ts.isObjectBindingPattern(declaration.name) &&
          declaration.name.elements.some(
            (element) =>
              ts.isIdentifier(element.name) &&
              element.name.text === "preservePackagedE2eCleanup",
          ),
      )
        ? [compact(statement, source)]
        : [],
    ),
    failures,
    import: source.statements.flatMap((statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "./preservePackagedE2eCleanup.cjs"
        ? [compact(statement, source)]
        : [],
    ),
    lifecycles,
  };
};

/** Execute the isolated packaged-E2E cleanup policy without running the E2E. */
const exercisePackagedFixtureCleanup = (): void => {
  const helper = createRequire(__filename)(
    path.join(ROOT, "internals", "preservePackagedE2eCleanup.cjs"),
  ) as {
    preservePackagedE2eCleanup: (
      failure: { error: unknown } | undefined,
      resource: string,
      cleanup: () => unknown,
    ) => void;
  };
  const primaryFailure = new Error("packaged fixture primary failure");
  const cleanupFailure = new Error("packaged fixture cleanup failure");
  const capture = (
    primary: Error | undefined,
    cleanup: Error | undefined,
  ): { attempts: number; caught: unknown } => {
    let attempts = 0;
    let caught: unknown;
    try {
      let failure: { error: unknown } | undefined;
      try {
        if (primary !== undefined) throw primary;
      } catch (error) {
        failure = { error };
        throw error;
      } finally {
        helper.preservePackagedE2eCleanup(failure, "packaged fixture", () => {
          attempts += 1;
          if (cleanup !== undefined) throw cleanup;
        });
      }
    } catch (error) {
      caught = error;
    }
    return { attempts, caught };
  };
  const success = capture(undefined, undefined);
  const primaryOnly = capture(primaryFailure, undefined);
  const standalone = capture(undefined, cleanupFailure);
  const combined = capture(primaryFailure, cleanupFailure);
  TestValidator.predicate(
    "packaged fixture cleanup retains exact primary-first failure ownership",
    success.caught === undefined &&
      success.attempts === 1 &&
      primaryOnly.caught === primaryFailure &&
      primaryOnly.attempts === 1 &&
      standalone.caught === cleanupFailure &&
      standalone.attempts === 1 &&
      aggregateContainsExactly(combined.caught, [
        primaryFailure,
        cleanupFailure,
      ]) &&
      combined.attempts === 1,
  );
};

/** The packaged harness restores every fixture without hiding probe failures. */
export const test_workspace_packaged_fixture_cleanup = (): void => {
  exercisePackagedFixtureCleanup();
  const source = fs.readFileSync(
    path.join(ROOT, "internals", "e2e-tgz.mjs"),
    "utf8",
  );
  const helper = fs.readFileSync(
    path.join(ROOT, "internals", "preservePackagedE2eCleanup.cjs"),
    "utf8",
  );
  const helperSource = ts.createSourceFile(
    "internals/preservePackagedE2eCleanup.cjs",
    helper,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  TestValidator.equals(
    "packaged fixture cleanup helper",
    {
      classes: helperSource.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "PackagedE2eCleanupError"
          ? [
              statement.heritageClauses
                ?.flatMap((clause) =>
                  clause.types.map((type) => compact(type, helperSource)),
                )
                .join(",") ?? "",
            ]
          : [],
      ),
      functions: helperSource.statements.flatMap((statement) =>
        ts.isVariableStatement(statement)
          ? [...statement.declarationList.declarations].flatMap(
              (declaration) =>
                ts.isIdentifier(declaration.name) &&
                declaration.name.text === "preservePackagedE2eCleanup" &&
                declaration.initializer !== undefined &&
                ts.isArrowFunction(declaration.initializer)
                  ? [compact(declaration.initializer.body, helperSource)]
                  : [],
            )
          : [],
      ),
    },
    {
      classes: ["AggregateError"],
      functions: [
        "{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewPackagedE2eCleanupError([failure.error,cleanupFailure],`$" +
          "{resource}cleanupfailedafterthepackagedE2Eoperationfailed.`,);}}",
      ],
    },
  );
  TestValidator.equals(
    "every outer packaged fixture cleanup is primary-first",
    packagedFixtureCleanupContract(source),
    {
      bindings: ["const{preservePackagedE2eCleanup}=packagedE2eCleanup;"],
      failures: [
        "let:packagedE2eFailure",
        "let:captureReceiptFailure",
        "let:captureExecutableFailure",
        "let:captureConfigFailure",
        "let:packagedSentinelFailure",
        "let:packagedPresenceFailure",
        "let:onnxNativeBindingFailure",
        "let:tamperedRenderPlanFailure",
        "let:staleRenderRuntimeFailure",
      ],
      import: [
        'importpackagedE2eCleanupfrom"./preservePackagedE2eCleanup.cjs";',
      ],
      lifecycles: [
        {
          catchActions: ["packagedE2eFailure={error};", "throwerror;"],
          finallyActions: [
            'preservePackagedE2eCleanup(packagedE2eFailure,"packagedE2Estage",()=>{if(KEEP_STAGE)console.log(`\\nverificationstageretainedat$' +
              "{stage}`);elsermSync(stage,{recursive:true,force:true,maxRetries:5});});",
          ],
        },
        {
          catchActions: ["captureReceiptFailure={error};", "throwerror;"],
          finallyActions: [
            'preservePackagedE2eCleanup(captureReceiptFailure,"packagedcapturereceipt",()=>writeFileSync(captureReceiptPath,captureReceiptText),);',
          ],
        },
        {
          catchActions: ["captureExecutableFailure={error};", "throwerror;"],
          finallyActions: [
            'preservePackagedE2eCleanup(captureExecutableFailure,"packagedcaptureexecutable",()=>renameSync(parkedCaptureExecutable,captureReceipt.browser.executablePath,),);',
          ],
        },
        {
          catchActions: ["captureConfigFailure={error};", "throwerror;"],
          finallyActions: [
            'preservePackagedE2eCleanup(captureConfigFailure,"packagedcaptureconfig",()=>writeFileSync(captureConfigPath,captureConfigText),);',
          ],
        },
        {
          catchActions: ["packagedSentinelFailure={error};", "throwerror;"],
          finallyActions: [
            'preservePackagedE2eCleanup(packagedSentinelFailure,"packagedlintsentinel",()=>rmSync(packagedSentinelPath,{force:true}),);',
          ],
        },
        {
          catchActions: ["packagedPresenceFailure={error};", "throwerror;"],
          finallyActions: [
            'preservePackagedE2eCleanup(packagedPresenceFailure,"packagedstate-presencefixture",()=>rmSync(packagedPresenceProject,{force:true,maxRetries:3,recursive:true,retryDelay:100,}),);',
          ],
        },
        {
          catchActions: ["onnxNativeBindingFailure={error};", "throwerror;"],
          finallyActions: [
            'preservePackagedE2eCleanup(onnxNativeBindingFailure,"packagedONNXRuntimebinding",()=>writeFileSync(onnxNativeBindingPath,onnxNativeBinding),);',
          ],
        },
        {
          catchActions: ["tamperedRenderPlanFailure={error};", "throwerror;"],
          finallyActions: [
            'preservePackagedE2eCleanup(tamperedRenderPlanFailure,"packagedrenderplantamper",()=>writeFileSync(renderPlanPath,renderPlanText),);',
          ],
        },
        {
          catchActions: ["staleRenderRuntimeFailure={error};", "throwerror;"],
          finallyActions: [
            'preservePackagedE2eCleanup(staleRenderRuntimeFailure,"packagedrenderruntimeidentity",()=>writeFileSync(renderPlanPath,renderPlanText),);',
          ],
        },
      ],
    },
  );
};
