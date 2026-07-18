const PLATFORM_CHROME_EXECUTABLE: Partial<Record<NodeJS.Platform, string>> = {
  win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "google-chrome",
};

/** Chrome executable selected for a production capture script. */
export const DEFAULT_CHROME_EXECUTABLE: string =
  process.env.CHROME ??
  PLATFORM_CHROME_EXECUTABLE[process.platform] ??
  "google-chrome";
