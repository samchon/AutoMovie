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

const renderGcRemovalCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "rendergctargetrenamehook",
    "rendergcsharedremovalrenamehook",
    "rendergcpublicationrenamehook",
    "rendergctierapplyrenamehook",
    "rendergcstableevidencestathook",
    "rendergcparentsuccessorrenamehook",
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
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
  };
};

export const test_cli_scaffold_render_gc_removal_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns six render GC removal cleanup lifecycles",
    renderGcRemovalCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "gcRenameBoundaryCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 2011,
          finallyDigest:
            "181133e16bace432fcd2fae85df617750647d6a8c8614ec0c07ffd3d62227650",
          finallySubstantive: {
            digest:
              "8e16d9326db34536d2416e337b6a0885ac5b66c026ab617ace2f6dffd350b0d9",
            tokens: 29,
          },
          index: 1418,
          preceding:
            "letgcRenameBoundaryCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "b8bcf1cc1cc2523373328ad1d973d6b0959a6832879467610ba0c61a48c5a0f9",
            tokens: 29,
          },
          tryBody:
            "{gcRenameBoundaryRejected=throws(()=>renderGcModule.removeCapturedRenderGcTarget({isolated:renameBoundaryIsolated,quarantine:gcQuarantine,snapshot:renameBoundarySnapshot,}),);}",
          tryDigest:
            "abd9022ad5b88fac0ca2b7d219fc810df913d165b235da98ff3bd5599cd54440",
        },
        {
          catchBodies: ["sharedRemovalCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 2011,
          finallyDigest:
            "60735d07af041548a97ca502017fce4ca8eea6dffbd59523e09ef11ef61d7c38",
          finallySubstantive: {
            digest:
              "932ebdad023f043a8be07619ec425c8fb3b7bbd218aeb6ec6a4b1ce7235602b4",
            tokens: 29,
          },
          index: 1433,
          preceding:
            "letsharedRemovalCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "d4140d0ce68eb2defed1a924e1d65e7987e2d26deb8518c5f6369059aa265571",
            tokens: 54,
          },
          tryBody:
            '{renderGcModule.removeCapturedRenderGcTarget({isolated:path.join(sharedRemovalStaging,"first"),quarantine:sharedRemovalStaging,snapshot:sharedRemovalFirstSnapshot,});renderGcModule.removeCapturedRenderGcTarget({isolated:path.join(sharedRemovalStaging,"second"),quarantine:sharedRemovalStaging,snapshot:sharedRemovalSecondSnapshot,});}',
          tryDigest:
            "08eaffa1a02af12ff626f57e246512d688f9be1118e71cd257ea6fe444dd7b76",
        },
        {
          catchBodies: [
            "gcPublicationBoundaryCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 2011,
          finallyDigest:
            "ebaded5080136b8f034940c2c55fa573489a844c51360118953a8fa63e02e007",
          finallySubstantive: {
            digest:
              "ba90a4e3f5ed026e80fc0cc9e0f7be3594704de956c42679df8036c65d2b9fbd",
            tokens: 29,
          },
          index: 1459,
          preceding:
            "letgcPublicationBoundaryCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "b01b01521e4a301528c955487cb4544cc011c6c34b595444a61634ebefb88d83",
            tokens: 29,
          },
          tryBody:
            "{gcPublicationBoundaryRejected=throws(()=>renderGcModule.removeCapturedRenderGcTarget({isolated:gcPublicationBoundaryIsolated,quarantine:gcQuarantine,snapshot:gcPublicationBoundarySnapshot,}),);}",
          tryDigest:
            "df415ba3b61423c64b613cf49083a85a6f72ef3b551fa26cb65f3e0c592352f2",
        },
        {
          catchBodies: ["tierApplyCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 2011,
          finallyDigest:
            "3ba98141df0b189046c2ae63ac05979ee5f9d4fb98f2cf2929e22ee2a445e685",
          finallySubstantive: {
            digest:
              "f11e6b13255b930775cd1b234a530abfe24651c68892fc563b5f6363a7e9f2f0",
            tokens: 29,
          },
          index: 1517,
          preceding: "lettierApplyCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "5068ee82465507a2fa72f9bff6498aca0aa6e5da51df9113446e277c13a05599",
            tokens: 38,
          },
          tryBody:
            "{if(tierPair?.evidence!==null&&tierPair?.evidence!==undefined)renderGcModule.removeCapturedRenderQuarantine({evidence:tierPair.evidence,marker:tierPair.marker,quarantine:tierApplyQuarantine,});}",
          tryDigest:
            "1d400b33d807e5ec623dbe3371dc4d86ba2320873b9717a87ae8f777d2b39fb9",
        },
        {
          catchBodies: ["stableEvidenceCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 2011,
          finallyDigest:
            "ba5c206bc2332ed551d68868f5c3832a1940c6b03b0775f3258f452d72929181",
          finallySubstantive: {
            digest:
              "a062ea464f7f837b36fe62c30ea2c1f782adc094fc8670427a6a0bc7038c7802",
            tokens: 29,
          },
          index: 1528,
          preceding:
            "letstableEvidenceCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "7e86674dc795c32d9c3b205bdb2ce569fa0c799a6b3597135d80c4b6c7c880c5",
            tokens: 32,
          },
          tryBody:
            "{renderGcModule.quarantineCapturedRenderTarget({destination:stableEvidenceMarker,isolated:stableEvidenceTarget,quarantine:stableEvidenceParent,snapshot:renderGcModule.captureRenderGcTarget(proxyTierGcRoot,stableEvidenceSource,),});}",
          tryDigest:
            "c03810e523a4a33dccdc37b41739e69badb5994b0c222e2f5ba67b2a29efab57",
        },
        {
          catchBodies: [
            "parentSuccessorCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 2011,
          finallyDigest:
            "8a5fe44fea7d4a8efec33b89b142abf9f54d16425724eb6aa149011a8abd15c2",
          finallySubstantive: {
            digest:
              "a782d299c2788ddd7ef24f76a4ef6994d1a9ea3b63cfd4e68f1414679730143b",
            tokens: 29,
          },
          index: 1545,
          preceding:
            "letparentSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "c90fa05908abff5dddb285f408f027cbabd2de038f69f5ffeb781a06f8850558",
            tokens: 22,
          },
          tryBody:
            "{renderGcModule.removeCapturedRenderQuarantine({evidence:parentSuccessorInspection.evidence,marker:parentSuccessorMarkerSnapshot,quarantine:tierApplyQuarantine,});}",
          tryDigest:
            "c9a0e0faa88b4ab8902721d6ea5e387c44dc985606d2bf68eea73533c5bde66c",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
