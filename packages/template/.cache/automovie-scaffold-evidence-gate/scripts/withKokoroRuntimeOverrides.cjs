class KokoroRuntimeOverrideError extends AggregateError {}

/**
 * Install temporary Kokoro runtime overrides and restore every attempted one.
 *
 * @template Output
 * @param {readonly {
 *   resource: string;
 *   install: () => unknown;
 *   restore: () => unknown;
 * }[]} overrides
 * @param {() => Output | Promise<Output>} operation
 * @returns {Promise<Output>}
 */
const withKokoroRuntimeOverrides = async (overrides, operation) => {
  const attempted = [];
  let failure;
  try {
    for (const override of overrides) {
      attempted.push(override);
      override.install();
    }
    return await operation();
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    const restorationFailures = [];
    for (const override of attempted)
      try {
        override.restore();
      } catch (error) {
        restorationFailures.push({ error, resource: override.resource });
      }
    if (restorationFailures.length === 1 && failure === undefined)
      throw restorationFailures[0].error;
    if (restorationFailures.length !== 0)
      throw new KokoroRuntimeOverrideError(
        [
          ...(failure === undefined ? [] : [failure.error]),
          ...restorationFailures.map((entry) => entry.error),
        ],
        `Kokoro runtime override restoration failed${
          failure === undefined ? "" : " after setup or loading failed"
        }: ${restorationFailures.map((entry) => entry.resource).join(", ")}.`,
      );
  }
};

module.exports = { withKokoroRuntimeOverrides };
