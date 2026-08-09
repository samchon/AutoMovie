import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveLegacyImportFixtureCleanup } from "./test_mcp_production_legacy_import";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digest = (node: ts.Node, source: ts.SourceFile): string =>
  createHash("sha256").update(node.getText(source)).digest("hex");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

/**
 * Every legacy-import lifecycle whose protected cleanup restores exactly one
 * process-global filesystem hook.
 *
 * A lifecycle carrying more than one resource belongs to its own issue, so the
 * selection is the single-resource shape itself rather than a name list.
 */
export const legacyImportSingleHookContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_legacy_import.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerStatements: number;
    finallyBodies: string[];
    index: number;
    prefixes: string[];
    tryDigest: string;
  }> = [];
  const singleResource = (block: ts.Block): boolean => {
    if (block.statements.length !== 1) return false;
    const statement = block.statements[0];
    if (
      statement === undefined ||
      ts.isExpressionStatement(statement) === false ||
      ts.isCallExpression(statement.expression) === false ||
      ts.isIdentifier(statement.expression.expression) === false ||
      statement.expression.expression.text !==
        "preserveLegacyImportFixtureCleanup" ||
      statement.expression.arguments.length !== 2
    )
      return false;
    const resources = statement.expression.arguments[1];
    if (
      resources === undefined ||
      ts.isArrayLiteralExpression(resources) === false ||
      resources.elements.length !== 1
    )
      return false;
    // One assignment back to a process-global `fs` member, or one descriptor
    // restoration, and nothing else.
    return /^\{resource:"[^"]+",cleanup:\(\)=>(?:\{fs\.[A-Za-z]+=[A-Za-z_$][\w$]*;\}|Object\.defineProperty\(fs,"[A-Za-z]+",[A-Za-z_$][\w$]*\)),\}$/u.test(
      compact(resources.elements[0]!, source),
    );
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      singleResource(node.finallyBlock) &&
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
        containerStatements: statements.length,
        finallyBodies: node.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
        index,
        prefixes: statements
          .slice(Math.max(0, index - 2), index)
          .map((statement) => compact(statement, source)),
        tryDigest: digest(node.tryBlock, source),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const labels = lifecycles.flatMap((lifecycle) =>
    lifecycle.finallyBodies.flatMap((body) => {
      const found = /resource:"([^"]+)"/u.exec(body);
      return found === null ? [] : [found[1]!];
    }),
  );
  return {
    count: lifecycles.length,
    // A label is how a cleanup failure names itself in the aggregate, so two
    // lifecycles sharing one would make the report ambiguous.
    duplicateLabels: labels.filter(
      (label, index) => labels.indexOf(label) !== index,
    ),
    lifecycles,
    // Nothing of this shape may be left running as a raw call in `finally`.
    rawFinalizers: [
      ...text.matchAll(
        /finally\s*\{\s*(?:fs\.([A-Za-z]+)\s*=|Object\.defineProperty\(\s*fs,\s*"([A-Za-z]+)")/gu,
      ),
    ].map((found) => (found[1] ?? found[2])!),
  };
};

const captureCleanup = (props: {
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
  resources?: number;
}): { caught: boolean; failure: unknown; order: string[] } => {
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveLegacyImportFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      Array.from({ length: props.resources ?? 1 }, (_, index) => ({
        resource: `resource-${index}`,
        cleanup: (): void => {
          order.push(`cleanup-${index}`);
          const cleanupFailure = props.cleanupFailures?.[index];
          if (cleanupFailure !== undefined) throw cleanupFailure.error;
        },
      })),
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, failure, order };
};

