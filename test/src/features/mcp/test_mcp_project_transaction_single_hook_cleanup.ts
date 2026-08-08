import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digestText = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

const leafTokenContract = (
  nodes: readonly ts.Node[],
  source: ts.SourceFile,
): { digest: string; tokens: number } => {
  const tokens: Array<[ts.SyntaxKind, string]> = [];
  const visit = (node: ts.Node): void => {
    const children = node.getChildren(source);
    if (children.length !== 0) children.forEach(visit);
    else {
      const text = node.getText(source);
      if (text.length !== 0) tokens.push([node.kind, text]);
    }
  };
  nodes.forEach(visit);
  return {
    digest: digestText(JSON.stringify(tokens)),
    tokens: tokens.length,
  };
};

const transactionSingleHookCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_project_transactions.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "actor cleanup write hook",
    "denied-removal rename hook",
    "restored-removal remove hook",
    "late-delete remove hook",
    "removal-swap rename hook",
    "lock-swap write hook",
    "root-swap operation write hook",
    "alias-retarget write hook",
  ];
  const rows: Array<{
    catchBodies: string[];
    catchVariables: string[];
    cleanup: string;
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    helper: string;
    index: number;
    resource: string;
    tryBody: string;
    tryDigest: string;
    trySubstantive: { digest: string; tokens: number };
  }> = [];
  const replacements: Array<{ end: number; start: number; text: string }> = [];
  const fixtureDigests: Array<{
    index: number;
    tryDigest: string;
    tryStatements: number;
  }> = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "test_mcp_project_transactions" &&
      node.initializer !== undefined &&
      ts.isArrowFunction(node.initializer) &&
      ts.isBlock(node.initializer.body)
    )
      for (const [
        index,
        statement,
      ] of node.initializer.body.statements.entries())
        if (
          ts.isTryStatement(statement) &&
          statement.finallyBlock
            ?.getText(source)
            .includes("preserveProjectTransactionFixtureCleanup") === true
        )
          fixtureDigests.push({
            index,
            tryDigest: digestText(statement.tryBlock.getText(source)),
            tryStatements: statement.tryBlock.statements.length,
          });
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      node.finallyBlock.statements.length === 1 &&
      anchors.some((anchor) =>
        compact(node.finallyBlock!, source).includes(
          anchor.replace(/\s+/g, ""),
        ),
      ) &&
      ts.isBlock(node.parent)
    ) {
      const statement = node.finallyBlock.statements[0]!;
      if (
        ts.isExpressionStatement(statement) &&
        ts.isCallExpression(statement.expression) &&
        statement.expression.arguments.length === 2 &&
        ts.isArrayLiteralExpression(statement.expression.arguments[1]!) &&
        (statement.expression.arguments[1] as ts.ArrayLiteralExpression)
          .elements.length === 1
      ) {
        const call = statement.expression;
        const resource = (call.arguments[1] as ts.ArrayLiteralExpression)
          .elements[0]!;
        if (ts.isObjectLiteralExpression(resource)) {
          const label = resource.properties.find(
            (property): property is ts.PropertyAssignment =>
              ts.isPropertyAssignment(property) &&
              property.name.getText(source) === "resource" &&
              ts.isStringLiteral(property.initializer),
          );
          const cleanup = resource.properties.find(
            (property): property is ts.PropertyAssignment =>
              ts.isPropertyAssignment(property) &&
              property.name.getText(source) === "cleanup" &&
              ts.isArrowFunction(property.initializer),
          );
          if (
            label !== undefined &&
            ts.isStringLiteral(label.initializer) &&
            cleanup !== undefined &&
            ts.isArrowFunction(cleanup.initializer)
          ) {
            const statements = [...node.parent.statements];
            const index = statements.indexOf(node);
            const failureHolder = statements[index - 1];
            if (failureHolder !== undefined) {
              const cleanupBody = cleanup.initializer.body;
              const originalCleanup = ts.isBlock(cleanupBody)
                ? cleanupBody.statements
                    .map((entry) => entry.getText(source))
                    .join("\n")
                : `${cleanupBody.getText(source)};`;
              rows.push({
                catchBodies: node.catchClause.block.statements.map((entry) =>
                  compact(entry, source),
                ),
                catchVariables:
                  node.catchClause.variableDeclaration === undefined
                    ? []
                    : [compact(node.catchClause.variableDeclaration, source)],
                cleanup: compact(cleanup.initializer, source),
                containerKind: ts.SyntaxKind[node.parent.parent.kind]!,
                containerStatements: statements.length,
                failureHolder: compact(failureHolder, source),
                finallyDigest: digestText(node.finallyBlock.getText(source)),
                finallySubstantive: leafTokenContract(
                  node.finallyBlock.statements,
                  source,
                ),
                helper: call.expression.getText(source),
                index,
                resource: label.initializer.text,
                tryBody: compact(node.tryBlock, source),
                tryDigest: digestText(node.tryBlock.getText(source)),
                trySubstantive: leafTokenContract(
                  node.tryBlock.statements,
                  source,
                ),
              });
              replacements.push({
                end: node.end,
                start: failureHolder.getStart(source),
                text: `try ${node.tryBlock.getText(source)} finally {\n${originalCleanup}\n}`,
              });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  let parent = text;
  for (const replacement of replacements.sort(
    (left, right) => right.start - left.start,
  ))
    parent = `${parent.slice(0, replacement.start)}${replacement.text}${parent.slice(replacement.end)}`;
  return {
    fixtureDigests,
    parentDigest: digestText(parent.replace(/\s+/g, "")),
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    rootDigest: digestText(text.replace(/\s+/g, "")),
    rows,
  };
};

export const test_mcp_project_transaction_single_hook_cleanup = (): void => {
  const text = fs.readFileSync(
    path.join(__dirname, "test_mcp_project_transactions.ts"),
    "utf8",
  );
  const expected = {
    fixtureDigests: [
      {
        index: 2,
        tryDigest:
          "753a7e3630a369dd891e66c00564165ddb5c92ddc8f68be641ce1a698a50ca0c",
        tryStatements: 136,
      },
      {
        index: 5,
        tryDigest:
          "145928807ad8e93420c2d75cda4ca9ca8254f375f77dd3a04b71ce0f61d0ea59",
        tryStatements: 14,
      },
    ],
    parentDigest:
      "f688644c8ac4a4aeec10b6d7058c7377f5a76560e2706c66d9d2185de1d54659",
    parseDiagnostics: [],
    rootDigest:
      "48e4094dc5574ccf5b5f776f979c74f2b27783a0ea79f11a913b0dae2b144830",
    rows: [
      {
        catchBodies: ["cleanupWriteFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{fs.writeFileSync=nativeCleanupWrite;}",
        containerKind: "TryStatement",
        containerStatements: 136,
        failureHolder:
          "letcleanupWriteFailure:IProjectTransactionFixtureFailure|undefined;",
        finallyDigest:
          "e4b4073093de2a5ed816aba5c336dc5fa5814e859c187a33c4ab9fda0ec66d2a",
        finallySubstantive: {
          digest:
            "e2b0a31d065bd8714352bf7df6dc09388d983c9530153c1a5a64da79944aced6",
          tokens: 29,
        },
        helper: "preserveProjectTransactionSwapCleanup",
        index: 64,
        resource: "actor cleanup write hook",
        tryBody:
          '{cleanupRejected=throwsError(()=>a.saveActors([actorSpec("cleanupFailure")]),["actortemporarywritefailed"],);}',
        tryDigest:
          "0f399340cadcadb8ad8b39f0e44488b1efb9312bdb546e29311733ed8243da49",
        trySubstantive: {
          digest:
            "5276edcd1d1e2dd8c262268ef51ade40a72220c598afaead7e7f2c2b130b07f4",
          tokens: 25,
        },
      },
      {
        catchBodies: ["deniedRemovalFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{fs.renameSync=nativeRename;}",
        containerKind: "TryStatement",
        containerStatements: 136,
        failureHolder:
          "letdeniedRemovalFailure:IProjectTransactionFixtureFailure|undefined;",
        finallyDigest:
          "111b64da71fdaae5be5ecc415e80d824e7e3a69734c8cb882fa2f7968a2a1097",
        finallySubstantive: {
          digest:
            "c6e9941ab2f66f4df0e1ff60a7d0b6598578b40f36dd205a68965ee8f57929d0",
          tokens: 29,
        },
        helper: "preserveProjectTransactionSwapCleanup",
        index: 70,
        resource: "denied-removal rename hook",
        tryBody:
          '{deniedRemoval=throwsError(()=>a.removeActor("knightA"),["actorrenamedenied"],);}',
        tryDigest:
          "84e3fbec36cc523fcbc287db4ba7c09e0dd572675bb01561c4faef74bec62832",
        trySubstantive: {
          digest:
            "56648ec9dfd543839a13746c5fcb43958ee48b11d96f5039289284c049443c9d",
          tokens: 20,
        },
      },
      {
        catchBodies: ["restoredRemovalFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{fs.rmSync=nativeRemove;}",
        containerKind: "TryStatement",
        containerStatements: 136,
        failureHolder:
          "letrestoredRemovalFailure:IProjectTransactionFixtureFailure|undefined;",
        finallyDigest:
          "870a15916cc25bb867b0f3601c38254bc33bd5fc35b9d2815927dba1f9f4cc3a",
        finallySubstantive: {
          digest:
            "841ccc591c69fb7b2998f79165c12d6d3a83129419c9c970fa591e85edd8ed66",
          tokens: 29,
        },
        helper: "preserveProjectTransactionSwapCleanup",
        index: 77,
        resource: "restored-removal remove hook",
        tryBody:
          '{restoredRemoval=throwsError(()=>a.removeActor("knightA"),["actorquarantinebusy"],);}',
        tryDigest:
          "781e19fc69d68a73f1ccd899bc254014010748c2f478ff04032466119c24f68f",
        trySubstantive: {
          digest:
            "1c5ba5ee851e3701a242adf3a8feae527cec7af7814d7a9eaae603cd48563f02",
          tokens: 20,
        },
      },
      {
        catchBodies: ["lateDeleteFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{fs.rmSync=nativeRemove;}",
        containerKind: "TryStatement",
        containerStatements: 136,
        failureHolder:
          "letlateDeleteFailure:IProjectTransactionFixtureFailure|undefined;",
        finallyDigest:
          "185f8f81547bef1531bfdd40f8d72ba9d711c6447c9a1032472a9b1293241150",
        finallySubstantive: {
          digest:
            "c05003b4dff8ef379d883143ede9df7e52a0ed6ba3dd1a80e639178021f25432",
          tokens: 29,
        },
        helper: "preserveProjectTransactionSwapCleanup",
        index: 83,
        resource: "late-delete remove hook",
        tryBody:
          '{lateDeleteRejected=throwsError(()=>a.removeActor("knightA"),["actordeletereportedlatefailure"],);}',
        tryDigest:
          "b4dd68dab2110b7a60174b6e4c560347b2abae137b6bd84b825e524b3552806e",
        trySubstantive: {
          digest:
            "a10ff8628ed4e94b222dc08dbbef61d0eb30bf39b439c09061db6e96990d37c4",
          tokens: 20,
        },
      },
      {
        catchBodies: ["removalSwapFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{fs.renameSync=nativeRename;}",
        containerKind: "TryStatement",
        containerStatements: 136,
        failureHolder:
          "letremovalSwapFailure:IProjectTransactionFixtureFailure|undefined;",
        finallyDigest:
          "8615be3bf4727fbdec5d3ebf4a418adf5421280f1f7844f08346bb340bb852a9",
        finallySubstantive: {
          digest:
            "407d461c694f70d4170721b9270f7d418697b927551ffeecc7e53c75bbd3a9ab",
          tokens: 29,
        },
        helper: "preserveProjectTransactionSwapCleanup",
        index: 90,
        resource: "removal-swap rename hook",
        tryBody:
          '{try{a.removeActor("knightA");}catch(error){removalSwapMessage=(errorasError).message;}}',
        tryDigest:
          "09b4537d7efb5d490da46b7781e9580c955415702206823eb2daac82cfe4b713",
        trySubstantive: {
          digest:
            "b4266b5c8c2ac4e5c2957435fa844b53ff3745b3a4cdfd1d01b8bd847704ffbd",
          tokens: 26,
        },
      },
      {
        catchBodies: ["lockSwapFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{fs.writeFileSync=nativeWrite;}",
        containerKind: "TryStatement",
        containerStatements: 136,
        failureHolder:
          "letlockSwapFailure:IProjectTransactionFixtureFailure|undefined;",
        finallyDigest:
          "32a71ee50f5648f9913cc33a816b2d2d7972893e44f75fc9f7e3956eacfbb5be",
        finallySubstantive: {
          digest:
            "b894cbd7745ad007764d75f570f3a1a2ad8592f25fa82a2e267db90ede33b228",
          tokens: 29,
        },
        helper: "preserveProjectTransactionSwapCleanup",
        index: 105,
        resource: "lock-swap write hook",
        tryBody:
          '{try{a.saveActors([actorSpec("lockSwap")]);}catch(error){lockSwapMessage=(errorasError).message;}}',
        tryDigest:
          "608324cf2d633d208958ddd96ed8d6b130b1f53f9c18473f73211b64a5f61145",
        trySubstantive: {
          digest:
            "0027ece84f49b855cae3fc00799d5670231ed4c4eff4a3b1fcf850b995e9beef",
          tokens: 31,
        },
      },
      {
        catchBodies: ["rootSwapOperationFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{fs.writeFileSync=nativeWrite;}",
        containerKind: "TryStatement",
        containerStatements: 136,
        failureHolder:
          "letrootSwapOperationFailure:IProjectTransactionFixtureFailure|undefined;",
        finallyDigest:
          "34fd51f7feb2d7ae198349b7a5242896fbac78ed853ec872f02c12398c931c36",
        finallySubstantive: {
          digest:
            "35919caef018f023ffe744e0d7ed0781d21e77b21af1843c840b82be72899412",
          tokens: 29,
        },
        helper: "preserveProjectTransactionSwapCleanup",
        index: 116,
        resource: "root-swap operation write hook",
        tryBody:
          '{try{a.saveActors([actorSpec("rootSwap")]);}catch(error){operationMessage=(errorasError).message;}}',
        tryDigest:
          "5b88cf6d80bf0a826c9aea87481fcb6e25b8a10f575485435fe5d91bf0bd9a97",
        trySubstantive: {
          digest:
            "9ac54784069865cf87b9ec0ca87b137c7e8a097012c4b8d955221ec26b5316f0",
          tokens: 31,
        },
      },
      {
        catchBodies: ["aliasRetargetFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{fs.writeFileSync=nativeWrite;}",
        containerKind: "TryStatement",
        containerStatements: 14,
        failureHolder:
          "letaliasRetargetFailure:IProjectTransactionFixtureFailure|undefined;",
        finallyDigest:
          "3cf3022ca3dd506ca892e7018697712e927cce732fdba205a594cc6f65825330",
        finallySubstantive: {
          digest:
            "c285c7a6730cdf3c502d3eed7bb65a831bbbdc663fd7fe5bb2c12b7aad7bf78b",
          tokens: 29,
        },
        helper: "preserveProjectTransactionSwapCleanup",
        index: 12,
        resource: "alias-retarget write hook",
        tryBody: '{project.saveSlate(slateOf("canonicalphysicalroot"));}',
        tryDigest:
          "15bae538c7523d7efe9daf98bd579a1506958531f01f4488a7b572aedd7e7c78",
        trySubstantive: {
          digest:
            "05b91edbb94768751a995ae0b56aad5887aebc9004ca24346cade107991257b2",
          tokens: 10,
        },
      },
    ],
  };
  TestValidator.equals(
    "project transactions protect eight single-hook cleanup lifecycles",
    transactionSingleHookCleanupContract(text),
    {
      fixtureDigests: [
        {
          index: 2,
          tryDigest:
            "ca956ea45910dcec30ae08aa3cf44de62adbe176ff726f894cc6e1af73914dd6",
          tryStatements: 136,
        },
        {
          index: 5,
          tryDigest:
            "145928807ad8e93420c2d75cda4ca9ca8254f375f77dd3a04b71ce0f61d0ea59",
          tryStatements: 14,
        },
      ],
      parentDigest:
        "7cb15774ccee799342d9dda998bebc2962c43e52c5c9451c9eab81803acda843",
      parseDiagnostics: [],
      rootDigest:
        "c89f03146b5bb97f548c53657968bdded99098151f6cb5f9c0d2a567c73dfa5a",
      rows: [
        {
          catchBodies: ["cleanupWriteFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          cleanup: "()=>{fs.writeFileSync=nativeCleanupWrite;}",
          containerKind: "TryStatement",
          containerStatements: 136,
          failureHolder:
            "letcleanupWriteFailure:IProjectTransactionFixtureFailure|undefined;",
          finallyDigest:
            "e4b4073093de2a5ed816aba5c336dc5fa5814e859c187a33c4ab9fda0ec66d2a",
          finallySubstantive: {
            digest:
              "e2b0a31d065bd8714352bf7df6dc09388d983c9530153c1a5a64da79944aced6",
            tokens: 29,
          },
          helper: "preserveProjectTransactionSwapCleanup",
          index: 64,
          resource: "actor cleanup write hook",
          tryBody:
            '{cleanupRejected=throwsError(()=>a.saveActors([actorSpec("cleanupFailure")]),["actortemporarywritefailed"],);}',
          tryDigest:
            "0f399340cadcadb8ad8b39f0e44488b1efb9312bdb546e29311733ed8243da49",
          trySubstantive: {
            digest:
              "5276edcd1d1e2dd8c262268ef51ade40a72220c598afaead7e7f2c2b130b07f4",
            tokens: 25,
          },
        },
        {
          catchBodies: ["deniedRemovalFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          cleanup: "()=>{fs.renameSync=nativeRename;}",
          containerKind: "TryStatement",
          containerStatements: 136,
          failureHolder:
            "letdeniedRemovalFailure:IProjectTransactionFixtureFailure|undefined;",
          finallyDigest:
            "111b64da71fdaae5be5ecc415e80d824e7e3a69734c8cb882fa2f7968a2a1097",
          finallySubstantive: {
            digest:
              "c6e9941ab2f66f4df0e1ff60a7d0b6598578b40f36dd205a68965ee8f57929d0",
            tokens: 29,
          },
          helper: "preserveProjectTransactionSwapCleanup",
          index: 70,
          resource: "denied-removal rename hook",
          tryBody:
            '{deniedRemoval=throwsError(()=>a.removeActor("knightA"),["actorrenamedenied"],);}',
          tryDigest:
            "84e3fbec36cc523fcbc287db4ba7c09e0dd572675bb01561c4faef74bec62832",
          trySubstantive: {
            digest:
              "56648ec9dfd543839a13746c5fcb43958ee48b11d96f5039289284c049443c9d",
            tokens: 20,
          },
        },
        {
          catchBodies: ["restoredRemovalFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          cleanup: "()=>{fs.rmSync=nativeRemove;}",
          containerKind: "TryStatement",
          containerStatements: 136,
          failureHolder:
            "letrestoredRemovalFailure:IProjectTransactionFixtureFailure|undefined;",
          finallyDigest:
            "870a15916cc25bb867b0f3601c38254bc33bd5fc35b9d2815927dba1f9f4cc3a",
          finallySubstantive: {
            digest:
              "841ccc591c69fb7b2998f79165c12d6d3a83129419c9c970fa591e85edd8ed66",
            tokens: 29,
          },
          helper: "preserveProjectTransactionSwapCleanup",
          index: 77,
          resource: "restored-removal remove hook",
          tryBody:
            '{restoredRemoval=throwsError(()=>a.removeActor("knightA"),["actorquarantinebusy"],);}',
          tryDigest:
            "781e19fc69d68a73f1ccd899bc254014010748c2f478ff04032466119c24f68f",
          trySubstantive: {
            digest:
              "1c5ba5ee851e3701a242adf3a8feae527cec7af7814d7a9eaae603cd48563f02",
            tokens: 20,
          },
        },
        {
          catchBodies: ["lateDeleteFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          cleanup: "()=>{fs.rmSync=nativeRemove;}",
          containerKind: "TryStatement",
          containerStatements: 136,
          failureHolder:
            "letlateDeleteFailure:IProjectTransactionFixtureFailure|undefined;",
          finallyDigest:
            "185f8f81547bef1531bfdd40f8d72ba9d711c6447c9a1032472a9b1293241150",
          finallySubstantive: {
            digest:
              "c05003b4dff8ef379d883143ede9df7e52a0ed6ba3dd1a80e639178021f25432",
            tokens: 29,
          },
          helper: "preserveProjectTransactionSwapCleanup",
          index: 83,
          resource: "late-delete remove hook",
          tryBody:
            '{lateDeleteRejected=throwsError(()=>a.removeActor("knightA"),["actordeletereportedlatefailure"],);}',
          tryDigest:
            "b4dd68dab2110b7a60174b6e4c560347b2abae137b6bd84b825e524b3552806e",
          trySubstantive: {
            digest:
              "a10ff8628ed4e94b222dc08dbbef61d0eb30bf39b439c09061db6e96990d37c4",
            tokens: 20,
          },
        },
        {
          catchBodies: ["removalSwapFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          cleanup: "()=>{fs.renameSync=nativeRename;}",
          containerKind: "TryStatement",
          containerStatements: 136,
          failureHolder:
            "letremovalSwapFailure:IProjectTransactionFixtureFailure|undefined;",
          finallyDigest:
            "8615be3bf4727fbdec5d3ebf4a418adf5421280f1f7844f08346bb340bb852a9",
          finallySubstantive: {
            digest:
              "407d461c694f70d4170721b9270f7d418697b927551ffeecc7e53c75bbd3a9ab",
            tokens: 29,
          },
          helper: "preserveProjectTransactionSwapCleanup",
          index: 90,
          resource: "removal-swap rename hook",
          tryBody:
            '{try{a.removeActor("knightA");}catch(error){removalSwapMessage=(errorasError).message;}}',
          tryDigest:
            "09b4537d7efb5d490da46b7781e9580c955415702206823eb2daac82cfe4b713",
          trySubstantive: {
            digest:
              "b4266b5c8c2ac4e5c2957435fa844b53ff3745b3a4cdfd1d01b8bd847704ffbd",
            tokens: 26,
          },
        },
        {
          catchBodies: ["lockSwapFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          cleanup: "()=>{fs.writeFileSync=nativeWrite;}",
          containerKind: "TryStatement",
          containerStatements: 136,
          failureHolder:
            "letlockSwapFailure:IProjectTransactionFixtureFailure|undefined;",
          finallyDigest:
            "32a71ee50f5648f9913cc33a816b2d2d7972893e44f75fc9f7e3956eacfbb5be",
          finallySubstantive: {
            digest:
              "b894cbd7745ad007764d75f570f3a1a2ad8592f25fa82a2e267db90ede33b228",
            tokens: 29,
          },
          helper: "preserveProjectTransactionSwapCleanup",
          index: 105,
          resource: "lock-swap write hook",
          tryBody:
            '{try{a.saveActors([actorSpec("lockSwap")]);}catch(error){lockSwapMessage=(errorasError).message;}}',
          tryDigest:
            "608324cf2d633d208958ddd96ed8d6b130b1f53f9c18473f73211b64a5f61145",
          trySubstantive: {
            digest:
              "0027ece84f49b855cae3fc00799d5670231ed4c4eff4a3b1fcf850b995e9beef",
            tokens: 31,
          },
        },
        {
          catchBodies: ["rootSwapOperationFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          cleanup: "()=>{fs.writeFileSync=nativeWrite;}",
          containerKind: "TryStatement",
          containerStatements: 136,
          failureHolder:
            "letrootSwapOperationFailure:IProjectTransactionFixtureFailure|undefined;",
          finallyDigest:
            "34fd51f7feb2d7ae198349b7a5242896fbac78ed853ec872f02c12398c931c36",
          finallySubstantive: {
            digest:
              "35919caef018f023ffe744e0d7ed0781d21e77b21af1843c840b82be72899412",
            tokens: 29,
          },
          helper: "preserveProjectTransactionSwapCleanup",
          index: 116,
          resource: "root-swap operation write hook",
          tryBody:
            '{try{a.saveActors([actorSpec("rootSwap")]);}catch(error){operationMessage=(errorasError).message;}}',
          tryDigest:
            "5b88cf6d80bf0a826c9aea87481fcb6e25b8a10f575485435fe5d91bf0bd9a97",
          trySubstantive: {
            digest:
              "9ac54784069865cf87b9ec0ca87b137c7e8a097012c4b8d955221ec26b5316f0",
            tokens: 31,
          },
        },
        {
          catchBodies: ["aliasRetargetFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          cleanup: "()=>{fs.writeFileSync=nativeWrite;}",
          containerKind: "TryStatement",
          containerStatements: 14,
          failureHolder:
            "letaliasRetargetFailure:IProjectTransactionFixtureFailure|undefined;",
          finallyDigest:
            "3cf3022ca3dd506ca892e7018697712e927cce732fdba205a594cc6f65825330",
          finallySubstantive: {
            digest:
              "c285c7a6730cdf3c502d3eed7bb65a831bbbdc663fd7fe5bb2c12b7aad7bf78b",
            tokens: 29,
          },
          helper: "preserveProjectTransactionSwapCleanup",
          index: 12,
          resource: "alias-retarget write hook",
          tryBody: '{project.saveSlate(slateOf("canonicalphysicalroot"));}',
          tryDigest:
            "15bae538c7523d7efe9daf98bd579a1506958531f01f4488a7b572aedd7e7c78",
          trySubstantive: {
            digest:
              "05b91edbb94768751a995ae0b56aad5887aebc9004ca24346cade107991257b2",
            tokens: 10,
          },
        },
      ],
    },
  );
  TestValidator.predicate(
    "project-transaction single-hook contract rejects every label mutation",
    expected.rows.every((row) => {
      const mutated = text.replace(
        `resource: "${row.resource}"`,
        `resource: "${row.resource} mutated"`,
      );
      return (
        mutated !== text &&
        JSON.stringify(transactionSingleHookCleanupContract(mutated)) !==
          JSON.stringify(expected)
      );
    }),
  );
};
