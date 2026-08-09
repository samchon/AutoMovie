import { Vector3 } from "../math/Vector3";
import { compareCodeUnits } from "../text/compareCodeUnits";
import { FRAMING_HEIGHT_FRACTION } from "./cameraMove";
import { projectToNdc } from "./cameraProjection";
/** Exact one-to-one suppression table for deliberate grammar exceptions. */
export const GRAMMAR_STYLE_SUPPRESSION = {
    "jump-cut": "grammar-jump-cut",
    "eyeline-break": "grammar-eyeline",
    "tight-reestablish": "grammar-reestablish",
    "rhythmic-pacing": "grammar-pacing",
};
const DEFAULT_MINIMUM_CUT_ANGLE_DEGREES = 30;
const DEFAULT_REESTABLISH_DISTANCE = 10;
const EPSILON = 1e-6;
/**
 * Diagnose an ordered edit from deterministic shot observations.
 *
 * Shot order is editorial meaning and remains untouched. Subject collections
 * and action-axis endpoints are normalized by id, so collection order and
 * random generation order cannot alter the result. The analyzer has no seed,
 * clock, scene mutation, or renderer dependency.
 */
export const analyzeFilmGrammar = (props) => {
    const minimumCutAngleDegrees = props.minimumCutAngleDegrees ?? DEFAULT_MINIMUM_CUT_ANGLE_DEGREES;
    const reestablishDistance = props.reestablishDistance ?? DEFAULT_REESTABLISH_DISTANCE;
    positive(minimumCutAngleDegrees, "minimumCutAngleDegrees");
    positive(reestablishDistance, "reestablishDistance");
    const shots = props.shots.map(normalizeShot);
    const ids = new Set();
    for (const shot of shots) {
        if (ids.has(shot.id))
            throw new Error(`Film grammar shot id "${shot.id}" is duplicated.`);
        ids.add(shot.id);
    }
    const diagnostics = [];
    for (const shot of shots)
        inspectShotSize(diagnostics, shot);
    for (let i = 1; i < shots.length; ++i)
        inspectCut(diagnostics, shots[i - 1], shots[i], minimumCutAngleDegrees, reestablishDistance);
    if (shots.length !== 0) {
        const average = shots.reduce((sum, shot) => sum + shot.duration, 0) / shots.length;
        const incoming = shots[shots.length - 1];
        diagnostics.push({
            code: "grammar-pacing",
            severity: "advisory",
            shot: incoming.id,
            previousShot: null,
            fact: `edited durations are [${shots
                .map((shot) => `${round(shot.duration)}s`)
                .join(", ")}], average shot length ${round(average)}s`,
            impact: "the duration series is the measurable basis for judging whether the cut rhythm serves the beat",
            recovery: "compare the duration series with the intended dramatic cadence, then trim, extend, or explicitly mark rhythmic-pacing",
        });
    }
    return diagnostics.filter((diagnostic) => {
        if (diagnostic.code === "grammar-pacing")
            return shots.some((shot) => shot.styleIntent.includes("rhythmic-pacing"))
                ? false
                : true;
        const shot = shots.find((candidate) => candidate.id === diagnostic.shot);
        return (shot.styleIntent ?? []).some((intent) => GRAMMAR_STYLE_SUPPRESSION[intent] === diagnostic.code)
            ? false
            : true;
    });
};
/** Adapt grammar diagnostics into the existing visual-review backlog socket. */
export const grammarDiagnosticsToReviewNotes = (props) => props.diagnostics.map((diagnostic) => ({
    beat: props.beat,
    tier: "visual",
    issue: `${diagnostic.code}: ${diagnostic.fact}; ${diagnostic.impact}`,
    suggestion: diagnostic.recovery,
}));
/** Classify a subject's measured fraction of total frame height. */
export const classifyGrammarShotSize = (verticalFrameOccupancy) => {
    positive(verticalFrameOccupancy, "verticalFrameOccupancy");
    const visibleHeightMultiple = 1 / verticalFrameOccupancy;
    return Object.entries(FRAMING_HEIGHT_FRACTION).reduce((best, candidate) => Math.abs(Math.log(visibleHeightMultiple / candidate[1])) <
        Math.abs(Math.log(visibleHeightMultiple / best[1]))
        ? candidate
        : best)[0];
};
const normalizeShot = (input) => {
    nonBlank(input.id, "shot.id");
    positive(input.duration, `${input.id}.duration`);
    for (const boundary of ["start", "end"]) {
        const camera = input.camera[boundary];
        positive(camera.fovY, `${input.id}.camera.${boundary}.fovY`);
        if (camera.fovY >= 180)
            throw new Error(`${input.id}.camera.${boundary}.fovY must be below 180.`);
        positive(camera.aspect, `${input.id}.camera.${boundary}.aspect`);
        finiteVector(camera.position, `${input.id}.camera.${boundary}.position`);
        for (const [key, value] of Object.entries(camera.rotation))
            if (Number.isFinite(value) === false)
                throw new Error(`${input.id}.camera.${boundary}.rotation.${key} must be finite.`);
    }
    const subjects = [...input.subjects].sort((a, b) => compareCodeUnits(a.id, b.id));
    const subjectIds = new Set();
    for (const subject of subjects) {
        nonBlank(subject.id, `${input.id}.subjects.id`);
        if (subjectIds.has(subject.id))
            throw new Error(`Film grammar subject id "${subject.id}" is duplicated in "${input.id}".`);
        subjectIds.add(subject.id);
        finiteVector(subject.start, `${input.id}.${subject.id}.start`);
        finiteVector(subject.end, `${input.id}.${subject.id}.end`);
        positive(subject.height, `${input.id}.${subject.id}.height`);
        if (subject.eyeline !== null) {
            nonBlank(subject.eyeline.target, `${input.id}.${subject.id}.eyeline.target`);
            finiteVector(subject.eyeline.start, `${input.id}.${subject.id}.eyeline.start`);
            finiteVector(subject.eyeline.end, `${input.id}.${subject.id}.eyeline.end`);
        }
    }
    if (input.primarySubject !== null &&
        subjectIds.has(input.primarySubject) === false)
        throw new Error(`Primary subject "${input.primarySubject}" is absent from "${input.id}".`);
    let actionAxis = null;
    if (input.actionAxis !== null) {
        const [first, second] = input.actionAxis;
        if (first === second)
            throw new Error(`Action axis in "${input.id}" repeats "${first}".`);
        if (subjectIds.has(first) === false || subjectIds.has(second) === false)
            throw new Error(`Action axis in "${input.id}" must reference two observed subjects.`);
        actionAxis =
            compareCodeUnits(first, second) <= 0 ? [first, second] : [second, first];
    }
    const styleIntent = [...(input.styleIntent ?? [])];
    if (new Set(styleIntent).size !== styleIntent.length)
        throw new Error(`styleIntent in "${input.id}" must be unique.`);
    return { ...input, subjects, actionAxis, styleIntent };
};
const inspectShotSize = (diagnostics, shot) => {
    if (shot.primarySubject === null || shot.declaredShotSize === null)
        return;
    const start = measuredShotSize(shot, "start");
    const end = measuredShotSize(shot, "end");
    const measured = [start, end].filter((value) => value !== null);
    if (measured.length === 0 ||
        measured.every((value) => value === shot.declaredShotSize))
        return;
    diagnostics.push({
        code: "grammar-shot-size",
        severity: "warning",
        shot: shot.id,
        previousShot: null,
        fact: `shot "${shot.id}" declares ${shot.declaredShotSize} framing but projects "${shot.primarySubject}" as ${start ?? "unmeasurable"} -> ${end ?? "unmeasurable"}`,
        impact: "the rendered subject scale does not deliver the authored shot-size hierarchy",
        recovery: `move camera "${shot.id}" to measure as ${shot.declaredShotSize}, change its lens, or correct the declared framing`,
    });
};
const inspectCut = (diagnostics, previous, incoming, minimumCutAngleDegrees, reestablishDistance) => {
    inspectAxis(diagnostics, previous, incoming);
    const previousSubjects = byId(previous.subjects);
    const incomingSubjects = byId(incoming.subjects);
    inspectEyeline(diagnostics, previous, incoming, previousSubjects, incomingSubjects);
    if (previous.primarySubject !== null &&
        previous.primarySubject === incoming.primarySubject) {
        const subjectId = previous.primarySubject;
        const outgoing = previousSubjects.get(subjectId);
        const arriving = incomingSubjects.get(subjectId);
        const previousSize = measuredShotSize(previous, "end");
        const incomingSize = measuredShotSize(incoming, "start");
        const cutAngle = cameraBearingAngleDegrees(outgoing.end, arriving.start, previous.camera.end.position, incoming.camera.start.position);
        if (previousSize !== null &&
            previousSize === incomingSize &&
            cutAngle < minimumCutAngleDegrees)
            diagnostics.push({
                code: "grammar-jump-cut",
                severity: "warning",
                shot: incoming.id,
                previousShot: previous.id,
                fact: `cut "${previous.id}" -> "${incoming.id}" keeps ${subjectId} at ${incomingSize} size while camera bearing changes ${round(cutAngle)} degrees`,
                impact: "the small same-size spatial change can read as an accidental jump",
                recovery: `move camera "${incoming.id}" at least ${minimumCutAngleDegrees} degrees around "${subjectId}", change shot size, insert a neutral cutaway, or mark jump-cut`,
            });
        const displacement = Vector3.length(Vector3.subtract(arriving.start, outgoing.end));
        if (displacement > reestablishDistance &&
            incomingSize !== null &&
            incomingSize !== "wide")
            diagnostics.push({
                code: "grammar-reestablish",
                severity: "warning",
                shot: incoming.id,
                previousShot: previous.id,
                fact: `"${subjectId}" moves ${round(displacement)}m across the cut into a ${incomingSize} shot`,
                impact: "the audience loses the subject's new spatial relation without a wide orientation view",
                recovery: `make "${incoming.id}" wide, insert a neutral establishing shot before it, or mark tight-reestablish`,
            });
        inspectScreenDirection(diagnostics, previous, incoming, outgoing, arriving);
    }
    const incomingSize = measuredShotSize(incoming, "start");
    const entrant = incoming.subjects.find((subject) => previousSubjects.has(subject.id) === false);
    if (entrant !== undefined &&
        incomingSize !== null &&
        incomingSize !== "wide" &&
        diagnostics.some((diagnostic) => diagnostic.code === "grammar-reestablish" &&
            diagnostic.shot === incoming.id) === false)
        diagnostics.push({
            code: "grammar-reestablish",
            severity: "warning",
            shot: incoming.id,
            previousShot: previous.id,
            fact: `"${entrant.id}" first enters the edit in a ${incomingSize} shot`,
            impact: "the audience has no wide spatial introduction for the newly visible subject",
            recovery: `introduce "${entrant.id}" in a wide or neutral establishing shot before "${incoming.id}", or mark tight-reestablish`,
        });
};
const inspectAxis = (diagnostics, previous, incoming) => {
    if (previous.actionAxis === null ||
        incoming.actionAxis === null ||
        previous.actionAxis[0] !== incoming.actionAxis[0] ||
        previous.actionAxis[1] !== incoming.actionAxis[1] ||
        crossesActionAxisOnScreen(previous) ||
        crossesActionAxisOnScreen(incoming))
        return;
    const previousSide = actionAxisSide(previous, "end");
    const incomingSide = actionAxisSide(incoming, "start");
    if (previousSide === 0 || incomingSide === 0 || previousSide === incomingSide)
        return;
    const halfPlane = previousSide > 0 ? "positive" : "negative";
    diagnostics.push({
        code: "grammar-axis-crossed",
        severity: "error",
        shot: incoming.id,
        previousShot: previous.id,
        fact: `cut "${previous.id}" -> "${incoming.id}" moves the camera from the ${halfPlane} to the ${halfPlane === "positive" ? "negative" : "positive"} half-plane of axis "${previous.actionAxis[0]}"-"${previous.actionAxis[1]}"`,
        impact: "the unseen axis crossing reverses established left-right geography",
        recovery: `keep camera "${incoming.id}" on the ${halfPlane} half-plane, show the crossing on screen, or insert a neutral shot on the action axis`,
    });
};
const inspectEyeline = (diagnostics, previous, incoming, previousSubjects, incomingSubjects) => {
    if (previous.primarySubject === null || incoming.primarySubject === null)
        return;
    const outgoing = previousSubjects.get(previous.primarySubject);
    if (outgoing.eyeline === null)
        return;
    const targetId = outgoing.eyeline.target;
    const incomingLooker = incomingSubjects.get(incoming.primarySubject);
    if (incomingLooker === undefined || incomingLooker.eyeline === null)
        return;
    const incomingTargetId = incomingLooker.eyeline.target;
    const reverse = incomingLooker.id === targetId && incomingTargetId === outgoing.id;
    const continuation = incomingLooker.id === outgoing.id && incomingTargetId === targetId;
    if (reverse === false && continuation === false)
        return;
    const outgoingSide = relativeScreenDirection(previous.camera.end, outgoing.end, outgoing.eyeline.end);
    const incomingSide = relativeScreenDirection(incoming.camera.start, incomingLooker.start, incomingLooker.eyeline.start);
    const expectedMultiplier = reverse ? -1 : 1;
    const matches = (outgoingValue, incomingValue) => outgoingValue === 0 ||
        incomingValue === 0 ||
        incomingValue === outgoingValue * expectedMultiplier;
    if (matches(outgoingSide.horizontal, incomingSide.horizontal) &&
        matches(outgoingSide.vertical, incomingSide.vertical))
        return;
    diagnostics.push({
        code: "grammar-eyeline",
        severity: "warning",
        shot: incoming.id,
        previousShot: previous.id,
        fact: `eyeline "${outgoing.id}" -> "${targetId}" reads ${screenRelation(outgoingSide)}, but incoming "${incomingLooker.id}" -> "${incomingTargetId}" reads ${screenRelation(incomingSide)} instead of the ${reverse ? "opposite" : "same"} screen relation`,
        impact: "the reverse relative screen position breaks the established eyeline match",
        recovery: `place camera "${incoming.id}" on the prior eyeline half-plane, insert a neutral look shot, or mark eyeline-break`,
    });
};
const inspectScreenDirection = (diagnostics, previous, incoming, outgoing, arriving) => {
    const outgoingDirection = screenMotionDirection(previous, outgoing);
    const incomingDirection = screenMotionDirection(incoming, arriving);
    if (outgoingDirection === 0 ||
        incomingDirection === 0 ||
        outgoingDirection === incomingDirection)
        return;
    diagnostics.push({
        code: "grammar-screen-direction",
        severity: "error",
        shot: incoming.id,
        previousShot: previous.id,
        fact: `"${outgoing.id}" moves screen-${outgoingDirection > 0 ? "right" : "left"} in "${previous.id}" then screen-${incomingDirection > 0 ? "right" : "left"} in "${incoming.id}"`,
        impact: "the reversal can read as the subject turning around or changing destination",
        recovery: `keep "${outgoing.id}" moving screen-${outgoingDirection > 0 ? "right" : "left"}, cross the camera visibly, or insert a neutral head-on shot`,
    });
};
const actionAxisSide = (shot, boundary) => {
    const subjects = byId(shot.subjects);
    const first = subjects.get(shot.actionAxis[0]);
    const second = subjects.get(shot.actionAxis[1]);
    const axis = Vector3.subtract(second[boundary], first[boundary]);
    const camera = Vector3.subtract(shot.camera[boundary].position, first[boundary]);
    return sign(axis.x * camera.z - axis.z * camera.x);
};
const crossesActionAxisOnScreen = (shot) => {
    if (shot.actionAxis === null)
        return false;
    const start = actionAxisSide(shot, "start");
    const end = actionAxisSide(shot, "end");
    return start !== 0 && end !== 0 && start !== end;
};
const measuredShotSize = (shot, boundary) => {
    if (shot.primarySubject === null)
        return null;
    const subject = byId(shot.subjects).get(shot.primarySubject);
    const camera = shot.camera[boundary];
    const halfY = Math.tan((camera.fovY * Math.PI) / 360);
    const base = projectToNdc(camera, subject[boundary], halfY, camera.aspect);
    const top = projectToNdc(camera, {
        ...subject[boundary],
        y: subject[boundary].y + subject.height,
    }, halfY, camera.aspect);
    if (base.depth <= EPSILON || top.depth <= EPSILON)
        return null;
    const occupancy = Math.abs(top.ndcY - base.ndcY) / 2;
    return occupancy <= EPSILON ? null : classifyGrammarShotSize(occupancy);
};
const relativeScreenDirection = (camera, subject, target) => {
    const halfY = Math.tan((camera.fovY * Math.PI) / 360);
    const subjectProjection = projectToNdc(camera, subject, halfY, camera.aspect);
    const targetProjection = projectToNdc(camera, target, halfY, camera.aspect);
    if (subjectProjection.depth <= EPSILON || targetProjection.depth <= EPSILON)
        return { horizontal: 0, vertical: 0 };
    return {
        horizontal: sign(targetProjection.ndcX - subjectProjection.ndcX),
        vertical: sign(targetProjection.ndcY - subjectProjection.ndcY),
    };
};
const screenMotionDirection = (shot, subject) => {
    const startHalfY = Math.tan((shot.camera.start.fovY * Math.PI) / 360);
    const endHalfY = Math.tan((shot.camera.end.fovY * Math.PI) / 360);
    const start = projectToNdc(shot.camera.start, subject.start, startHalfY, shot.camera.start.aspect);
    const end = projectToNdc(shot.camera.end, subject.end, endHalfY, shot.camera.end.aspect);
    if (start.depth <= EPSILON || end.depth <= EPSILON)
        return 0;
    return sign(end.ndcX - start.ndcX);
};
const cameraBearingAngleDegrees = (previousSubject, incomingSubject, previousCamera, incomingCamera) => {
    const previous = Vector3.subtract(previousCamera, previousSubject);
    const incoming = Vector3.subtract(incomingCamera, incomingSubject);
    const lengths = Vector3.length(previous) * Vector3.length(incoming);
    if (lengths <= EPSILON)
        return 180;
    const cosine = Math.max(-1, Math.min(1, Vector3.dot(previous, incoming) / lengths));
    return (Math.acos(cosine) * 180) / Math.PI;
};
const byId = (subjects) => new Map(subjects.map((subject) => [subject.id, subject]));
const sign = (value) => Math.abs(value) <= EPSILON ? 0 : value > 0 ? 1 : -1;
const screenRelation = (direction) => [
    direction.horizontal === 0
        ? "screen-center"
        : `screen-${direction.horizontal > 0 ? "right" : "left"}`,
    direction.vertical === 0
        ? "level"
        : direction.vertical > 0
            ? "above"
            : "below",
].join("/");
const positive = (value, path) => {
    if (Number.isFinite(value) === false || value <= 0)
        throw new Error(`${path} must be finite and positive.`);
};
const nonBlank = (value, path) => {
    if (value.trim().length === 0)
        throw new Error(`${path} must be non-blank.`);
};
const finiteVector = (value, path) => {
    for (const [key, component] of Object.entries(value))
        if (Number.isFinite(component) === false)
            throw new Error(`${path}.${key} must be finite.`);
};
const round = (value) => Math.round(value * 1_000) / 1_000;
//# sourceMappingURL=filmGrammar.js.map