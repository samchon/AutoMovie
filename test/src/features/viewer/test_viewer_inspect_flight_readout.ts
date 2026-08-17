import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import ts from "typescript-compiler";

/**
 * The inspection page's speed line states the pace the eye actually keeps.
 *
 * `viewer/inspect.html` exists so a fault can be reported by coordinate, and a
 * coordinate is reached by holding a key for a while. Every frame integrates at
 * most `MAX_FRAME_SECONDS` of travel, which is right — without it one frame
 * dropped by a backgrounded tab flings the eye across the set — but it means
 * the printed speed is not the speed on a set heavy enough to draw slowly. Held
 * for one second at a printed `4.00m/s`, the eye moved 2.80 m on a mansion
 * (samchon/automovie#1958). The clamp is kept and the readout is what answers
 * for it: the page now prints the pace the frames it is actually drawing allow,
 * beside the pace it was asked for, whenever the two differ.
 *
 * The page cannot be imported here — it opens with a top-level `fetch` and
 * needs a document — so the function under test is read out of the shipped
 * source by its declaration, compiled, and run. An extraction that finds
 * nothing throws rather than quietly measuring an empty contract, and the
 * structural round pins the one seam behaviour cannot see: that the budget the
 * readout divides by is the same constant the eye's own integration clamps
 * with, and that the readout is handed the real frame intervals rather than
 * the already-clamped ones, which would make the deficit unprintable.
 *
 * Scenarios:
 *
 * 1. The page clamps and reports against one constant, `MAX_FRAME_SECONDS` at
 *    0.1 s, and the intervals the readout measures are the unclamped ones.
 * 2. Frames inside the budget print the asked-for speed alone, and in
 *    particular a 60 fps eye is not reported flying at six times its setting.
 * 3. The reported 2.80 m witness is reproduced: at the frame rate that produced
 *    it, the line would have told the operator 2.80 m/s.
 * 4. The frame-time census from the same report (a 0.3668 s median) reads as
 *    1.09 m/s at 2.7 fps.
 * 5. A deficit is printed only once it is visible at the printed precision: a
 *    median at the budget and a hair past it both print one number, and the
 *    first median that rounds differently prints two.
 * 6. `E` remains usable on a heavy set, because the flown figure scales with
 *    the setting the operator raises.
 * 7. One enormous interval is ignored, while the same duration sustained is
 *    reported: the median is what separates a returning tab from a slow set.
 * 8. A window with no samples yet, and one of instantaneous frames, print the
 *    asked-for speed rather than dividing by nothing.
 * 9. A window still filling reports the slow frame rather than averaging it
 *    away.
 * 10. The printed pace is the distance a held key buys, replayed against the
 *     page's own integration over one second: it reproduces the 2.80 m the
 *     report measured, and on an alternating frame rate it under-states the
 *     travel by a stated amount rather than an unknown one.
 */
