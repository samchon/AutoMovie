import { TestValidator } from "@nestia/e2e";
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

interface IFacePhotoAssetContract {
  calls: Record<"loadPhotoHead" | "loadSkin" | "selectSkin", string[]>;
  functions: Record<
    "loadPhotoHead" | "loadSkin" | "selectSkin",
    Array<{ body: string; parameters: string[]; returnType: string | null }>
  >;
  state: Array<{
    initializer: string | null;
    kind: "const" | "let" | "var";
    name: string;
    type: string | null;
  }>;
  topLevelActions: string[];
  windowAssignments: string[];
}

/** Bind selected texture/head ownership, retry state, and preset consumers. */
const facePhotoAssetContract = (text: string): IFacePhotoAssetContract => {
  const source = ts.createSourceFile(
    "packages/playground/src/face.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const functionNames = ["loadPhotoHead", "loadSkin", "selectSkin"] as const;
  const stateNames = new Set([
    "headCache",
    "headRequests",
    "photoHead",
    "photoHeadOn",
    "photoHeadUrl",
    "photoMaterial",
    "photoTone",
    "skinCache",
  ]);
  const functions = {
    loadPhotoHead: [],
    loadSkin: [],
    selectSkin: [],
  } as IFacePhotoAssetContract["functions"];
  const state: IFacePhotoAssetContract["state"] = [];
  const topLevelActions: string[] = [];
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      const kind =
        statement.declarationList.flags & ts.NodeFlags.Const
          ? "const"
          : statement.declarationList.flags & ts.NodeFlags.Let
            ? "let"
            : "var";
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        if (stateNames.has(name)) {
          state.push({
            initializer:
              declaration.initializer === undefined
                ? null
                : compact(declaration.initializer, source),
            kind,
            name,
            type:
              declaration.type === undefined
                ? null
                : compact(declaration.type, source),
          });
          topLevelActions.push(name);
        }
        if (
          functionNames.includes(name as (typeof functionNames)[number]) &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
        ) {
          const arrow = declaration.initializer;
          functions[name as (typeof functionNames)[number]].push({
            body: compact(arrow.body, source),
            parameters: arrow.parameters.map((parameter) =>
              compact(parameter, source),
            ),
            returnType:
              arrow.type === undefined ? null : compact(arrow.type, source),
          });
          topLevelActions.push(name);
        }
        if (name === "skullMaterial") topLevelActions.push(name);
      }
      continue;
    }
    if (
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      ts.isIdentifier(statement.expression.expression) &&
      (statement.expression.expression.text === "selectSkin" ||
        statement.expression.expression.text === "loadPhotoHead")
    )
      topLevelActions.push(compact(statement, source));
  }

  const calls = {
    loadPhotoHead: [],
    loadSkin: [],
    selectSkin: [],
  } as IFacePhotoAssetContract["calls"];
  const windowAssignments: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      functionNames.includes(
        node.expression.text as (typeof functionNames)[number],
      )
    )
      calls[node.expression.text as (typeof functionNames)[number]].push(
        compact(node, source),
      );
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      compact(node.left, source).includes("__loadSkin")
    )
      windowAssignments.push(compact(node, source));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { calls, functions, state, topLevelActions, windowAssignments };
};

/**
 * Photo textures and GLTF heads apply only while their preset URL still owns
 * the workbench selection, while failed and duplicate loads remain retryable.
 */
export const test_workspace_face_photo_assets = (): void => {
  const face = fs.readFileSync(
    path.join(ROOT, "packages", "playground", "src", "face.ts"),
    "utf8",
  );
  TestValidator.equals(
    "face photo assets reject stale preset completions",
    facePhotoAssetContract(face),
    {
      calls: {
        loadPhotoHead: [
          "loadPhotoHead(p.data.head)",
          'loadPhotoHead("/models/hero1-head.glb")',
        ],
        loadSkin: ["loadSkin(url)"],
        selectSkin: ['selectSkin("/models/hero1-face.png")'],
      },
      functions: {
        loadPhotoHead: [
          {
            body: '{constplace=(g:THREE.Group):void=>{if(photoHead)photoHead.visible=false;photoHead=g;photoHead.visible=photoHeadOn;};if(url!==photoHeadUrl){photoHeadUrl=url;if(photoHead)photoHead.visible=false;photoHead=null;}if(!url)return;consthit=headCache.get(url);if(hit){place(hit);return;}if(headRequests.has(url))return;consttoken=Symbol(url);headRequests.set(url,token);newGLTFLoader().load(url,(gltf)=>{if(headRequests.get(url)!==token)return;headRequests.delete(url);gltf.scene.traverse((o)=>{constm=oasTHREE.Mesh;if(m.isMesh){conststd=m.materialasTHREE.MeshStandardMaterial;m.material=newTHREE.MeshBasicMaterial({map:std.map,side:THREE.DoubleSide,vertexColors:m.geometry.hasAttribute("color"),transparent:std.transparent,});}});gltf.scene.visible=false;scene.add(gltf.scene);headCache.set(url,gltf.scene);if(photoHeadUrl===url)place(gltf.scene);},undefined,()=>{if(headRequests.get(url)===token)headRequests.delete(url);},);}',
            parameters: ["url:string"],
            returnType: "void",
          },
        ],
        loadSkin: [
          {
            body: "{constcached=skinCache.get(url);if(cached)returncached;lettexture!:THREE.Texture;texture=newTHREE.TextureLoader().load(url,(loaded)=>{if(photoMaterial.map===loaded)matchSkullTone(loaded);},undefined,()=>{if(skinCache.get(url)===texture)skinCache.delete(url);},);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;skinCache.set(url,texture);returntexture;}",
            parameters: ["url:string"],
            returnType: "THREE.Texture",
          },
        ],
        selectSkin: [
          {
            body: "{consttexture=loadSkin(url);photoTone=null;photoMaterial.map=texture;photoMaterial.needsUpdate=true;applySkullTone();if(texture.image)matchSkullTone(texture);}",
            parameters: ["url:string"],
            returnType: "void",
          },
        ],
      },
      state: [
        {
          initializer: "newTHREE.MeshBasicMaterial({side:THREE.DoubleSide})",
          kind: "const",
          name: "photoMaterial",
          type: null,
        },
        {
          initializer: "newMap<string,THREE.Texture>()",
          kind: "const",
          name: "skinCache",
          type: null,
        },
        {
          initializer: "null",
          kind: "let",
          name: "photoTone",
          type: "THREE.Color|null",
        },
        {
          initializer: "null",
          kind: "let",
          name: "photoHead",
          type: "THREE.Group|null",
        },
        {
          initializer: "false",
          kind: "let",
          name: "photoHeadOn",
          type: null,
        },
        {
          initializer: '""',
          kind: "let",
          name: "photoHeadUrl",
          type: null,
        },
        {
          initializer: "newMap<string,THREE.Group>()",
          kind: "const",
          name: "headCache",
          type: null,
        },
        {
          initializer: "newMap<string,symbol>()",
          kind: "const",
          name: "headRequests",
          type: null,
        },
      ],
      topLevelActions: [
        "photoMaterial",
        "skinCache",
        "loadSkin",
        "photoTone",
        "selectSkin",
        "skullMaterial",
        'selectSkin("/models/hero1-face.png");',
        "photoHead",
        "photoHeadOn",
        "photoHeadUrl",
        "headCache",
        "headRequests",
        "loadPhotoHead",
        'loadPhotoHead("/models/hero1-head.glb");',
      ],
      windowAssignments: [
        "(windowasunknownas{__loadSkin:unknown}).__loadSkin=selectSkin",
      ],
    },
  );
};
