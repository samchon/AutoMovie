import {
  AUTOMOVIE_RENDER_METRICS,
  autoMovieSemanticMaskVerificationFailure,
  digestAutoMovieSemanticMask,
  evaluateAutoMovieRenderBudget,
  renderAutoMovieSemanticMaskSidecar,
  verifyAutoMovieSemanticMask,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieRenderInventory,
  IAutoMovieRenderTarget,
  IAutoMovieSemanticMask,
  IAutoMovieSemanticMaskEntry,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

import { throwsError } from "../internal/predicates";

/**
 * A semantic-mask digest seals every field needed to interpret its pixels.
 *
 * Scenarios:
 *
 * 1. An independently encoded full v2 payload produces the same SHA-256 digest
 *    and canonical sidecar bytes as the engine.
 * 2. Reordering entries, node joins, and palette gaps changes neither digest nor
 *    sidecar bytes.
 * 3. Changing only label, owner, nodes, slot, or each gap field changes digest.
 * 4. Null, empty, zero, singleton, and multiple-node values remain distinct and
 *    deterministic.
 * 5. A changed payload carrying its old digest is refused by both the verifier
 *    and serializer.
 * 6. Historical v1 and unknown version/protocol pairs are refused rather than
 *    reinterpreted as current evidence.
 * 7. Unknown and missing fields at every v2 record boundary are refused even
 *    when the malformed projection carries its own recomputed digest.
 * 8. Non-object masks, absent discriminators, and wrong collection/member
 *    shapes are typed as invalid before digest comparison.
 * 9. Two otherwise identical render reports inherit different mask and report
 *    identities when only the sealed semantic payload changes.
 */
export const test_render_semantic_mask_digest = (): void => {
  const mask = seal(basePayload());
  const expectedPayload = {
    version: 2,
    protocol: "automovie.semantic-mask.v2",
    background: "#000000",
    entries: [
      {
        id: "instance-slot:windows#0",
        kind: "instance-slot",
        label: "window",
        color: "#010203",
        owner: "instance-set:windows",
        nodes: ["window-a", "window-b"],
        slot: { instanceSet: "windows", index: 0 },
      },
      {
        id: "node:root",
        kind: "node",
        label: null,
        color: "#ABCDEF",
        owner: null,
        nodes: [],
        slot: null,
      },
    ],
    unaddressed: [
      {
        instanceSet: "curtains",
        slots: 2,
        reason: "palette bound",
        remedy: "split the set",
      },
      {
        instanceSet: "trees",
        slots: 1,
        reason: "palette bound",
        remedy: "read runtime identity",
      },
    ],
  };
  const expectedDigest = `sha256:${createHash("sha256")
    .update(JSON.stringify(expectedPayload), "utf8")
    .digest("hex")}` as AutoMovieContentDigest;
  TestValidator.equals(
    "the explicit full payload is the digest preimage and sidecar body",
    {
      digest: mask.digest,
      verified: verifyAutoMovieSemanticMask(mask),
      sidecar: renderAutoMovieSemanticMaskSidecar(mask),
    },
    {
      digest: expectedDigest,
      verified: undefined,
      sidecar: `${JSON.stringify(
        { ...expectedPayload, digest: expectedDigest },
        null,
        2,
      )}\n`,
    },
  );

  const reordered = seal({
    ...basePayload(),
    entries: [...basePayload().entries]
      .reverse()
      .map((entry) => ({ ...entry, nodes: [...entry.nodes].reverse() })),
    unaddressed: [...basePayload().unaddressed].reverse(),
  });
  TestValidator.equals(
    "collection order is absent from canonical mask identity",
    {
      digest: reordered.digest,
      sidecar: renderAutoMovieSemanticMaskSidecar(reordered),
    },
    {
      digest: mask.digest,
      sidecar: renderAutoMovieSemanticMaskSidecar(mask),
    },
  );

  const entry = mask.entries.find(
    (candidate) => candidate.id === "instance-slot:windows#0",
  )!;
  const changed = {
    label: editEntry(mask, { label: "clerestory" }).digest,
    owner: editEntry(mask, { owner: "space:hall" }).digest,
    nodesAdded: editEntry(mask, {
      nodes: [...entry.nodes, "window-c"],
    }).digest,
    nodesRemoved: editEntry(mask, { nodes: [entry.nodes[0]!] }).digest,
    slotSet: editEntry(mask, {
      slot: { instanceSet: "clerestory", index: 0 },
    }).digest,
    slotIndex: editEntry(mask, {
      slot: { instanceSet: "windows", index: 1 },
    }).digest,
    slotNull: editEntry(mask, { slot: null }).digest,
    gapSet: editGap(mask, { instanceSet: "drapes" }).digest,
    gapSlots: editGap(mask, { slots: 3 }).digest,
    gapReason: editGap(mask, { reason: "another bound" }).digest,
    gapRemedy: editGap(mask, { remedy: "use another mask" }).digest,
    gapsEmpty: seal({ ...payload(mask), unaddressed: [] }).digest,
  };
  TestValidator.equals(
    "every semantic axis has a digest-moving negative twin",
    Object.fromEntries(
      Object.entries(changed).map(([name, digest]) => [
        name,
        digest !== mask.digest,
      ]),
    ),
    Object.fromEntries(Object.keys(changed).map((name) => [name, true])),
  );

  const tampered = {
    ...mask,
    entries: [
      { ...mask.entries[0]!, owner: "space:foreign" },
      ...mask.entries.slice(1),
    ],
  };
  TestValidator.equals(
    "an old self digest cannot authorize changed semantic bytes",
    {
      verify: throwsError(
        () => verifyAutoMovieSemanticMask(tampered),
        "digest mismatch",
      ),
      serialize: throwsError(
        () => renderAutoMovieSemanticMaskSidecar(tampered),
        "digest mismatch",
      ),
    },
    { verify: true, serialize: true },
  );

  const historical = {
    ...mask,
    version: 1,
    protocol: "automovie.semantic-mask.v1",
  } as unknown as IAutoMovieSemanticMask;
  const unknown = {
    ...mask,
    protocol: "automovie.semantic-mask.v99",
  } as unknown as IAutoMovieSemanticMask;
  TestValidator.equals(
    "historical and unknown protocols remain non-current",
    {
      historical: throwsError(
        () => verifyAutoMovieSemanticMask(historical),
        ["unsupported", "1/automovie.semantic-mask.v1"],
      ),
      unknown: throwsError(
        () => verifyAutoMovieSemanticMask(unknown),
        ["unsupported", "automovie.semantic-mask.v99"],
      ),
    },
    { historical: true, unknown: true },
  );

  const malformed = malformedCurrentMasks(mask);
  TestValidator.equals(
    "a self-consistent digest cannot authorize an inexact current schema",
    Object.fromEntries(
      malformed.map(([name, candidate, boundary]) => [
        name,
        {
          reason: verificationFailure(candidate),
          boundary: throwsError(
            () => verifyAutoMovieSemanticMask(candidate),
            boundary,
          ),
        },
      ]),
    ),
    Object.fromEntries(
      malformed.map(([name]) => [
        name,
        { reason: "invalid" as const, boundary: true },
      ]),
    ),
  );
  const malformedShapes = malformedShapeMasks(mask);
  TestValidator.equals(
    "wrong current-schema shapes fail at their exact structural boundary",
    Object.fromEntries(
      malformedShapes.map(([name, candidate, boundary]) => [
        name,
        {
          reason: verificationFailure(candidate),
          boundary: throwsError(
            () => verifyAutoMovieSemanticMask(candidate),
            boundary,
          ),
        },
      ]),
    ),
    Object.fromEntries(
      malformedShapes.map(([name]) => [
        name,
        { reason: "invalid" as const, boundary: true },
      ]),
    ),
  );

  const reports = [mask, editEntry(mask, { owner: "space:hall" })].map(
    (candidate) => report(candidate),
  );
  TestValidator.equals(
    "render report identity inherits the complete semantic payload",
    {
      maskFieldsDiffer: reports[0]!.mask !== reports[1]!.mask,
      reportsDiffer: reports[0]!.digest !== reports[1]!.digest,
    },
    { maskFieldsDiffer: true, reportsDiffer: true },
  );
};

/** Current hand-built payload, deliberately declared out of input order. */
const basePayload = (): Omit<IAutoMovieSemanticMask, "digest"> =>
  ({
    version: 2,
    protocol: "automovie.semantic-mask.v2",
    background: "#000000",
    entries: [
      {
        id: "node:root",
        kind: "node",
        label: null,
        color: "#ABCDEF",
        owner: null,
        nodes: [],
        slot: null,
      },
      {
        id: "instance-slot:windows#0",
        kind: "instance-slot",
        label: "window",
        color: "#010203",
        owner: "instance-set:windows",
        nodes: ["window-b", "window-a"],
        slot: { instanceSet: "windows", index: 0 },
      },
    ],
    unaddressed: [
      {
        instanceSet: "trees",
        slots: 1,
        reason: "palette bound",
        remedy: "read runtime identity",
      },
      {
        instanceSet: "curtains",
        slots: 2,
        reason: "palette bound",
        remedy: "split the set",
      },
    ],
  }) as unknown as Omit<IAutoMovieSemanticMask, "digest">;

/** Seal one typed payload with the production digest helper. */
const seal = (
  value: Omit<IAutoMovieSemanticMask, "digest">,
): IAutoMovieSemanticMask => ({
  ...value,
  digest: digestAutoMovieSemanticMask(value),
});

/** The payload portion of a sealed mask. */
const payload = (
  mask: IAutoMovieSemanticMask,
): Omit<IAutoMovieSemanticMask, "digest"> => ({
  version: mask.version,
  protocol: mask.protocol,
  background: mask.background,
  entries: mask.entries,
  unaddressed: mask.unaddressed,
});

/** Current masks whose malformed projections each carry their own digest. */
const malformedCurrentMasks = (
  mask: IAutoMovieSemanticMask,
): ReadonlyArray<readonly [string, IAutoMovieSemanticMask, string]> => {
  const entry = mask.entries[1]!;
  const slot = entry.slot!;
  const gap = mask.unaddressed[0]!;
  return [
    [
      "unknown root field",
      sealUnchecked({ ...payload(mask), future: true }),
      "mask keys",
    ],
    [
      "missing root field",
      sealUnchecked(renameKey(payload(mask), "background", "backdrop")),
      "mask keys",
    ],
    [
      "unknown entry field",
      sealUnchecked({
        ...payload(mask),
        entries: [{ ...mask.entries[0]!, future: true }, entry],
      }),
      "entry 0 keys",
    ],
    [
      "missing entry field",
      sealUnchecked({
        ...payload(mask),
        entries: [renameKey(mask.entries[0]!, "owner", "parent"), entry],
      }),
      "entry 0 keys",
    ],
    [
      "unknown slot field",
      sealUnchecked({
        ...payload(mask),
        entries: [
          mask.entries[0]!,
          { ...entry, slot: { ...slot, future: true } },
        ],
      }),
      "entry 1 slot keys",
    ],
    [
      "missing slot field",
      sealUnchecked({
        ...payload(mask),
        entries: [
          mask.entries[0]!,
          { ...entry, slot: renameKey(slot, "index", "slot") },
        ],
      }),
      "entry 1 slot keys",
    ],
    [
      "unknown gap field",
      sealUnchecked({
        ...payload(mask),
        unaddressed: [{ ...gap, future: true }, ...mask.unaddressed.slice(1)],
      }),
      "gap 0 keys",
    ],
    [
      "missing gap field",
      sealUnchecked({
        ...payload(mask),
        unaddressed: [
          renameKey(gap, "remedy", "resolution"),
          ...mask.unaddressed.slice(1),
        ],
      }),
      "gap 0 keys",
    ],
  ];
};

/** Current-discriminator records with wrong runtime collection/member shapes. */
const malformedShapeMasks = (
  mask: IAutoMovieSemanticMask,
): ReadonlyArray<readonly [string, IAutoMovieSemanticMask, string]> => [
  ["null mask", null as unknown as IAutoMovieSemanticMask, "must be an object"],
  ["array mask", [] as unknown as IAutoMovieSemanticMask, "must be an object"],
  [
    "missing version",
    renameKey(mask, "version", "schema") as unknown as IAutoMovieSemanticMask,
    "requires explicit version and protocol",
  ],
  [
    "missing protocol",
    renameKey(mask, "protocol", "format") as unknown as IAutoMovieSemanticMask,
    "requires explicit version and protocol",
  ],
  [
    "entries are not an array",
    { ...mask, entries: {} } as unknown as IAutoMovieSemanticMask,
    "entries must be an array",
  ],
  [
    "gaps are not an array",
    { ...mask, unaddressed: {} } as unknown as IAutoMovieSemanticMask,
    "unaddressed gaps must be an array",
  ],
  [
    "entry is not an object",
    { ...mask, entries: [null] } as unknown as IAutoMovieSemanticMask,
    "entry 0 must be an object",
  ],
  [
    "entry nodes are not an array",
    {
      ...mask,
      entries: [{ ...mask.entries[0]!, nodes: {} }],
    } as unknown as IAutoMovieSemanticMask,
    "entry 0 nodes must be an array",
  ],
  [
    "slot is not an object",
    {
      ...mask,
      entries: [
        {
          ...mask.entries[1]!,
          slot: 1,
        } as unknown as IAutoMovieSemanticMaskEntry,
      ],
    },
    "entry 0 slot must be an object",
  ],
  [
    "gap is not an object",
    { ...mask, unaddressed: [null] } as unknown as IAutoMovieSemanticMask,
    "gap 0 must be an object",
  ],
];

/** Seal one intentionally malformed runtime record through canonical projection. */
const sealUnchecked = (
  value: Record<string, unknown>,
): IAutoMovieSemanticMask =>
  ({
    ...value,
    digest: digestAutoMovieSemanticMask(value as never),
  }) as unknown as IAutoMovieSemanticMask;

/** Rename one own key while preserving the record's key count. */
const renameKey = (
  value: object,
  from: string,
  to: string,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value).map(([key, member]) => [
      key === from ? to : key,
      member,
    ]),
  );

