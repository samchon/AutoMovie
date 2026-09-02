/**
 * Host boundary of one generated project.
 *
 * Nothing here changes a delivered frame, a sound, or the meaning of a review.
 * A browser to drive, an interface to bind a local server to, and the path that
 * server publishes the viewer at are facts about the machine the scripts happen
 * to run on, so they carry a shipped default and are overridden by an explicit
 * input on the invoking command rather than by an authored project value.
 *
 * The input channel is the process environment because the same decisions have
 * to reach `vite.config.ts`, which is started by Vite and never sees this
 * project's own argument vector. Every accepted value is enumerated, and an
 * unrecognized one is refused by name instead of falling back to the default:
 * a host that asked for a specific browser and silently got another one would
 * be capturing through an instrument nobody selected.
 */

/**
 * One resolved browser selection, shared without importing the executable
 * capture host.
 */
export type AutoMovieCaptureBrowserConfig =
  | { source: "playwright-chromium" }
  | { source: "system-channel"; channel: "chrome" | "msedge" }
  | {
      source: "configured-executable";
      product: "chromium" | "chrome" | "msedge";
      executablePath: string;
    };

/** Browser the harness drives when the host selects none. */
export const AUTOMOVIE_DEFAULT_CAPTURE_BROWSER: AutoMovieCaptureBrowserConfig =
  { source: "playwright-chromium" };

/** Loopback interface the local viewer server binds when the host selects none. */
export const AUTOMOVIE_DEFAULT_VIEWER_HOST = "127.0.0.1";

/** Path the local viewer server publishes the viewer document at. */
export const AUTOMOVIE_DEFAULT_VIEWER_BASE_PATH = "/viewer/";

/** Environment variable selecting the capture browser. */
const AUTOMOVIE_CAPTURE_BROWSER_VARIABLE = "AUTOMOVIE_CAPTURE_BROWSER";

/** Environment variable naming the configured browser executable. */
const AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE_VARIABLE =
  "AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE";

/** Environment variable naming the configured executable's product. */
const AUTOMOVIE_CAPTURE_BROWSER_PRODUCT_VARIABLE =
  "AUTOMOVIE_CAPTURE_BROWSER_PRODUCT";

/** Environment variable selecting the local viewer-server interface. */
const AUTOMOVIE_VIEWER_HOST_VARIABLE = "AUTOMOVIE_VIEWER_HOST";

/** Environment variable selecting the local viewer-server base path. */
const AUTOMOVIE_VIEWER_BASE_PATH_VARIABLE = "AUTOMOVIE_VIEWER_BASE_PATH";

const CAPTURE_BROWSER_SELECTIONS = [
  "playwright-chromium",
  "chrome",
  "msedge",
  "executable",
] as const;

const CAPTURE_BROWSER_PRODUCTS = ["chromium", "chrome", "msedge"] as const;

/** Read one explicit host browser selection, or the shipped default. */
export const readAutoMovieHostCaptureBrowser = (
  environment: Readonly<Record<string, string | undefined>>,
): AutoMovieCaptureBrowserConfig => {
  const selected = environment[AUTOMOVIE_CAPTURE_BROWSER_VARIABLE];
  if (selected === undefined || selected === "")
    return AUTOMOVIE_DEFAULT_CAPTURE_BROWSER;
  if (selected === "playwright-chromium") return { source: selected };
  if (selected === "chrome" || selected === "msedge")
    return { source: "system-channel", channel: selected };
  if (selected !== "executable")
    throw new Error(
      `${AUTOMOVIE_CAPTURE_BROWSER_VARIABLE}="${selected}" is not a capture browser. Choose one of ${CAPTURE_BROWSER_SELECTIONS.join(", ")}.`,
    );
  const product = environment[AUTOMOVIE_CAPTURE_BROWSER_PRODUCT_VARIABLE];
  if (product !== "chromium" && product !== "chrome" && product !== "msedge")
    throw new Error(
      `${AUTOMOVIE_CAPTURE_BROWSER_VARIABLE}="executable" also requires ${AUTOMOVIE_CAPTURE_BROWSER_PRODUCT_VARIABLE} set to one of ${CAPTURE_BROWSER_PRODUCTS.join(", ")}.`,
    );
  const executablePath =
    environment[AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE_VARIABLE];
  if (executablePath === undefined || executablePath.trim().length === 0)
    throw new Error(
      `${AUTOMOVIE_CAPTURE_BROWSER_VARIABLE}="executable" also requires ${AUTOMOVIE_CAPTURE_BROWSER_EXECUTABLE_VARIABLE} set to a non-blank project-relative or absolute path.`,
    );
  return { source: "configured-executable", product, executablePath };
};

/** Read one explicit host viewer interface, or the shipped loopback default. */
export const readAutoMovieHostViewerHost = (
  environment: Readonly<Record<string, string | undefined>>,
): string => {
  const selected = environment[AUTOMOVIE_VIEWER_HOST_VARIABLE];
  if (selected === undefined || selected === "")
    return AUTOMOVIE_DEFAULT_VIEWER_HOST;
  if (selected.trim() !== selected)
    throw new Error(
      `${AUTOMOVIE_VIEWER_HOST_VARIABLE}="${selected}" is not a trimmed host. Remove the surrounding whitespace.`,
    );
  return selected;
};

/**
 * Read one explicit host viewer base path, or the shipped default.
 *
 * The value is normalized to a directory path so every consumer can join a
 * document name onto it without deciding again whether a separator is missing.
 */
export const readAutoMovieHostViewerBasePath = (
  environment: Readonly<Record<string, string | undefined>>,
): string => {
  const selected = environment[AUTOMOVIE_VIEWER_BASE_PATH_VARIABLE];
  if (selected === undefined || selected === "")
    return AUTOMOVIE_DEFAULT_VIEWER_BASE_PATH;
  if (selected.startsWith("/") === false)
    throw new Error(
      `${AUTOMOVIE_VIEWER_BASE_PATH_VARIABLE}="${selected}" is not a server-absolute path. Start it with "/".`,
    );
  return selected.endsWith("/") ? selected : `${selected}/`;
};