export const test_viewer_inspect_flight_readout = (): void => {
  const page = ts.createSourceFile(
    INSPECT_SOURCE,
    fs.readFileSync(INSPECT_SOURCE, "utf8"),
    ts.ScriptTarget.ES2022,
    true,
  );
  const readout = compile(page);

  //----
  // 1. ONE BUDGET, CLAMPED AND REPORTED AGAINST, OVER UNCLAMPED INTERVALS
  //----
  const frame = declaration(page, "frame");
  TestValidator.equals(
    "the eye integrates and reports against the same frame budget",
    {
      budget: literal(page, "MAX_FRAME_SECONDS"),
      "the readout's arguments": args(frame, "speedReadout"),
      "the sampled interval": args(frame, "frameSeconds.push"),
      "the clamped interval is the budget's": initializer(
        frame,
        "delta",
      ).includes("MAX_FRAME_SECONDS"),
      "the sampled interval is not": initializer(frame, "real").includes(
        "MAX_FRAME_SECONDS",
      ),
    },
    {
      budget: 0.1,
      "the readout's arguments": ["speed", "frameSeconds", "MAX_FRAME_SECONDS"],
      "the sampled interval": ["real"],
      "the clamped interval is the budget's": true,
      "the sampled interval is not": false,
    },
  );

  //----
  // 2. FRAMES INSIDE THE BUDGET COST NOTHING AND EARN NOTHING
  //----
  TestValidator.equals(
    "a 60 fps eye flies exactly the speed it was given",
    readout(4, filled(1 / 60), 0.1),
    "4.00m/s",
  );

  //----
  // 3. THE MEASURED WITNESS
  //----
  // 2.80 m in the second the key was held, at a printed 4.00 m/s: 70% of the
  // ask, which is 0.1 s of budget out of every 0.1429 s frame. 4 x 0.1 / 0.1429
  // = 2.799 m/s, and 1 / 0.1429 = 7.0 frames a second.
  TestValidator.equals(
    "the line states the 2.80 m/s the eye actually flew",
    readout(4, filled(0.1429), 0.1),
    "4.00m/s (flying 2.80m/s at 7.0fps)",
  );

  //----
  // 4. THE FRAME-TIME CENSUS FROM THE SAME REPORT
  //----
  // 4 x 0.1 / 0.3668 = 1.0905 m/s, at 1 / 0.3668 = 2.726 frames a second.
  TestValidator.equals(
    "a mansion drawing at under three frames a second says so",
    readout(4, filled(0.3668), 0.1),
    "4.00m/s (flying 1.09m/s at 2.7fps)",
  );

  //----
  // 5. A DIFFERENCE TOO SMALL TO PRINT IS NOT PRINTED
  //----
  // At 0.1001 s the eye loses a tenth of a percent: 4 x 0.1 / 0.1001 = 3.996,
  // which is "4.00" at the precision this line prints, so a second number would
  // repeat the first and a suffix would flicker on and off at the budget's
  // edge. 0.1013 s is the neighbouring frame time that does round apart:
  // 4 x 0.1 / 0.1013 = 3.9487 m/s at 9.87 frames a second.
  TestValidator.equals(
    "the deficit appears exactly when it is visible at two decimals",
    [
      readout(4, filled(0.1), 0.1),
      readout(4, filled(0.1001), 0.1),
      readout(4, filled(0.1013), 0.1),
    ],
    ["4.00m/s", "4.00m/s", "4.00m/s (flying 3.95m/s at 9.9fps)"],
  );

  //----
  // 6. THE SPEED CONTROL STILL WORKS ON A HEAVY SET
  //----
  // Three presses of `E` from the default: 4 x 1.5^3 = 13.5 m/s asked, and
  // 13.5 x 0.1 / 0.3668 = 3.68 m/s flown, which is how an operator gets back
  // to something near the pace the frames took away.
  TestValidator.equals(
    "raising the setting raises the pace actually flown",
    readout(13.5, filled(0.3668), 0.1),
    "13.50m/s (flying 3.68m/s at 2.7fps)",
  );

  //----
  // 7. A RETURNING TAB IS NOT A SLOW SET
  //----
  // Fourteen 60 fps frames and one 30 s gap: the mean interval is 2.0156 s and
  // would report an eye at 0.20 m/s that in fact never slowed down. The median
  // is 1/60 s and reports nothing. Sustain that mean, though, and the set
  // really is that slow, and the line says so.
  const returning = [...filled(1 / 60).slice(1), 30];
  TestValidator.equals(
    "one enormous interval is ignored and a sustained one is not",
    [readout(4, returning, 0.1), readout(4, filled(2.0156), 0.1)],
    ["4.00m/s", "4.00m/s (flying 0.20m/s at 0.5fps)"],
  );

  //----
  // 8. A WINDOW WITH NOTHING IN IT YET
  //----
  // The first frame arrives at elapsed 0 and measures a zero-length interval,
  // so both of these are states the page really passes through.
  TestValidator.equals(
    "an empty and an instantaneous window both print the asked-for speed",
    [readout(4, [], 0.1), readout(4, [0, 0, 0], 0.1)],
    ["4.00m/s", "4.00m/s"],
  );

  //----
  // 9. A WINDOW STILL FILLING REPORTS THE SLOW FRAME
  //----
  // The buffer starts empty, so the first frames are read from an even-length
  // window. Taking the upper of the two middles keeps the reading pessimistic,
  // which is the safe direction for a number an operator computes a distance
  // from.
  TestValidator.equals(
    "a half-filled window does not average the slow frame away",
    readout(4, [0, 0.3668], 0.1),
    "4.00m/s (flying 1.09m/s at 2.7fps)",
  );

  //----
  // 10. THE PRINTED PACE IS THE DISTANCE A HELD KEY BUYS
  //----
  // The point of the line, replayed against the page's own integration: one
  // second of holding `W` moves `speed` times the sum of the clamped frames it
  // contains. Seven 0.1429 s frames fill that second and each carries 0.1 s of
  // budget, so the eye covers 4 x 7 x 0.1 = 2.80 m -- the distance the report
  // measured on the mansion -- and the line now prints exactly that number.
  //
  // A frame rate that alternates is where the median stops being the whole
  // truth, and the shortfall is stated here rather than left to be discovered.
  // A window of 0.3 s and 0.05 s frames has a median of 0.3 s and reads
  // 1.33 m/s, while the first second of it holds three long frames and two
  // short ones and so buys 4 x (3 x 0.1 + 2 x 0.05) = 1.60 m. The line is a
  // plan and not a proof; what a finding is written from is the position
  // printed beside it, which is exact whatever the frames cost.
  TestValidator.equals(
    "the flown figure is the metres one second of holding a key actually buys",
    [
      readout(4, filled(0.1429), 0.1),
      travelled(4, filled(0.1429), 0.1).toFixed(2),
      readout(4, bimodal(), 0.1),
      travelled(4, bimodal(), 0.1).toFixed(2),
    ],
    [
      "4.00m/s (flying 2.80m/s at 7.0fps)",
      "2.80",
      "4.00m/s (flying 1.33m/s at 3.3fps)",
      "1.60",
    ],
  );
};

