/**
 * Run one fallible direct-script cleanup without replacing an earlier failure.
 *
 * @param {{ error: unknown } | undefined} failure
 * @param {string} resource
 * @param {() => unknown} cleanup
 * @returns {Promise<void>}
 */
export const preserveCleanupFailure = async (failure, resource, cleanup) => {
  try {
    await cleanup();
  } catch (cleanupError) {
    if (failure === undefined) throw cleanupError;
    throw new AggregateError(
      [failure.error, cleanupError],
      `${resource} cleanup failed after the operation failed.`,
    );
  }
};

/**
 * Run one direct-script operation with complete browser and page ownership.
 *
 * @template T
 * @param {() => Promise<import("playwright-core").Browser>} launchBrowser
 * @param {Parameters<import("playwright-core").Browser["newPage"]>[0]} pageOptions
 * @param {string} resource
 * @param {(page: import("playwright-core").Page) => Promise<T>} operation
 * @returns {Promise<T>}
 */
export const withBrowserPage = async (
  launchBrowser,
  pageOptions,
  resource,
  operation,
) => {
  const browser = await launchBrowser();
  let browserFailure;
  try {
    const page = await browser.newPage(pageOptions);
    let pageFailure;
    try {
      return await operation(page);
    } catch (error) {
      pageFailure = { error };
      throw error;
    } finally {
      await preserveCleanupFailure(pageFailure, `${resource} page`, () =>
        page.close(),
      );
    }
  } catch (error) {
    browserFailure = { error };
    throw error;
  } finally {
    await preserveCleanupFailure(browserFailure, `${resource} browser`, () =>
      browser.close(),
    );
  }
};
