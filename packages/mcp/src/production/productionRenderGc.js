/**
 * Mark current proxy/final plans and publication files, then classify garbage.
 *
 * Locks, attempts, and arbitrary paths never enter this planner. The CLI keeps
 * those operational records outside the candidate inventory so GC cannot race
 * an active worker.
 */
export const planProductionRenderGc = (props) => {
    const activeChunks = new Set(props.plans.flatMap((plan) => plan.chunks.map((chunk) => `${plan.tier.kind}\0${chunk.id.slice("sha256:".length)}`)));
    const activePublication = new Set(props.publicationPaths.map(canonicalRelativePath));
    const retainedChunkPaths = new Set();
    for (const value of props.retainedChunkPaths) {
        const path = canonicalRelativePath(value);
        if (retainedChunkPaths.has(path))
            throw new Error(`Render GC retained chunk path "${path}" is duplicate.`);
        retainedChunkPaths.add(path);
    }
    const paths = new Set();
    const chunkPublicationCandidates = new Set();
    const keep = [];
    const remove = [];
    for (const candidate of [...props.candidates].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)) {
        const path = canonicalRelativePath(candidate.path);
        const chunkPath = /^(proxy|final)\/chunks\/([0-9a-f]{64})$/u.exec(path);
        const pointerPath = /^(proxy|final)\/pointers\/([0-9a-f]{64})$/u.exec(path);
        const treePath = /^(proxy|final)\/tmp\/([0-9a-f]{64})\.[^.]+\.\d+$/u.exec(path);
        const ownedDigest = candidate.kind === "chunk"
            ? chunkPath?.[2]
            : candidate.kind === "chunk-pointer"
                ? pointerPath?.[2]
                : candidate.kind === "chunk-tree"
                    ? treePath?.[2]
                    : undefined;
        if (paths.has(path) ||
            Number.isSafeInteger(candidate.bytes) === false ||
            candidate.bytes < 0 ||
            ((candidate.kind === "chunk" ||
                candidate.kind === "chunk-pointer" ||
                candidate.kind === "chunk-tree") &&
                (candidate.digest === null ||
                    /^sha256:[0-9a-f]{64}$/.test(candidate.digest) === false ||
                    ownedDigest === undefined ||
                    candidate.digest !== `sha256:${ownedDigest}`)) ||
            (candidate.kind === "quarantine" &&
                /^(?:proxy|final)\/quarantine\/[^/]+$/u.test(path) === false) ||
            (candidate.kind === "publication" &&
                path.startsWith("publication/") === false) ||
            (candidate.kind !== "chunk" &&
                candidate.kind !== "chunk-pointer" &&
                candidate.kind !== "chunk-tree" &&
                candidate.digest !== null))
            throw new Error(`Render GC candidate "${candidate.path}" has duplicate or invalid ownership facts.`);
        paths.add(path);
        if (candidate.kind === "chunk-pointer" || candidate.kind === "chunk-tree")
            chunkPublicationCandidates.add(path);
        const normalized = { ...candidate, path };
        if ((candidate.kind === "chunk" &&
            chunkPath !== null &&
            activeChunks.has(`${chunkPath[1]}\0${chunkPath[2]}`)) ||
            ((candidate.kind === "chunk-pointer" ||
                candidate.kind === "chunk-tree") &&
                retainedChunkPaths.has(path)) ||
            (candidate.kind === "publication" && activePublication.has(path)))
            keep.push(normalized);
        else
            remove.push(normalized);
    }
    for (const path of retainedChunkPaths)
        if (chunkPublicationCandidates.has(path) === false)
            throw new Error(`Render GC retained chunk path "${path}" has no exact pointer/tree candidate.`);
    const retainedPairs = new Map();
    for (const path of retainedChunkPaths) {
        const pointer = /^(proxy|final)\/pointers\/([0-9a-f]{64})$/u.exec(path);
        const tree = /^(proxy|final)\/tmp\/([0-9a-f]{64})\.[^.]+\.\d+$/u.exec(path);
        const match = pointer ?? tree;
        if (match === null)
            continue;
        const key = `${match[1]}\0${match[2]}`;
        const pair = retainedPairs.get(key) ?? { pointers: 0, trees: 0 };
        if (pointer === null)
            pair.trees++;
        else
            pair.pointers++;
        retainedPairs.set(key, pair);
    }
    for (const [key, pair] of retainedPairs)
        if (pair.pointers !== 1 ||
            pair.trees !== 1 ||
            activeChunks.has(key) === false)
            throw new Error(`Render GC retained chunk publication "${key.replace("\0", "/")}" is not one exact current pointer/tree pair.`);
    const reclaimableBytes = remove.reduce((total, candidate) => total + candidate.bytes, 0);
    if (Number.isSafeInteger(reclaimableBytes) === false)
        throw new Error("Render GC reclaimable byte total exceeds safe integer range.");
    return {
        version: 1,
        keep,
        remove,
        reclaimableBytes,
    };
};
const canonicalRelativePath = (value) => {
    if (value.trim().length === 0 ||
        value.includes("\\") ||
        value.startsWith("/") ||
        /^[A-Za-z]:/.test(value) ||
        value
            .split("/")
            .some((segment) => segment.length === 0 || segment === "." || segment === ".."))
        throw new Error(`Render GC path "${value}" must be one canonical relative POSIX path.`);
    return value;
};
//# sourceMappingURL=productionRenderGc.js.map