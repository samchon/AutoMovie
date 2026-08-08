import {
  AUTOMOVIE_SANDBOX_ENGINE_EXPORTS,
  isProjectSourceSpecifier,
  linkProductionSource,
  resolveProjectSourceSpecifier,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const link = (files: Record<string, string>, entry = "src/shots/one.ts") =>
  linkProductionSource({
    entryPath: entry,
    entrySource: files[entry]!,
    read: (relative) => {
      const found = files[relative];
      if (found === undefined)
        throw new Error(`Source "${relative}" does not exist.`);
      return found;
    },
  });

const paths = (result: ReturnType<typeof link>): string[] =>
  result.modules.map((module) => module.path);

/**
 * A shot reaches the subject vocabulary through its own imports.
 *
 * Linking is what lets a shot name a subject instead of rebuilding it, and it
 * is also the widest thing the deterministic sandbox has ever been asked to
 * open. So the rules that make one module safe have to survive being applied to
 * a graph: order has to be a real dependency order, a specifier has to mean one
 * module however it is spelled, and everything the reader refuses for an entry
 * module stays refused for an imported one.
 *
 * Scenarios:
 *
 * 1. Modules come back in dependency order with the entry last, which is what lets
 *    a synchronous registry evaluate each one with its imports present.
 * 2. A module reached twice is linked once, so a diamond does not evaluate its
 *    shared dependency twice or register it twice.
 * 3. A specifier resolves against the module that wrote it, and the extension is
 *    optional, so two spellings of one module are one registry entry.
 * 4. A type-only import creates no dependency, because it is erased before the
 *    sandbox sees it; pulling its module in would link source nothing runs.
 * 5. A cycle is refused and names the path around it, rather than being served a
 *    half-built `exports` the way CommonJS would.
 * 6. A specifier climbing above the project root is refused with its own reason,
 *    so an author is told what they did rather than that a file is missing.
 * 7. An unreadable import is refused and carries the reader's own message, so the
 *    escape and symlink refusals the reader owns are not restated here.
 * 8. The engine surface the sandbox reimplements is exactly the surface a source
 *    module may import; a name on one side and not the other would be either an
 *    unreachable stand-in or an import that fails at execution.
 */
export const test_mcp_production_source_link = (): void => {
  const chain = link({
    "src/shots/one.ts": [
      'import { defineShot } from "@automovie/engine";',
      'import { army } from "../formations/army";',
      "export const one = defineShot('one', { build: () => army });",
    ].join("\n"),
    "src/formations/army.ts": [
      'import { member } from "../units/member";',
      "export const army = [member];",
    ].join("\n"),
    "src/units/member.ts": "export const member = 1;",
  });
  TestValidator.equals(
    "modules arrive in dependency order with the entry last",
    paths(chain),
    ["src/units/member.ts", "src/formations/army.ts", "src/shots/one.ts"],
  );

  const diamond = link({
    "src/shots/one.ts": [
      'import { left } from "./left";',
      'import { right } from "./right";',
      "export const one = { build: () => [left, right] };",
    ].join("\n"),
    "src/shots/left.ts": [
      'import { shared } from "../units/shared";',
      "export const left = shared;",
    ].join("\n"),
    "src/shots/right.ts": [
      'import { shared } from "../units/shared";',
      "export const right = shared;",
    ].join("\n"),
    "src/units/shared.ts": "export const shared = 1;",
  });
  TestValidator.equals(
    "a module reached twice is linked once",
    paths(diamond),
    [
      "src/units/shared.ts",
      "src/shots/left.ts",
      "src/shots/right.ts",
      "src/shots/one.ts",
    ],
  );

  TestValidator.equals(
    "a specifier means one module however it is spelled",
    namedFacts([
      [
        "sibling",
        () =>
          resolveProjectSourceSpecifier("src/shots/one.ts", "./two") ===
          "src/shots/two.ts",
      ],
      [
        "parent",
        () =>
          resolveProjectSourceSpecifier(
            "src/shots/one.ts",
            "../units/member.ts",
          ) === "src/units/member.ts",
      ],
      [
        "redundant",
        () =>
          resolveProjectSourceSpecifier("src/shots/one.ts", "././two") ===
          "src/shots/two.ts",
      ],
      [
        "escaping",
        () => resolveProjectSourceSpecifier("one.ts", "../outside") === null,
      ],
      [
        "relative",
        () =>
          isProjectSourceSpecifier("./a") &&
          isProjectSourceSpecifier("../a") &&
          isProjectSourceSpecifier("@automovie/engine") === false,
      ],
    ]),
    {
      sibling: true,
      parent: true,
      redundant: true,
      escaping: true,
      relative: true,
    },
  );

  const typeOnly = link({
    "src/shots/one.ts": [
      'import type { Shape } from "../units/shape";',
      'import { type Other } from "../units/other";',
      "export const one = { build: () => 1 };",
    ].join("\n"),
    "src/units/shape.ts": "export interface Shape { a: number }",
    "src/units/other.ts": "export interface Other { b: number }",
  });
  TestValidator.equals(
    "a type-only import creates no runtime dependency",
    paths(typeOnly),
    ["src/shots/one.ts"],
  );

  const cyclic = link({
    "src/shots/one.ts": [
      'import { a } from "../units/a";',
      "export const one = { build: () => a };",
    ].join("\n"),
    "src/units/a.ts": ['import { b } from "./b";', "export const a = b;"].join(
      "\n",
    ),
    "src/units/b.ts": ['import { a } from "./a";', "export const b = a;"].join(
      "\n",
    ),
  });
  TestValidator.predicate(
    "a cycle is refused and names the path around it",
    cyclic.failures.length === 1 &&
      cyclic.failures[0]!.path === "src/units/a.ts" &&
      cyclic.failures[0]!.reason.includes(
        "src/units/a.ts -> src/units/b.ts -> src/units/a.ts",
      ),
  );

  const climbing = link(
    {
      "one.ts": [
        'import { outside } from "../outside";',
        "export const one = { build: () => outside };",
      ].join("\n"),
      "src/units/member.ts": "export const member = 1;",
    },
    "one.ts",
  );
  TestValidator.predicate(
    "a specifier above the project root is refused as such",
    climbing.failures.length === 1 &&
      climbing.failures[0]!.reason.includes("climbs above the project root"),
  );

  const absent = link({
    "src/shots/one.ts": [
      'import { gone } from "../units/gone";',
      "export const one = { build: () => gone };",
    ].join("\n"),
  });
  TestValidator.predicate(
    "an unreadable import carries the reader's own refusal",
    absent.failures.length === 1 &&
      absent.failures[0]!.reason.includes(
        'Source "src/units/gone.ts" does not exist.',
      ),
  );

  TestValidator.equals(
    "the importable engine surface is exactly the sandbox stand-in",
    [...AUTOMOVIE_SANDBOX_ENGINE_EXPORTS].sort((left, right) =>
      left < right ? -1 : 1,
    ),
    [
      "AutoMovieSubject",
      "AutoMovieSubjectGroup",
      "defineShot",
      "mergeAutoMovieSubjectContributions",
    ],
  );
};
