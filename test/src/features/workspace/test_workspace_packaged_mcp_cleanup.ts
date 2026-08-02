import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node
    .getText(source)
    .replace(/\/\/[^\r\n]*/g, "")
    .replace(/\s+/g, "");

const templateSource = (value: string): string =>
  value.replaceAll("#{", "$" + "{");

interface IPackagedMcpCleanupContract {
  cleanupCalls: Array<{ call: string; failure: string | null }>;
  declarations: Array<{
    initializer: string | null;
    kind: "const" | "let" | "var";
    name: string;
  }>;
  failureWrites: string[];
  functions: Record<
    "assert" | "preserveCleanupFailure",
    Array<{
      async: boolean;
      body: string;
      parameters: string[];
    }>
  >;
  lifecycle: Array<{
    catch: string | null;
    finally: string;
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
            body: compact(declaration.initializer.body, source),
            parameters: declaration.initializer.parameters.map((parameter) =>
              compact(parameter, source),
            ),
          });
        }
        if (
          ts.isIdentifier(declaration.name) &&
          ["client", "clientFailure"].includes(declaration.name.text)
        ) {
          declarations.push({
            initializer:
              declaration.initializer === undefined
                ? null
                : compact(declaration.initializer, source),
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
        ts.isTryStatement(statement)
          ? `try:${createHash("sha256")
              .update(compact(statement, source))
              .digest("hex")}`
          : compact(statement, source),
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
      failureWrites.push(`${kind}:${compact(node, source)}`);
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.finallyBlock !== undefined &&
      compact(node.finallyBlock, source).includes("preserveCleanupFailure")
    )
      lifecycle.push({
        catch:
          node.catchClause === undefined
            ? null
            : compact(node.catchClause, source),
        finally: compact(node.finallyBlock, source),
        probeDigest: createHash("sha256")
          .update(compact(node.tryBlock, source))
          .digest("hex"),
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
      failureWrites.push(`assignment:${compact(node, source)}`);
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(
        node.operator,
      ) &&
      targetsFailureHolder(node.operand)
    )
      failureWrites.push(`update:${compact(node, source)}`);
    if (ts.isDeleteExpression(node) && targetsFailureHolder(node.expression))
      failureWrites.push(`delete:${compact(node, source)}`);
    if (
      (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
      ts.isVariableDeclarationList(node.initializer) === false &&
      targetsFailureHolder(node.initializer)
    )
      failureWrites.push(`iteration:${compact(node.initializer, source)}`);
    if (
      ts.isCallExpression(node) &&
      compact(node.expression, source) === "process.exit"
    )
      processExits.push(compact(node, source));
    if (
      ts.isCallExpression(node) &&
      compact(node.expression, source) === "client.close"
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
        call: compact(node, source),
        failure:
          policy?.arguments[0] === undefined
            ? null
            : compact(policy.arguments[0], source),
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
      cleanupCalls: [{ call: "client.close()", failure: "clientFailure" }],
      declarations: [
        {
          initializer: 'newClient({name:"automovie-tgz-e2e",version:"0.0.0"})',
          kind: "const",
          name: "client",
        },
        {
          initializer: null,
          kind: "let",
          name: "clientFailure",
        },
      ],
      failureWrites: [
        "declaration:clientFailure",
        "assignment:clientFailure={error}",
      ],
      functions: {
        assert: [
          {
            async: false,
            body: templateSource(
              "{if(!condition)thrownewError(`✗#{name}:#{detail}`);console.log(`✓#{name}`);}",
            ),
            parameters: ["name", "condition", "detail"],
          },
        ],
        preserveCleanupFailure: [
          {
            async: true,
            body: '{try{awaitcleanup();}catch(cleanupError){if(failure===undefined)throwcleanupError;thrownewAggregateError([failure.error,cleanupError],"PackagedMCPclientcleanupfailedaftertheprobefailed.",);}}',
            parameters: ["failure", "cleanup"],
          },
        ],
      },
      lifecycle: [
        {
          catch: "catch(error){clientFailure={error};throwerror;}",
          finally:
            "{awaitpreserveCleanupFailure(clientFailure,()=>client.close());}",
          probeDigest:
            "a3269ac396e61b9f44c04783fbdc7a667bbce86cec7a6868ff5f46fd020fbeb0",
        },
      ],
      processExits: [],
      sourceCount: 1,
      topLevelActions: [
        'constbin=path.resolve("node_modules/@automovie/mcp/lib/bin.js");',
        'constprojectRoot=path.resolve("mcp-host");',
        "mkdirSync(projectRoot,{recursive:true});",
        'writeFileSync(path.join(projectRoot,"automovie.config.ts"),"exportdefault{};",);',
        'consttransport=newStdioClientTransport({command:process.execPath,args:[bin],env:{...getDefaultEnvironment(),AUTOMOVIE_PROJECT_ROOT:projectRoot},stderr:"pipe",});',
        'constclient=newClient({name:"automovie-tgz-e2e",version:"0.0.0"});',
        "letclientFailure;",
        "try:ad5f288917e7b981005acd019f7b2cde55f3f8060eadcc650dcd2e784909849b",
      ],
    },
  );
};