export const test_mcp_production_legacy_import_single_hook_cleanup =
  (): void => {
    const primaryFailure = { phase: "legacy-import regression" };
    const restorationFailure = { phase: "legacy hook restoration" };
    const success = captureCleanup({});
    const primaryOnly = captureCleanup({
      primaryFailure: { error: primaryFailure, present: true },
    });
    const standalone = captureCleanup({
      cleanupFailures: [{ error: restorationFailure, present: true }],
    });
    const combined = captureCleanup({
      cleanupFailures: [{ error: restorationFailure, present: true }],
      primaryFailure: { error: primaryFailure, present: true },
    });
    const undefinedPrimary = captureCleanup({
      primaryFailure: { error: undefined, present: true },
    });
    TestValidator.equals(
      "single legacy-import restoration preserves the guarded failure first",
      namedFacts([
        ["successCaught", () => success.caught === false],
        [
          "successFailure",
          () => success.caught === false && success.failure === undefined,
        ],
        [
          "successOrderJoin",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0",
        ],
        ["primaryOnlyCaught", () => primaryOnly.caught],
        [
          "primaryOnlyFailurePrimaryFailure",
          () => primaryOnly.failure === primaryFailure,
        ],
        [
          "primaryOnlyOrderJoin",
          () => primaryOnly.order.join(",") === "cleanup-0",
        ],
        ["standaloneCaught", () => standalone.caught],
        [
          "standaloneFailureRestorationFailure",
          () => standalone.failure === restorationFailure,
        ],
        [
          "standaloneOrderJoin",
          () => standalone.order.join(",") === "cleanup-0",
        ],
        ["combinedCaught", () => combined.caught],
        [
          "aggregateContainsExactlyCombinedFailure",
          () =>
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              restorationFailure,
            ]),
        ],
        ["combinedOrderJoin", () => combined.order.join(",") === "cleanup-0"],
        ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
        [
          "undefinedPrimaryFailure",
          () => undefinedPrimary.failure === undefined,
        ],
        [
          "undefinedPrimaryOrderJoin",
          () => undefinedPrimary.order.join(",") === "cleanup-0",
        ],
      ]),
      {
        successCaught: true,
        successFailure: true,
        successOrderJoin: true,
        primaryOnlyCaught: true,
        primaryOnlyFailurePrimaryFailure: true,
        primaryOnlyOrderJoin: true,
        standaloneCaught: true,
        standaloneFailureRestorationFailure: true,
        standaloneOrderJoin: true,
        combinedCaught: true,
        aggregateContainsExactlyCombinedFailure: true,
        combinedOrderJoin: true,
        undefinedPrimaryCaught: true,
        undefinedPrimaryFailure: true,
        undefinedPrimaryOrderJoin: true,
      },
    );
    TestValidator.equals(
      "legacy-import regression protects every single hook restoration",
      legacyImportSingleHookContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_legacy_import.ts"),
          "utf8",
        ),
      ),
      CONTRACT,
    );
  };

