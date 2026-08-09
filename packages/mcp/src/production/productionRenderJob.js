import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
/** Build content-addressed chunks from the compiler-owned film edit. */
export const planProductionRenderJob = (props) => {
    if (Number.isSafeInteger(props.chunkFrames) === false ||
        props.chunkFrames <= 0)
        throw new Error(`chunkFrames must be a positive safe integer, but was ${props.chunkFrames}.`);
    if (validDigest(props.runtimeIdentity.sourceDigest) === false)
        throw new Error("Render runtime sourceDigest must be one current SHA-256 content identity.");
    const tier = normalizeRenderTier(props.tier);
    const frameFormat = resolveProductionRenderTierFrameFormat(props.production.frameFormat, tier);
    if (frameFormat.width % 2 !== 0 || frameFormat.height % 2 !== 0)
        throw new Error("The production H.264 render adapter requires even width and height.");
    if (props.timeline.id !== props.production.id ||
        props.timeline.fps !== props.production.frameFormat.fps ||
        props.timeline.totalFrames !==
            Math.round(props.production.targetRuntimeSeconds *
                props.production.frameFormat.fps))
        throw new Error("The film edit differs from the production identity, frame clock, or runtime. Recompile before planning.");
    if (props.timeline.totalFrames % tier.frameStep !== 0)
        throw new Error(`Render tier "${tier.kind}" frameStep ${tier.frameStep} does not divide the ${props.timeline.totalFrames}-frame edit. Choose a divisor so proxy and final have the same exact runtime.`);
    const audioAssets = normalizeAudioAssets(props.audioAssets);
    for (const cue of props.timeline.tracks.audio) {
        const asset = audioAssets.find((candidate) => candidate.path === cue.asset);
        if (asset === undefined ||
            Math.round(asset.durationSeconds * props.timeline.fps) !==
                cue.sourceDurationFrames)
            throw new Error(`Audio cue "${cue.id}" lacks one digest-, format-, and duration-verified source asset.`);
    }
    const legacyGuidePasses = normalizeGuidePasses(props.guidePasses ?? ["pose"]);
    const editFingerprint = digestJson({
        protocol: "automovie.production-render-edit.v1",
        id: props.timeline.id,
        fps: props.timeline.fps,
        totalFrames: props.timeline.totalFrames,
        segments: props.timeline.segments,
        omissions: props.timeline.omissions,
        tracks: props.timeline.tracks,
    });
    const frames = Array.from({ length: props.timeline.totalFrames / tier.frameStep }, (_, outputFrame) => {
        const timelineFrame = outputFrame * tier.frameStep;
        return {
            ...sampleProductionRenderFrame(props.timeline, timelineFrame),
            globalFrame: outputFrame,
            timelineFrame,
            timeSeconds: outputFrame / frameFormat.fps,
        };
    });
    const chunks = [];
    for (const deliverable of props.production.deliverables) {
        // Only the two moving-image kinds carry chunks. Narrowing here rather than
        // resolving an empty pass list keeps the chunk's own `kind` exact, so a
        // caption or audio deliverable cannot reach a video parser probe.
        if (deliverable.kind !== "feature" && deliverable.kind !== "guide-pass")
            continue;
        const passes = deliverable.kind === "feature"
            ? ["beauty"]
            : normalizeGuidePasses(deliverable.pass === undefined
                ? legacyGuidePasses
                : [deliverable.pass]);
        for (const pass of passes)
            for (let frameStart = 0, index = 0; frameStart < frames.length; frameStart += props.chunkFrames, ++index) {
                const frameEndExclusive = Math.min(frameStart + props.chunkFrames, frames.length);
                const range = frames.slice(frameStart, frameEndExclusive);
                const sources = [
                    ...new Set(range.flatMap((frame) => frame.layers.map((layer) => layer.shot))),
                ]
                    .sort(compareCodeUnits)
                    .map((shot) => {
                    const digest = props.sourceFingerprints[shot];
                    if (digest === undefined || validDigest(digest) === false)
                        throw new Error(`Render range references shot "${shot}" without one current compiler-owned source fingerprint.`);
                    return { shot, digest };
                });
                const slot = `${props.production.id}:${tier.kind}:${deliverable.id}:${pass}:${index}`;
                const identity = {
                    protocol: "automovie.production-render-chunk.v3",
                    production: props.production.id,
                    tier,
                    deliverable: deliverable.id,
                    kind: deliverable.kind,
                    editFingerprint,
                    sourceFrameFormat: props.production.frameFormat,
                    frameFormat,
                    frameStart,
                    frameEndExclusive,
                    pass,
                    runtimeIdentity: props.runtimeIdentity,
                    sources,
                };
                chunks.push({
                    slot,
                    id: digestJson(identity),
                    deliverable: deliverable.id,
                    kind: deliverable.kind,
                    pass,
                    frameStart,
                    frameEndExclusive,
                    frames: range,
                });
            }
    }
    return {
        version: 3,
        productionId: props.production.id,
        compileFingerprint: props.timeline.inputFingerprint,
        editFingerprint,
        runtimeIdentity: props.runtimeIdentity,
        tier,
        sourceFrameFormat: structuredClone(props.production.frameFormat),
        frameFormat,
        totalFrames: frames.length,
        chunkFrames: props.chunkFrames,
        chunks,
        tracks: {
            captions: canonicalProductionWebVtt(props.timeline),
            audio: structuredClone(props.timeline.tracks.audio),
            audioAssets,
        },
    };
};
/** Prove a persisted plan is exactly reproducible from current compiler inputs. */
export const verifyProductionRenderJobPlan = (props) => {
    const expected = planProductionRenderJob({
        timeline: props.timeline,
        production: props.production,
        runtimeIdentity: props.runtimeIdentity,
        sourceFingerprints: props.sourceFingerprints,
        audioAssets: props.audioAssets,
        chunkFrames: props.plan.chunkFrames,
        guidePasses: props.guidePasses,
        tier: props.plan.tier,
    });
    if (canonicalJson(props.plan) !== canonicalJson(expected))
        throw new Error("Stored render plan differs from the current compiler-owned timeline and render inputs. Run automovie render plan, then rerender only changed chunk identities.");
};
/** Resolve one global frame, including exact dissolve and fade weights. */
export const sampleProductionRenderFrame = (timeline, globalFrame) => {
    if (Number.isSafeInteger(globalFrame) === false ||
        globalFrame < 0 ||
        globalFrame >= timeline.totalFrames)
        throw new Error(`Film-global frame ${globalFrame} is outside 0..${timeline.totalFrames - 1}.`);
    const active = timeline.segments
        .map((segment, index) => ({ segment, index }))
        .filter(({ segment }) => segment.startFrame <= globalFrame && globalFrame < segment.endFrame);
    const current = active.at(-1);
    if (current === undefined)
        throw new Error(`Film-global frame ${globalFrame} has no compiler-owned video segment.`);
    const offset = globalFrame - current.segment.startFrame;
    const incoming = {
        shot: current.segment.shot,
        sourceFrame: current.segment.sourceInFrame + offset,
        weight: 1,
    };
    if (current.segment.transitionIn.kind === "dissolve" &&
        offset < current.segment.transitionIn.durationFrames) {
        const previous = timeline.segments[current.index - 1];
        if (previous === undefined)
            throw new Error(`Segment "${current.segment.shot}" dissolves without an outgoing segment.`);
        const alpha = offset / current.segment.transitionIn.durationFrames;
        return frame(timeline, globalFrame, [
            {
                shot: previous.shot,
                sourceFrame: previous.sourceOutFrame -
                    current.segment.transitionIn.durationFrames +
                    offset,
                weight: 1 - alpha,
            },
            { ...incoming, weight: alpha },
        ]);
    }
    const fadeIn = current.segment.transitionIn.kind === "fade" &&
        offset < current.segment.transitionIn.durationFrames
        ? offset / current.segment.transitionIn.durationFrames
        : 1;
    const remaining = current.segment.endFrame - globalFrame;
    const fadeOut = current.segment.transitionOut.kind === "fade" &&
        remaining <= current.segment.transitionOut.durationFrames
        ? remaining / current.segment.transitionOut.durationFrames
        : 1;
    return frame(timeline, globalFrame, [
        { ...incoming, weight: Math.min(fadeIn, fadeOut) },
    ]);
};
/**
 * Resolve pass-specific transition inputs.
 *
 * Beauty is alpha composited. Structural guide passes are classifications or
 * geometric fields, so linearly blending their pixels invents invalid values;
 * they select the dominant shot layer instead (incoming wins an exact tie).
 */
