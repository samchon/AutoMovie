import { run } from "automovie";

export interface ICliOutputCaptureResult {
  status: number;
  stderr: string;
  stdout: string;
}

interface ICliOutputCaptureFailure {
  error: unknown;
}

interface ICliOutputCaptureCleanup {
  cleanup: () => unknown;
  resource: string;
}

class CliOutputCaptureCleanupError extends AggregateError {}

/** Attempt every installed output restoration without replacing CLI failure. */
export const preserveCliOutputCaptureCleanup = (
  failure: ICliOutputCaptureFailure | undefined,
  resources: readonly ICliOutputCaptureCleanup[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 1 && failure === undefined)
    throw cleanupFailures[0]!.error;
  if (cleanupFailures.length !== 0)
    throw new CliOutputCaptureCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `CLI output restoration failed${
        failure === undefined ? "" : " after the CLI failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

/** Capture one in-process CLI call while owning both installed stream hooks. */
export const captureCliOutput = (
  args: readonly string[],
): ICliOutputCaptureResult => {
  const nativeStdout = process.stdout.write;
  const nativeStderr = process.stderr.write;
  let stdout = "";
  let stderr = "";
  let stdoutCaptureInstalled = false;
  let stderrCaptureInstalled = false;
  let captureFailure: ICliOutputCaptureFailure | undefined;
  try {
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      stdout +=
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    }) as typeof process.stdout.write;
    stdoutCaptureInstalled = true;
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      stderr +=
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    }) as typeof process.stderr.write;
    stderrCaptureInstalled = true;
    return {
      status: run(["node", "automovie", ...args]),
      stdout,
      stderr,
    };
  } catch (error) {
    captureFailure = { error };
    throw error;
  } finally {
    const completedStdoutCapture = stdoutCaptureInstalled;
    const completedStderrCapture = stderrCaptureInstalled;
    preserveCliOutputCaptureCleanup(captureFailure, [
      ...(completedStdoutCapture
        ? [
            {
              resource: "standard output",
              cleanup: (): void => {
                process.stdout.write = nativeStdout;
              },
            },
          ]
        : []),
      ...(completedStderrCapture
        ? [
            {
              resource: "standard error",
              cleanup: (): void => {
                process.stderr.write = nativeStderr;
              },
            },
          ]
        : []),
    ]);
  }
};
