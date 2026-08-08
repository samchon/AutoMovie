import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveRenderJobFixtureCleanup } from "./test_mcp_production_render_job";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digest = (node: ts.Node, source: ts.SourceFile): string =>
  createHash("sha256").update(node.getText(source)).digest("hex");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

/**
 * Every render-job lifecycle whose protected cleanup restores exactly one
 * process-global filesystem hook.
 *
 * The selection is the single-resource shape itself rather than a name list, so
 * a later harness change that adds a second owned resource to one of these
 * boundaries leaves the shape and is caught by the count.
 */
export const renderJobSingleHookContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_render_job.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerStatements: number;
    finallyBodies: string[];
    index: number;
    prefixes: string[];
    tryDigest: string;
  }> = [];
  const singleResource = (block: ts.Block): boolean => {
    if (block.statements.length !== 1) return false;
    const statement = block.statements[0];
    if (
      statement === undefined ||
      ts.isExpressionStatement(statement) === false ||
      ts.isCallExpression(statement.expression) === false ||
      ts.isIdentifier(statement.expression.expression) === false ||
      statement.expression.expression.text !==
        "preserveRenderJobFixtureCleanup" ||
      statement.expression.arguments.length !== 2
    )
      return false;
    const resources = statement.expression.arguments[1];
    if (
      resources === undefined ||
      ts.isArrayLiteralExpression(resources) === false ||
      resources.elements.length !== 1
    )
      return false;
    // One assignment back to a hook holder -- the process-global `fs` or the
    // `createRequire("node:fs")` alias the split-identity proxy needs -- and
    // nothing else.
    return /^\{resource:"[^"]+",cleanup:\(\)=>\{(?:fs|mutableFs)\.[A-Za-z]+=[A-Za-z_$][\w$]*;\},\}$/u.test(
      compact(resources.elements[0]!, source),
    );
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      singleResource(node.finallyBlock) &&
      ts.isBlock(node.parent)
    ) {
      const statements = [...node.parent.statements];
      const index = statements.indexOf(node);
      lifecycles.push({
        catchBodies: node.catchClause.block.statements.map((statement) =>
          compact(statement, source),
        ),
        catchVariables:
          node.catchClause.variableDeclaration === undefined
            ? []
            : [compact(node.catchClause.variableDeclaration, source)],
        containerStatements: statements.length,
        finallyBodies: node.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
        index,
        prefixes: statements
          .slice(Math.max(0, index - 2), index)
          .map((statement) => compact(statement, source)),
        tryDigest: digest(node.tryBlock, source),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const labels = lifecycles.flatMap((lifecycle) =>
    lifecycle.finallyBodies.flatMap((body) => {
      const found = /resource:"([^"]+)"/u.exec(body);
      return found === null ? [] : [found[1]!];
    }),
  );
  return {
    count: lifecycles.length,
    // A label is how a cleanup failure names itself in the aggregate, so two
    // lifecycles sharing one would make the report ambiguous.
    duplicateLabels: labels.filter(
      (label, index) => labels.indexOf(label) !== index,
    ),
    lifecycles,
    // Nothing of this shape may be left running as a raw restoration in
    // `finally`, whichever holder owns the hook.
    rawFinalizers: [
      ...text.matchAll(/finally\s*\{\s*(?:fs|mutableFs)\.([A-Za-z]+)\s*=/gu),
    ].map((found) => found[1]!),
  };
};

const captureCleanup = (props: {
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
  resources?: number;
}): { caught: boolean; failure: unknown; order: string[] } => {
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveRenderJobFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      Array.from({ length: props.resources ?? 1 }, (_, index) => ({
        resource: `resource-${index}`,
        cleanup: (): void => {
          order.push(`cleanup-${index}`);
          const cleanupFailure = props.cleanupFailures?.[index];
          if (cleanupFailure !== undefined) throw cleanupFailure.error;
        },
      })),
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, failure, order };
};

