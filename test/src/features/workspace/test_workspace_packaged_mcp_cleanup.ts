import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const tokenDigest = (node: ts.Node, source: ts.SourceFile): string => {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    node.getText(source),
  );
  const tokens: Array<readonly [ts.SyntaxKind, string, boolean]> = [];
  for (;;) {
    const kind = scanner.scan();
    if (kind === ts.SyntaxKind.EndOfFileToken) break;
    tokens.push([
      kind,
      scanner.getTokenText(),
      scanner.hasPrecedingLineBreak(),
    ]);
  }
  const literals: Array<readonly [ts.SyntaxKind, string]> = [];
  const syntax: Array<readonly [ts.SyntaxKind, number]> = [];
  const visit = (child: ts.Node): void => {
    if (
      ts.isStringLiteralLike(child) ||
      [
        ts.SyntaxKind.TemplateHead,
        ts.SyntaxKind.TemplateMiddle,
        ts.SyntaxKind.TemplateTail,
        ts.SyntaxKind.RegularExpressionLiteral,
        ts.SyntaxKind.JsxText,
      ].includes(child.kind)
    )
      literals.push([child.kind, child.getText(source)]);
    const children: ts.Node[] = [];
    ts.forEachChild(child, (nested) => {
      children.push(nested);
    });
    syntax.push([child.kind, children.length]);
    children.forEach(visit);
  };
  visit(node);
  const diagnostics = (
    source as ts.SourceFile & {
      parseDiagnostics: ReadonlyArray<{
        code: number;
        length: number | undefined;
        start: number | undefined;
      }>;
    }
  ).parseDiagnostics.map((diagnostic) => [
    diagnostic.code,
    diagnostic.start ?? null,
    diagnostic.length ?? null,
  ]);
  return createHash("sha256")
    .update(JSON.stringify({ diagnostics, literals, syntax, tokens }))
    .digest("hex");
};

const expectedDigest = (digest: string, _description: string): string => digest;

const identifierPath = (node: ts.Expression): string | null => {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    const parent = identifierPath(node.expression);
    return parent === null ? null : `${parent}.${node.name.text}`;
  }
  return null;
};

