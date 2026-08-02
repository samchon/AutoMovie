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
  const tokens: Array<readonly [ts.SyntaxKind, string]> = [];
  for (;;) {
    const kind = scanner.scan();
    if (kind === ts.SyntaxKind.EndOfFileToken) break;
    tokens.push([kind, scanner.getTokenText()]);
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
  return createHash("sha256")
    .update(JSON.stringify({ literals, syntax, tokens }))
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
            "1867989d23610327a9bbfab619f3e64bbd54bc9d1d047ec586419e10f70d27cc",
          failure: "clientFailure",
        },
      ],
      declarations: [
        {
          initializerDigest:
            "1e81ada3dec1f24adbf24d0dbaf6969bd28d68dd2b9e39fc49164b37547715cb",
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
        "declaration:ad8769e4ecc83910365b5948ce38bf4884c4a9f9ea4c73de95d3773f0e2f8aac",
        "assignment:d5876f920a9062f9cb4ba8c3dccf2a8f5e6563df80f2ec6d79aa9b63339b271d",
      ],
      functions: {
        assert: [
          {
            async: false,
            bodyDigest: expectedDigest(
              "46ebeb6f9b66e8a7508f24263b28daf68fc391b973684b5c58f853617958fe90",
              "{if(!condition)thrownewError(`✗#{name}:#{detail}`);console.log(`✓#{name}`);}",
            ),
            parameterDigests: [
              "489d9b1667d940a1f918209324bc2ed78bdd234d48b1dd85a14cf8dbcfab6571",
              "50fbcbdc811513094be8c69536261738a0d3acd5a0b0abdf8aa5b19de1975a28",
              "56b2583bf974fb5e437ba71242ddae996753e6e92b78e7fcc515a762d2824f0b",
            ],
          },
        ],
        preserveCleanupFailure: [
          {
            async: true,
            bodyDigest:
              "3827cdde8b964118fc8c7a8fee4ad1db4a078e739b90a2c8a0e0e04d38ec7e09",
            parameterDigests: [
              "b54056d15532279ebd2ee27e7fe8c0826a0fa979cb96bf88392421f08ddb6b2e",
              "bd4924d579d1306da24b66ee2df595bcd856cb5dce1a1155477e05165de80abe",
            ],
          },
        ],
      },
      lifecycle: [
        {
          catchDigest:
            "ce254f22d4d57199f3e6c796a0f5f283527ee0c093a371cf10df0b8cd43a418a",
          finallyDigest:
            "4cf894b90582fcfb136ab497d136c943b03ec5c23bb7ac779167f96de189be25",
          probeDigest:
            "675559ce9bf150d44311b6e424d084f34f07804cebe6afab670b213c104c60af",
        },
      ],
      processExits: [],
      sourceCount: 1,
      topLevelActions: [
        "variable:28f1e0a97961b0cc71972e8026b01ebf057b77230642b2a2253c191e9c304a22",
        "variable:b2fa6e8f8f4455494fadb5528257bcfbd36531639ebff452aa4fd93200af7f98",
        "expression:df11a4c92466fff165965cc02dc87bcc6e5a7b1a260bb41e4e621970b66027ed",
        "expression:ac4bec418c05a74357201c32f2cee3071fbce32987e6269972b11dba4e91a6f4",
        "variable:273340b01e7c2ca418d8508eea111f4c50869e8df44a5a546881bafd830dae0b",
        "variable:419dfa471917c2342dcf191e2823d9d1ddee6d58c65c9d6fc0a114b328445e29",
        "variable:67936f5a09395cffa7d0d117589ba933c0dfee01672f1b1cf94c0539d959de8a",
        "try:982f4a90940108ebc08eb890a41e5ee59a805f2f9846af11e2f922310c8cecbb",
      ],
    },
  );
};
