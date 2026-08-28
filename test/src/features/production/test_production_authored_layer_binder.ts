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
 * 1. Out-of-order screenplay files bind in code-unit path order beneath one H1;
 *    H1 through H4 are rebased, comments and anchors disappear, and fenced
 *    headings plus reader Markdown survive.
 * 2. Model and map layers use the same transformation, proving the API is not
 *    tied to films, while CRLF input and non-Markdown neighbors remain harmless.
 * 3. Two runs write byte-identical output at one stable path and leave every
 *    authored source byte unchanged.
 * 4. Empty, missing, linked, malformed, overflowing, invalid-layer, blank-title,
 *    and docs-overlapping inputs fail without publishing an edition.
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
      write(
        film,
        "docs/screenplays/002-answer.md",
        "# Answer screenplay {#answer}\n\n## SEQ-ANSWER {#seq-answer}\n\nThe gate opens.\n",
      );
      write(
        film,
        "docs/screenplays/010-appendix/001-observation.md",
        "# Observation\n\n## Readable state\n\nThe final state is visible.\n",
      );
      write(
        film,
        "docs/screenplays/001-cue.md",
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
          "## Cue screenplay",
          "### SEQ-CUE",
          "#### SCN-001",
          "##### 0.000-2.000 s",
          "## Quoted evidence heading {#quoted}",
          "## Answer screenplay",
          "### SEQ-ANSWER",
          "## Observation",
          "### Readable state",
        ],
      );
      TestValidator.predicate(
        "authoring comments removed",
        !markdown.includes("@evidence"),
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
      const libraryMarkdown: string = await new AutoMovieProductionBinder({
        root: library,
        title: "Object Library",
        layer: "models",
      }).markdown();
      TestValidator.equals(
        "library reader edition",
        libraryMarkdown,
        "# Object Library\n\n## Body\n\n### Envelope\n\nOne metre.\n",
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
    } finally {
      for (const root of roots)
        fs.rmSync(root, { force: true, recursive: true });
    }
  };