const containsIdentifier = (node: ts.Node, name: string): boolean => {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (ts.isIdentifier(child) && child.text === name) found = true;
    else if (found === false) ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

interface IPackagedMcpCleanupContract {
  cleanupCalls: Array<{ callDigest: string; failure: string | null }>;
  declarations: Array<{
    initializerDigest: string | null;
    kind: "const" | "let" | "var";
    name: string;
  }>;
  failureWrites: string[];
  functions: Record<
    "assert" | "preserveCleanupFailure",
    Array<{
      async: boolean;
      bodyDigest: string;
      parameterDigests: string[];
    }>
  >;
  lifecycle: Array<{
    catchDigest: string | null;
    finallyDigest: string;
    probeDigest: string;
  }>;
  processExits: string[];
  sourceCount: number;
  topLevelActions: string[];
}

/** Bind installed-package MCP client cleanup and primary-error precedence. */
const packagedMcpCleanupContract = (
  text: string,
): IPackagedMcpCleanupContract => {
  const outer = ts.createSourceFile(
    "internals/e2e-tgz.mjs",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const embedded = outer.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "CLIENT_SOURCE" &&
          declaration.initializer !== undefined &&
          ts.isNoSubstitutionTemplateLiteral(declaration.initializer)
            ? [declaration.initializer.text]
            : [],
        )
      : [],
  );
  const source = ts.createSourceFile(
    "packaged-mcp-client.mjs",
    embedded[0] ?? "",
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const functions: IPackagedMcpCleanupContract["functions"] = {
    assert: [],
    preserveCleanupFailure: [],
  };
  const declarations: IPackagedMcpCleanupContract["declarations"] = [];
  const topLevelActions: string[] = [];
  let resourceSetupStarted = false;
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          ["assert", "preserveCleanupFailure"].includes(
            declaration.name.text,
          ) &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
        ) {
          const name = declaration.name
            .text as keyof IPackagedMcpCleanupContract["functions"];
          functions[name].push({
            async:
              declaration.initializer.modifiers?.some(
                (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
              ) === true,
            bodyDigest: tokenDigest(declaration.initializer.body, source),
            parameterDigests: declaration.initializer.parameters.map(
              (parameter) => tokenDigest(parameter, source),
            ),
          });
        }
        if (
          ts.isIdentifier(declaration.name) &&
          ["client", "clientFailure"].includes(declaration.name.text)
        ) {
          declarations.push({
            initializerDigest:
              declaration.initializer === undefined
                ? null
                : tokenDigest(declaration.initializer, source),
            kind:
              statement.declarationList.flags & ts.NodeFlags.Const
                ? "const"
                : statement.declarationList.flags & ts.NodeFlags.Let
                  ? "let"
                  : "var",
            name: declaration.name.text,
          });
        }
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "bin"
        )
          resourceSetupStarted = true;
      }
    if (resourceSetupStarted)
      topLevelActions.push(
        `${
          ts.isVariableStatement(statement)
            ? "variable"
            : ts.isExpressionStatement(statement)
              ? "expression"
              : ts.isTryStatement(statement)
                ? "try"
                : `syntax-${statement.kind}`
        }:${tokenDigest(statement, source)}`,
      );
  }

  const cleanupCalls: IPackagedMcpCleanupContract["cleanupCalls"] = [];
  const failureWrites: string[] = [];
  const lifecycle: IPackagedMcpCleanupContract["lifecycle"] = [];
  const processExits: string[] = [];
  const targetsFailureHolder = (node: ts.Node): boolean => {
    if (ts.isIdentifier(node)) return node.text === "clientFailure";
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isTypeAssertionExpression(node)
    )
      return targetsFailureHolder(node.expression);
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    )
      return targetsFailureHolder(node.expression);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    )
      return targetsFailureHolder(node.left);
    if (ts.isArrayLiteralExpression(node) || ts.isArrayBindingPattern(node))
      return node.elements.some((element) => targetsFailureHolder(element));
    if (ts.isObjectLiteralExpression(node))
      return node.properties.some((property) => {
        if (ts.isPropertyAssignment(property))
          return targetsFailureHolder(property.initializer);
        if (ts.isShorthandPropertyAssignment(property))
          return property.name.text === "clientFailure";
        if (ts.isSpreadAssignment(property))
          return targetsFailureHolder(property.expression);
        return false;
      });
    if (ts.isObjectBindingPattern(node))
      return node.elements.some((element) =>
        targetsFailureHolder(element.name),
      );
    if (ts.isBindingElement(node)) return targetsFailureHolder(node.name);
    if (ts.isSpreadElement(node)) return targetsFailureHolder(node.expression);
    return false;
  };
  const recordBinding = (
    kind: string,
    node: ts.Node & { name?: ts.Node },
  ): void => {
    if (node.name !== undefined && targetsFailureHolder(node.name))
      failureWrites.push(`${kind}:${tokenDigest(node, source)}`);
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.finallyBlock !== undefined &&
      containsIdentifier(node.finallyBlock, "preserveCleanupFailure")
    )
      lifecycle.push({
        catchDigest:
          node.catchClause === undefined
            ? null
            : tokenDigest(node.catchClause, source),
        finallyDigest: tokenDigest(node.finallyBlock, source),
        probeDigest: tokenDigest(node.tryBlock, source),
      });
    if (ts.isVariableDeclaration(node)) recordBinding("declaration", node);
    else if (ts.isParameter(node)) recordBinding("parameter", node);
    else if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node))
      recordBinding("function", node);
    else if (ts.isClassDeclaration(node) || ts.isClassExpression(node))
      recordBinding("class", node);
    else if (ts.isImportClause(node)) recordBinding("import", node);
    else if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node))
      recordBinding("import", node);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      targetsFailureHolder(node.left)
    )
      failureWrites.push(`assignment:${tokenDigest(node, source)}`);
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(
        node.operator,
      ) &&
      targetsFailureHolder(node.operand)
    )
      failureWrites.push(`update:${tokenDigest(node, source)}`);
    if (ts.isDeleteExpression(node) && targetsFailureHolder(node.expression))
      failureWrites.push(`delete:${tokenDigest(node, source)}`);
    if (
      (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
      ts.isVariableDeclarationList(node.initializer) === false &&
      targetsFailureHolder(node.initializer)
    )
      failureWrites.push(`iteration:${tokenDigest(node.initializer, source)}`);
    if (
      ts.isCallExpression(node) &&
      identifierPath(node.expression) === "process.exit"
    )
      processExits.push(tokenDigest(node, source));
    if (
      ts.isCallExpression(node) &&
      identifierPath(node.expression) === "client.close"
    ) {
      let cursor: ts.Node | undefined = node;
      let policy: ts.CallExpression | undefined;
      while (cursor?.parent !== undefined) {
        if (
          ts.isArrowFunction(cursor) &&
          ts.isCallExpression(cursor.parent) &&
          ts.isIdentifier(cursor.parent.expression) &&
          cursor.parent.expression.text === "preserveCleanupFailure" &&
          cursor.parent.arguments[1] === cursor
        ) {
          policy = cursor.parent;
          break;
        }
        cursor = cursor.parent;
      }
      cleanupCalls.push({
        callDigest: tokenDigest(node, source),
        failure:
          policy?.arguments[0] === undefined
            ? null
            : ts.isIdentifier(policy.arguments[0])
              ? policy.arguments[0].text
              : tokenDigest(policy.arguments[0], source),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    cleanupCalls,
    declarations,
    failureWrites,
    functions,
    lifecycle,
    processExits,
    sourceCount: embedded.length,
    topLevelActions,
  };
};

/** The packaged MCP probe closes its client primary-first on every exit. */
export const test_workspace_packaged_mcp_cleanup = (): void => {
  const source = fs.readFileSync(
    path.join(ROOT, "internals", "e2e-tgz.mjs"),
    "utf8",
  );
  TestValidator.equals(
    "packaged MCP client cleanup",
    packagedMcpCleanupContract(source),
    {
      cleanupCalls: [
        {
          callDigest:
            "b4b809ecaba27749bffa14cb04df1b8aef7267a58fa1235a59fb534d51e1392f",
          failure: "clientFailure",
        },
      ],
      declarations: [
        {
          initializerDigest:
            "43e6a3f28b4fb5785705d5f49739212b98d5f8c0e5ed4094258bafa58c509f09",
          kind: "const",
          name: "client",
        },
        {
          initializerDigest: null,
          kind: "let",
          name: "clientFailure",
        },
      ],
      failureWrites: [
        "declaration:10b9b2ee066fc4f49e618f5a464f706d8a23e149d8db78b4b9320a5163069fd6",
        "assignment:dd9513cf8098cb9bc48d5ee9bb429a5a4bcf96e3916c4a406035ef0da2085c31",
      ],
      functions: {
        assert: [
          {
            async: false,
            bodyDigest: expectedDigest(
              "b265840bf99182805fe3c451c6341f8ee93f9dcdd8dba6aff6569d48408ca7d4",
              "{if(!condition)thrownewError(`✗#{name}:#{detail}`);console.log(`✓#{name}`);}",
            ),
            parameterDigests: [
              "c603b0e1002c2c73acf722ce565cd4035b1f8a890702cb5938a2c14d25381753",
              "8e6c06d8d686ddac1aeffb36308c1ccfe0c1c2b2c94e384c9f5ef59839e94a9b",
              "062de4199123e87ffa04b8c586a68a753dfe1da0f00685420d78bfd9611708ae",
            ],
          },
        ],
        preserveCleanupFailure: [
          {
            async: true,
            bodyDigest:
              "471734536bba6243c5478bd2c6d244e90ceae9773120d6b233920307f2f14119",
            parameterDigests: [
              "7dbd2433fb74ab5c3e5a2aaad1fba9c0f3106d62fd9f819921a5ce0ce4154940",
              "060c4a2c8c157c4c87c48412f2f6b793e75bf64750106125cc0ba63f5fd4b104",
            ],
          },
        ],
      },
      lifecycle: [
        {
          catchDigest:
            "e7eb6be6c44cccad1718585e0dcf7e0e6a1acd955f77e5a92095c6443ede2cdc",
          finallyDigest:
            "1a260beee5550b83b8702b00d8747004114cffbdc1af75156aa2a090ce524792",
          probeDigest:
            "bfa71859dd9feddf4bc8609c7ee1edf793a307ece6ce15eb873b5814654fcab2",
        },
      ],
      processExits: [],
      sourceCount: 1,
      topLevelActions: [
        "variable:f9b2ab0b39a6383149755a6466f7f3231c23d7177a211d9297a8afb22f2e0f3a",
        "variable:00c6db51054a2f53cb008385ad28bd570584c734209eb29daa7c5ca5e67b9238",
        "expression:e53c35d0ccf1d1aeb266c822ec604547c17ee7fa1c2885091ef723883b7f39b6",
        "expression:2a7897d8430d3f8c3a6ba1028de7c7598ea4db678741f562a5d187feed96b9d0",
        "variable:7512f73310edb014ecde288689ea928d16a90b5ab842c62ffafd8249a4985ac2",
        "variable:8bca35e713bb795d6921b80db6e87a2a240e7ebfdac090c7ad4978bbc91af64c",
        "variable:76c29700e1407a10d9bdda2d5599ed9c866666def9a9e619deeb700335c6f62b",
        "try:de3fc5c98ee4ed28a944fc13af2c0432e671103bf2da693cf425ad8a41a47244",
      ],
    },
  );
};
