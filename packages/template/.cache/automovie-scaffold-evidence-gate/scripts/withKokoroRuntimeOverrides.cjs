class KokoroRuntimeOverrideError extends AggregateError {}

// Generated projects load different physical copies of this module into one
// process during concurrency verification. The named slot coordinates only a
// FIFO permit; it never stores production dialogue, paths, or runtime assets.
const COORDINATION_KEY = Symbol.for(
  "automovie.kokoro-runtime-override-coordination.v1",
);
const coordination = globalThis[COORDINATION_KEY] ?? {
  tail: Promise.resolve(),
};
globalThis[COORDINATION_KEY] = coordination;

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
  let release;
  const predecessor = coordination.tail;
  coordination.tail = new Promise((resolve) => {
    release = resolve;
  });
  await predecessor;
  try {
    return await withExclusiveKokoroRuntimeOverrides(overrides, operation);
  } finally {
    release();
  }
};

/**
 * @template Output
 * @param {readonly {
 *   resource: string;
 *   install: () => unknown;
 *   restore: () => unknown;
 * }[]} overrides
 * @param {() => Output | Promise<Output>} operation
 * @returns {Promise<Output>}
 */
const withExclusiveKokoroRuntimeOverrides = async (overrides, operation) => {
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
        failure === undefined ? undefined : { cause: failure.error },
      );
  }
};

module.exports = { withKokoroRuntimeOverrides };
