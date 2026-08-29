class KokoroRuntimeOverrideError extends AggregateError {}

interface IKokoroRuntimeCoordination {
  tail: Promise<void>;
}

export interface IKokoroRuntimeOverride {
  readonly resource: string;
  readonly install: () => unknown;
  readonly restore: () => unknown;
}

// Generated projects load different physical copies of this module into one
// process during concurrency verification. The named slot coordinates only a
// FIFO permit; it never stores production dialogue, paths, or runtime assets.
const COORDINATION_KEY = Symbol.for(
  "automovie.kokoro-runtime-override-coordination.v1",
);
const storedCoordination = Reflect.get(globalThis, COORDINATION_KEY) as
  | IKokoroRuntimeCoordination
  | undefined;
const coordination: IKokoroRuntimeCoordination = storedCoordination ?? {
  tail: Promise.resolve(),
};
Reflect.set(globalThis, COORDINATION_KEY, coordination);

/** Install temporary Kokoro runtime overrides and restore every attempted one. */
export const withKokoroRuntimeOverrides = async <Output>(
  overrides: readonly IKokoroRuntimeOverride[],
  operation: () => Output | Promise<Output>,
): Promise<Output> => {
  let release: (() => void) | undefined;
  const predecessor = coordination.tail;
  coordination.tail = new Promise((resolve) => {
    release = resolve;
  });
  await predecessor;
  try {
    return await withExclusiveKokoroRuntimeOverrides(overrides, operation);
  } finally {
    release!();
  }
};

const withExclusiveKokoroRuntimeOverrides = async <Output>(
  overrides: readonly IKokoroRuntimeOverride[],
  operation: () => Output | Promise<Output>,
): Promise<Output> => {
  const attempted: IKokoroRuntimeOverride[] = [];
  let outcome:
    | { readonly success: true; readonly value: Output }
    | { readonly success: false; readonly error: unknown };
  try {
    for (const override of overrides) {
      attempted.push(override);
      override.install();
    }
    outcome = { success: true, value: await operation() };
  } catch (error) {
    outcome = { success: false, error };
  }
  const restorationFailures: Array<{
    error: unknown;
    resource: string;
  }> = [];
  for (const override of attempted)
    try {
      override.restore();
    } catch (error) {
      restorationFailures.push({ error, resource: override.resource });
    }
  if (restorationFailures.length === 1 && outcome.success)
    throw restorationFailures[0]!.error;
  if (restorationFailures.length !== 0)
    throw new KokoroRuntimeOverrideError(
      [
        ...(outcome.success ? [] : [outcome.error]),
        ...restorationFailures.map((entry) => entry.error),
      ],
      `Kokoro runtime override restoration failed${
        outcome.success ? "" : " after setup or loading failed"
      }: ${restorationFailures.map((entry) => entry.resource).join(", ")}.`,
      outcome.success ? undefined : { cause: outcome.error },
    );
  if (outcome.success === false) throw outcome.error;
  return outcome.value;
};