const CONTRACT = {
  count: 10,
  duplicateLabels: [],
  lifecycles: [
    {
      catchBodies: ["rmSyncFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 17,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(rmSyncFailure,[{resource:"planningcleanupremovehook",cleanup:()=>{fs.rmSync=nativeRm;},},]);',
      ],
      index: 7,
      prefixes: [
        "letstandaloneCaught:unknown;",
        "letrmSyncFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "4c812e4c616dfd1229585871be08f8585de014b719654fa7ba1d06cde1750938",
    },
    {
      catchBodies: ["renameSyncFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 4,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(renameSyncFailure,[{resource:"collisionstagingrenamehook",cleanup:()=>{fs.renameSync=nativeRename;},},]);',
      ],
      index: 3,
      prefixes: [
        'fs.renameSync=((oldPath:fs.PathLike,newPath:fs.PathLike):void=>{if(path.basename(oldPath.toString()).startsWith(".automovie-import-")&&path.basename(newPath.toString())===".automovie")thrownewError("injectedrenamefailure");nativeRename(oldPath,newPath);})astypeoffs.renameSync;',
        "letrenameSyncFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "72eba394c6cfc7730f1f56ebed4bf4364f0698ac15da86fa1d72312ca37474c7",
    },
    {
      catchBodies: ["deniedImportStateLstatFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 8,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(deniedImportStateLstatFailure,[{resource:"deniedimportstatelstatdescriptorhook",cleanup:()=>Object.defineProperty(fs,"lstatSync",nativeLstatDescriptor),},]);',
      ],
      index: 7,
      prefixes: [
        'Object.defineProperty(fs,"lstatSync",{...nativeLstatDescriptor,value:((file:fs.PathLike,...args:unknown[]):fs.Stats|fs.BigIntStats=>{if(path.resolve(file.toString())===path.resolve(deniedPath)){consterror=newError("injectedimport-statelstatdenial",)asNodeJS.ErrnoException;error.code="EACCES";throwerror;}returnReflect.apply(nativeLstat,fs,[file,...args])as|fs.Stats|fs.BigIntStats;})astypeoffs.lstatSync,});',
        "letdeniedImportStateLstatFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "727c842ef8fb1d20181a4d749b125edb444a2bb793fbe529093dab09c03f30fb",
    },
    {
      catchBodies: ["writeFileSyncFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 11,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(writeFileSyncFailure,[{resource:"applyresident-lockwritehook",cleanup:()=>{fs.writeFileSync=nativeWrite;},},]);',
      ],
      index: 5,
      prefixes: [
        'fs.writeFileSync=((file:fs.PathOrFileDescriptor,...args:unknown[]):void=>{Reflect.apply(nativeWrite,fs,[file,...args]);if(replaced===false&&typeoffile!=="number"&&path.resolve(file.toString())===residentLock){replaced=true;fs.renameSync(replacedAfterResidentLock.root,parkedResidentRoot);fs.symlinkSync(residentReplacement,replacedAfterResidentLock.root,"junction",);}})astypeoffs.writeFileSync;',
        "letwriteFileSyncFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "812df865a3e23ef663ef2e2e5fec839c2c26f36a56aa69301b49236019d4d1b5",
    },
    {
      catchBodies: ["writeFileSyncFailure2={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 14,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(writeFileSyncFailure2,[{resource:"rollbackresident-lockwritehook",cleanup:()=>{fs.writeFileSync=nativeWrite;},},]);',
      ],
      index: 8,
      prefixes: [
        'fs.writeFileSync=((file:fs.PathOrFileDescriptor,...args:unknown[]):void=>{Reflect.apply(nativeWrite,fs,[file,...args]);if(replaced===false&&typeoffile!=="number"&&path.resolve(file.toString())===residentLock){replaced=true;fs.renameSync(replacedAfterRollbackLock.root,parkedRollbackResidentRoot,);fs.symlinkSync(rollbackReplacement,replacedAfterRollbackLock.root,"junction",);}})astypeoffs.writeFileSync;',
        "letwriteFileSyncFailure2:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "a13cc4fd3d394284d296ceccc81c8361aad52672ea8efc134b658df1cbaf16d8",
    },
    {
      catchBodies: ["readdirSyncFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 7,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(readdirSyncFailure,[{resource:"case-collidinginventoryreaddirhook",cleanup:()=>{fs.readdirSync=nativeReaddir;},},]);',
      ],
      index: 6,
      prefixes: [
        'fs.readdirSync=((directory:fs.PathLike,options?:{withFileTypes?:boolean},):fs.Dirent[]=>{constentries=Reflect.apply(nativeReaddir,fs,[directory,options,])asfs.Dirent[];if(path.resolve(directory.toString())===collidingActorDirectory&&options?.withFileTypes===true)return[...entries.filter((entry)=>entry.name.toLowerCase()!=="officer.txt",),...["Officer.txt","officer.txt"].map((name)=>({name,isSymbolicLink:()=>false,isDirectory:()=>false,isFile:()=>true,})asfs.Dirent,),];returnentries;})astypeoffs.readdirSync;',
        "letreaddirSyncFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "7e98c06a2896ce1f15b9964425627546e7aa9138d4cb5de2fafa209db09ed8d7",
    },
    {
      catchBodies: ["readdirSyncFailure2={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 4,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(readdirSyncFailure2,[{resource:"special-entryinventoryreaddirhook",cleanup:()=>{fs.readdirSync=nativeReaddir;},},]);',
      ],
      index: 3,
      prefixes: [
        'fs.readdirSync=((directory:fs.PathLike,options?:{withFileTypes?:boolean},):fs.Dirent[]=>{constentries=Reflect.apply(nativeReaddir,fs,[directory,options,])asfs.Dirent[];if(path.resolve(directory.toString())===path.join(specialInventoryEntry.root,"actors")&&options?.withFileTypes===true)return[...entries,{name:"special-device",isSymbolicLink:()=>false,isDirectory:()=>false,isFile:()=>false,}asfs.Dirent,];returnentries;})astypeoffs.readdirSync;',
        "letreaddirSyncFailure2:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "94650d48dbbca99cbc70ed190d26a0c64d6084ca2e5542bd08ec5df5ebf2310e",
    },
    {
      catchBodies: ["openSyncFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 10,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(openSyncFailure,[{resource:"residentlockmutationopenhook",cleanup:()=>{fs.openSync=nativeOpen;},},]);',
      ],
      index: 9,
      prefixes: [
        'fs.openSync=((file:fs.PathLike,...args:unknown[]):number=>{constdescriptor=Reflect.apply(nativeOpen,fs,[file,...args,])asnumber;if(changed===false&&path.resolve(file.toString())===manifestPath){changed=true;fs.rmSync(lockPath,{force:true});if(lockMutation==="symlink")fs.symlinkSync(outsideLockPath,lockPath);elseif(lockMutation==="directory")fs.mkdirSync(lockPath);elseif(lockMutation==="foreign-token")fs.writeFileSync(lockPath,"external-owner");}returndescriptor;})astypeoffs.openSync;',
        "letopenSyncFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "edd9ce8c76646ff2a72fcb9b04977452330228a1a2e6e529df3a44f226080f80",
    },
    {
      catchBodies: ["writeFileSyncFailure3={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 8,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(writeFileSyncFailure3,[{resource:"rollbacklocktokenwritehook",cleanup:()=>{fs.writeFileSync=nativeWrite;},},]);',
      ],
      index: 7,
      prefixes: [
        'fs.writeFileSync=((file:fs.PathOrFileDescriptor,...args:unknown[]):void=>{Reflect.apply(nativeWrite,fs,[file,...args]);if(corrupted===false&&typeoffile!=="number"&&path.resolve(file.toString())===lockPath){corrupted=true;nativeWrite(lockPath,"foreign-owner");}})astypeoffs.writeFileSync;',
        "letwriteFileSyncFailure3:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "5ec69810581f659262d55e6783200ac75d03ab740b4c16a1e7661caa5559fd42",
    },
    {
      catchBodies: ["readdirSyncFailure3={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 7,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(readdirSyncFailure3,[{resource:"specialapplied-statereaddirhook",cleanup:()=>{fs.readdirSync=nativeReaddir;},},]);',
      ],
      index: 6,
      prefixes: [
        'fs.readdirSync=((directory:fs.PathLike,options?:{withFileTypes?:boolean},):fs.Dirent[]=>{constentries=Reflect.apply(nativeReaddir,fs,[directory,options,])asfs.Dirent[];if(path.resolve(directory.toString())===stateRoot&&options?.withFileTypes===true)return[...entries,{name:"special-device",isSymbolicLink:()=>false,isDirectory:()=>false,isFile:()=>false,}asfs.Dirent,];returnentries;})astypeoffs.readdirSync;',
        "letreaddirSyncFailure3:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "b8188f2eb91d32267275685faf04aa0b8e97c01165e1fa6ff8f1133013bd72f0",
    },
  ],
  rawFinalizers: [],
};
