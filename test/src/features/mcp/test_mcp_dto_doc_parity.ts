import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { openMcpStdio } from "../internal/mcpStdio";

/** Repository root, three levels above `test/src/features/mcp`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const readSource = (relative: string): string =>
  fs.readFileSync(path.resolve(ROOT, relative), "utf8");

/** The body of one top-level `export interface`, or null when absent. */
const interfaceBody = (source: string, name: string): string | null => {
  const head = new RegExp(`\\nexport interface ${name}\\b[^{]*\\{\\n`).exec(
    source,
  );
  if (head === null) return null;
  const start = head.index + head[0].length;
  const end = source.indexOf("\n}\n", start);
  return end < 0 ? null : source.slice(start, end);
};

/**
 * Field name to its JSDoc prose, whitespace-collapsed, for one interface.
 * Returns null when the interface could not be located at all, which the
 * scenario asserts against: a silently empty extraction would make this whole
 * check pass by finding nothing.
 */
const fieldDocs = (
  source: string,
  name: string,
): Map<string, string> | null => {
  const body = interfaceBody(source, name);
  if (body === null) return null;
  const docs = new Map<string, string>();
  const pattern = /\/\*\*([\s\S]*?)\*\/\s*\n\s*([A-Za-z_$][\w$]*)\??\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null)
    docs.set(
      match[2]!,
      match[1]!
        .replace(/^\s*\*/gm, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  return docs;
};

/**
 * What counts as a CONSTRAINT inside a backticked token: a number (a range, a
 * bound, a default), a comparison or `±` relation, or an allowed-value literal.
 * A backticked cross-reference to a sibling API (`travelMotion`,
 * `AutoMoviePlayer`) is deliberately NOT a constraint: the MCP mirror has no
 * business advertising engine-internal names, and treating those as drift would
 * make the check cry wolf until someone silenced it.
 *
 * The classifier was widened once by fault injection: the first version keyed
 * on digits alone and missed a stripped `<= clip duration` bound.
 */
const CONSTRAINT = /[0-9]|[<>]=?|±/;
const LITERAL = /^(?:"[^"]*"|null|true|false)$/;

/** Every constraint token a field's JSDoc states. */
const constraintTokens = (doc: string): string[] => {
  const found = new Set<string>();
  const pattern = /`([^`]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(doc)) !== null)
    if (CONSTRAINT.test(match[1]!) || LITERAL.test(match[1]!))
      found.add(match[1]!);
  return [...found].sort(compareCodeUnits);
};

/**
 * The hand-maintained mirrors and the types they mirror.
 *
 * `skip` names the fields whose divergence is deliberate: the tuple rewrites
 * these mirrors exist for, and the per-beat opening fields a stored actor spec
 * does not carry. A field absent from the mirror entirely (the bezier control
 * tuples) is not drift either, since there is no mirrored doc to fall behind.
 */
const MIRRORS: readonly {
  mirror: string;
  source: string;
  sourceType: string;
  skip: readonly string[];
  fields: number;
}[] = [
  {
    mirror: "IAutoMovieMcpGaitLimb",
    source: "packages/interface/src/motion/IAutoMovieGaitLimb.ts",
    sourceType: "IAutoMovieGaitLimb",
    skip: [],
    fields: 10,
  },
  {
    mirror: "IAutoMovieMcpGait",
    source: "packages/interface/src/motion/IAutoMovieGait.ts",
    sourceType: "IAutoMovieGait",
    skip: ["style"],
    fields: 5,
  },
  {
    mirror: "IAutoMovieMcpMotion",
    source: "packages/interface/src/motion/IAutoMovieMotion.ts",
    sourceType: "IAutoMovieMotion",
    skip: [],
    fields: 6,
  },
  {
    mirror: "IAutoMovieMcpKeyframe",
    source: "packages/interface/src/motion/IAutoMovieKeyframe.ts",
    sourceType: "IAutoMovieKeyframe",
    skip: ["bezier"],
    fields: 5,
  },
  {
    mirror: "IAutoMovieMcpActorContext",
    source: "packages/engine/src/perform/IAutoMovieActorContext.ts",
    sourceType: "IAutoMovieActorContext",
    skip: ["position", "facingDeg", "gaitPhase"],
    fields: 10,
  },
];

