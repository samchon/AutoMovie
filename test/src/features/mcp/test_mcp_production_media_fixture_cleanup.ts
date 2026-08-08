import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProductionMediaEncoderCleanup } from "./productionMediaFixtures";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const productionMediaFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "productionMediaFixtures.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows = new Map<string, ts.ArrowFunction[]>();
  for (const statement of source.statements)
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
        ) {
          const matches = arrows.get(declaration.name.text);
          if (matches === undefined)
            arrows.set(declaration.name.text, [declaration.initializer]);
          else matches.push(declaration.initializer);
        }
  const owner = arrows.get("productionH264Mp4") ?? [];
  const cleanupCalls: Array<{ call: string; protected: boolean }> = [];
  const catchBodies: string[][] = [];
  const finallyBodies: string[][] = [];
  const tryBodies: string[] = [];
  if (owner.length === 1) {
    const protectedByPolicy = (node: ts.Node): boolean => {
      let cursor: ts.Node | undefined = node.parent;
      while (cursor !== undefined && cursor !== owner[0]!.body) {
        if (
          ts.isCallExpression(cursor) &&
          ts.isIdentifier(cursor.expression) &&
          cursor.expression.text === "preserveProductionMediaEncoderCleanup"
        )
          return true;
        cursor = cursor.parent;
      }
      return false;
    };
    const visit = (node: ts.Node): void => {
      if (ts.isTryStatement(node)) {
        tryBodies.push(compact(node.tryBlock, source));
        if (node.catchClause !== undefined)
          catchBodies.push(
            node.catchClause.block.statements.map((statement) =>
              compact(statement, source),
            ),
          );
        if (node.finallyBlock !== undefined)
          finallyBodies.push(
            node.finallyBlock.statements.map((statement) =>
              compact(statement, source),
            ),
          );
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        compact(node.expression, source) === "encoder.delete"
      )
        cleanupCalls.push({
          call: compact(node, source),
          protected: protectedByPolicy(node),
        });
      ts.forEachChild(node, visit);
    };
    visit(owner[0]!.body);
  }
  const policy = arrows.get("preserveProductionMediaEncoderCleanup") ?? [];
  return {
    owner: {
      count: owner.length,
      catchBodies,
      cleanupCalls,
      finallyBodies,
      statements:
        owner.length === 1 && ts.isBlock(owner[0]!.body)
          ? owner[0]!.body.statements.map((statement) =>
              compact(statement, source),
            )
          : [],
      tryBodies,
    },
    policy: {
      bodies: policy.map((arrow) => compact(arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProductionMediaEncoderCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      parameters: policy.map((arrow) =>
        arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
    },
  };
};

const captureCleanup = (props: {
  cleanupFailure?: unknown;
  primaryFailure?: unknown;
}): { attempts: number; failure: unknown } => {
  let attempts = 0;
  let failure: unknown;
  try {
    let primary: { error: unknown } | undefined;
    try {
      if (props.primaryFailure !== undefined)
        throw props.primaryFailure as Error;
    } catch (error) {
      primary = { error };
      throw error;
    } finally {
      preserveProductionMediaEncoderCleanup(primary, () => {
        ++attempts;
        if (props.cleanupFailure !== undefined)
          throw props.cleanupFailure as Error;
      });
    }
  } catch (error) {
    failure = error;
  }
  return { attempts, failure };
};

export const test_mcp_production_media_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "fixture generation" };
  const cleanupFailure = { phase: "encoder delete" };
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({ primaryFailure });
  const cleanupOnly = captureCleanup({ cleanupFailure });
  const combined = captureCleanup({ cleanupFailure, primaryFailure });
  TestValidator.equals(
    "production media fixture cleanup preserves phase identity and order",
    namedFacts([
      ["successFailure", () => success.failure === undefined],
      [
        "primaryOnlyFailurePrimaryFailure",
        () =>
          success.failure === undefined &&
          primaryOnly.failure === primaryFailure,
      ],
      [
        "cleanupOnlyFailureCleanupFailure",
        () =>
          success.failure === undefined &&
          primaryOnly.failure === primaryFailure &&
          cleanupOnly.failure === cleanupFailure,
      ],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          success.failure === undefined &&
          primaryOnly.failure === primaryFailure &&
          cleanupOnly.failure === cleanupFailure &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            cleanupFailure,
          ]),
      ],
      [
        "successPrimaryOnlyCleanupOnly",
        () =>
          success.failure === undefined &&
          primaryOnly.failure === primaryFailure &&
          cleanupOnly.failure === cleanupFailure &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            cleanupFailure,
          ]) &&
          [success, primaryOnly, cleanupOnly, combined].every(
            (capture) => capture.attempts === 1,
          ),
      ],
    ]),
    {
      successFailure: true,
      primaryOnlyFailurePrimaryFailure: true,
      cleanupOnlyFailureCleanupFailure: true,
      aggregateContainsExactlyCombinedFailure: true,
      successPrimaryOnlyCleanupOnly: true,
    },
  );
  TestValidator.equals(
    "production H.264 fixture owns encoder deletion without changing generation",
    productionMediaFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "productionMediaFixtures.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        catchBodies: [["failure={error};", "throwerror;"]],
        cleanupCalls: [{ call: "encoder.delete()", protected: true }],
        finallyBodies: [
          [
            "preserveProductionMediaEncoderCleanup(failure,()=>encoder.delete());",
          ],
        ],
        statements: [
          "constencoder=awaitHME.createH264MP4Encoder();",
          "letfailure:IProductionMediaEncoderFailure|undefined;",
          "try{encoder.width=props.width;encoder.height=props.height;encoder.frameRate=props.fps;encoder.speed=10;encoder.groupOfPictures=props.fps;encoder.initialize();constframe=newUint8Array(props.width*props.height*4);for(letindex=0;index<props.frameCount;++index){for(letpixel=0;pixel<props.width*props.height;++pixel){constoffset=pixel*4;frame[offset]=(index*7+pixel)%256;frame[offset+1]=(index*11+pixel*3)%256;frame[offset+2]=(index*13+pixel*5)%256;frame[offset+3]=255;}encoder.addFrameRgba(frame);}encoder.finalize();returnUint8Array.from(encoder.FS.readFile(encoder.outputFilename));}catch(error){failure={error};throwerror;}finally{preserveProductionMediaEncoderCleanup(failure,()=>encoder.delete());}",
        ],
        tryBodies: [
          "{encoder.width=props.width;encoder.height=props.height;encoder.frameRate=props.fps;encoder.speed=10;encoder.groupOfPictures=props.fps;encoder.initialize();constframe=newUint8Array(props.width*props.height*4);for(letindex=0;index<props.frameCount;++index){for(letpixel=0;pixel<props.width*props.height;++pixel){constoffset=pixel*4;frame[offset]=(index*7+pixel)%256;frame[offset+1]=(index*11+pixel*3)%256;frame[offset+2]=(index*13+pixel*5)%256;frame[offset+3]=255;}encoder.addFrameRgba(frame);}encoder.finalize();returnUint8Array.from(encoder.FS.readFile(encoder.outputFilename));}",
        ],
      },
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProductionMediaEncoderCleanupError([failure.error,cleanupFailure],"Productionmediaencodercleanupfailedafterfixturegenerationfailed.",);}}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProductionMediaEncoderFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
