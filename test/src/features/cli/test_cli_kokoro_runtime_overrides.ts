import { renderScaffold } from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript-compiler";

/** Repository root, four levels above `test/src/features/cli`. */
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

const namedArrow = (
  source: ts.SourceFile,
  name: string,
): ts.ArrowFunction | undefined => {
  const matches = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === name &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
            ? [declaration.initializer]
            : [],
        )
      : [],
  );
  return matches.length === 1 ? matches[0] : undefined;
};

const kokoroOverrideContract = (
  renderText: string,
  helperText: string,
): {
  binding: {
    count: number;
    initializers: string[];
    moduleReferences: string[];
  };
  owner: {
    assignments: Array<{ assignment: string; guarded: boolean }>;
    calls: Array<{ operationBodies: string[]; overrides: string[] }>;
    pinnedFetchDeclarations: string[];
  };
  policy: {
    bodies: string[];
    classes: string[];
    parameters: string[][];
  };
} => {
  const render = ts.createSourceFile(
    "scripts/render.ts",
    renderText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const helper = ts.createSourceFile(
    "scripts/withKokoroRuntimeOverrides.cjs",
    helperText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const bindingDeclarations = render.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].filter(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === "withKokoroRuntimeOverrides",
        )
      : [],
  );
  const moduleReferences: string[] = [];
  for (const declaration of bindingDeclarations) {
    const visit = (node: ts.Node): void => {
      const argument =
        ts.isCallExpression(node) && node.arguments.length === 1
          ? node.arguments[0]
          : undefined;
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        argument !== undefined &&
        ts.isStringLiteralLike(argument)
      )
        moduleReferences.push(argument.text);
      ts.forEachChild(node, visit);
    };
    if (declaration.initializer !== undefined) visit(declaration.initializer);
  }
  const owner = namedArrow(render, "loadPinnedKokoroRuntime");
  const calls: ts.CallExpression[] = [];
  const assignments: Array<{ assignment: string; guarded: boolean }> = [];
  const pinnedFetchDeclarations: string[] = [];
  if (owner !== undefined) {
    const protectedByHelper = (node: ts.Node): boolean => {
      let cursor: ts.Node | undefined = node.parent;
      while (cursor !== undefined && cursor !== owner.body) {
        if (
          ts.isCallExpression(cursor) &&
          ts.isIdentifier(cursor.expression) &&
          cursor.expression.text === "withKokoroRuntimeOverrides"
        )
          return true;
        cursor = cursor.parent;
      }
      return false;
    };
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === "pinnedFetch",
        )
      )
        pinnedFetchDeclarations.push(compact(node, render));
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "withKokoroRuntimeOverrides"
      )
        calls.push(node);
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ["env.cacheDir", "globalThis.fetch"].includes(
          compact(node.left, render),
        )
      )
        assignments.push({
          assignment: compact(node, render),
          guarded: protectedByHelper(node),
        });
      ts.forEachChild(node, visit);
    };
    visit(owner.body);
  }
  const callContracts = calls.map((call) => {
    const overrides = call.arguments[0];
    const operation = call.arguments[1];
    return {
      operationBodies:
        operation !== undefined && ts.isArrowFunction(operation)
          ? [compact(operation.body, render)]
          : [],
      overrides:
        overrides !== undefined && ts.isArrayLiteralExpression(overrides)
          ? [...overrides.elements].map((entry) => compact(entry, render))
          : [],
    };
  });
  const policy = namedArrow(helper, "withKokoroRuntimeOverrides");
  return {
    binding: {
      count: bindingDeclarations.length,
      initializers: bindingDeclarations.flatMap((declaration) =>
        declaration.initializer === undefined
          ? []
          : [compact(declaration.initializer, render)],
      ),
      moduleReferences,
    },
    owner: {
      assignments,
      calls: callContracts,
      pinnedFetchDeclarations,
    },
    policy: {
      bodies:
        policy !== undefined && ts.isBlock(policy.body)
          ? [compact(policy.body, helper)]
          : [],
      classes: helper.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "KokoroRuntimeOverrideError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, helper)),
            )
          : [],
      ),
      parameters:
        policy === undefined
          ? []
          : [policy.parameters.map((parameter) => compact(parameter, helper))],
    },
  };
};

