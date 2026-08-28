import { AutoMovieProductionBinder } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Writes one UTF-8 fixture file, creating its parent directories. */
const write = (root: string, relative: string, content: string): string => {
  const target: string = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  return target;
};

/** Reads the authored docs tree as a path-to-byte map. */
const docsSnapshot = (root: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const docs: string = path.join(root, "docs");
  const walk = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort(
        (left, right) =>
          Number(left.name > right.name) - Number(left.name < right.name),
      )) {
      const target: string = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile())
        result[path.relative(docs, target).split(path.sep).join("/")] =
          fs.readFileSync(target, "utf8");
    }
  };
  walk(docs);
  return result;
};

/**
 * The authored-layer binder exposes evidence-heavy work as one clean Markdown edition.
 *
 * Scenarios:
 *
 * 1. Out-of-order screenplay groups bind as H2 partitions and ordered H3 units;
 *    index bodies stay out, H1 through H4 are rebased, comments and anchors
 *    disappear, and fenced headings plus reader Markdown survive.
 * 2. Model and map layers use the same transformation, proving the API is not
 *    tied to films, while CRLF input and non-Markdown neighbors remain harmless.
 * 3. Two runs write byte-identical output at one stable path and leave every
 *    authored source byte unchanged.
 * 4. Empty, missing, linked, malformed, overflowing, invalid-layer, blank-title,
 *    docs-overlapping, resident-symlink, hardlink, and foreign-byte inputs fail
 *    without publishing or changing the resident bytes.
 */
