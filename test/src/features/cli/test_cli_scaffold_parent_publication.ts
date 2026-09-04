import {
  type IScaffoldParentPublicationCapability,
  type IScaffoldParentPublicationRequest,
  type IScaffoldPhysicalDirectory,
  type ScaffoldFilePublicationOutcome,
  publishScaffoldFileToCapturedParent,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import * as path from "node:path";

type FakeSchedule =
  | "complete"
  | "create-failed"
  | "parent-changed"
  | "target-competitor"
  | { bytesWritten: number; kind: "partial" };

interface IFakePublishedFile {
  bytes: readonly number[];
  identity: string;
}

class FakeParentPublicationCapability implements IScaffoldParentPublicationCapability {
  public cleanupCount = 0;
  public createCount = 0;
  public request: IScaffoldParentPublicationRequest | undefined;
  public writeCount = 0;
  private readonly files = new Map<string, Map<string, IFakePublishedFile>>();

  public constructor(private readonly schedule: FakeSchedule) {}

  public inventory(parentIdentity: string): [string, IFakePublishedFile][] {
    return [...(this.files.get(parentIdentity)?.entries() ?? [])];
  }

  public publish(
    request: IScaffoldParentPublicationRequest,
  ): ScaffoldFilePublicationOutcome {
    this.request = request;
    if (this.schedule === "parent-changed")
      return {
        error: "parent changed before create",
        reason: "parent-changed",
        status: "refused",
      };
    if (this.schedule === "target-competitor")
      return {
        error: "target competitor",
        reason: "target-competitor",
        status: "refused",
      };
    if (this.schedule === "create-failed")
      return {
        error: "native create failed",
        reason: "create-failed",
        status: "refused",
      };

    const parent = this.files.get(request.expectedParentIdentity) ?? new Map();
    this.files.set(request.expectedParentIdentity, parent);
    this.createCount++;
    const file: IFakePublishedFile = {
      bytes: [],
      identity: `slot-${this.createCount}`,
    };
    parent.set(request.childName, file);
    this.writeCount++;
    if (this.schedule === "complete") {
      file.bytes = [...request.bytes];
      return {
        parentIdentity: request.expectedParentIdentity,
        status: "completed",
      };
    }
    file.bytes = request.bytes.slice(0, this.schedule.bytesWritten);
    return {
      bytesWritten: this.schedule.bytesWritten,
      error: "write stopped",
      parentIdentity: request.expectedParentIdentity,
      status: "partial",
    };
  }

  public seed(
    parentIdentity: string,
    childName: string,
    file: IFakePublishedFile,
  ): void {
    const parent = this.files.get(parentIdentity) ?? new Map();
    this.files.set(parentIdentity, parent);
    parent.set(childName, file);
  }
}

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
  const externalIdentity = "volume:parent-2";
  const attempt = (
    capability: IScaffoldParentPublicationCapability,
  ): ScaffoldFilePublicationOutcome =>
    publishScaffoldFileToCapturedParent({
      bytes: [0, 127, 255],
      capability,
      parent,
      target,
    });

  const completeCapability = new FakeParentPublicationCapability("complete");
  const complete = attempt(completeCapability);
  TestValidator.equals(
    "complete publication enters one closed native parent capability",
    {
      frozen:
        Object.isFrozen(completeCapability.request) &&
        Object.isFrozen(completeCapability.request?.bytes) &&
        Object.isFrozen(complete),
      inventory: completeCapability.inventory(parent.identity),
      request: completeCapability.request,
      result: complete,
      sideEffects: {
        cleanup: completeCapability.cleanupCount,
        create: completeCapability.createCount,
        write: completeCapability.writeCount,
      },
    },
    {
      frozen: true,
      inventory: [["entry.txt", { bytes: [0, 127, 255], identity: "slot-1" }]],
      request: {
        bytes: [0, 127, 255],
        childName: "entry.txt",
        expectedParentIdentity: parent.identity,
        parentPath: parent.path,
      },
      result: { parentIdentity: parent.identity, status: "completed" },
      sideEffects: { cleanup: 0, create: 1, write: 1 },
    },
  );

  const parentChanged = new FakeParentPublicationCapability("parent-changed");
  const createFailed = new FakeParentPublicationCapability("create-failed");
  const competitor = new FakeParentPublicationCapability("target-competitor");
  competitor.seed(parent.identity, "entry.txt", {
    bytes: [9, 9],
    identity: "competitor-1",
  });
  const refused = [parentChanged, createFailed, competitor].map(
    (capability) => ({ capability, outcome: attempt(capability) }),
  );
  TestValidator.equals(
    "pre-create native decisions remain zero-publication refusals",
    refused.map(({ capability, outcome }) => ({
      external: capability.inventory(externalIdentity),
      owned: capability.inventory(parent.identity),
      reason: outcome.status === "refused" ? outcome.reason : "not-refused",
      sideEffects: {
        cleanup: capability.cleanupCount,
        create: capability.createCount,
        write: capability.writeCount,
      },
    })),
    [
      {
        external: [],
        owned: [],
        reason: "parent-changed",
        sideEffects: { cleanup: 0, create: 0, write: 0 },
      },
      {
        external: [],
        owned: [],
        reason: "create-failed",
        sideEffects: { cleanup: 0, create: 0, write: 0 },
      },
      {
        external: [],
        owned: [["entry.txt", { bytes: [9, 9], identity: "competitor-1" }]],
        reason: "target-competitor",
        sideEffects: { cleanup: 0, create: 0, write: 0 },
      },
    ],
  );

  const partialCapability = new FakeParentPublicationCapability({
    bytesWritten: 2,
    kind: "partial",
  });
  const partial = attempt(partialCapability);
  TestValidator.equals(
    "descriptor-bound partial state retains its physical owner",
    {
      external: partialCapability.inventory(externalIdentity),
      owned: partialCapability.inventory(parent.identity),
      result: partial,
      sideEffects: {
        cleanup: partialCapability.cleanupCount,
        create: partialCapability.createCount,
        write: partialCapability.writeCount,
      },
    },
    {
      external: [],
      owned: [["entry.txt", { bytes: [0, 127], identity: "slot-1" }]],
      result: {
        bytesWritten: 2,
        error: "write stopped",
        parentIdentity: parent.identity,
        status: "partial",
      },
      sideEffects: { cleanup: 0, create: 1, write: 1 },
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