interface IKokoroOverrideCapture {
  caught: unknown;
  order: string[];
  output: unknown;
}

const exerciseKokoroOverridePolicy = async (): Promise<void> => {
  const helper = createRequire(__filename)(
    path.join(
      ROOT,
      "packages",
      "cli",
      "scaffold",
      "scripts",
      "withKokoroRuntimeOverrides.cjs",
    ),
  ) as {
    withKokoroRuntimeOverrides: <Output>(
      overrides: readonly {
        resource: string;
        install: () => unknown;
        restore: () => unknown;
      }[],
      operation: () => Output | Promise<Output>,
    ) => Promise<Output>;
  };
  const setupFailure = new Error("Kokoro override setup failed");
  const operationFailure = new Error("Kokoro load failed");
  const firstRestorationFailure = new Error("cache restoration failed");
  const secondRestorationFailure = new Error("fetch restoration failed");
  const capture = async (props: {
    installFailure?: Error;
    operationFailure?: Error;
    restorationFailures?: readonly (Error | undefined)[];
  }): Promise<IKokoroOverrideCapture> => {
    const order: string[] = [];
    let caught: unknown;
    let output: unknown;
    try {
      output = await helper.withKokoroRuntimeOverrides(
        [0, 1].map((index) => ({
          resource: `override-${index}`,
          install: (): void => {
            order.push(`install-${index}`);
            if (index === 1 && props.installFailure !== undefined)
              throw props.installFailure;
          },
          restore: (): void => {
            order.push(`restore-${index}`);
            const restorationFailure = props.restorationFailures?.[index];
            if (restorationFailure !== undefined) throw restorationFailure;
          },
        })),
        () => {
          order.push("operation");
          if (props.operationFailure !== undefined)
            throw props.operationFailure;
          return "loaded runtime";
        },
      );
    } catch (error) {
      caught = error;
    }
    return { caught, order, output };
  };
  const success = await capture({});
  const setupOnly = await capture({ installFailure: setupFailure });
  const operationOnly = await capture({ operationFailure });
  const standaloneRestoration = await capture({
    restorationFailures: [firstRestorationFailure],
  });
  const multipleRestorations = await capture({
    restorationFailures: [firstRestorationFailure, secondRestorationFailure],
  });
  const combined = await capture({
    operationFailure,
    restorationFailures: [firstRestorationFailure, secondRestorationFailure],
  });
  const completedOrder = "install-0,install-1,operation,restore-0,restore-1";
  const setupOrder = "install-0,install-1,restore-0,restore-1";
  TestValidator.predicate(
    "Kokoro override policy rolls back partial setup and preserves every failure",
    success.output === "loaded runtime" &&
      success.caught === undefined &&
      success.order.join(",") === completedOrder &&
      setupOnly.output === undefined &&
      setupOnly.caught === setupFailure &&
      setupOnly.order.join(",") === setupOrder &&
      operationOnly.caught === operationFailure &&
      operationOnly.order.join(",") === completedOrder &&
      standaloneRestoration.caught === firstRestorationFailure &&
      standaloneRestoration.order.join(",") === completedOrder &&
      aggregateContainsExactly(multipleRestorations.caught, [
        firstRestorationFailure,
        secondRestorationFailure,
      ]) &&
      multipleRestorations.order.join(",") === completedOrder &&
      aggregateContainsExactly(combined.caught, [
        operationFailure,
        firstRestorationFailure,
        secondRestorationFailure,
      ]) &&
      combined.order.join(",") === completedOrder,
  );
};

