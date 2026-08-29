import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";

const hostBoundaryPath = path.resolve(
  __dirname,
  "../../../../packages/template/scaffold/scripts/hostBoundary.ts",
);

type CaptureBrowser =
  | { source: "playwright-chromium" }
  | { source: "system-channel"; channel: "chrome" | "msedge" }
  | {
      source: "configured-executable";
      product: "chromium" | "chrome" | "msedge";
      executablePath: string;
    };

const boundary = require(hostBoundaryPath) as {
  AUTOMOVIE_DEFAULT_CAPTURE_BROWSER: CaptureBrowser;
  AUTOMOVIE_DEFAULT_VIEWER_HOST: string;
  AUTOMOVIE_DEFAULT_VIEWER_BASE_PATH: string;
  readAutoMovieHostCaptureBrowser: (
    environment: Readonly<Record<string, string | undefined>>,
  ) => CaptureBrowser;
  readAutoMovieHostViewerHost: (
    environment: Readonly<Record<string, string | undefined>>,
  ) => string;
  readAutoMovieHostViewerBasePath: (
    environment: Readonly<Record<string, string | undefined>>,
  ) => string;
};

/**
 * The host boundary a generated project reads instead of a project-owned
 * configuration object.
 *
 * Which browser this machine has and which interface a local server may bind
 * are facts about the machine, not decisions the production owns, so they carry
 * a shipped default and are selected by an explicit input on the invoking
 * command. What the boundary must never do is guess: a host that named a
 * browser and silently received another one would be capturing through an
 * instrument nobody selected, and a base path missing its separator resolves a
 * sibling document to the server root instead of the viewer directory.
 *
 * Scenarios:
 *
 * 1. An absent variable and an empty variable both yield the shipped default,
 *    for all three decisions; the empty case is separate because an exported
 *    but unset shell variable arrives as `""` rather than as `undefined`.
 * 2. Each enumerated browser selection produces its own union arm:
 *    `playwright-chromium`, the two system channels, and a configured
 *    executable carrying both its product and its path.
 * 3. An unknown browser name is refused and the refusal lists the accepted
 *    names; `executable` without a valid product, and without a non-blank
 *    path, are refused separately and each names the variable still missing.
 * 4. A viewer host is taken verbatim, and an untrimmed one is refused rather
 *    than silently trimmed into a different interface.
 * 5. A base path already ending in `/` is returned unchanged, one without the
 *    separator gains it, and one that is not server-absolute is refused.
 */
