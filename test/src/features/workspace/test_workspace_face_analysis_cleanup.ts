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

interface IFaceAnalysisCleanupContract {
  directCleanupCalls: string[];
  exits: Array<{
    afterWrapper: boolean;
    call: string;
    condition: string | null;
    owner: string | null;
    topLevelGuard: boolean;
  }>;
  imports: string[];
  launchOwners: Array<string | null>;
  pageCalls: Record<string, number>;
  unownedPageCalls: string[];
  wrappers: Array<{
    arguments: number;
    awaited: boolean;
    label: string;
    launch: string;
    operationAsync: boolean;
    operationDigest: string;
    operationParameters: string[];
    pageOptions: string;
    topLevelAwaited: boolean;
  }>;
}

/** Bind every direct face-analysis page operation to its lifecycle wrapper. */
const faceAnalysisCleanupContract = (
  file: string,
  text: string,
): IFaceAnalysisCleanupContract => {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const imports = source.statements.flatMap((statement) =>
    ts.isImportDeclaration(statement) &&
    ts.isImportClause(statement.importClause) &&
    statement.importClause.namedBindings !== undefined &&
    ts.isNamedImports(statement.importClause.namedBindings) &&
    statement.importClause.namedBindings.elements.some(
      (element) => element.name.text === "withBrowserPage",
    )
      ? [compact(statement, source)]
      : [],
  );
  const ownerOf = (node: ts.Node): string | null => {
    let cursor: ts.Node | undefined = node;
    while (cursor?.parent !== undefined) {
      if (
        ts.isArrowFunction(cursor) &&
        ts.isCallExpression(cursor.parent) &&
        ts.isIdentifier(cursor.parent.expression) &&
        cursor.parent.expression.text === "withBrowserPage"
      ) {
        const index = cursor.parent.arguments.findIndex(
          (argument) => argument === cursor,
        );
        const label = compact(cursor.parent.arguments[2]!, source);
        return index === 0
          ? `launch:${label}`
          : index === 3
            ? label
            : `argument-${index}:${label}`;
      }
      cursor = cursor.parent;
    }
    return null;
  };
  const directCleanupCalls: string[] = [];
  const exitNodes: Array<{
    call: string;
    condition: string | null;
    owner: string | null;
    position: number;
    topLevelGuard: boolean;
  }> = [];
  const launchOwners: Array<string | null> = [];
  const pageCalls: Record<string, number> = {};
  const unownedPageCalls: string[] = [];
  const wrappers: IFaceAnalysisCleanupContract["wrappers"] = [];
  const wrapperEnds: number[] = [];
  const guardOf = (node: ts.Node): ts.IfStatement | null => {
    let cursor: ts.Node | undefined = node;
    while (cursor?.parent !== undefined) {
      if (ts.isIfStatement(cursor.parent)) return cursor.parent;
      cursor = cursor.parent;
    }
    return null;
  };
  const isTopLevelAwait = (node: ts.CallExpression): boolean => {
    if (ts.isAwaitExpression(node.parent) === false) return false;
    const owner = node.parent.parent;
    if (
      ts.isVariableDeclaration(owner) &&
      owner.initializer === node.parent &&
      ts.isVariableDeclarationList(owner.parent) &&
      ts.isVariableStatement(owner.parent.parent)
    )
      return owner.parent.parent.parent === source;
    return (
      ts.isExpressionStatement(owner) &&
      owner.expression === node.parent &&
      owner.parent === source
    );
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = compact(node.expression, source);
      if (callee === "withBrowserPage") {
        wrapperEnds.push(node.end);
        const operation = node.arguments[3];
        wrappers.push({
          arguments: node.arguments.length,
          awaited: ts.isAwaitExpression(node.parent),
          label: compact(node.arguments[2]!, source),
          launch: compact(node.arguments[0]!, source),
          operationAsync:
            operation !== undefined &&
            ts.isArrowFunction(operation) &&
            operation.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
            ) === true,
          operationDigest:
            operation !== undefined && ts.isArrowFunction(operation)
              ? createHash("sha256")
                  .update(compact(operation.body, source))
                  .digest("hex")
              : "",
          operationParameters:
            operation !== undefined && ts.isArrowFunction(operation)
              ? operation.parameters.map((parameter) =>
                  compact(parameter, source),
                )
              : [],
          pageOptions: compact(node.arguments[1]!, source),
          topLevelAwaited: isTopLevelAwait(node),
        });
      }
      if (callee === "chromium.launch") launchOwners.push(ownerOf(node));
      if (callee.startsWith("page.")) {
        pageCalls[callee] = (pageCalls[callee] ?? 0) + 1;
        if (ownerOf(node) === null)
          unownedPageCalls.push(compact(node, source));
      }
      if (callee === "process.exit") {
        const guard = guardOf(node);
        exitNodes.push({
          call: compact(node, source),
          condition: guard === null ? null : compact(guard.expression, source),
          owner: ownerOf(node),
          position: node.getStart(source),
          topLevelGuard: guard?.parent === source,
        });
      }
      if (callee.endsWith(".close"))
        directCleanupCalls.push(compact(node, source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    directCleanupCalls,
    exits: exitNodes.map(
      ({ call, condition, owner, position, topLevelGuard }) => ({
        afterWrapper: wrapperEnds.some((end) => end < position),
        call,
        condition,
        owner,
        topLevelGuard,
      }),
    ),
    imports,
    launchOwners,
    pageCalls,
    unownedPageCalls,
    wrappers,
  };
};

interface IWithBrowserPageContract {
  async: boolean;
  body: string;
  exported: boolean;
  parameters: string[];
}

/** Bind the common page/browser failure and cleanup precedence policy. */
const withBrowserPageContract = (text: string): IWithBrowserPageContract[] => {
  const source = ts.createSourceFile(
    "packages/playground/scripts/preserveCleanupFailure.mjs",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const functions: IWithBrowserPageContract[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "withBrowserPage" &&
      node.initializer !== undefined &&
      ts.isArrowFunction(node.initializer)
    )
      functions.push({
        async:
          node.initializer.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
          ) === true,
        body: compact(node.initializer.body, source),
        exported:
          ts.isVariableDeclarationList(node.parent) &&
          ts.isVariableStatement(node.parent.parent) &&
          node.parent.parent.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
          ) === true,
        parameters: node.initializer.parameters.map((parameter) =>
          compact(parameter, source),
        ),
      });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return functions;
};

