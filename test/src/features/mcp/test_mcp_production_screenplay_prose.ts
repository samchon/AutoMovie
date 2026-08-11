import { IAutoMovieScreenplayIndex } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { productionFixture } from "./productionFixtures";

interface IScreenplayProseFixtureFailure {
  error: unknown;
}

class ScreenplayProseFixtureCleanupError extends AggregateError {}

const preserveScreenplayProseFixtureCleanup = (
  failure: IScreenplayProseFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ScreenplayProseFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Screenplay-prose fixture teardown failed after the test failed.",
    );
  }
};

/**
 * The compiler joins the machine ledger to the prose a human actually wrote.
 *
 * Every other screenplay check reads the index alone, and an index that agrees
 * with itself can still promise a scene nobody wrote. This is the only place
 * the compiler opens authored prose, so it is the only place that can tell a
 * ledger entry from a scene. It is the last obligation
 * `automovie/screenplay-contract` held that the compiler did not.
 *
 * The scaffold splits prose one file per unit and points the index-level path
 * at the first of them, so the index document _is_ a per-scene document. The
 * split is what makes the mixed layout worth pinning: an index-level document
 * yields exactly the units that do not address their own, since counting an
 * owned unit from it would find that heading twice.
 *
 * Each case edits one document or one index field, so a diagnostic that fires
 * is answering for that edit. Every rewrite refuses to leave its target
 * unchanged, because a rewrite that matched nothing would leave the case
 * asserting against a correct project.
 *
 * Scenarios:
 *
 * 1. The untouched fixture is silent, which is the baseline the rest are read
 *    against.
 * 2. A treatment beat whose prose the document does not contain is refused, and
 *    soft-wrapping that same sentence across lines is not, since Markdown
 *    presentation is not a change to the authored sentence.
 * 3. An indexed scene with no heading in its document is refused; so is a heading
 *    the index does not declare, and a heading id occurring twice.
 * 4. A heading whose title differs from the index is refused, and an active scene
 *    whose heading carries no prose beneath it is refused.
 * 5. A heading inside a fenced block does not count as a declaration, so a
 *    document that merely illustrates the format is not mistaken for one that
 *    declares the scene.
 * 6. An index addressing a document that does not exist is refused rather than
 *    crashing, since one authoring mistake must not become a stack trace, and
 *    the unreadable treatment stops there rather than going on to judge beats
 *    against prose it never got.
 * 7. The whole-file layout per-unit paths were added beside, with no unit
 *    addressing a document of its own, stays green.
 */