export const test_cli_scaffold_host_boundary = (): void => {
  TestValidator.equals(
    "an unselected host boundary is the shipped default and an empty selection is not a selection",
    namedFacts([
      [
        "absentBrowser",
        () =>
          boundary.readAutoMovieHostCaptureBrowser({}).source ===
          "playwright-chromium",
      ],
      [
        "emptyBrowser",
        () =>
          boundary.readAutoMovieHostCaptureBrowser({
            AUTOMOVIE_CAPTURE_BROWSER: "",
          }).source === "playwright-chromium",
      ],
      [
        "defaultBrowserConstant",
        () =>
          boundary.AUTOMOVIE_DEFAULT_CAPTURE_BROWSER.source ===
          "playwright-chromium",
      ],
      [
        "absentViewerHost",
        () =>
          boundary.readAutoMovieHostViewerHost({}) ===
          boundary.AUTOMOVIE_DEFAULT_VIEWER_HOST,
      ],
      [
        "emptyViewerHost",
        () =>
          boundary.readAutoMovieHostViewerHost({
            AUTOMOVIE_VIEWER_HOST: "",
          }) === "127.0.0.1",
      ],
      [
        "absentBasePath",
        () =>
          boundary.readAutoMovieHostViewerBasePath({}) ===
          boundary.AUTOMOVIE_DEFAULT_VIEWER_BASE_PATH,
      ],
      [
        "emptyBasePath",
        () =>
          boundary.readAutoMovieHostViewerBasePath({
            AUTOMOVIE_VIEWER_BASE_PATH: "",
          }) === "/viewer/",
      ],
    ]),
    {
      absentBrowser: true,
      emptyBrowser: true,
      defaultBrowserConstant: true,
      absentViewerHost: true,
      emptyViewerHost: true,
      absentBasePath: true,
      emptyBasePath: true,
    },
  );

  TestValidator.equals(
    "every enumerated browser selection produces its own union arm",
    [
      boundary.readAutoMovieHostCaptureBrowser({
        AUTOMOVIE_CAPTURE_BROWSER: "playwright-chromium",
      }),
      boundary.readAutoMovieHostCaptureBrowser({
        AUTOMOVIE_CAPTURE_BROWSER: "chrome",
      }),
      boundary.readAutoMovieHostCaptureBrowser({
        AUTOMOVIE_CAPTURE_BROWSER: "msedge",
      }),
      boundary.readAutoMovieHostCaptureBrowser({
        AUTOMOVIE_CAPTURE_BROWSER: "executable",
        AUTOMOVIE_CAPTURE_BROWSER_PRODUCT: "msedge",
        AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE: "vendor/edge.exe",
      }),
      boundary.readAutoMovieHostCaptureBrowser({
        AUTOMOVIE_CAPTURE_BROWSER: "executable",
        AUTOMOVIE_CAPTURE_BROWSER_PRODUCT: "chromium",
        AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE: "/opt/chromium",
      }),
      boundary.readAutoMovieHostCaptureBrowser({
        AUTOMOVIE_CAPTURE_BROWSER: "executable",
        AUTOMOVIE_CAPTURE_BROWSER_PRODUCT: "chrome",
        AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE: "/opt/chrome",
      }),
    ],
    [
      { source: "playwright-chromium" },
      { source: "system-channel", channel: "chrome" },
      { source: "system-channel", channel: "msedge" },
      {
        source: "configured-executable",
        product: "msedge",
        executablePath: "vendor/edge.exe",
      },
      {
        source: "configured-executable",
        product: "chromium",
        executablePath: "/opt/chromium",
      },
      {
        source: "configured-executable",
        product: "chrome",
        executablePath: "/opt/chrome",
      },
    ],
  );

  TestValidator.equals(
    "an unusable host selection is refused by name instead of falling back",
    namedFacts([
      [
        "unknownBrowserNamesTheAcceptedSet",
        () =>
          throwsError(
            () =>
              boundary.readAutoMovieHostCaptureBrowser({
                AUTOMOVIE_CAPTURE_BROWSER: "firefox",
              }),
            [
              'AUTOMOVIE_CAPTURE_BROWSER="firefox"',
              "playwright-chromium, chrome, msedge, executable",
            ],
          ),
      ],
      [
        "executableWithoutProduct",
        () =>
          throwsError(
            () =>
              boundary.readAutoMovieHostCaptureBrowser({
                AUTOMOVIE_CAPTURE_BROWSER: "executable",
                AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE: "/opt/chromium",
              }),
            ["AUTOMOVIE_CAPTURE_BROWSER_PRODUCT", "chromium, chrome, msedge"],
          ),
      ],
      [
        "executableWithUnknownProduct",
        () =>
          throwsError(
            () =>
              boundary.readAutoMovieHostCaptureBrowser({
                AUTOMOVIE_CAPTURE_BROWSER: "executable",
                AUTOMOVIE_CAPTURE_BROWSER_PRODUCT: "safari",
                AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE: "/opt/safari",
              }),
            "AUTOMOVIE_CAPTURE_BROWSER_PRODUCT",
          ),
      ],
      [
        "executableWithoutPath",
        () =>
          throwsError(
            () =>
              boundary.readAutoMovieHostCaptureBrowser({
                AUTOMOVIE_CAPTURE_BROWSER: "executable",
                AUTOMOVIE_CAPTURE_BROWSER_PRODUCT: "chrome",
              }),
            "AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE",
          ),
      ],
      [
        "executableWithBlankPath",
        () =>
          throwsError(
            () =>
              boundary.readAutoMovieHostCaptureBrowser({
                AUTOMOVIE_CAPTURE_BROWSER: "executable",
                AUTOMOVIE_CAPTURE_BROWSER_PRODUCT: "chrome",
                AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE: "   ",
              }),
            "non-blank",
          ),
      ],
      [
        "untrimmedViewerHost",
        () =>
          throwsError(
            () =>
              boundary.readAutoMovieHostViewerHost({
                AUTOMOVIE_VIEWER_HOST: " 127.0.0.1",
              }),
            "is not a trimmed host",
          ),
      ],
      [
        "relativeBasePath",
        () =>
          throwsError(
            () =>
              boundary.readAutoMovieHostViewerBasePath({
                AUTOMOVIE_VIEWER_BASE_PATH: "viewer/",
              }),
            "is not a server-absolute path",
          ),
      ],
    ]),
    {
      unknownBrowserNamesTheAcceptedSet: true,
      executableWithoutProduct: true,
      executableWithUnknownProduct: true,
      executableWithoutPath: true,
      executableWithBlankPath: true,
      untrimmedViewerHost: true,
      relativeBasePath: true,
    },
  );

  TestValidator.equals(
    "an explicit host selection is taken verbatim and a base path is normalized to a directory",
    [
      boundary.readAutoMovieHostViewerHost({
        AUTOMOVIE_VIEWER_HOST: "0.0.0.0",
      }),
      boundary.readAutoMovieHostViewerBasePath({
        AUTOMOVIE_VIEWER_BASE_PATH: "/studio/viewer/",
      }),
      boundary.readAutoMovieHostViewerBasePath({
        AUTOMOVIE_VIEWER_BASE_PATH: "/studio/viewer",
      }),
    ],
    ["0.0.0.0", "/studio/viewer/", "/studio/viewer/"],
  );
};