const rootImport = 'import{withBrowserPage}from"./preserveCleanupFailure.mjs";';
const mhImport = 'import{withBrowserPage}from"../preserveCleanupFailure.mjs";';
const launch = "()=>chromium.launch({executablePath:CHROME,headless:true})";

/** All remaining direct face-analysis commands release page and browser. */
export const test_workspace_face_analysis_cleanup = (): void => {
  const scripts = Object.fromEntries(
    [
      "compare-front.mjs",
      "compare-jaw.mjs",
      "dissect-view.mjs",
      "extract-landmarks.mjs",
      "fit-front.mjs",
      "fit-joint.mjs",
      "overlay-aligned.mjs",
      "overlay-pose.mjs",
      "mh/mh_capture.mjs",
      "mh/mh_dissect.mjs",
    ].map((file) => [
      file,
      faceAnalysisCleanupContract(
        file,
        fs.readFileSync(
          path.join(ROOT, "packages", "playground", "scripts", file),
          "utf8",
        ),
      ),
    ]),
  );
  TestValidator.equals("face analysis browser/page ownership", scripts, {
    "compare-front.mjs": {
      directCleanupCalls: [],
      exits: [],
      imports: [rootImport],
      launchOwners: ['launch:"comparefront"'],
      pageCalls: {
        "page.goto": 1,
        "page.waitForFunction": 1,
        "page.addStyleTag": 1,
        "page.setViewportSize": 1,
        "page.evaluate": 3,
      },
      unownedPageCalls: [],
      wrappers: [
        {
          arguments: 4,
          awaited: true,
          label: '"comparefront"',
          launch,
          operationAsync: true,
          operationDigest:
            "8249ad3f2defad516ff1eeb3b4572782650fbfa67098fa96503c0ac661d6cdce",
          operationParameters: ["page"],
          pageOptions: "{viewport:{width:1000,height:1000}}",
          topLevelAwaited: true,
        },
      ],
    },
    "compare-jaw.mjs": {
      directCleanupCalls: [],
      exits: [],
      imports: [rootImport],
      launchOwners: ['launch:"comparejaw"'],
      pageCalls: {
        "page.goto": 1,
        "page.waitForFunction": 1,
        "page.addStyleTag": 1,
        "page.setViewportSize": 1,
        "page.evaluate": 3,
      },
      unownedPageCalls: [],
      wrappers: [
        {
          arguments: 4,
          awaited: true,
          label: '"comparejaw"',
          launch,
          operationAsync: true,
          operationDigest:
            "16c30a42fbed8b9e55454ad4e30627a2ccd7ca0dc4c8ca3919d19a48ae3d2f20",
          operationParameters: ["page"],
          pageOptions: "{viewport:{width:1000,height:1000}}",
          topLevelAwaited: true,
        },
      ],
    },
    "dissect-view.mjs": {
      directCleanupCalls: [],
      exits: [
        {
          afterWrapper: false,
          call: "process.exit(0)",
          condition: "!cell",
          owner: null,
          topLevelGuard: true,
        },
      ],
      imports: [rootImport],
      launchOwners: ['launch:"dissectview"'],
      pageCalls: {
        "page.goto": 1,
        "page.waitForFunction": 1,
        "page.addStyleTag": 1,
        "page.setViewportSize": 1,
        "page.evaluate": 4,
        'page.locator("#view").screenshot': 1,
        "page.locator": 1,
      },
      unownedPageCalls: [],
      wrappers: [
        {
          arguments: 4,
          awaited: true,
          label: '"dissectview"',
          launch,
          operationAsync: true,
          operationDigest:
            "9d231e140e358e95175aa032b947e8423a015a87c43271a7af740828fa49f83d",
          operationParameters: ["page"],
          pageOptions: "{viewport:{width:1000,height:1000}}",
          topLevelAwaited: true,
        },
      ],
    },
    "extract-landmarks.mjs": {
      directCleanupCalls: [],
      exits: [],
      imports: [rootImport],
      launchOwners: ['launch:"extractlandmarks"'],
      pageCalls: { "page.goto": 1, "page.evaluate": 3 },
      unownedPageCalls: [],
      wrappers: [
        {
          arguments: 4,
          awaited: true,
          label: '"extractlandmarks"',
          launch,
          operationAsync: true,
          operationDigest:
            "bebcf2f4d302536826955adc637d83dec92e44280ae18fe36eefee0410af886d",
          operationParameters: ["page"],
          pageOptions: "{viewport:{width:800,height:600}}",
          topLevelAwaited: true,
        },
      ],
    },
    "fit-front.mjs": {
      directCleanupCalls: [],
      exits: [],
      imports: [rootImport],
      launchOwners: ['launch:"fitfront"'],
      pageCalls: {
        "page.goto": 1,
        "page.waitForFunction": 1,
        "page.addStyleTag": 1,
        "page.setViewportSize": 1,
        "page.evaluate": 4,
      },
      unownedPageCalls: [],
      wrappers: [
        {
          arguments: 4,
          awaited: true,
          label: '"fitfront"',
          launch,
          operationAsync: true,
          operationDigest:
            "ffe840322fbeb130383a3fca1a94fcc80b43781ad083e62ed9a218cada8aca5b",
          operationParameters: ["page"],
          pageOptions: "{viewport:{width:1000,height:1000}}",
          topLevelAwaited: true,
        },
      ],
    },
    "fit-joint.mjs": {
      directCleanupCalls: [],
      exits: [],
      imports: [rootImport],
      launchOwners: ['launch:"fitjoint"'],
      pageCalls: {
        "page.goto": 1,
        "page.waitForFunction": 1,
        "page.addStyleTag": 1,
        "page.setViewportSize": 1,
        "page.evaluate": 4,
      },
      unownedPageCalls: [],
      wrappers: [
        {
          arguments: 4,
          awaited: true,
          label: '"fitjoint"',
          launch,
          operationAsync: true,
          operationDigest:
            "685df750af3c2639a830c2e458078242a7af47c7c83c1cb7f65b1a69416f1da0",
          operationParameters: ["page"],
          pageOptions: "{viewport:{width:1000,height:1000}}",
          topLevelAwaited: true,
        },
      ],
    },
    "overlay-aligned.mjs": {
      directCleanupCalls: [],
      exits: [
        {
          afterWrapper: true,
          call: "process.exit(0)",
          condition: "!photoLm||!modelLm",
          owner: null,
          topLevelGuard: true,
        },
      ],
      imports: [rootImport],
      launchOwners: ['launch:"overlayaligned"'],
      pageCalls: {
        "page.goto": 1,
        "page.waitForFunction": 1,
        "page.addStyleTag": 1,
        "page.setViewportSize": 1,
        "page.evaluate": 5,
        'page.locator("#view").screenshot': 1,
        "page.locator": 1,
      },
      unownedPageCalls: [],
      wrappers: [
        {
          arguments: 4,
          awaited: true,
          label: '"overlayaligned"',
          launch,
          operationAsync: true,
          operationDigest:
            "7989eb8783de9d594421ecde5fd7360eba9ea712a5877a4d2f0ab22960239434",
          operationParameters: ["page"],
          pageOptions: "{viewport:{width:1000,height:1000}}",
          topLevelAwaited: true,
        },
      ],
    },
    "overlay-pose.mjs": {
      directCleanupCalls: [],
      exits: [
        {
          afterWrapper: true,
          call: "process.exit(0)",
          condition: "!photo||!photo.matrix",
          owner: null,
          topLevelGuard: true,
        },
        {
          afterWrapper: true,
          call: "process.exit(0)",
          condition: "!best",
          owner: null,
          topLevelGuard: true,
        },
      ],
      imports: [rootImport],
      launchOwners: ['launch:"overlaypose"'],
      pageCalls: {
        "page.goto": 1,
        "page.waitForFunction": 1,
        "page.addStyleTag": 1,
        "page.setViewportSize": 1,
        "page.evaluate": 6,
        'page.locator("#view").screenshot': 1,
        "page.locator": 1,
      },
      unownedPageCalls: [],
      wrappers: [
        {
          arguments: 4,
          awaited: true,
          label: '"overlaypose"',
          launch,
          operationAsync: true,
          operationDigest:
            "4d167c80871f80637ff5c254af0aede7d3839872869e9f7504acd11d411fb9e9",
          operationParameters: ["page"],
          pageOptions: "{viewport:{width:1000,height:1000}}",
          topLevelAwaited: true,
        },
      ],
    },
    "mh/mh_capture.mjs": {
      directCleanupCalls: [],
      exits: [],
      imports: [mhImport],
      launchOwners: ['launch:"MakeHumancapture"'],
      pageCalls: {
        "page.on": 2,
        "page.goto": 1,
        "page.waitForFunction(()=>window.__mhReady===true,{timeout:20000}).catch": 1,
        "page.waitForFunction": 1,
        "page.evaluate": 2,
        'page.locator("#view").screenshot': 1,
        "page.locator": 1,
      },
      unownedPageCalls: [],
      wrappers: [
        {
          arguments: 4,
          awaited: true,
          label: '"MakeHumancapture"',
          launch,
          operationAsync: true,
          operationDigest:
            "ced9591f283f3df67bec92d3a68ae15e256c0130c5142ee83ae0551a9aab0e03",
          operationParameters: ["page"],
          pageOptions:
            "{viewport:{width:1024,height:1024},deviceScaleFactor:1}",
          topLevelAwaited: true,
        },
      ],
    },
    "mh/mh_dissect.mjs": {
      directCleanupCalls: [],
      exits: [],
      imports: [mhImport],
      launchOwners: ['launch:"MakeHumandissect"'],
      pageCalls: {
        "page.on": 1,
        [templateSource(
          'page.goto(`#{BASE}/mhhead.html`,{waitUntil:"load"}).catch',
        )]: 1,
        "page.goto": 1,
        "page.evaluate": 1,
      },
      unownedPageCalls: [],
      wrappers: [
        {
          arguments: 4,
          awaited: true,
          label: '"MakeHumandissect"',
          launch,
          operationAsync: true,
          operationDigest:
            "d9193c251375f0805209e1b197e51f5c8a08719484a16d1adf05a540628458aa",
          operationParameters: ["page"],
          pageOptions: "{viewport:{width:1100,height:700}}",
          topLevelAwaited: true,
        },
      ],
    },
  });

  const policy = fs.readFileSync(
    path.join(
      ROOT,
      "packages",
      "playground",
      "scripts",
      "preserveCleanupFailure.mjs",
    ),
    "utf8",
  );
  TestValidator.equals(
    "shared browser/page cleanup precedence",
    withBrowserPageContract(policy),
    [
      {
        async: true,
        body: templateSource(
          "{constbrowser=awaitlaunchBrowser();letbrowserFailure;try{constpage=awaitbrowser.newPage(pageOptions);letpageFailure;try{returnawaitoperation(page);}catch(error){pageFailure={error};throwerror;}finally{awaitpreserveCleanupFailure(pageFailure,`#{resource}page`,()=>page.close(),);}}catch(error){browserFailure={error};throwerror;}finally{awaitpreserveCleanupFailure(browserFailure,`#{resource}browser`,()=>browser.close(),);}}",
        ),
        exported: true,
        parameters: ["launchBrowser", "pageOptions", "resource", "operation"],
      },
    ],
  );
};
