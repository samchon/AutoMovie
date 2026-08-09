import { compareCodeUnits } from "../text/compareCodeUnits";
import { blockBeat } from "./blockBeat";
import { performShot } from "./performShot";
import { realizeShotContract } from "./realizeShotContract";
import { resolveBeatEnd, resolveBeatOpening } from "./resolveBeatEnd";
import { stageScene } from "./stageScene";
/**
 * Register one coding-agent-authored shot.
 *
 * This helper deliberately does not execute or validate the builder. Module
 * evaluation remains side-effect free; {@link compileDefinedShot} owns all
 * validation and converts author-visible failures into structured diagnostics.
 */
export const defineShot = (id, definition) => ({ id, ...definition });
/**
 * Compile a registered shot without MCP.
 *
 * The builder supplies ordinary code; the engine owns stage referential
 * integrity, blocking coherence, verb composition, ROM validation, artifact
 * validation and continuity sampling. Author mistakes return diagnostics.
 * Unexpected builder exceptions are also translated at this public boundary,
 * keeping raw throws internal to programmer invariants.
 */
export const compileDefinedShot = (props) => {
    let registration;
    try {
        registration = validateRegistration(props.shot);
    }
    catch (error) {
        return {
            success: false,
            diagnostics: [
                {
                    code: "pipeline-failed",
                    phase: "registration",
                    path: "$shot",
                    fact: `The registration boundary threw ${errorText(error)}.`,
                    impact: "No stable shot identity or contract can be selected for compilation.",
                    recovery: "Pass one defineShot export with a non-blank id, scene and contract beat, then compile that same value again.",
                },
            ],
        };
    }
    if (registration.length !== 0)
        return { success: false, diagnostics: registration };
    let program;
    try {
        program = props.shot.build(props.context);
    }
    catch (error) {
        return {
            success: false,
            diagnostics: [
                {
                    code: "builder-failed",
                    phase: "build",
                    path: "$shot.build",
                    fact: `The registered builder threw ${errorText(error)}.`,
                    impact: "No deterministic program exists, so stage and motion validation cannot run.",
                    recovery: "Correct the named source operation or precondition and return an IAutoMovieShotProgram synchronously.",
                },
            ],
        };
    }
    let phase = "build";
    try {
        const contract = validateProgramContract(props.shot, program);
        if (contract.length !== 0)
            return { success: false, diagnostics: contract };
        phase = "stage";
        const advice = validateAdvice(props.runtime.advice ?? []);
        if (advice.length !== 0)
            return { success: false, diagnostics: advice };
        const authoredStage = stageScene(program.script, program.stage);
        if (authoredStage.success === false)
            return {
                success: false,
                diagnostics: authoredStage.violations.map((violation) => fromViolation("stage", "stage-invalid", violation)),
            };
        phase = "blocking";
        const blocked = blockBeat(program.script, authoredStage, program.blocking, props.runtime.previous);
        if (blocked.success === false)
            return {
                success: false,
                diagnostics: blocked.violations.map((violation) => fromViolation("blocking", "blocking-invalid", violation)),
            };
        phase = "stage";
        const resumedStage = blocked.previous === null
            ? authoredStage
            : stageScene(program.script, resumeStage(program.stage, blocked.previous));
        if (resumedStage.success === false)
            return {
                success: false,
                diagnostics: resumedStage.violations.map((violation) => fromViolation("stage", "stage-invalid", violation)),
            };
        const staged = resumePoses(resumedStage, blocked.previous);
        phase = "performance";
        const performed = performShot({
            script: program.script,
            staged,
            performance: program.performance,
            synthesize: props.runtime.synthesize,
            skeleton: props.runtime.skeleton,
            models: props.runtime.models,
            formations: props.runtime.formations,
            formationMotions: props.runtime.formationMotions,
            frameFormat: props.runtime.frameFormat,
            hasActorContext: props.runtime.hasActorContext,
            jointAxes: props.runtime.jointAxes,
            restFrames: props.runtime.restFrames,
            targetAt: props.runtime.targetAt,
            gaits: props.runtime.gaits,
            blocking: blocked.blocking,
            shotId: props.shot.id,
            previous: blocked.previous,
        });
        if (performed.success === false)
            return {
                success: false,
                diagnostics: performed.violations.map((violation) => fromViolation("performance", "performance-invalid", violation)),
            };
        const motions = Object.values(performed.motions);
        const source = {
            eventSamples: structuredClone(program.eventSamples),
            scene: staged.scene,
            motions,
            shot: performed.shot,
        };
        phase = "contract";
        const measured = realizeShotContract({
            contract: {
                ...props.shot.contract,
                id: props.shot.id,
                source: {
                    module: `<defineShot:${props.shot.id}>`,
                    export: props.shot.id,
                },
            },
            production: null,
            frameFormat: props.runtime.frameFormat,
            world: props.runtime.world ?? null,
            formations: props.runtime.formationDesigns ?? new Map(),
            compiled: {
                ...source,
                models: [...(props.runtime.models ?? [])],
                formations: [...(props.runtime.formations ?? [])],
                // The cues the camera solve read, so the readability grade measures the
                // unit where the camera framed it rather than where it started.
                formationMotions: [...(props.runtime.formationMotions ?? [])],
            },
            skeleton: props.runtime.skeleton,
            collisions: props.runtime.collisions ?? [],
        });
        if (measured.diagnostics.length !== 0)
            return {
                success: false,
                diagnostics: measured.diagnostics.map((diagnostic) => ({
                    code: "contract-realization-failed",
                    phase: "contract",
                    path: diagnostic.path ?? "$shot.contract",
                    fact: diagnostic.message,
                    impact: "Independent scene, motion, event, or camera evidence does not realize the registered shot contract.",
                    recovery: "Correct the authored stage, performance, event sample, or camera named by the fact; do not change contract prose to echo the current output.",
                })),
            };
        phase = "continuity";
        const replantedNodes = new Set(performed.plants.map((entry) => entry.node));
        const continuityProps = {
            beat: props.shot.contract.beat,
            scene: staged.scene,
            shot: performed.shot,
            motions,
            mounts: staged.mounts,
            plants: [
                ...(props.runtime.plants ?? []).filter((entry) => replantedNodes.has(entry.node) === false),
                ...performed.plants,
            ],
        };
        return {
            success: true,
            source,
            continuity: {
                opening: resumeOpeningSnapshot(resolveBeatOpening(continuityProps), blocked.previous),
                closing: resolveBeatEnd(continuityProps),
            },
            realization: measured.realization,
            advice: structuredClone(props.runtime.advice ?? []),
        };
    }
    catch (error) {
        return {
            success: false,
            diagnostics: [
                {
                    code: "pipeline-failed",
                    phase,
                    path: `$${phase}`,
                    fact: `The ${phase} pipeline threw ${errorText(error)}.`,
                    impact: "The public authoring boundary cannot publish a partially measured or partially validated shot.",
                    recovery: "Correct the runtime capability, authored value, or duplicate continuity input named by the fact, then compile the same registered export again.",
                },
            ],
        };
    }
};
/** Keep resumable simulation facts authoritative at the new opening instant. */
const resumeOpeningSnapshot = (opening, previous) => {
    if (previous === null)
        return opening;
    const states = new Map(previous.actors.map((actor) => [actor.node, actor]));
    return {
        ...opening,
        actors: opening.actors.map((actor) => {
            const prior = states.get(actor.node);
            return prior === undefined
                ? actor
                : {
                    ...actor,
                    gaitPhase: prior.gaitPhase,
                    rootVelocity: structuredClone(prior.rootVelocity),
                    footPlants: structuredClone(prior.footPlants),
                    mount: structuredClone(prior.mount),
                };
        }),
    };
};
/** Resume root placement, facing, and persistent mounts before staging. */
const resumeStage = (stage, previous) => {
    const states = new Map(previous.actors.map((actor) => [actor.node, actor]));
    return {
        ...stage,
        actors: stage.actors.map((actor) => {
            const prior = states.get(actor.node);
            return prior === undefined
                ? actor
                : {
                    ...actor,
                    position: structuredClone(prior.transform.translation),
                    facingDeg: (Math.atan2(prior.facing.x, prior.facing.z) * 180) / Math.PI,
                    attach: prior.mount === null ? undefined : structuredClone(prior.mount),
                };
        }),
    };
};
/** Carry prior articulation onto the resumed scene's opening frame. */
const resumePoses = (staged, previous) => {
    if (previous === null)
        return staged;
    const states = new Map(previous.actors.map((actor) => [actor.node, actor]));
    return {
        ...staged,
        scene: {
            ...staged.scene,
            nodes: staged.scene.nodes.map((node) => {
                const pose = states.get(node.id)?.pose;
                return pose === undefined
                    ? node
                    : { ...node, pose: structuredClone(pose) };
            }),
        },
    };
};
const validateAdvice = (advice) => {
    const diagnostics = [];
    const ids = new Map();
    advice.forEach((item, index) => {
        const path = `$runtime.advice[${index}]`;
        const first = ids.get(item.id);
        if (item.id.trim().length === 0 || first !== undefined)
            diagnostics.push({
                code: "contract-mismatch",
                phase: "performance",
                path: `${path}.id`,
                fact: first === undefined
                    ? "The physics-advice id is blank."
                    : `Physics-advice id "${item.id}" duplicates ${`$runtime.advice[${first}].id`}.`,
                impact: "The selected D010 decision cannot be audited against one stable proposal.",
                recovery: "Give every advice item one non-blank id that is unique in this shot.",
            });
        else
            ids.set(item.id, index);
        const rationaleValid = typeof item.rationale === "string" && item.rationale.trim().length !== 0;
        const proposalEqualsSelected = item.selected !== null &&
            JSON.stringify(canonicalAdviceValue(item.proposal)) ===
                JSON.stringify(canonicalAdviceValue(item.selected));
        const valid = item.decision === null
            ? item.selected === null && item.rationale === null
            : item.decision === "accepted"
                ? item.selected !== null && proposalEqualsSelected && rationaleValid
                : item.decision === "modified"
                    ? item.selected !== null &&
                        proposalEqualsSelected === false &&
                        rationaleValid
                    : item.selected === null && rationaleValid;
        if (valid === false)
            diagnostics.push({
                code: "contract-mismatch",
                phase: "performance",
                path,
                fact: `D010 advice "${item.id}" has decision ${JSON.stringify(item.decision)}, selected ${item.selected === null ? "null" : "response data"}, and rationale ${JSON.stringify(item.rationale)}.`,
                impact: "The artifact cannot distinguish an unchanged proposal, an authored replacement, and a rejected physical suggestion.",
                recovery: "Keep pending selected/rationale null; copy proposal into selected for accepted; provide a different selected response for modified; or keep selected null for rejected. Every decided item needs a non-blank rationale.",
            });
    });
    return diagnostics;
};
/** Compare response data by value rather than source object key insertion order. */
const canonicalAdviceValue = (value) => {
    if (Array.isArray(value))
        return value.map(canonicalAdviceValue);
    if (typeof value !== "object" || value === null)
        return value;
    return Object.fromEntries(Object.keys(value)
        .sort(compareCodeUnits)
        .map((key) => [
        key,
        canonicalAdviceValue(value[key]),
    ]));
};
const validateRegistration = (shot) => {
    const diagnostics = [];
    for (const [path, value, label] of [
        ["$shot.id", shot.id, "shot id"],
        ["$shot.scene", shot.scene, "scene id"],
        ["$shot.contract.beat", shot.contract.beat, "contract beat id"],
    ])
        if (typeof value !== "string" || value.trim().length === 0)
            diagnostics.push({
                code: "registration-invalid",
                phase: "registration",
                path,
                fact: `The ${label} is blank.`,
                impact: "The source export cannot receive a stable registered artifact address.",
                recovery: `Give ${path} one non-blank stable id and keep it identical across source and design references.`,
            });
    return diagnostics;
};
const validateProgramContract = (shot, program) => {
    const diagnostics = [];
    const mismatch = (path, actual, expected, correction) => {
        if (actual === expected)
            return;
        diagnostics.push({
            code: "contract-mismatch",
            phase: "build",
            path,
            fact: `${path} is ${JSON.stringify(actual)} but the registration requires ${JSON.stringify(expected)}.`,
            impact: "The source program would self-certify a different artifact than the registered contract.",
            recovery: correction,
        });
    };
    mismatch("$program.stage.scene.id", program.stage.scene.id, shot.scene, "Make the staged scene id equal the scene declared by defineShot.");
    mismatch("$program.blocking.beat", program.blocking.beat, shot.contract.beat, "Make blocking.beat equal the registered contract beat.");
    mismatch("$program.performance.beat", program.performance.beat, shot.contract.beat, "Make performance.beat equal the registered contract beat.");
    mismatch("$program.blocking.duration", program.blocking.duration, shot.contract.durationSeconds, "Make blocking.duration equal the registered contract duration.");
    mismatch("$program.performance.duration", program.performance.duration, shot.contract.durationSeconds, "Make performance.duration equal the registered contract duration.");
    const stagedActors = new Set(program.stage.actors.map((actor) => actor.node));
    const actorFacts = new Map();
    program.actors.forEach((actor, index) => {
        const path = `$program.actors[${index}]`;
        const first = actorFacts.get(actor.node);
        const invalid = actor.node.trim().length === 0
            ? "node is blank"
            : first !== undefined
                ? `node "${actor.node}" duplicates $program.actors[${first}].node`
                : stagedActors.has(actor.node) === false
                    ? `node "${actor.node}" is absent from stage.actors`
                    : actor.model.trim().length === 0
                        ? "model is blank"
                        : Number.isFinite(actor.speed) === false || actor.speed <= 0
                            ? `speed is ${JSON.stringify(actor.speed)} instead of finite and above zero`
                            : Number.isFinite(actor.eyeHeight) === false ||
                                actor.eyeHeight < 0
                                ? `eyeHeight is ${JSON.stringify(actor.eyeHeight)} instead of finite and non-negative`
                                : null;
        if (invalid === null)
            actorFacts.set(actor.node, index);
        else
            diagnostics.push({
                code: "contract-mismatch",
                phase: "build",
                path,
                fact: `${path} ${invalid}.`,
                impact: "The host cannot bind this thin actor program to one measured staged runtime.",
                recovery: "Use one staged actor node and one non-blank compiler model id, then provide finite positive speed and finite non-negative eye height.",
            });
    });
    const samples = new Map();
    program.eventSamples.forEach((sample, index) => {
        if (samples.has(sample.id))
            diagnostics.push({
                code: "contract-mismatch",
                phase: "build",
                path: `$program.eventSamples[${index}].id`,
                fact: `Event sample "${sample.id}" is duplicated.`,
                impact: "A declared semantic event would have more than one claimed authority time.",
                recovery: "Return exactly one independently chosen sample for each registered event id.",
            });
        samples.set(sample.id, sample.time);
    });
    shot.contract.events.forEach((event) => {
        const time = samples.get(event.id);
        if (time === undefined ||
            Number.isFinite(time) === false ||
            time < event.window.from ||
            time > event.window.to)
            diagnostics.push({
                code: "contract-mismatch",
                phase: "build",
                path: "$program.eventSamples",
                fact: time === undefined
                    ? `Event "${event.id}" has no sample.`
                    : `Event "${event.id}" is sampled at ${time}s outside ${event.window.from}..${event.window.to}s.`,
                impact: "The engine cannot independently measure the event inside its authoritative window.",
                recovery: `Return one finite "${event.id}" sample inside its registered event window.`,
            });
    });
    for (const id of samples.keys())
        if (shot.contract.events.some((event) => event.id === id) === false)
            diagnostics.push({
                code: "contract-mismatch",
                phase: "build",
                path: "$program.eventSamples",
                fact: `Event sample "${id}" is not declared by the registered contract.`,
                impact: "Source output would invent an event instead of realizing an authoritative requirement.",
                recovery: "Remove the sample or add the intended measurable event to defineShot's contract.",
            });
    return diagnostics;
};
const fromViolation = (phase, code, violation) => ({
    code,
    phase,
    path: violation.path,
    fact: `${violation.expected}; received ${JSON.stringify(violation.value)}.`,
    impact: `The ${phase} gate cannot emit a trustworthy registered shot while this constraint is unsatisfied.`,
    recovery: `Correct ${violation.path} according to the stated bound, then compile the same registered export again.`,
    violation,
});
const errorText = (error) => error instanceof Error ? `${error.name}: ${error.message}` : String(error);
//# sourceMappingURL=defineShot.js.map