/**
 * A constraint documented in `interface` field JSDoc must reach the MCP schema
 * (#1342).
 *
 * The `development` skill makes field JSDoc the ONLY place a constraint is
 * written down: `interface` carries no `typia` tags, so the generated schema
 * has no `minimum`/`maximum` to fall back on. `packages/mcp/src/dto.ts` mirrors
 * those types by hand for the few fields whose tuples the LLM schema cannot
 * express, and the mirrors' field prose had been rewritten down to one-liners.
 * The gait limb lost 1,169 characters of guidance to 199, including the worked
 * knee example that names the exact `neutral`/`amplitude` relation an S-01 run
 * then failed 26 ROM violations for want of.
 *
 * Scenarios:
 *
 * 1. On the GENERATED schema, not the source: `perform`'s advertised
 *    `IAutoMovieMcpGaitLimb` states `neutral`'s relation to `amplitude` and its
 *    ROM consequence, `duty`'s `(0, 1)` range, `axis`'s `"flexion"` default,
 *    and `phase`'s `[0, 1)`. This is what an agent actually reads.
 * 2. The restored guidance is not a token sprinkle: the type's field descriptions
 *    total well past the 199 characters the surface used to carry.
 * 3. Drift check: for every mirrored field, each constraint token its interface
 *    counterpart states appears in the mirror's own prose. This is the detector
 *    the campaign lacked; a mirror that silently falls behind its source is the
 *    failure mode being fixed.
 * 4. The drift check's own extraction is asserted, not assumed: each mapped
 *    interface must yield the field count it declares. A regex that matched
 *    nothing would otherwise report a clean sweep over an empty set, which is
 *    how a comparison tool goes quiet exactly where it matters.
 * 5. Boundary: a field that legitimately differs (the bezier control tuples the
 *    mirrors exist to rewrite) is absent from the mirror rather than drifted,
 *    and is not reported.
 * 6. The restoration landed where it belongs: these are `$defs` field
 *    descriptions, so `perform`'s OWN description must still be within its
 *    1023-character cap. The whole-surface sweep of that cap lives in
 *    `test_mcp_contract_budgets`; repeating it here would only buy a second
 *    copy of the same assertion.
 */
export const test_mcp_dto_doc_parity = async (): Promise<void> => {
  // 3-5. the drift check, over the source pair
  const dto = readSource("packages/mcp/src/dto.ts");
  const drift: string[] = [];
  for (const entry of MIRRORS) {
    const mirror = fieldDocs(dto, entry.mirror);
    const origin = fieldDocs(readSource(entry.source), entry.sourceType);
    // 4. the extractor must have found something, and the right amount
    TestValidator.equals(
      `mirror ${entry.mirror} is extractable`,
      mirror !== null,
      true,
    );
    TestValidator.equals(
      `source ${entry.sourceType} yields its declared field count`,
      origin?.size,
      entry.fields,
    );
    if (mirror === null || origin === null) continue;
    for (const [field, doc] of origin) {
      if (entry.skip.includes(field)) continue;
      const mirrored = mirror.get(field);
      // 5. a field the mirror does not carry cannot have drifted
      if (mirrored === undefined) continue;
      for (const token of constraintTokens(doc))
        if (!mirrored.includes(token))
          drift.push(`${entry.mirror}.${field} lost ${token}`);
    }
  }
  TestValidator.equals("no mirrored field has lost a constraint", drift, []);

  // 1-2, 6. the generated schema an agent actually reads
  const { client, tools } = await openMcpStdio("automovie-test");
  try {
    const perform = tools.find((tool) => tool.name === "perform");
    if (perform === undefined) throw new Error("the perform tool must exist");
    const limb = (
      perform.inputSchema as {
        $defs?: Record<
          string,
          { properties?: Record<string, { description?: string }> }
        >;
      }
    ).$defs?.IAutoMovieMcpGaitLimb;
    if (limb?.properties === undefined)
      throw new Error("perform must advertise the gait limb definition");
    const described = (field: string): string =>
      limb.properties![field]?.description ?? "";

    TestValidator.predicate(
      "the schema states neutral's amplitude relation and its ROM consequence",
      described("neutral").includes("±amplitude") &&
        described("neutral").includes("[0, 150]") &&
        described("neutral").includes("{ neutral: 25, amplitude: 18 }") &&
        described("neutral").includes("ROM validator"),
    );
    TestValidator.predicate(
      "the schema states duty's range, axis's default, and phase's interval",
      described("duty").includes("(0, 1)") &&
        described("axis").includes('"flexion"') &&
        described("phase").includes("[0, 1)"),
    );

    // 2. the restoration is substantive, not a token sprinkle
    const total = Object.values(limb.properties).reduce(
      (sum, property) => sum + (property.description ?? "").length,
      0,
    );
    TestValidator.predicate(
      `the gait limb's advertised guidance is restored (${total} chars, was 199)`,
      total > 1000,
    );

    // 6. the restored prose landed in the `$defs` field descriptions and not in
    //     `perform`'s own, which has its own hard cap.
    TestValidator.predicate(
      `perform's own description stayed within 1023 chars (${(perform.description ?? "").length})`,
      (perform.description ?? "").length <= 1023,
    );
  } finally {
    await client.close();
  }
};
