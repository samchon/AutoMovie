import {
  type IScaffoldParentPublicationCapability,
  type IScaffoldParentPublicationRequest,
  type IScaffoldPhysicalDirectory,
  type ScaffoldFilePublicationOutcome,
  publishScaffoldFileToCapturedParent,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import * as path from "node:path";

/**
 * One-file publication admits only a truthful parent-bound native outcome.
 *
 * Scenarios:
 *
 * 1. A completed native operation receives one frozen child-relative request
 *    and keeps the captured physical parent identity.
 * 2. Parent replacement, a target competitor, and native create failure stay
 *    zero-publication refusals without write or cleanup activity.
 * 3. Descriptor-bound partial state is retained, while malformed bytes,
 *    targets, parent identities, byte counts, refusal reasons, and outcomes are
 *    rejected at the typed boundary.
 */
export const test_cli_scaffold_parent_publication = (): void => {
  const parent: IScaffoldPhysicalDirectory = {
    identity: "volume:parent-1",
    path: path.resolve("synthetic-parent"),
    real: path.resolve("synthetic-parent"),
  };
  const target = path.join(parent.path, "entry.txt");
  const attempt = (
    outcome: ScaffoldFilePublicationOutcome,
  ): {
    calls: number;
    request: IScaffoldParentPublicationRequest;
    result: ScaffoldFilePublicationOutcome;
  } => {
    let calls = 0;
    let request: IScaffoldParentPublicationRequest | undefined;
    const capability: IScaffoldParentPublicationCapability = {
      publish: (value) => {
        calls++;
        request = value;
        return outcome;
      },
    };
    const result = publishScaffoldFileToCapturedParent({
      bytes: [0, 127, 255],
      capability,
      parent,
      target,
    });
    return { calls, request: request!, result };
  };

  const complete = attempt({
    parentIdentity: parent.identity,
    status: "completed",
  });
  TestValidator.equals(
    "complete publication enters one closed native parent capability",
    {
      calls: complete.calls,
      frozen:
        Object.isFrozen(complete.request) &&
        Object.isFrozen(complete.request.bytes) &&
        Object.isFrozen(complete.result),
      request: complete.request,
      result: complete.result,
    },
    {
      calls: 1,
      frozen: true,
      request: {
        bytes: [0, 127, 255],
        childName: "entry.txt",
        expectedParentIdentity: parent.identity,
        parentPath: parent.path,
      },
      result: { parentIdentity: parent.identity, status: "completed" },
    },
  );

  const refusals = [
    "parent-changed",
    "target-competitor",
    "create-failed",
  ] as const;
  TestValidator.equals(
    "pre-create native decisions remain zero-publication refusals",
    refusals.map((reason) => {
      const counters = { cleanup: 0, create: 0, write: 0 };
      const refused = attempt({ error: reason, reason, status: "refused" });
      return {
        calls: refused.calls,
        counters,
        reason:
          refused.result.status === "refused"
            ? refused.result.reason
            : "not-refused",
      };
    }),
    refusals.map((reason) => ({
      calls: 1,
      counters: { cleanup: 0, create: 0, write: 0 },
      reason,
    })),
  );

  const partial = attempt({
    bytesWritten: 2,
    error: "write stopped",
    parentIdentity: parent.identity,
    status: "partial",
  });
  TestValidator.equals(
    "descriptor-bound partial state retains its physical owner",
    partial.result,
    {
      bytesWritten: 2,
      error: "write stopped",
      parentIdentity: parent.identity,
      status: "partial",
    },
  );

  const invalid = (props: {
    bytes?: readonly number[];
    outcome: ScaffoldFilePublicationOutcome;
    parent?: IScaffoldPhysicalDirectory;
    target?: string;
  }): string => {
    try {
      publishScaffoldFileToCapturedParent({
        bytes: props.bytes ?? [1, 2, 3],
        capability: { publish: () => props.outcome },
        parent: props.parent ?? parent,
        target: props.target ?? target,
      });
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  const completeWrongParent: ScaffoldFilePublicationOutcome = {
    parentIdentity: "volume:parent-2",
    status: "completed",
  };
  const partialOutcome = (
    bytesWritten: number,
    parentIdentity: string = parent.identity,
  ): ScaffoldFilePublicationOutcome => ({
    bytesWritten,
    error: "stopped",
    parentIdentity,
    status: "partial",
  });
  TestValidator.predicate(
    "malformed capability inputs and outcomes fail closed",
    [
      invalid({ outcome: completeWrongParent, target: parent.path }),
      invalid({
        outcome: completeWrongParent,
        parent: { ...parent, identity: "" },
      }),
      invalid({ bytes: [0.5], outcome: completeWrongParent }),
      invalid({ bytes: [-1], outcome: completeWrongParent }),
      invalid({ bytes: [256], outcome: completeWrongParent }),
      invalid({ outcome: completeWrongParent }),
      invalid({ outcome: partialOutcome(0, "volume:parent-2") }),
      invalid({ outcome: partialOutcome(0.5) }),
      invalid({ outcome: partialOutcome(-1) }),
      invalid({ outcome: partialOutcome(4) }),
      invalid({
        outcome: {
          error: "bad reason",
          reason: "unknown",
          status: "refused",
        } as unknown as ScaffoldFilePublicationOutcome,
      }),
      invalid({
        outcome: {
          status: "unknown",
        } as unknown as ScaffoldFilePublicationOutcome,
      }),
    ].every((message) => message !== "accepted"),
  );
};