export const test_cli_kokoro_runtime_overrides = async (): Promise<void> => {
  await exerciseKokoroOverridePolicy();
  const files = renderScaffold({ name: "kokoro-override-film" });
  TestValidator.equals(
    "Kokoro runtime loader owns both temporary overrides through one policy",
    kokoroOverrideContract(
      files["scripts/render.ts"]!,
      files["scripts/withKokoroRuntimeOverrides.cjs"]!,
    ),
    {
      binding: {
        count: 1,
        initializers: [
          '(require("./withKokoroRuntimeOverrides.cjs")as{withKokoroRuntimeOverrides:<Output>(overrides:readonly{resource:string;install:()=>unknown;restore:()=>unknown;}[],operation:()=>Output|Promise<Output>,)=>Promise<Output>;}).withKokoroRuntimeOverrides',
        ],
        moduleReferences: ["./withKokoroRuntimeOverrides.cjs"],
      },
      owner: {
        assignments: [
          { assignment: "env.cacheDir=modelCacheRoot", guarded: true },
          { assignment: "env.cacheDir=previous.cacheDir", guarded: true },
          { assignment: "globalThis.fetch=pinnedFetch", guarded: true },
          { assignment: "globalThis.fetch=previous.fetch", guarded: true },
        ],
        pinnedFetchDeclarations: [
          'constpinnedFetch:typeofglobalThis.fetch=async(input,init)=>{constsource=typeofinput==="string"?input:inputinstanceofURL?input.href:input.url;constmarker=`huggingface.co/${KOKORO_MODEL}/resolve/`;constmarkerIndex=source.indexOf(marker);if(markerIndex<0)returnfetcher(input,init);constsuffix=source.slice(markerIndex+marker.length);constseparator=suffix.indexOf("/");if(separator<0)thrownewError(`KokoromodelURLhasnoassetpath:${source}`);constpinned=source.slice(0,markerIndex+marker.length)+KOKORO_MODEL_REVISION+suffix.slice(separator);constrequest=typeofinput==="object"&&input!==null&&"url"ininput&&inputinstanceofRequest?newRequest(pinned,input):pinned;returnfetcher(request,init);};',
        ],
        calls: [
          {
            operationBodies: [
              '{constloaded=awaitKokoroTTS.from_pretrained(KOKORO_MODEL,{dtype:"q8",device:KOKORO_DEVICE,});constmodelAssets=kokoroModelCacheAssets(modelCacheRoot);if(modelAssets.length===0)thrownewError("PinnedKokoroloadproducednorevision-scopedmodelcacheassets.",);renderProgress("sound.model.load.complete",{model:KOKORO_MODEL,revision:KOKORO_MODEL_REVISION,});return{runtime:loadedasunknownasIKokoroRuntime,createTextSplitter:()=>newTextSplitterStream(),runtimeAssets:[...baseRuntimeAssets,...modelAssets],};}',
            ],
            overrides: [
              '{resource:"Transformerscachedirectory",install:()=>{env.cacheDir=modelCacheRoot;},restore:()=>{env.cacheDir=previous.cacheDir;},}',
              '{resource:"globalfetch",install:()=>{globalThis.fetch=pinnedFetch;},restore:()=>{globalThis.fetch=previous.fetch;},}',
            ],
          },
        ],
      },
      policy: {
        bodies: [
          '{constattempted=[];letfailure;try{for(constoverrideofoverrides){attempted.push(override);override.install();}returnawaitoperation();}catch(error){failure={error};throwerror;}finally{constrestorationFailures=[];for(constoverrideofattempted)try{override.restore();}catch(error){restorationFailures.push({error,resource:override.resource});}if(restorationFailures.length===1&&failure===undefined)throwrestorationFailures[0].error;if(restorationFailures.length!==0)thrownewKokoroRuntimeOverrideError([...(failure===undefined?[]:[failure.error]),...restorationFailures.map((entry)=>entry.error),],`Kokororuntimeoverriderestorationfailed${failure===undefined?"":"aftersetuporloadingfailed"}:${restorationFailures.map((entry)=>entry.resource).join(",")}.`,);}}',
        ],
        classes: ["AggregateError"],
        parameters: [["overrides", "operation"]],
      },
    },
  );
};
