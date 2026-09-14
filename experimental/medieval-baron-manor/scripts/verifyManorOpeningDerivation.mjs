import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  builtEnvironmentElementPartBounds,
  builtOpeningPanelPlacements,
  validateBuiltEnvironment,
} from "@automovie/engine";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { createManorScene } from "../src/models/manor.js";

// Compare the registered derivation with the current source's rendered default
// transforms and complete leaf geometry. This is structural evidence, not an
// image observation or a production-completion verdict.
const artifactPath = "automovie/derived/manor/environment-v24-critical.json";
const bytes = readFileSync(artifactPath);
const environment = JSON.parse(bytes).environments[0];
const inventory = JSON.parse(readFileSync("automovie/derived/manor/instances-v23-critical.json", "utf8"));
const source = createManorScene({ geometryOnly: true });
// The artifact is JSON: compare both sides at that same serialization boundary
// (JSON represents IEEE negative zero as zero).
const jsonDigest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const expectedOpenings = source.boundaries.flatMap(boundary => boundary.openings);
assert.equal(environment.openings.length, expectedOpenings.length);
const validation = validateBuiltEnvironment({ environment });
assert.equal(validation.success, true, JSON.stringify(validation));

const close = (actual, expected, label) => {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9,
    `${label}: ${actual} differs from ${expected}`);
};
const quaternion = (actual, expected, label) => {
  const dot = actual.x * expected.x + actual.y * expected.y + actual.z * expected.z + actual.w * expected.w;
  close(Math.abs(dot), 1, label);
};
const matrix = transform => new Matrix4().compose(
  new Vector3(transform.translation.x, transform.translation.y, transform.translation.z),
  new Quaternion(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w),
  new Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
);
// Independent Three composition from the source author's rest frame and axis,
// not from the derived environment's element transform or the API under test.
const expectedPlacement = (entry, value) => {
  let world;
  if (entry.pose) {
    world = new Matrix4().compose(new Vector3(...entry.pose.pivot),
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), entry.pose.closedAngle + value), new Vector3(1, 1, 1));
  } else {
    const { rest, motion, relativeToParent } = entry.articulation;
    assert.ok(!relativeToParent, "Opening-panel oracle needs an explicit parent-state input for " + entry.id);
    const axis = new Vector3(motion.axis.x, motion.axis.y, motion.axis.z);
    if (motion.kind === "revolute") {
      const pivot = new Vector3(motion.pivot.x, motion.pivot.y, motion.pivot.z);
      const delta = new Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z)
        .multiply(new Matrix4().makeRotationAxis(axis, value))
        .multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
      world = matrix(rest).multiply(delta);
    } else world = matrix(rest).multiply(new Matrix4().makeTranslation(axis.x * value, axis.y * value, axis.z * value));
  }
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  world.decompose(position, rotation, scale);
  return { position, rotation, scale };
};
const comparePlacement = (actual, expected, label) => {
  for (const field of ["position", "scale"]) for (const axis of ["x", "y", "z"])
    close(actual[field][axis], expected[field][axis], `${label}.${field}.${axis}`);
  quaternion(actual.rotation, expected.rotation, `${label}.rotation`);
};
let panels = 0, states = 0, independentlyComparedPlacements = 0, intermediateStates = 0;
for (const expected of expectedOpenings) {
  const opening = environment.openings.find(item => item.id === expected.id);
  assert.ok(opening, `Missing opening ${expected.id}`);
  assert.ok(opening.fill !== null, `Missing fill ${opening.id}`);
  assert.deepEqual(opening.operation, expected.operation, `Lost operation ${opening.id}`);
  assert.ok(opening.operation?.panels.length, `No panels for ${opening.id}`);
  for (const placement of builtOpeningPanelPlacements(environment, opening.id)) {
    const actualSource = inventory.transforms[placement.element];
    assert.ok(actualSource, `No source default for ${placement.element}`);
    for (const axis of ["x", "y", "z"]) {
      close(placement.position[axis], actualSource.translation[axis], `${placement.element}.position.${axis}`);
      close(placement.scale[axis], actualSource.scale[axis], `${placement.element}.scale.${axis}`);
    }
    quaternion(placement.rotation, actualSource.rotation, `${placement.element}.rotation`);
    const element = environment.elements.find(item => item.id === placement.element);
    const model = environment.models.find(item => item.id === element.model);
    const original = source.entries.find(item => item.id === placement.element).model;
    assert.equal(jsonDigest(model.parts), jsonDigest(original.parts), `Leaf lost geometry ${placement.element}`);
    assert.equal(jsonDigest(model.materials), jsonDigest(original.materials), `Leaf lost materials ${placement.element}`);
    assert.ok(!environment.populations.some(item => item.set.id.startsWith(placement.element + "--")),
      `Moving leaf has world-fixed instances ${placement.element}`);
    panels++;
  }
  for (const state of opening.operation.states) {
    const first = builtOpeningPanelPlacements(environment, opening.id, state.id);
    assert.deepEqual(first, builtOpeningPanelPlacements(environment, opening.id, state.id));
    assert.equal(first.length, opening.operation.panels.length);
    for (const actual of first) {
      const value = state.panels.find(item => item.panel === actual.panel).value;
      comparePlacement(actual, expectedPlacement(source.entries.find(entry => entry.id === actual.element), value), `${opening.id}/${state.id}/${actual.panel}`);
      independentlyComparedPlacements++;
    }
    states++;
  }
  for (const fraction of [0.25, 0.5, 0.75]) {
    const state = { id: "measurement-intermediate", panels: opening.operation.panels.map(panel => ({ panel: panel.id, value: panel.motion.min + fraction * (panel.motion.max - panel.motion.min) })) };
    const probe = { ...environment, openings: environment.openings.map(item => item.id === opening.id ? { ...item, operation: { ...item.operation, states: [...item.operation.states, state] } } : item) };
    for (const actual of builtOpeningPanelPlacements(probe, opening.id, state.id)) {
      const value = state.panels.find(item => item.panel === actual.panel).value;
      comparePlacement(actual, expectedPlacement(source.entries.find(entry => entry.id === actual.element), value), `${opening.id}/${fraction}/${actual.panel}`);
      independentlyComparedPlacements++;
    }
    intermediateStates++;
  }
  assert.throws(() => builtOpeningPanelPlacements(environment, opening.id, "undeclared-state"), /no operating state/);
}

