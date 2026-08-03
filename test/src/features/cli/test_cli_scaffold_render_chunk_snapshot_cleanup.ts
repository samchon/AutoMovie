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

const renderChunkSnapshotCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "renderchunknormalpublicationopenhook",
    "renderchunktempsuccessoropenhook",
    "renderchunkrecoverydecoyopenhook",
    "renderchunkrootswapopenhook",
  ];
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    preceding: string;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
  }> = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      anchors.some((anchor) =>
        compact(node.finallyBlock!, source).toLowerCase().includes(anchor),
      ) &&
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
        containerKind: ts.SyntaxKind[node.parent.parent.kind]!,
        containerStatements: statements.length,
        finallyDigest: digestText(node.finallyBlock.getText(source)),
        finallySubstantive: leafTokenContract(
          node.finallyBlock.statements,
          source,
        ),
        index,
        preceding: compact(statements[index - 1]!, source),
        substantive: leafTokenContract(node.tryBlock.statements, source),
        tryBody: compact(node.tryBlock, source),
        tryDigest: digestText(node.tryBlock.getText(source)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    lifecycles,
    parseDiagnostics: source.parseDiagnostics.map((diagnostic) =>
      String(diagnostic.messageText),
    ),
  };
};

export const test_cli_scaffold_render_chunk_snapshot_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns four render chunk snapshot cleanup lifecycles",
    renderChunkSnapshotCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["normalChunkCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 2,
          finallyDigest:
            "4fd6af293fa3467eb0d75b6ec4dd5a5223284918aee445328b67e59f41b5c230",
          finallySubstantive: {
            digest:
              "6b94bbf130c0d8f391db59debb95e23a49d734fe368fe84254310383ecf85b7e",
            tokens: 29,
          },
          index: 1,
          preceding: "letnormalChunkCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "879fe28bb259977d5be30651be2f93b4f733809c030942dc0f5e7692ddc1ad97",
            tokens: 38,
          },
          tryBody:
            '{returnrenderChunkSnapshotModule.publishRenderChunkSnapshot({chunk:chunkPublicationId,receipt:normalChunkReceipt,root:chunkPublicationRoot,scope:chunkPublicationScope,tier:"final",tree:captureChunkTree(chunkPublicationRoot,normalChunkSource),});}',
          tryDigest:
            "81a35351a75b70cf2c3c1ca305df34955cb000f4ab77db8a6d0cc032f3cbc755",
        },
        {
          catchBodies: ["tempSuccessorCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "7da45bf78f6faf658138fd804dc9a97d428e768eba28dabe1e0758c9bd19500c",
          finallySubstantive: {
            digest:
              "585022d8d5b7288884c6ceadca0db539aa8041170aa78361a70d339d0e920c35",
            tokens: 29,
          },
          index: 1262,
          preceding:
            "lettempSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "f9b353c15ba8f51cd2ff8f9c86d84fbb323c475238f3dbf9f0a46ca6f572e5c2",
            tokens: 46,
          },
          tryBody:
            '{tempSuccessorRejected=throws(()=>renderChunkSnapshotModule.publishRenderChunkSnapshot({chunk:tempRaceId,receipt:tempRaceReceipt,root:chunkPublicationRoot,scope:chunkPublicationScope,tier:"final",tree:captureChunkTree(chunkPublicationRoot,tempRaceSource),}),);}',
          tryDigest:
            "07ba1ceb968f87b44f6d7436181b5ce3955e5a04e2fea7a181ee57cdda6a22df",
        },
        {
          catchBodies: ["recoveryDecoyCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "aef20cbf37a8ba36cfbfd7703d4889962e8ab5165979c1b9c66360044e18b207",
          finallySubstantive: {
            digest:
              "c6d89073be00109d3b1d43c5c264d0dd3973bdabd30d02651f7308fdb8822806",
            tokens: 29,
          },
          index: 1284,
          preceding:
            "letrecoveryDecoyCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "343770bddfc05dc0b706bfcd35a7d95ef4aac815cdb28fd1822f86a350cd8950",
            tokens: 125,
          },
          tryBody:
            '{recoveryProtected=renderChunkSnapshotModule.currentRenderChunkPublicationProtectsTree({candidate:recoveryCandidate,candidateName:`${recoveryId.slice(7)}.candidate.999999`,capture:(chunk)=>renderChunkSnapshotModule.captureRenderChunkPublication(chunkPublicationRoot,renderChunkSnapshotModule.renderChunkPublicationPath({chunk:chunk.id,root:chunkPublicationRoot,scope:chunkPublicationScope,tier:"final",}),),chunks:newMap([[recoveryId,{id:recoveryId,slot:recoveryReceipt.slot}],...recoveryDecoys.map((decoy,index)=>[decoy.id,{id:decoy.id,slot:`decoy-${index}`}]asconst,),]),});}',
          tryDigest:
            "339c76ace056b5a08af8d4eeaa8a9644af155197efce93cf8aeffe3889fb4201",
        },
        {
          catchBodies: [
            "publicationRootSwapCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "f65c0066fb1502f04ee4a0226a7a0e7d22fe7677f649a003f7108159b2b8596b",
          finallySubstantive: {
            digest:
              "de03834995d8cc52b3d59d846a0794012efac49c2c5785776cd595f19c0c169d",
            tokens: 29,
          },
          index: 1344,
          preceding:
            "letpublicationRootSwapCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "546a5f27f9ea8e792b720aa11eb3dff2b9162d7ede3bf4ddeb1957be5f4fe5d8",
            tokens: 46,
          },
          tryBody:
            '{publicationRootSwapRejected=throws(()=>renderChunkSnapshotModule.publishRenderChunkSnapshot({chunk:rootSwapId,receipt:rootSwapReceipt,root:rootSwapRoot,scope:chunkPublicationScope,tier:"final",tree:captureChunkTree(rootSwapRoot,rootSwapSource),}),);}',
          tryDigest:
            "03e6133ab5ebb60c968063584bbde385261724d3265eb832cfd0b84626530b9e",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