export const productionRenderLayersForPass = (frame, pass) => {
    if (pass === "beauty")
        return structuredClone(frame.layers);
    const selected = frame.layers.reduce((selected, candidate) => candidate.weight >= selected.weight ? candidate : selected);
    return [
        {
            ...structuredClone(selected),
            weight: 1,
        },
    ];
};
/** Canonical WebVTT derived only from compiled caption placements. */
export const canonicalProductionWebVtt = (timeline) => {
    const cues = [...timeline.tracks.captions].sort((left, right) => left.startFrame - right.startFrame ||
        left.endFrame - right.endFrame ||
        compareCodeUnits(left.id, right.id));
    return [
        `WEBVTT ${webVttPlainText(timeline.id)}`,
        "",
        ...cues.flatMap((cue) => [
            webVttPlainText(cue.id),
            `${webVttTime(cue.startFrame / timeline.fps)} --> ${webVttTime(cue.endFrame / timeline.fps)}`,
            `<lang ${webVttPlainText(cue.language)}>${cue.speaker === undefined
                ? webVttPlainText(cue.text)
                : `<v ${webVttPlainText(cue.speaker)}>${webVttPlainText(cue.text)}</v>`}</lang>`,
            "",
        ]),
    ].join("\n");
};
/** Classify current identities without treating an old slot as current. */
export const productionRenderChunkStatuses = (props) => {
    return props.plan.chunks.map((chunk) => {
        const slotReceipts = props.receipts.filter((item) => item.slot === chunk.slot);
        const receipt = slotReceipts.find((item) => item.chunk === chunk.id) ??
            slotReceipts.at(-1);
        const slotAttempts = props.attempts.filter((item) => item.slot === chunk.slot);
        const attempt = slotAttempts.find((item) => item.chunk === chunk.id) ??
            slotAttempts.at(-1);
        if (receipt?.chunk === chunk.id)
            return status(chunk, "complete", "Verify current bytes, then reuse this chunk.");
        if (attempt?.chunk === chunk.id)
            return status(chunk, attempt.state, attempt.state === "running"
                ? "Wait for its lock owner or recover the abandoned attempt."
                : attempt.correction);
        if (receipt !== undefined || attempt !== undefined)
            return status(chunk, "stale", "Quarantine prior slot output and render only this current chunk.");
        return status(chunk, "planned", "Acquire its lock, render, encode, verify, and commit.");
    });
};
/** Verify completion identity, exact range coverage, raster, and byte facts. */
export const verifyProductionRenderChunkReceipt = (props) => {
    const { plan, chunk, receipt } = props;
    if (receipt.version !== 1 ||
        receipt.slot !== chunk.slot ||
        receipt.chunk !== chunk.id)
        throw new Error(`Chunk receipt "${receipt.slot}" is stale.`);
    if (receipt.frames.length !== chunk.frames.length)
        throw new Error(`Chunk "${chunk.slot}" has ${receipt.frames.length} frame receipts; expected ${chunk.frames.length}.`);
    receipt.frames.forEach((frameReceipt, index) => {
        const expected = chunk.frames[index].globalFrame;
        if (frameReceipt.globalFrame !== expected ||
            frameReceipt.width !== plan.frameFormat.width ||
            frameReceipt.height !== plan.frameFormat.height ||
            validByteFact(frameReceipt) === false)
            throw new Error(`Chunk "${chunk.slot}" frame ${index} does not prove global frame ${expected} at the production raster.`);
    });
    if (validByteFact(receipt.encoded) === false)
        throw new Error(`Chunk "${chunk.slot}" has no verified encoded output.`);
};
class ProductionRenderChunkLifecycleError extends AggregateError {
}
/** Preserve one acquired chunk's complete fatal lifecycle in phase order. */
const productionRenderChunkLifecycleFailure = (attempt, failureRecord, release) => {
    const failures = [attempt, failureRecord, release].filter((failure) => failure !== undefined);
    if (failures.length === 1)
        return failures[0].error;
    return new ProductionRenderChunkLifecycleError(failures.map((failure) => failure.error), "Production render chunk cleanup failed after the render attempt failed.");
};
/** Schedule only non-current chunks through host-owned lock/byte adapters. */
export const runProductionRenderJob = async (props) => {
    if (Number.isSafeInteger(props.workers) === false || props.workers <= 0)
        throw new Error(`workers must be a positive safe integer, but was ${props.workers}.`);
    const queue = props.plan.chunks.filter((chunk) => props.deliverable === undefined ||
        chunk.deliverable === props.deliverable);
    if (props.deliverable !== undefined &&
        props.plan.chunks.some((chunk) => chunk.deliverable === props.deliverable) === false)
        throw new Error(`Render plan has no video chunks for deliverable "${props.deliverable}".`);
    const output = {
        complete: [],
        rendered: [],
        busy: [],
        failed: [],
    };
    let cursor = 0;
    const fatalFailures = [];
    const reserveFatalFailure = () => {
        if (fatalFailures.length !== 0)
            return undefined;
        const failure = { error: undefined };
        fatalFailures.push(failure);
        return failure;
    };
    const recordFatalFailure = (error) => {
        const failure = reserveFatalFailure();
        if (failure !== undefined)
            failure.error = error;
    };
    const worker = async () => {
        try {
            while (fatalFailures.length === 0 && cursor < queue.length) {
                const chunk = queue[cursor++];
                const current = await props.adapters.current(chunk);
                if (current !== null) {
                    verifyProductionRenderChunkReceipt({
                        plan: props.plan,
                        chunk,
                        receipt: current,
                    });
                    output.complete.push(chunk.slot);
                    continue;
                }
                if ((await props.adapters.acquire(chunk)) === false) {
                    output.busy.push(chunk.slot);
                    continue;
                }
                let attemptFailure;
                let failureRecordFailure;
                let releaseFailure;
                let fatalFailure;
                try {
                    const receipt = await props.adapters.render(chunk);
                    verifyProductionRenderChunkReceipt({
                        plan: props.plan,
                        chunk,
                        receipt,
                    });
                    output.rendered.push(chunk.slot);
                }
                catch (error) {
                    attemptFailure = { error };
                    const correction = error instanceof Error ? error.message : String(error);
                    try {
                        await props.adapters.fail(chunk, correction);
                        output.failed.push({ slot: chunk.slot, correction });
                    }
                    catch (failure) {
                        failureRecordFailure = { error: failure };
                        fatalFailure = reserveFatalFailure();
                    }
                }
                finally {
                    try {
                        await props.adapters.release(chunk);
                    }
                    catch (failure) {
                        releaseFailure = { error: failure };
                        fatalFailure ??= reserveFatalFailure();
                    }
                    if (fatalFailure !== undefined)
                        fatalFailure.error = productionRenderChunkLifecycleFailure(attemptFailure, failureRecordFailure, releaseFailure);
                }
            }
        }
        catch (error) {
            recordFatalFailure(error);
        }
    };
    await Promise.all(Array.from({ length: Math.min(props.workers, Math.max(1, queue.length)) }, worker));
    if (fatalFailures.length !== 0)
        throw fatalFailures[0].error;
    const order = new Map(queue.map((chunk, index) => [chunk.slot, index]));
    output.complete.sort((left, right) => order.get(left) - order.get(right));
    output.rendered.sort((left, right) => order.get(left) - order.get(right));
    output.busy.sort((left, right) => order.get(left) - order.get(right));
    output.failed.sort((left, right) => order.get(left.slot) - order.get(right.slot));
    return output;
};
class ProductionOwnedDescriptorCleanupError extends AggregateError {
}
/** Close one production-owned descriptor without losing earlier failures. */
const closeProductionOwnedDescriptor = (descriptor, failure, target) => {
    try {
        fs.closeSync(descriptor);
    }
    catch (closeFailure) {
        if (failure === undefined)
            throw closeFailure;
        throw new ProductionOwnedDescriptorCleanupError([
            ...(failure.error instanceof ProductionOwnedDescriptorCleanupError
                ? failure.error.errors
                : [failure.error]),
            closeFailure,
        ], `Production-owned descriptor cleanup failed after the read failed: ${target}.`);
    }
};
export function readAutoMovieProductionOwnedFile(props) {
    const root = path.resolve(props.root);
    const directory = path.resolve(props.directory);
    const target = path.resolve(directory, props.relative);
    if (`${directory}${path.sep}`.startsWith(`${root}${path.sep}`) === false ||
        target.startsWith(`${directory}${path.sep}`) === false)
        throw new Error(`Production-owned path "${props.relative}" escapes its owned directory.`);
    const relativeParent = path.relative(root, path.dirname(target));
    const components = relativeParent.length === 0 ? [] : relativeParent.split(path.sep);
    const directories = [root];
    for (const component of components)
        directories.push(path.join(directories.at(-1), component));
    const identities = directories.map((file) => ({
        file,
        identity: productionOwnedDirectoryIdentity(file),
    }));
    const assertResidentDirectories = () => {
        const changed = identities.find((expected) => expected.identity !== productionOwnedDirectoryIdentity(expected.file));
        if (changed !== undefined)
            throw new Error(`Production-owned path "${changed.file}" changed physical identity while it was read.`);
    };
    let linkedIdentity;
    try {
        linkedIdentity = productionOwnedFileIdentity(target);
    }
    catch (error) {
        if (props.optional === true &&
            error.code === "ENOENT") {
            assertResidentDirectories();
            return null;
        }
        throw error;
    }
    const descriptor = fs.openSync(target, "r");
    let failure;
    try {
        const openedIdentity = productionOwnedDescriptorIdentity(target, descriptor);
        const assertResidentFile = () => {
            assertResidentDirectories();
            if (productionOwnedFileIdentity(target) !== linkedIdentity)
                throw new Error(`Production-owned path "${target}" changed physical identity while it was read.`);
            const residentDescriptor = fs.openSync(target, "r");
            let residentFailure;
            try {
                if (productionOwnedDescriptorIdentity(target, residentDescriptor) !==
                    openedIdentity)
                    throw new Error(`Production-owned path "${target}" changed physical identity while it was read.`);
            }
            catch (error) {
                residentFailure = { error };
                throw error;
            }
            finally {
                closeProductionOwnedDescriptor(residentDescriptor, residentFailure, target);
            }
        };
        assertResidentFile();
        const bytes = fs.readFileSync(descriptor);
        assertResidentFile();
        return bytes;
    }
    catch (error) {
        failure = { error };
        throw error;
    }
    finally {
        closeProductionOwnedDescriptor(descriptor, failure, target);
    }
}
const frame = (timeline, globalFrame, layers) => ({
    globalFrame,
    timelineFrame: globalFrame,
    timeSeconds: globalFrame / timeline.fps,
    layers,
});
const normalizeRenderTier = (tier) => {
    const value = tier ?? {
        kind: "final",
        resolutionScale: 1,
        frameStep: 1,
    };
    if ((value.kind !== "proxy" && value.kind !== "final") ||
        Number.isFinite(value.resolutionScale) === false ||
        value.resolutionScale <= 0 ||
        value.resolutionScale > 1 ||
        Number.isSafeInteger(value.frameStep) === false ||
        value.frameStep <= 0 ||
        value.frameStep > 16 ||
        (value.kind === "final" &&
            (value.resolutionScale !== 1 || value.frameStep !== 1)) ||
        (value.kind === "proxy" &&
            value.resolutionScale === 1 &&
            value.frameStep === 1))
        throw new Error("Render tier must be exact final (scale 1, step 1) or a bounded cheaper proxy (scale in (0, 1], integer step 1..16, with at least one reduction).");
    return structuredClone(value);
};
/** Derive the exact even raster and frame clock for one render tier. */
export const resolveProductionRenderTierFrameFormat = (source, tier) => {
    const normalized = normalizeRenderTier(tier);
    if (normalized.kind === "final")
        return structuredClone(source);
    const even = (value) => Math.max(2, Math.floor((value * normalized.resolutionScale) / 2) * 2);
    return {
        width: even(source.width),
        height: even(source.height),
        fps: source.fps / normalized.frameStep,
        colorSpace: source.colorSpace,
    };
};
const status = (chunk, state, correction) => ({
    slot: chunk.slot,
    chunk: chunk.id,
    status: state,
    correction,
});
const normalizeGuidePasses = (passes) => {
    const valid = new Set([
        "depth",
        "mask",
        "normal",
        "outline",
        "pose",
    ]);
    const output = [];
    for (const pass of passes) {
        if (valid.has(pass) === false)
            throw new Error(`Guide-pass render cannot use "${pass}".`);
        if (output.includes(pass) === false)
            output.push(pass);
    }
    if (output.length !== 1)
        throw new Error(`A guide-pass deliverable requires exactly one declared pass, but received ${output.length}. Declare separate deliverables when the production contract gains per-pass ownership.`);
    return output;
};
const normalizeAudioAssets = (assets) => {
    const paths = new Set();
    const output = [...assets]
        .sort((left, right) => compareCodeUnits(left.path, right.path))
        .map((asset) => {
        if (asset.path.trim().length === 0 ||
            paths.has(asset.path) ||
            validByteFact({ digest: asset.digest, bytes: 1 }) === false ||
            Number.isFinite(asset.durationSeconds) === false ||
            asset.durationSeconds <= 0 ||
            Number.isSafeInteger(asset.sampleRate) === false ||
            asset.sampleRate <= 0 ||
            Number.isSafeInteger(asset.channels) === false ||
            asset.channels <= 0)
            throw new Error(`Audio asset "${asset.path}" has invalid identity, duration, sample rate, channels, or duplicate ownership.`);
        paths.add(asset.path);
        return structuredClone(asset);
    });
    return output;
};
const webVttTime = (seconds) => {
    const milliseconds = Math.round(seconds * 1_000);
    const hours = Math.floor(milliseconds / 3_600_000);
    const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
    const remainder = Math.floor((milliseconds % 60_000) / 1_000);
    const fraction = milliseconds % 1_000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}.${String(fraction).padStart(3, "0")}`;
};
/** Escape one authored plain-text field into a single WebVTT content line. */
const webVttPlainText = (value) => value
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const validByteFact = (fact) => Number.isSafeInteger(fact.bytes) &&
    fact.bytes > 0 &&
    validDigest(fact.digest);
const validDigest = (value) => /^sha256:[0-9a-f]{64}$/.test(value);
const digestJson = (value) => `sha256:${createHash("sha256")
    .update(Buffer.from(canonicalJson(value), "utf8"))
    .digest("hex")}`;
const canonicalJson = (value) => {
    if (value === null || typeof value === "boolean" || typeof value === "string")
        return JSON.stringify(value);
    if (typeof value === "number") {
        if (Number.isFinite(value) === false)
            throw new Error("Render identity refuses non-finite numbers.");
        return JSON.stringify(value);
    }
    if (Array.isArray(value))
        return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
    if (typeof value === "object") {
        const record = value;
        return `{${Object.keys(record)
            .filter((key) => record[key] !== undefined)
            .sort(compareCodeUnits)
            .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
            .join(",")}}`;
    }
    throw new Error("Render identity requires JSON-compatible values.");
};
const compareCodeUnits = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const productionOwnedDirectoryIdentity = (directory) => {
    const linked = fs.lstatSync(directory, { bigint: true });
    if (linked.isSymbolicLink() || linked.isDirectory() === false)
        throw new Error(`Production-owned directory "${directory}" is not a physical directory.`);
    return `${linked.dev}\0${linked.ino}`;
};
const productionOwnedFileIdentity = (file) => {
    const linked = fs.lstatSync(file, { bigint: true });
    if (linked.isSymbolicLink() || linked.isFile() === false)
        throw new Error(`Production-owned path "${file}" is not a physical file.`);
    return `${linked.dev}\0${linked.ino}`;
};
const productionOwnedDescriptorIdentity = (file, descriptor) => {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (opened.isFile() === false)
        throw new Error(`Production-owned path "${file}" is not a physical file.`);
    return `${opened.dev}\0${opened.ino}`;
};
//# sourceMappingURL=productionRenderJob.js.map