// The two-ended casements must both remain children of the window's fill, and
// the privacy bolt must follow the door in its source-authored current state.
for (const opening of environment.openings.filter(item => item.kind === "window")) {
  assert.equal(opening.operation.panels.length, 2);
  for (const panel of opening.operation.panels)
    assert.equal(environment.elements.find(item => item.id === panel.element).parent, opening.fill);
}
const wash = environment.openings.find(item => item.id === "wash-door");
assert.equal(environment.elements.find(item => item.id === "wash-door-privacy-bolt").parent, wash.fill);
assert.ok(wash.operation.hardware.some(item => item.element === "wash-door-privacy-bolt"));
assert.ok(!wash.operation.panels.some(item => item.element === "wash-door-privacy-bolt"), "A bolt extending into its jamb is hardware, not a void-filling panel");
const bolt = source.entries.find(item => item.id === "wash-door-privacy-bolt");
const actualBoltBounds = builtEnvironmentElementPartBounds(environment, bolt.id);
assert.equal(actualBoltBounds.length, bolt.model.parts.length);
for (const [index, part] of bolt.model.parts.entries()) {
  assert.equal(part.geometry.type, "primitive");
  const shape = part.geometry.shape;
  assert.equal(shape.type, "box");
  const world = matrix(inventory.transforms[bolt.id]).multiply(matrix(part.transform));
  const expectedBounds = new Box3().setFromPoints([-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z =>
    new Vector3(x * shape.width / 2, y * shape.height / 2, z * shape.depth / 2).applyMatrix4(world)))));
  for (const end of ["min", "max"]) for (const axis of ["x", "y", "z"])
    close(actualBoltBounds[index][end][axis], expectedBounds[end][axis], `privacy-bolt.${part.id}.${end}.${axis}`);
}
const invalid = { ...environment, openings: environment.openings.map(opening => opening.id === "hall-door" ? { ...opening, fill: null } : opening) };
const refusal = validateBuiltEnvironment({ environment: invalid });
assert.equal(refusal.success, false, "An operable opening without a filling element was accepted");
assert.ok(refusal.violations.some(item => item.path.includes("openings")), "Refusal did not identify the opening");

console.log(JSON.stringify({
  artifact: artifactPath,
  digest: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
  openings: expectedOpenings.length,
  panels,
  states,
  intermediateStates,
  independentlyComparedPlacements,
  defaultTransformTolerance: 1e-9,
  completeLeafGeometryPreserved: true,
  unknownStateRefused: true,
  missingFillRefused: true,
  hardwareLimit: "The privacy bolt retains its current local pose and follows the door; its independent slide is available in source preview and is not encoded as a void-filling panel.",
  warnings: validation.warnings ?? [],
}, null, 2));
