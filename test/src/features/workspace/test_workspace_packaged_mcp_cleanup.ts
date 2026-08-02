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
  return createHash("sha256").update(JSON.stringify(tokens)).digest("hex");
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
            "bfa36ed4960767c6af2bc034e15f8294e580373d628dadfd5a8de6c66144a9cc",
          failure: "clientFailure",
        },
      ],
      declarations: [
        {
          initializerDigest:
            "06047bd30fc65edbdf13ec571a7287621d0de1d4f83893303ea8ac829e9929f4",
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
        "declaration:364976945ec76e3893410445ffdb1c8183cb28d727adf027e9cda6a59c68e609",
        "assignment:cf6e11f71fea417dde0e70d77cc65b6c79ed1980d7d163686f1ba8c84bd3bcc3",
      ],
      functions: {
        assert: [
          {
            async: false,
            bodyDigest: expectedDigest(
              "658a8c522345f82e1ab2f45ddb0182f8df48e206ff8485fc1fad574a700e8367",
              "{if(!condition)thrownewError(`✗#{name}:#{detail}`);console.log(`✓#{name}`);}",
            ),
            parameterDigests: [
              "5fbff4b5e0026045beaeeeb11a7158ef94dcdf28713cca6ea4c5d3becd7b6d0f",
              "df4a4ee1490054c8dd755cfa29f1954d808578ae5d79166a72a027e53aea440f",
              "6cd1cbe184067bb4770cc2f5faf1cc29aa47a56abc4a815122923462adad3f66",
            ],
          },
        ],
        preserveCleanupFailure: [
          {
            async: true,
            bodyDigest:
              "28389ac4d17b9509e036cfb19116dde97300d995139eeeb578ff4fca9820896b",
            parameterDigests: [
              "bd6915f99a0fb80d2fdfc2f460fd78073deae7e9d5a1a7b2921305ab50f41bfe",
              "6bb173ef83cac6a1b9b70304bbc8c22be31ea6fd94c4dbe09cb1dba462fb4f86",
            ],
          },
        ],
      },
      lifecycle: [
        {
          catchDigest:
            "a0fe30ba4bca1975fd7860a9246a8d12b33b5b0809a1071b6aed59893c501a1a",
          finallyDigest:
            "5ea951e0ac1ea5be2d9d6d874812e31d1304da87bcbd2f13900c4a0f79b4404c",
          probeDigest:
            "e57ebd1711cdd3d0fe3c840d12515649a9ec21ab0ae89dfaa7fad4ab329a0735",
        },
      ],
      processExits: [],
      sourceCount: 1,
      topLevelActions: [
        "variable:3632d97f8213152947201578283b5598463d9ed89d7f706dca561c4e76128062",
        "variable:51cc13f846ed864dcbf13c1611a6e032acbf1d9942fca795bacf1b130d06c957",
        "expression:74085183de4c8661d0a93e14146b89eff269cbd692635bc80ff95a15ea6cf47c",
        "expression:212c408f45765c987a46386f5bcb5d4d7960a8f69a709932d7b9b90c54e38ca0",
        "variable:0c22409b779168871e01abb7a7c7f0909931ad2c10a5e0ec7fb7d4ab35d29fc3",
        "variable:ed79343dcafef6e988750359736b783bee07253d4a3e560f6051cbd118b2b60f",
        "variable:84ce4275db6f2334e4e2e953123ea4577b081ceb3e4e6544297ca4814190a4c8",
        "try:c357f9b3627cfbcd533a887173f16c7f388a54971f996b722ded9ba960ddb8b2",
      ],
    },
  );
};