/** Return the verifier's stable typed refusal for one candidate. */
const verificationFailure = (
  mask: IAutoMovieSemanticMask,
): ReturnType<typeof autoMovieSemanticMaskVerificationFailure> => {
  try {
    verifyAutoMovieSemanticMask(mask);
    return null;
  } catch (error) {
    return autoMovieSemanticMaskVerificationFailure(error);
  }
};

/** Replace one field of the instanced-slot entry and reseal it. */
const editEntry = (
  mask: IAutoMovieSemanticMask,
  replacement: Partial<IAutoMovieSemanticMaskEntry>,
): IAutoMovieSemanticMask =>
  seal({
    ...payload(mask),
    entries: mask.entries.map((entry) =>
      entry.id === "instance-slot:windows#0"
        ? { ...entry, ...replacement }
        : entry,
    ),
  });

/** Replace one field of the first canonical bounded-palette gap and reseal it. */
const editGap = (
  mask: IAutoMovieSemanticMask,
  replacement: Partial<IAutoMovieSemanticMask["unaddressed"][number]>,
): IAutoMovieSemanticMask =>
  seal({
    ...payload(mask),
    unaddressed: [
      { ...mask.unaddressed[0]!, ...replacement },
      ...mask.unaddressed.slice(1),
    ],
  });

/** Evaluate a content-only report against one fixed zero-cost inventory. */
const report = (mask: IAutoMovieSemanticMask) =>
  evaluateAutoMovieRenderBudget({
    inventory: {
      version: 1,
      protocol: "automovie.render-inventory.v1",
      totals: Object.fromEntries(
        AUTOMOVIE_RENDER_METRICS.map((metric) => [metric, 0]),
      ),
      owners: [],
      gaps: [],
      digest: `sha256:${"1".repeat(64)}`,
    } as unknown as IAutoMovieRenderInventory,
    budget: null,
    mask,
    target: {
      digest: `sha256:${"2".repeat(64)}`,
    } as IAutoMovieRenderTarget,
  });