export const test_production_authored_layer_binder =
  async (): Promise<void> => {
    const roots: string[] = [];
    const makeRoot = (): string => {
      const root: string = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-reader-"),
      );
      roots.push(root);
      fs.mkdirSync(path.join(root, "docs"), { recursive: true });
      return root;
    };

    try {
      const film: string = makeRoot();
      write(film, "docs/screenplays/001-alpha/index.md", "# Alpha group\n");
      write(film, "docs/screenplays/001-alpha/001-zulu.md", "# Zulu unit\n");
      write(film, "docs/screenplays/001-alpha/001-alpha.md", "# Alpha unit\n");
      write(
        film,
        "docs/screenplays/002-answer/index.md",
        "# Answer group {#answer-group}\n\nThis index body is authoring-only.\n",
      );
      write(
        film,
        "docs/screenplays/002-answer/001-answer.md",
        "# Answer screenplay {#answer}\n\n## SEQ-ANSWER {#seq-answer}\n\nThe gate opens.\n",
      );
      write(film, "docs/screenplays/010-appendix/index.md", "# Appendix\n");
      write(
        film,
        "docs/screenplays/010-appendix/001-observation.md",
        "# Observation\n\n## Readable state\n\nThe final state is visible.\n",
      );
      write(
        film,
        "docs/screenplays/001-cue/index.md",
        "# Cue group {#cue-group}\n\nThis group note is not reader content.\n",
      );
      write(
        film,
        "docs/screenplays/001-cue/001-cue.md",
        [
          "<!--",
          "@evidence contracts/local.md#tone The cue answers the adopted tone.",
          "-->",
          "",
          "# Cue screenplay {#cue}",
          "",
          "## SEQ-CUE {#seq-cue}",
          "",
          "### SCN-001 {#scene-one}",
          "",
          "#### 0.000-2.000 s {#beat-one}",
          "",
          "The hand rises; see [blocking notes](https://example.invalid/blocking).",
          "",
          "```md",
          "## Quoted evidence heading {#quoted}",
          "<!-- A fenced example comment remains reader content. -->",
          "",
          "",
          "Two blank example lines remain above this sentence.",
          "```",
          "",
          "The prop keeps {braces that are prose}.",
          "",
        ].join("\n"),
      );
      const filmBefore = docsSnapshot(film);
      const filmBinder = new AutoMovieProductionBinder({
        root: film,
        title: "Signal / Answer",
        layer: "screenplays",
      });
      const markdown: string = await filmBinder.markdown();
      TestValidator.equals(
        "reader headings",
        markdown.split("\n").filter((line) => line.startsWith("#")),
        [
          "# Signal / Answer",
          "## Alpha group",
          "### Alpha unit",
          "### Zulu unit",
          "## Cue group",
          "### Cue screenplay",
          "#### SEQ-CUE",
          "##### SCN-001",
          "###### 0.000-2.000 s",
          "## Quoted evidence heading {#quoted}",
          "## Answer group",
          "### Answer screenplay",
          "#### SEQ-ANSWER",
          "## Appendix",
          "### Observation",
          "#### Readable state",
        ],
      );
      TestValidator.predicate(
        "authoring comments removed",
        !markdown.includes("@evidence"),
      );
      TestValidator.predicate(
        "group index bodies omitted",
        !markdown.includes("This index body is authoring-only.") &&
          !markdown.includes("This group note is not reader content."),
      );
      TestValidator.predicate(
        "reader Markdown preserved",
        markdown.includes(
          "[blocking notes](https://example.invalid/blocking)",
        ) &&
          markdown.includes("{braces that are prose}") &&
          markdown.includes(
            "<!-- A fenced example comment remains reader content. -->",
          ) &&
          markdown.includes(
            "<!-- A fenced example comment remains reader content. -->\n\n\nTwo blank example lines remain above this sentence.",
          ),
      );

      const first: string = await filmBinder.bind();
      const firstBytes: string = fs.readFileSync(first, "utf8");
      const second: string = await filmBinder.bind();
      TestValidator.equals("stable output path", second, first);
      TestValidator.equals(
        "stable output bytes",
        fs.readFileSync(second, "utf8"),
        firstBytes,
      );
      TestValidator.equals(
        "read-only authored docs",
        docsSnapshot(film),
        filmBefore,
      );
      TestValidator.equals(
        "reader filename",
        path.basename(first),
        "signal-answer-screenplays.md",
      );

      const library: string = makeRoot();
      write(
        library,
        "docs/models/001-body.md",
        "#\tBody\r\n\r\n##  Envelope {#envelope:v2}\r\n\r\nOne metre.\r\n",
      );
      write(library, "docs/models/notes.txt", "not an authored document\n");
      write(
        library,
        "docs/models/010-parts/001-leg.md",
        "# Leg\n\n## Envelope\n\nOne metre.\n",
      );
      const libraryMarkdown: string = await new AutoMovieProductionBinder({
        root: library,
        title: "Object Library",
        layer: "models",
      }).markdown();
      TestValidator.equals(
        "library reader edition",
        libraryMarkdown,
        "# Object Library\n\n## Body\n\n### Envelope\n\nOne metre.\n\n## Leg\n\n### Envelope\n\nOne metre.\n",
      );
      write(
        library,
        "docs/maps/001-site.md",
        "# Site map\n\n## Extent {#extent}\n\nOne bounded site.\n",
      );
      TestValidator.equals(
        "map reader edition",
        await new AutoMovieProductionBinder({
          root: library,
          title: "Site Library",
          layer: "maps",
        }).markdown(),
        "# Site Library\n\n## Site map\n\n### Extent\n\nOne bounded site.\n",
      );
      write(
        library,
        "docs/briefs/001-delivery.md",
        "# Delivery brief\n\n## Observation {#observation}\n\nThe bounded result is visible.\n",
      );
      TestValidator.equals(
        "direct-brief reader edition",
        await new AutoMovieProductionBinder({
          root: library,
          title: "Direct Brief",
          layer: "briefs",
        }).markdown(),
        "# Direct Brief\n\n## Delivery brief\n\n### Observation\n\nThe bounded result is visible.\n",
      );

      const empty: string = makeRoot();
      fs.mkdirSync(path.join(empty, "docs", "settings"), { recursive: true });
      await TestValidator.error("empty layer", () =>
        new AutoMovieProductionBinder({
          root: empty,
          title: "Empty",
          layer: "settings",
        }).markdown(),
      );
      await TestValidator.error("missing layer", () =>
        new AutoMovieProductionBinder({
          root: empty,
          title: "Missing",
          layer: "materials",
        }).markdown(),
      );

      const missingGrouped: string = makeRoot();
      await TestValidator.error("missing grouped layer", () =>
        new AutoMovieProductionBinder({
          root: missingGrouped,
          title: "Missing scripts",
          layer: "scripts",
        }).markdown(),
      );

      const missingDocs: string = makeRoot();
      fs.rmSync(path.join(missingDocs, "docs"), { recursive: true });
      await TestValidator.error("missing grouped docs root", () =>
        new AutoMovieProductionBinder({
          root: missingDocs,
          title: "Missing docs",
          layer: "screenplays",
        }).markdown(),
      );

      const noGroups: string = makeRoot();
      fs.mkdirSync(path.join(noGroups, "docs", "scripts"));
      await TestValidator.error("empty grouped layer", () =>
        new AutoMovieProductionBinder({
          root: noGroups,
          title: "No groups",
          layer: "scripts",
        }).markdown(),
      );

      const missingIndex: string = makeRoot();
      write(missingIndex, "docs/scripts/001-event/001-unit.md", "# Unit\n");
      await TestValidator.error("missing group index", () =>
        new AutoMovieProductionBinder({
          root: missingIndex,
          title: "Missing index",
          layer: "scripts",
        }).markdown(),
      );

      const malformedIndex: string = makeRoot();
      write(
        malformedIndex,
        "docs/scripts/001-event/index.md",
        "Opening prose before the group title.\n",
      );
      write(malformedIndex, "docs/scripts/001-event/001-unit.md", "# Unit\n");
      await TestValidator.error("malformed group index", () =>
        new AutoMovieProductionBinder({
          root: malformedIndex,
          title: "Malformed index",
          layer: "scripts",
        }).markdown(),
      );

      const noUnits: string = makeRoot();
      write(noUnits, "docs/scripts/001-event/index.md", "# Event\n");
      await TestValidator.error("group without units", () =>
        new AutoMovieProductionBinder({
          root: noUnits,
          title: "No units",
          layer: "scripts",
        }).markdown(),
      );

      const malformedUnit: string = makeRoot();
      write(malformedUnit, "docs/scripts/001-event/index.md", "# Event\n");
      write(
        malformedUnit,
        "docs/scripts/001-event/001-unit.md",
        "Opening prose before the unit title.\n",
      );
      await TestValidator.error("malformed grouped unit", () =>
        new AutoMovieProductionBinder({
          root: malformedUnit,
          title: "Malformed unit",
          layer: "scripts",
        }).markdown(),
      );

      const invalidIndexLeaf: string = makeRoot();
      fs.mkdirSync(
        path.join(invalidIndexLeaf, "docs", "scripts", "001-event", "index.md"),
        { recursive: true },
      );
      await TestValidator.error("non-file group index", () =>
        new AutoMovieProductionBinder({
          root: invalidIndexLeaf,
          title: "Invalid index",
          layer: "scripts",
        }).markdown(),
      );

      const linkedGroupedLayer: string = makeRoot();
      const linkedGroupedSource: string = makeRoot();
      write(linkedGroupedSource, "scripts/001-event/index.md", "# Event\n");
      write(linkedGroupedSource, "scripts/001-event/001-unit.md", "# Unit\n");
      fs.symlinkSync(
        path.join(linkedGroupedSource, "scripts"),
        path.join(linkedGroupedLayer, "docs", "scripts"),
        process.platform === "win32" ? "junction" : "dir",
      );
      await TestValidator.error("linked grouped layer", () =>
        new AutoMovieProductionBinder({
          root: linkedGroupedLayer,
          title: "Linked scripts",
          layer: "scripts",
        }).markdown(),
      );

      const linkedGroupedEntry: string = makeRoot();
      const linkedDirectory = path.join(linkedGroupedEntry, "outside");
      fs.mkdirSync(linkedDirectory);
      write(linkedGroupedEntry, "docs/scripts/001-event/index.md", "# Event\n");
      fs.symlinkSync(
        linkedDirectory,
        path.join(linkedGroupedEntry, "docs", "scripts", "001-event", "linked"),
        process.platform === "win32" ? "junction" : "dir",
      );
      await TestValidator.error("linked grouped entry", () =>
        new AutoMovieProductionBinder({
          root: linkedGroupedEntry,
          title: "Linked unit",
          layer: "scripts",
        }).markdown(),
      );

      const malformed: string = makeRoot();
      write(
        malformed,
        "docs/settings/001-malformed.md",
        "Opening prose before any title.\n",
      );
      await TestValidator.error("missing H1", () =>
        new AutoMovieProductionBinder({
          root: malformed,
          title: "Malformed",
          layer: "settings",
        }).markdown(),
      );

      const overflow: string = makeRoot();
      write(
        overflow,
        "docs/settings/001-overflow.md",
        "# Overflow\n\n###### Too deep\n",
      );
      await TestValidator.error("heading overflow", () =>
        new AutoMovieProductionBinder({
          root: overflow,
          title: "Overflow",
          layer: "settings",
        }).markdown(),
      );

      const linked: string = makeRoot();
      const outside: string = makeRoot();
      write(outside, "external/outside.md", "# Outside\n");
      write(outside, "settings/outside.md", "# Outside settings\n");
      fs.mkdirSync(path.join(linked, "docs", "settings"), { recursive: true });
      const link = path.join(linked, "docs", "settings", "external");
      try {
        fs.symlinkSync(
          path.join(outside, "external"),
          link,
          process.platform === "win32" ? "junction" : "dir",
        );
        await TestValidator.error("linked source", () =>
          new AutoMovieProductionBinder({
            root: linked,
            title: "Linked",
            layer: "settings",
          }).markdown(),
        );
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            "code" in error &&
            ["EPERM", "EACCES"].includes(String(error.code))
          )
        )
          throw error;
      }

      const linkedLayer = makeRoot();
      const linkedLayerPath = path.join(linkedLayer, "docs", "settings");
      try {
        fs.symlinkSync(
          path.join(outside, "external"),
          linkedLayerPath,
          process.platform === "win32" ? "junction" : "dir",
        );
        await TestValidator.error("linked layer root", () =>
          new AutoMovieProductionBinder({
            root: linkedLayer,
            title: "Linked root",
            layer: "settings",
          }).markdown(),
        );
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            "code" in error &&
            ["EPERM", "EACCES"].includes(String(error.code))
          )
        )
          throw error;
      }

      const linkedDocs = makeRoot();
      fs.rmSync(path.join(linkedDocs, "docs"), { recursive: true });
      try {
        fs.symlinkSync(
          path.dirname(path.join(outside, "external")),
          path.join(linkedDocs, "docs"),
          process.platform === "win32" ? "junction" : "dir",
        );
        await TestValidator.error("linked docs root", () =>
          new AutoMovieProductionBinder({
            root: linkedDocs,
            title: "Linked docs",
            layer: "settings",
          }).markdown(),
        );
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            "code" in error &&
            ["EPERM", "EACCES"].includes(String(error.code))
          )
        )
          throw error;
      }

      TestValidator.error(
        "blank title",
        () =>
          new AutoMovieProductionBinder({
            root: film,
            title: "  ",
            layer: "screenplays",
          }),
      );
      TestValidator.error(
        "multiline title",
        () =>
          new AutoMovieProductionBinder({
            root: film,
            title: "Signal\n# Injected title",
            layer: "screenplays",
          }),
      );
      TestValidator.error(
        "unknown layer",
        () =>
          new AutoMovieProductionBinder({
            root: film,
            title: "Unknown",
            layer: "unknown",
          } as unknown as ConstructorParameters<
            typeof AutoMovieProductionBinder
          >[0]),
      );
      TestValidator.error(
        "output contains docs",
        () =>
          new AutoMovieProductionBinder({
            root: film,
            title: "Unsafe",
            layer: "screenplays",
            output: film,
          }),
      );
      TestValidator.error(
        "output is docs",
        () =>
          new AutoMovieProductionBinder({
            root: film,
            title: "Unsafe",
            layer: "screenplays",
            output: path.join(film, "docs"),
          }),
      );
      TestValidator.error(
        "output lies inside docs",
        () =>
          new AutoMovieProductionBinder({
            root: film,
            title: "Unsafe",
            layer: "screenplays",
            output: path.join(film, "docs", "reader"),
          }),
      );
      const blockedOutputParent = write(
        film,
        "blocked-output-parent",
        "preserved output-parent bytes\n",
      );
      await TestValidator.error("output ancestor is not a directory", () =>
        new AutoMovieProductionBinder({
          root: film,
          title: "Unsafe",
          layer: "screenplays",
          output: path.join(blockedOutputParent, "reader"),
        }).bind(),
      );
      TestValidator.equals(
        "blocked output ancestor remains unchanged",
        fs.readFileSync(blockedOutputParent, "utf8"),
        "preserved output-parent bytes\n",
      );
      await TestValidator.error("invalid output path", () =>
        new AutoMovieProductionBinder({
          root: film,
          title: "Unsafe",
          layer: "screenplays",
          output: path.join(film, "\0invalid-output"),
        }).bind(),
      );
      const linkedOutput = path.join(film, "linked-output");
      try {
        fs.symlinkSync(
          path.join(film, "docs"),
          linkedOutput,
          process.platform === "win32" ? "junction" : "dir",
        );
        await TestValidator.error("output resolves to docs", () =>
          new AutoMovieProductionBinder({
            root: film,
            title: "Unsafe",
            layer: "screenplays",
            output: linkedOutput,
          }).bind(),
        );
        const prospectiveNestedOutput = path.join(
          linkedOutput,
          "not-yet-created-reader",
        );
        await TestValidator.error("prospective output resolves into docs", () =>
          new AutoMovieProductionBinder({
            root: film,
            title: "Unsafe",
            layer: "screenplays",
            output: prospectiveNestedOutput,
          }).bind(),
        );
        TestValidator.predicate(
          "prospective refusal leaves docs unchanged",
          !fs.existsSync(path.join(film, "docs", "not-yet-created-reader")),
        );
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            "code" in error &&
            ["EPERM", "EACCES"].includes(String(error.code))
          )
        )
          throw error;
      }

      const punctuation: string = makeRoot();
      write(punctuation, "docs/settings/001-scope.md", "# Scope\n");
      const fallback: string = await new AutoMovieProductionBinder({
        root: punctuation,
        title: "...",
        layer: "settings",
      }).bind();
      TestValidator.equals(
        "filename fallback",
        path.basename(fallback),
        "automovie-settings.md",
      );

      const occupied: string = makeRoot();
      write(occupied, "docs/settings/001-scope.md", "# Scope\n");
      const occupiedTarget = write(
        occupied,
        "artifacts/occupied-settings.md",
        "foreign reader bytes\n",
      );
      await TestValidator.error("different resident edition", () =>
        new AutoMovieProductionBinder({
          root: occupied,
          title: "Occupied",
          layer: "settings",
        }).bind(),
      );
      TestValidator.equals(
        "different resident bytes preserved",
        fs.readFileSync(occupiedTarget, "utf8"),
        "foreign reader bytes\n",
      );

      const linkedTargetRoot: string = makeRoot();
      write(linkedTargetRoot, "docs/settings/001-scope.md", "# Scope\n");
      const externalTarget = write(
        linkedTargetRoot,
        "external.md",
        "external reader bytes\n",
      );
      const targetDirectory = path.join(linkedTargetRoot, "artifacts");
      fs.mkdirSync(targetDirectory);
      const targetName = path.join(targetDirectory, "linked-settings.md");
      try {
        fs.symlinkSync(externalTarget, targetName, "file");
        await TestValidator.error("resident edition symlink", () =>
          new AutoMovieProductionBinder({
            root: linkedTargetRoot,
            title: "Linked",
            layer: "settings",
          }).bind(),
        );
        TestValidator.equals(
          "resident symlink target preserved",
          fs.readFileSync(externalTarget, "utf8"),
          "external reader bytes\n",
        );
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            "code" in error &&
            ["EPERM", "EACCES"].includes(String(error.code))
          )
        )
          throw error;
      }

      const hardlinkedRoot: string = makeRoot();
      write(hardlinkedRoot, "docs/settings/001-scope.md", "# Scope\n");
      const hardlinkSource = write(
        hardlinkedRoot,
        "external.md",
        "external hardlink bytes\n",
      );
      fs.mkdirSync(path.join(hardlinkedRoot, "artifacts"));
      const hardlinkTarget = path.join(
        hardlinkedRoot,
        "artifacts",
        "hardlinked-settings.md",
      );
      fs.linkSync(hardlinkSource, hardlinkTarget);
      await TestValidator.error("resident edition hardlink", () =>
        new AutoMovieProductionBinder({
          root: hardlinkedRoot,
          title: "Hardlinked",
          layer: "settings",
        }).bind(),
      );
      TestValidator.equals(
        "resident hardlink source preserved",
        fs.readFileSync(hardlinkSource, "utf8"),
        "external hardlink bytes\n",
      );

      const longName: string = makeRoot();
      write(longName, "docs/settings/001-scope.md", "# Scope\n");
      await TestValidator.error("unpublishable final filename", () =>
        new AutoMovieProductionBinder({
          root: longName,
          title: "a".repeat(300),
          layer: "settings",
        }).bind(),
      );
      TestValidator.equals(
        "failed publication removes its temporary file",
        fs.readdirSync(path.join(longName, "artifacts")),
        [],
      );
    } finally {
      for (const root of roots)
        fs.rmSync(root, { force: true, recursive: true });
    }
  };