export const test_mcp_production_screenplay_prose = (): void => {
  let failure: IScreenplayProseFixtureFailure | undefined;
  const fixture = productionFixture();
  try {
    const reopen = (): AutoMovieProductionCompiler =>
      new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(fixture.root),
      );
    reopen();
    const indexFile = [
      path.join(
        fixture.root,
        ".automovie/design/fixture-film/screenplay/index.json",
      ),
      path.join(fixture.root, ".automovie/design/screenplay/index.json"),
    ].find((file) => fs.existsSync(file))!;
    const originalIndex = fs.readFileSync(indexFile, "utf8");
    const index = JSON.parse(originalIndex) as IAutoMovieScreenplayIndex;
    const scenePath = index.screenplay.scenes[0]!.path!;
    const treatmentPath = index.treatment.sequences[0]!.path!;
    const sceneFile = path.join(fixture.root, scenePath);
    const treatmentFile = path.join(fixture.root, treatmentPath);
    const originalScene = fs.readFileSync(sceneFile, "utf8");
    const originalTreatment = fs.readFileSync(treatmentFile, "utf8");

    const restore = (): void => {
      fs.writeFileSync(indexFile, originalIndex);
      fs.writeFileSync(sceneFile, originalScene);
      fs.writeFileSync(treatmentFile, originalTreatment);
    };
    const write = (file: string, before: string, next: string): void => {
      if (next === before)
        throw new Error(`The prose mutation left "${file}" unchanged.`);
      fs.writeFileSync(file, next);
    };
    const compileCodes = (): Set<string> =>
      new Set(
        reopen()
          .compile({ scope: "design" })
          .diagnostics.map((item) => item.code),
      );
    const after = (mutate: () => void): Set<string> => {
      restore();
      mutate();
      const codes = compileCodes();
      restore();
      return codes;
    };
    const editScene = (next: (source: string) => string): void =>
      write(sceneFile, originalScene, next(originalScene));
    const editIndex = (
      mutate: (value: IAutoMovieScreenplayIndex) => void,
    ): void => {
      const value = JSON.parse(originalIndex) as IAutoMovieScreenplayIndex;
      mutate(value);
      write(indexFile, originalIndex, `${JSON.stringify(value, null, 2)}\n`);
    };

    restore();
    TestValidator.predicate(
      "an authored screenplay raises no prose diagnostic",
      [...compileCodes()].some((code) => code.startsWith("screenplay-")) ===
        false,
    );

    const observed: Record<string, boolean> = {
      // The scaffold soft-wraps this beat across two lines, so the defect has
      // to be a changed word rather than a changed line: rewriting the whole
      // sentence would prove nothing that reflowing it does not.
      beatUnwritten: after(() =>
        write(
          treatmentFile,
          originalTreatment,
          originalTreatment.replace("in its rows", "in a scattered mob"),
        ),
      ).has("screenplay-beat-unwritten"),
      headingAbsent: after(() =>
        editScene((source) =>
          source.replace(/^#{1,6} SCN-001.*$/mu, "## Prose"),
        ),
      ).has("screenplay-heading-absent"),
      headingUnindexed: after(() =>
        editScene(
          (source) =>
            `${source}\n## SCN-777 — An unindexed scene\n\nProse nobody indexed.\n`,
        ),
      ).has("screenplay-heading-unindexed"),
      headingRepeated: after(() =>
        editScene(
          (source) =>
            `${source}\n## SCN-001 — The signal\n\nA second section claiming the same number.\n`,
        ),
      ).has("screenplay-heading-repeated"),
      headingRetitled: after(() =>
        editIndex((value) => {
          value.screenplay.scenes[0]!.title = "A title the heading never uses";
        }),
      ).has("screenplay-heading-retitled"),
      documentAbsent: after(() =>
        editIndex((value) => {
          value.screenplay.scenes[0]!.path = "docs/nowhere/SCN-001.md";
        }),
      ).has("screenplay-document-absent"),
      // The treatment half of the same mistake. It must report the unreadable
      // document and stop there rather than go on to judge beats against prose
      // it never got, which would blame the author twice for one typo.
      treatmentDocumentAbsent: (() => {
        const codes = after(() =>
          editIndex((value) => {
            value.treatment.sequences[0]!.path = "docs/nowhere/SEQ-CUE.md";
          }),
        );
        return (
          codes.has("screenplay-document-absent") &&
          codes.has("screenplay-beat-unwritten") === false
        );
      })(),
    };
    TestValidator.equals(
      "every prose obligation refuses the document that breaks it",
      observed,
      {
        beatUnwritten: true,
        headingAbsent: true,
        headingUnindexed: true,
        headingRepeated: true,
        headingRetitled: true,
        documentAbsent: true,
        treatmentDocumentAbsent: true,
      },
    );

    // A scene whose heading survives but whose prose does not is the case that
    // separates an authored scene from a promise of one.
    const unwritten = after(() =>
      editScene((source) => {
        const heading = /^#{1,6} SCN-001.*$/mu.exec(source)![0];
        return `${heading}\n`;
      }),
    );
    TestValidator.predicate(
      "a heading with no prose beneath it does not satisfy an active scene",
      unwritten.has("screenplay-scene-unwritten"),
    );

    // The negative twins. Presentation whitespace is not a change to the
    // authored sentence, and an illustration of the heading format is not a
    // declaration of the scene.
    // The scaffold ships this beat on one line, so hard-wrapping it is the
    // same sentence presented differently. Prose comparison normalizes the
    // whitespace between words, or a treatment would owe its beats a line
    // width as well as their words.
    const wrapped = after(() =>
      write(
        treatmentFile,
        originalTreatment,
        originalTreatment.replace(
          "A soloist raises a hand while the chorus behind stays visibly in its rows.",
          "A soloist raises a hand while the chorus behind stays visibly\nin its rows.",
        ),
      ),
    );
    const fenced = after(() =>
      editScene(
        (source) =>
          `${source}\n\`\`\`md\n## SCN-777 — Only an illustration\n\`\`\`\n`,
      ),
    );
    TestValidator.equals(
      "presentation and illustration are not authoring defects",
      {
        softWrapAccepted: wrapped.has("screenplay-beat-unwritten") === false,
        fencedHeadingIgnored:
          fenced.has("screenplay-heading-unindexed") === false,
      },
      { softWrapAccepted: true, fencedHeadingIgnored: true },
    );

    // The whole-file layout, which per-unit paths were added beside rather
    // than in place of. Dropping every unit path leaves the index-level
    // documents as the only addresses, and a production that never split its
    // prose must stay green.
    const whole = after(() => {
      const value = JSON.parse(originalIndex) as IAutoMovieScreenplayIndex;
      for (const sequence of value.treatment.sequences) delete sequence.path;
      for (const entry of value.screenplay.scenes) delete entry.path;
      // One document now has to carry every scene, and the index-level path
      // already names the first scene's file.
      const merged = value.screenplay.scenes
        .map((entry) =>
          fs.readFileSync(
            path.join(
              fixture.root,
              `${scenePath.slice(0, scenePath.lastIndexOf("/"))}/${entry.id}.md`,
            ),
            "utf8",
          ),
        )
        .join("\n");
      write(sceneFile, originalScene, merged);
      const treatmentDir = treatmentPath.slice(
        0,
        treatmentPath.lastIndexOf("/"),
      );
      write(
        treatmentFile,
        originalTreatment,
        value.treatment.sequences
          .map((sequence) =>
            fs.readFileSync(
              path.join(fixture.root, `${treatmentDir}/${sequence.id}.md`),
              "utf8",
            ),
          )
          .join("\n"),
      );
      write(indexFile, originalIndex, `${JSON.stringify(value, null, 2)}\n`);
    });
    TestValidator.predicate(
      "a production that never split its prose stays green",
      [...whole].some((code) => code.startsWith("screenplay-")) === false,
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveScreenplayProseFixtureCleanup(failure, () => fixture.dispose());
  }
};