/**
 * Metres the eye covers over the first second of these frames, by the page's
 * own rule: every frame carries `speed` for as long as it lasted, and never for
 * longer than the budget.
 */
const travelled = (
  speed: number,
  frames: readonly number[],
  budgetSeconds: number,
): number => {
  let elapsed = 0;
  let distance = 0;
  for (const interval of frames) {
    if (elapsed >= 1) break;
    elapsed += interval;
    distance += speed * Math.min(interval, budgetSeconds);
  }
  return distance;
};

/** A window whose frame rate alternates, where a median is not a mean. */
const bimodal = (): number[] =>
  new Array<number>(15)
    .fill(0)
    .map((_unused, index) => (index % 2 === 0 ? 0.3 : 0.05));

/** The shipped page, which every generated project inherits verbatim. */
const INSPECT_SOURCE = path.resolve(
  __dirname,
  "../../../../packages/cli/scaffold/viewer/src/inspect.ts",
);

/** A full sample window of one repeated frame interval, in seconds. */
const filled = (seconds: number): number[] =>
  new Array<number>(15).fill(seconds);

/** The readout function itself, lifted out of the page and made callable. */
const compile = (
  page: ts.SourceFile,
): ((speed: number, frames: readonly number[], budget: number) => string) => {
  const js = ts.transpileModule(declaration(page, "speedReadout").getText(), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-flight-"));
  const file = path.join(directory, "speedReadout.cjs");
  fs.writeFileSync(file, `${js}\nmodule.exports = speedReadout;\n`, "utf8");
  try {
    return createRequire(__filename)(file) as (
      speed: number,
      frames: readonly number[],
      budget: number,
    ) => string;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

/** One top-level function of the page, or a failure that says which is gone. */
const declaration = (
  page: ts.SourceFile,
  name: string,
): ts.FunctionDeclaration => {
  const found = page.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (found === undefined)
    throw new Error(
      `inspect.ts no longer declares "${name}" at the top level, so this` +
        ` case is measuring nothing; re-read the page before re-pinning it.`,
    );
  return found;
};

/** The numeric value of one top-level `const` of the page. */
const literal = (page: ts.SourceFile, name: string): number => {
  for (const statement of page.statements)
    if (ts.isVariableStatement(statement))
      for (const entry of statement.declarationList.declarations)
        if (
          ts.isIdentifier(entry.name) &&
          entry.name.text === name &&
          entry.initializer !== undefined &&
          ts.isNumericLiteral(entry.initializer)
        )
          return Number(entry.initializer.text);
  throw new Error(`inspect.ts no longer declares "${name}" as a number.`);
};

/** The source text a named local of one function is initialized from. */
const initializer = (host: ts.Node, name: string): string =>
  only(
    collect(host, (node) =>
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer !== undefined
        ? node.initializer.getText()
        : undefined,
    ),
    `a binding of "${name}"`,
  );

/** The argument expressions one call inside a function is written with. */
const args = (host: ts.Node, callee: string): string[] =>
  only(
    collect(host, (node) =>
      ts.isCallExpression(node) && node.expression.getText() === callee
        ? node.arguments.map((argument) => argument.getText())
        : undefined,
    ),
    `a call to "${callee}"`,
  );

/** Everything one reading of the frame function finds. */
const collect = <T>(
  host: ts.Node,
  read: (node: ts.Node) => T | undefined,
): T[] => {
  const found: T[] = [];
  walk(host, (node) => {
    const value = read(node);
    if (value !== undefined) found.push(value);
  });
  return found;
};

/**
 * The single member, or a failure naming what was expected.
 *
 * Taking the last of several would leave a second call site unread, which is
 * exactly the divergence this case exists to refuse: two readouts told two
 * different budgets would pass a check that only ever looked at one of them.
 */
const only = <T>(found: readonly T[], what: string): T => {
  if (found.length !== 1)
    throw new Error(
      `inspect.ts holds ${found.length} of ${what} inside its frame rather ` +
        `than one, so this case is no longer measuring what it names.`,
    );
  return found[0]!;
};

const walk = (node: ts.Node, visit: (node: ts.Node) => void): void => {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
};
