import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

interface IIdentityLoaderContract {
  body: string | null;
  callSites: string[];
  declarations: Array<{
    initializer: string | null;
    kind: "const" | "let" | "var";
    name: string;
    type: string | null;
  }>;
  parameters: string[];
  returnType: string | null;
  writes: Array<{
    name: string;
    operator: string;
    value: string;
  }>;
}

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

/** Bind the complete face identity request state machine and its consumers. */
const identityLoaderContract = (text: string): IIdentityLoaderContract => {
  const source = ts.createSourceFile(
    "packages/playground/src/face.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names = new Set([
    "identityLoaded",
    "identityRequest",
    "identityUrl",
    "loadIdentity",
  ]);
  const declarations: IIdentityLoaderContract["declarations"] = [];
  const loaders: ts.ArrowFunction[] = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const kind =
      statement.declarationList.flags & ts.NodeFlags.Const
        ? "const"
        : statement.declarationList.flags & ts.NodeFlags.Let
          ? "let"
          : "var";
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        !names.has(declaration.name.text)
      )
        continue;
      declarations.push({
        initializer:
          declaration.initializer === undefined
            ? null
            : compact(declaration.initializer, source),
        kind,
        name: declaration.name.text,
        type:
          declaration.type === undefined
            ? null
            : compact(declaration.type, source),
      });
      if (
        declaration.name.text === "loadIdentity" &&
        declaration.initializer !== undefined &&
        ts.isArrowFunction(declaration.initializer)
      )
        loaders.push(declaration.initializer);
    }
  }

  const writes: IIdentityLoaderContract["writes"] = [];
  const callSites: Array<{ position: number; text: string }> = [];
  const loader = loaders.length === 1 ? loaders[0]! : null;
  const visitLoader = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      ts.isIdentifier(node.left) &&
      names.has(node.left.text) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    )
      writes.push({
        name: node.left.text,
        operator: node.operatorToken.getText(source),
        value: compact(node.right, source),
      });
    ts.forEachChild(node, visitLoader);
  };
  if (loader !== null) visitLoader(loader.body);

  const visitCalls = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "loadIdentity"
    ) {
      let statement: ts.Node = node;
      while (
        statement.parent !== undefined &&
        !ts.isExpressionStatement(statement)
      )
        statement = statement.parent;
      if (ts.isExpressionStatement(statement))
        callSites.push({
          position: statement.getStart(source),
          text: compact(statement, source),
        });
    }
    ts.forEachChild(node, visitCalls);
  };
  visitCalls(source);

  return {
    body: loader === null ? null : compact(loader.body, source),
    callSites: callSites
      .sort((x, y) => x.position - y.position)
      .map((entry) => entry.text),
    declarations,
    parameters:
      loader?.parameters.map((parameter) => compact(parameter, source)) ?? [],
    returnType:
      loader?.type === undefined ? null : compact(loader.type, source),
    writes,
  };
};

/**
 * The face identity loader coalesces active URLs, retries failed URLs, and
 * rejects stale response ownership without changing its two production calls.
 */
export const test_workspace_face_identity_loader = (): void => {
  const face = fs.readFileSync(
    path.join(ROOT, "packages", "playground", "src", "face.ts"),
    "utf8",
  );
  TestValidator.equals(
    "face identity loading is race-safe, coalesced, and retryable",
    identityLoaderContract(face),
    {
      body: '{if(identityRequest?.url===url){identityUrl=url;returnidentityRequest.promise;}if(url===identityUrl)returnPromise.resolve();identityUrl=url;identityLoaded=false;identityDelta.fill(0);constdone=():void=>{(faceGeometry.morphAttributes.position[IDENTITY]asTHREE.BufferAttribute).needsUpdate=true;};if(!url){done();returnPromise.resolve();}consttoken=Symbol(url);constpromise=fetch(url).then((r)=>(r.ok?r.json():null)).then((j:{identity:number[]}|null)=>{if(identityUrl!==url)return;if(!j){identityUrl="";return;}identityDelta.set(j.identity);identityLoaded=true;}).catch(()=>{if(identityUrl===url)identityUrl="";}).then(()=>{if(identityRequest?.token===token)identityRequest=null;done();});identityRequest={promise,token,url};returnpromise;}',
      callSites: [
        'voidloadIdentity("/models/hero1-identity.json");',
        'voidloadIdentity(p.data?.identity??"").then(()=>{setIdentity(p.data?1:0);});',
      ],
      declarations: [
        {
          initializer: "false",
          kind: "let",
          name: "identityLoaded",
          type: null,
        },
        {
          initializer: '""',
          kind: "let",
          name: "identityUrl",
          type: null,
        },
        {
          initializer: "null",
          kind: "let",
          name: "identityRequest",
          type: "{promise:Promise<void>;token:symbol;url:string;}|null",
        },
        {
          initializer:
            '(url:string):Promise<void>=>{if(identityRequest?.url===url){identityUrl=url;returnidentityRequest.promise;}if(url===identityUrl)returnPromise.resolve();identityUrl=url;identityLoaded=false;identityDelta.fill(0);constdone=():void=>{(faceGeometry.morphAttributes.position[IDENTITY]asTHREE.BufferAttribute).needsUpdate=true;};if(!url){done();returnPromise.resolve();}consttoken=Symbol(url);constpromise=fetch(url).then((r)=>(r.ok?r.json():null)).then((j:{identity:number[]}|null)=>{if(identityUrl!==url)return;if(!j){identityUrl="";return;}identityDelta.set(j.identity);identityLoaded=true;}).catch(()=>{if(identityUrl===url)identityUrl="";}).then(()=>{if(identityRequest?.token===token)identityRequest=null;done();});identityRequest={promise,token,url};returnpromise;}',
          kind: "const",
          name: "loadIdentity",
          type: null,
        },
      ],
      parameters: ["url:string"],
      returnType: "Promise<void>",
      writes: [
        { name: "identityUrl", operator: "=", value: "url" },
        { name: "identityUrl", operator: "=", value: "url" },
        { name: "identityLoaded", operator: "=", value: "false" },
        { name: "identityUrl", operator: "=", value: '""' },
        { name: "identityLoaded", operator: "=", value: "true" },
        { name: "identityUrl", operator: "=", value: '""' },
        { name: "identityRequest", operator: "=", value: "null" },
        {
          name: "identityRequest",
          operator: "=",
          value: "{promise,token,url}",
        },
      ],
    },
  );
};