export const test_mcp_production_render_job_single_hook_cleanup = (): void => {
  const primaryFailure = { phase: "render-job regression" };
  const restorationFailure = { phase: "render-job hook restoration" };
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [{ error: restorationFailure, present: true }],
  });
  const combined = captureCleanup({
    cleanupFailures: [{ error: restorationFailure, present: true }],
    primaryFailure: { error: primaryFailure, present: true },
  });
  const undefinedPrimary = captureCleanup({
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.equals(
    "single render-job restoration preserves the guarded failure first",
    namedFacts([
      ["successCaught", () => success.caught === false],
      [
        "successFailure",
        () => success.caught === false && success.failure === undefined,
      ],
      [
        "successOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0",
      ],
      ["primaryOnlyCaught", () => primaryOnly.caught],
      [
        "primaryOnlyFailurePrimaryFailure",
        () => primaryOnly.failure === primaryFailure,
      ],
      [
        "primaryOnlyOrderJoin",
        () => primaryOnly.order.join(",") === "cleanup-0",
      ],
      ["standaloneCaught", () => standalone.caught],
      [
        "standaloneFailureRestorationFailure",
        () => standalone.failure === restorationFailure,
      ],
      ["standaloneOrderJoin", () => standalone.order.join(",") === "cleanup-0"],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            restorationFailure,
          ]),
      ],
      ["combinedOrderJoin", () => combined.order.join(",") === "cleanup-0"],
      ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
      ["undefinedPrimaryFailure", () => undefinedPrimary.failure === undefined],
      [
        "undefinedPrimaryOrderJoin",
        () => undefinedPrimary.order.join(",") === "cleanup-0",
      ],
    ]),
    {
      successCaught: true,
      successFailure: true,
      successOrderJoin: true,
      primaryOnlyCaught: true,
      primaryOnlyFailurePrimaryFailure: true,
      primaryOnlyOrderJoin: true,
      standaloneCaught: true,
      standaloneFailureRestorationFailure: true,
      standaloneOrderJoin: true,
      combinedCaught: true,
      aggregateContainsExactlyCombinedFailure: true,
      combinedOrderJoin: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryOrderJoin: true,
    },
  );
  TestValidator.equals(
    "render-job regression protects every single hook restoration",
    renderJobSingleHookContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_render_job.ts"),
        "utf8",
      ),
    ),
    CONTRACT,
  );
};

const CONTRACT = {
  count: 3,
  duplicateLabels: [],
  lifecycles: [
    {
      catchBodies: ["splitIdentityFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 2,
      finallyBodies: [
        'preserveRenderJobFixtureCleanup(splitIdentityFailure,[{resource:"split-identitylstathook",cleanup:()=>{mutableFs.lstatSync=nativeLstat;},},]);',
      ],
      index: 1,
      prefixes: ["letsplitIdentityFailure:IRenderJobFixtureFailure|undefined;"],
      tryDigest:
        "537b6703b074e6171f1604ff172eecbedea59216ebd62cbebdade5f3b61141b7",
    },
    {
      catchBodies: ["pathnameSwapFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 39,
      finallyBodies: [
        'preserveRenderJobFixtureCleanup(pathnameSwapFailure,[{resource:"pathnameswapreadhook",cleanup:()=>{fs.readFileSync=nativeRead;},},]);',
      ],
      index: 34,
      prefixes: [
        'fs.readFileSync=((file:fs.PathOrFileDescriptor,...args:unknown[]):unknown=>{if(swapped===false&&typeoffile!=="number"&&path.resolve(file.toString())===resident){swapped=true;fs.renameSync(resident,preserved);fs.renameSync(replacement,resident);letpathnameReadFailure:IRenderJobFixtureFailure|undefined;try{returnReflect.apply(nativeRead,fs,[file,...args])asunknown;}catch(error){pathnameReadFailure={error};throwerror;}finally{preserveRenderJobFixtureCleanup(pathnameReadFailure,[{resource:"pathnamereplacement",cleanup:()=>fs.renameSync(resident,replacement),},{resource:"pathnameresident",cleanup:()=>fs.renameSync(preserved,resident),},]);}}returnReflect.apply(nativeRead,fs,[file,...args])asunknown;})astypeoffs.readFileSync;',
        "letpathnameSwapFailure:IRenderJobFixtureFailure|undefined;",
      ],
      tryDigest:
        "e7685b6741d68ad62f5d68f38f4b99a0685ed405029ec67870c0ef080eb5221a",
    },
    {
      catchBodies: ["replacementFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 39,
      finallyBodies: [
        'preserveRenderJobFixtureCleanup(replacementFailure,[{resource:"physicalreplacementreadhook",cleanup:()=>{fs.readFileSync=nativeRead;},},]);',
      ],
      index: 38,
      prefixes: [
        "fs.readFileSync=((file:fs.PathOrFileDescriptor,...args:unknown[]):unknown=>{constbytes=Reflect.apply(nativeRead,fs,[file,...args])asunknown;if(replaced===false){replaced=true;fs.rmSync(resident);fs.renameSync(replacement,resident);}returnbytes;})astypeoffs.readFileSync;",
        "letreplacementFailure:IRenderJobFixtureFailure|undefined;",
      ],
      tryDigest:
        "d967a528aba50f87107cbb961973e09859d8fb2efdfc3b08c02824980fc93f4f",
    },
  ],
  rawFinalizers: [],
};
