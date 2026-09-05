import {
  builtEnvironmentBuildingCensus,
  builtEnvironmentDescendantSpaces,
  builtSpaceObservationStations,
} from "@automovie/engine";
import type {
  AutoMovieLibraryObservationRole,
  IAutoMovieBuiltEnvironment,
  IAutoMovieDiagnostic,
  IAutoMovieEnvironmentContext,
  IAutoMovieLibraryRequiredObservation,
  IAutoMovieLibraryReviewObservationReceipt,
  IAutoMovieLibraryReviewWaiver,
} from "@automovie/interface";

import { compareCodeUnits } from "./contentIdentity";

/** Stable compiled subject address of one building unit aggregate. */
const buildingSubject = (environment: string, unit: string): string =>
  `building:${environment}/${unit}`;

/** Stable compiled subject address of one adopted environment context. */
const mapSubject = (context: string): string => `map:${context}`;

/** Stable compiled subject address of one operable opening. */
const operationSubject = (environment: string, opening: string): string =>
  `operation:${environment}/${opening}`;

/** Stable compiled subject address of one placed instance population. */
const instanceSubject = (environment: string, set: string): string =>
  `instance:${environment}/${set}`;

/**
 * Which building unit each logical space belongs to.
 *
 * Four derivations below attribute their subject through this map: an instance
 * set to the building whose space holds it, an opening through its boundary, a
 * material through the element that wears it, and a connector through its
 * landings. Separate copies of one rule are separate chances for them to
 * disagree about who owns a space, and an owner is what a review is counted
 * per, so the disagreement would be silent and would land in the denominator.
 */
const spaceOwners = (
  environment: IAutoMovieBuiltEnvironment,
): ReadonlyMap<string, string> => {
  const owners = new Map<string, string>();
  for (const building of environment.buildings)
    for (const space of builtEnvironmentDescendantSpaces(
      environment,
      building.space,
    ))
      owners.set(space, building.id);
  return owners;
};

/** Stable compiled subject address of one circulation connector. */
const serviceSubject = (environment: string, connector: string): string =>
  `service:${environment}/${connector}`;

/** Stable compiled subject address of one material as one model wears it. */
const materialSubject = (
  environment: string,
  model: string,
  material: string,
): string => `material:${environment}/${model}/${material}`;

/** Stable compiled subject address of one logical space. */
const spaceSubject = (environment: string, space: string): string =>
  `space:${environment}/${space}`;

const sameVector = (
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): boolean => left.x === right.x && left.y === right.y && left.z === right.z;

/** Which observation role one derived interior station answers. */
const stationRole = (
  role: "center" | "corner" | "threshold",
): AutoMovieLibraryObservationRole =>
  role === "center"
    ? "interior-center"
    : role === "corner"
      ? "interior-corner"
      : "interior-threshold";

/**
 * The closed observation population one library owner's topology requires.
 *
 * A building is not a bounded object and cannot be closed by a fixed count of
 * pictures. What closes it is its own envelope: one elevation for every exposed
 * facade, one perspective for every corner those elevations meet at, one view
 * of every exposed roof and underside, one of every opening cut through it, and
 * one of the whole unit in its setting, which no elevation gives. Every room
 * then answers for itself from inside itself, because one representative
 * interior says nothing about its siblings.
 *
 * The result is a pure function of the compiled record. A caller may add its own
 * questions to a plan and may never remove one of these, which is the property
 * that makes a completeness claim mean anything: an owner covered by a few
 * flattering angles fails here rather than reading complete.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Derives the required observation population from compiled topology rather than from the author.
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Gives a library space owner a denominator its plan cannot shrink.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Implements the envelope, corner, entrance, and interior-station derivation the viewpoint plan states.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Supplies the derived half of the library delivery denominator the review gate closes.
 * @author Samchon
 */
export const autoMovieLibraryObservationRequirements = (
  environments: readonly IAutoMovieBuiltEnvironment[],
  contexts: readonly IAutoMovieEnvironmentContext[] = [],
): IAutoMovieLibraryRequiredObservation[] => {
  const required: IAutoMovieLibraryRequiredObservation[] = [];
  // One per adopted world, before the buildings standing in it. A map owner
  // publishes contexts and no environment, so this is the whole of its
  // population; a space owner publishes environments and no context, so this
  // loop runs zero times and charges it nothing.
  for (const context of contexts) {
    const subject = mapSubject(context.id);
    required.push({
      id: `${subject}/datum`,
      role: "map-datum",
      subject,
      building: null,
      // The whole datum, not the north alone. It is the north the work is
      // oriented to and the ground its elevations are measured from, and an
      // origin naming half of it sends a reader to check the half that was
      // right.
      origin: "datum",
      pose: null,
    });
  }
  for (const environment of environments)
    for (const unit of builtEnvironmentBuildingCensus(environment)) {
      const subject = buildingSubject(environment.id, unit.building);
      const exterior = (
        role: AutoMovieLibraryObservationRole,
        origin: string,
      ): void => {
        required.push({
          id: `${subject}/${role}/${origin}`,
          role,
          subject,
          building: unit.building,
          origin,
          pose: null,
        });
      };
      // The setting view is the one exterior observation no elevation gives:
      // an envelope read face by face never says where the work stands.
      required.push({
        id: `${subject}/context`,
        role: "context",
        subject,
        building: unit.building,
        origin: unit.building,
        pose: null,
      });
      for (const face of unit.facades) exterior("facade", face.boundary);
      for (const corner of unit.corners) exterior("corner", corner.id);
      for (const face of unit.roofs) exterior("roof", face.boundary);
      for (const face of unit.undersides) exterior("underside", face.boundary);
      for (const opening of unit.entrances) exterior("entrance", opening);
      for (const space of unit.spaces)
        for (const station of builtSpaceObservationStations(
          environment,
          space,
        )) {
          const address = spaceSubject(environment.id, space);
          required.push({
            id: `${address}/${station.id}`,
            role: stationRole(station.role),
            subject: address,
            building: unit.building,
            origin: station.opening ?? space,
            pose: station.pose === null ? null : { ...station.pose, space },
          });
        }
    }
  // An instance set is judged three ways and no one of them substitutes for
  // another. The population view is the only place density and layout can be
  // wrong; the member view is the only one close enough to judge the prototype
  // being repeated; and the contact view is the only one that shows an instance
  // meeting the surface it stands on, which is where a set that floats or sinks
  // gives itself away.
  //
  // The set is attributed to the building whose space holds it, because a
  // review is counted per owner and a population standing in no building's
  // space belongs to the environment rather than to a unit. Those are skipped
  // here rather than invented: attaching them to an arbitrary unit would make
  // one owner answer for placement it does not own.
  for (const environment of environments) {
    const buildingOfSpace = spaceOwners(environment);
    for (const population of environment.populations ?? []) {
      const building = buildingOfSpace.get(population.space);
      if (building === undefined) continue;
      const subject = instanceSubject(environment.id, population.set.id);
      for (const role of [
        "instance-population",
        "instance-member",
        "instance-contact",
      ] as const)
        required.push({
          id: `${subject}/${role}`,
          role,
          subject,
          building,
          origin: population.space,
          // Every instance observation is framed from the set's own placed
          // extent, the way an exterior building view is framed from the
          // envelope. What is fixed here is which question must be opened, not
          // where the eye stands to answer it.
          pose: null,
        });
    }
  }
  // An opening that operates is judged in its own states, in the travel between
  // them, and where its leaf meets its frame. A still frame answers none of the
  // three alone: a door photographed open and closed proves nothing about the
  // arc between, and one photographed only mid-swing never says it shuts.
  //
  // The transitions are the adjacent pairs of the declared state order, not
  // every combination. An opening declares its states in the order it passes
  // through them, so the pairs are the travels that exist; charging every pair
  // would ask for a swing from closed to closed and read as thoroughness.
  //
  // A fixed cut -- an arch, a permanently open passage -- declares no
  // operation, and it is passed over rather than charged an empty state.
  //
  // Which building answers for an opening is read from the boundary it is cut
  // through, not from the building's entrance list. Entrances are the envelope
  // openings, so attributing by entrance charged the front door and silently
  // charged nothing for every interior door, hatch and shutter in the building
  // -- which in a house is most of them. A boundary names the space it encloses
  // or the two it separates, and every building that owns one of those spaces
  // owes its own view.
  for (const environment of environments) {
    const buildingOfSpace = spaceOwners(environment);
    const boundariesById = new Map(
      environment.boundaries.map((boundary) => [boundary.id, boundary]),
    );
    for (const opening of environment.openings) {
      const operation = opening.operation;
      if (operation === undefined) continue;
      const buildings = [
        ...new Set(
          (boundariesById.get(opening.boundary)?.spaces ?? [])
            .map((space) => buildingOfSpace.get(space))
            .filter((owner): owner is string => owner !== undefined),
        ),
      ];
      // A boundary bounding no building's space -- a site gate, a freestanding
      // screen -- belongs to the environment rather than to a unit, and
      // attaching it to an arbitrary one would make that owner answer for a
      // thing it does not contain.
      if (buildings.length === 0) continue;
      const subject = operationSubject(environment.id, opening.id);
      for (const building of buildings) {
        const push = (
          role: AutoMovieLibraryObservationRole,
          origin: string,
        ): void => {
          required.push({
            id: `${subject}/${building}/${role}/${origin}`,
            role,
            subject,
            building,
            origin,
            // An operation is framed from the opening's own extent, the way an
            // exterior building view is framed from the envelope. What is fixed
            // here is which travel must be opened, not where the eye stands.
            pose: null,
          });
        };
        for (const state of operation.states) push("operation-state", state.id);
        for (let index = 1; index < operation.states.length; index += 1)
          push(
            "operation-transition",
            `${operation.states[index - 1]!.id}->${operation.states[index]!.id}`,
          );
        for (const panel of operation.panels)
          push("operation-contact", panel.id);
      }
    }
  }
  // A material is reached the way anything else in a building is reached: an
  // element stands in a space, the space belongs to a unit, and the element
  // wears a model whose materials are the surfaces that unit shows. A model
  // published but placed in no building is skipped rather than attributed to an
  // arbitrary unit, exactly as a population standing in no building's space is.
  //
  // What each material owes is read off its own declaration rather than fixed
  // in advance, so a flat opaque panel owes one observation and a lit glass
  // pane wearing three maps owes six. A fixed set would either charge the panel
  // for views that show nothing or let the pane pass on views nobody took.
  for (const environment of environments) {
    const modelsById = new Map(
      environment.models.map((model) => [model.id, model]),
    );
    const buildingOfSpace = spaceOwners(environment);
    const seen = new Set<string>();
    for (const element of environment.elements) {
      if (element.model === null || element.space === null) continue;
      const building = buildingOfSpace.get(element.space);
      // An element may cite a runtime model this record does not own -- that is
      // what `modelReferences` is for, and the validator accepts it. Its
      // materials are not here to be named, so nothing is derived for it. That
      // is a skip rather than a gap: charging an observation for a surface this
      // record cannot describe would invent the surface.
      const model = modelsById.get(element.model);
      if (building === undefined || model === undefined) continue;
      for (const material of model.materials) {
        const subject = materialSubject(environment.id, model.id, material.id);
        // One material worn by many elements of one building is one surface to
        // look at, not one per element. Charging it per placement would inflate
        // the denominator with repeats of the same answer.
        if (seen.has(`${building}\0${subject}`)) continue;
        seen.add(`${building}\0${subject}`);
        const push = (
          role: AutoMovieLibraryObservationRole,
          origin: string,
        ): void => {
          required.push({
            id: `${subject}/${role}/${origin}`,
            role,
            subject,
            building,
            origin,
            // A material is a surface rather than a room, so there is no
            // interior eye to prove. The framing comes from the element that
            // wears it, which the subject address already names.
            pose: null,
          });
        };
        push("material-response", material.id);
        if (material.emissive !== null) push("material-emission", material.id);
        if (material.opacity < 1) push("material-transmission", material.id);
        for (const [map, binding] of [
          ["baseColor", material.baseColorTexture],
          ["emissive", material.emissiveTexture ?? null],
          ["metallicRoughness", material.metallicRoughnessTexture ?? null],
          ["normal", material.normalTexture ?? null],
          ["occlusion", material.occlusionTexture ?? null],
        ] as const)
          if (binding !== null) push("material-texture", map);
      }
    }
  }
  // A connector is the systems branch's own coupled subject. It is judged the
  // way an opening is -- each state, each adjacency between them, each moving
  // part -- with one addition that has no analogue there. A landing is where a
  // carriage meets a floor, and that is the failure neither a route drawing nor
  // a state still can show: a lift whose car stops a step below the slab is
  // correct in every state and wrong at every landing.
  //
  // A connector declaring no operation is a stair. It has no states and no
  // carriages and it still owes its landings, because the step a stair lands on
  // is the same question.
  //
  // Which building answers for it is the census's answer, not a second rule
  // here: a unit lists the connectors that stop in its own spaces, counting
  // every landing rather than only the two ends. A connector serving two
  // buildings is therefore owed by both, which is right -- each is served by it
  // -- and one that stops in no building's space is listed by no unit and so is
  // skipped, exactly as a population standing nowhere already was.
  for (const environment of environments) {
    const census = builtEnvironmentBuildingCensus(environment);
    const buildingOfSpace = spaceOwners(environment);
    // Read connector-first so every building that lists it is reached without
    // a lookup that could miss. A census unit lists ids drawn from this same
    // array, so a lookup by id could never fail here, and a guard for that
    // would be a branch no run can take.
    for (const connector of environment.connectors)
      for (const unit of census.filter((entry) =>
        entry.connectors.includes(connector.id),
      )) {
        const subject = serviceSubject(environment.id, connector.id);
        const push = (
          role: AutoMovieLibraryObservationRole,
          origin: string,
        ): void => {
          required.push({
            id: `${subject}/${unit.building}/${role}/${origin}`,
            role,
            subject,
            building: unit.building,
            origin,
            // What is fixed here is which landing or travel must be opened, not
            // where the eye stands.
            pose: null,
          });
        };
        // A connector that names its landings is answered at each of them. One
        // that names none still joins two spaces, and those two ends are the
        // landings it has.
        //
        // A landing is addressed by its space and its height together, because
        // a lift serving one atrium at three levels lands three times in the
        // same space and the space alone would name one observation for all
        // three -- the two upper landings would vanish into the lower one and
        // the review would read complete having looked at one floor.
        const landings = (
          connector.landings === undefined || connector.landings.length === 0
            ? // With no landings declared there is nothing to tell one end from
              // the other by, and a connector may join a space to itself, so
              // the end is named by which end it is.
              [
                { space: connector.from, origin: `${connector.from}@from` },
                { space: connector.to, origin: `${connector.to}@to` },
              ]
            : connector.landings.map((landing) => ({
                space: landing.space,
                origin: `${landing.space}@${landing.at}`,
              }))
        ).filter(
          (landing) => buildingOfSpace.get(landing.space) === unit.building,
        );
        for (const landing of landings) push("service-landing", landing.origin);
        const operation = connector.operation;
        if (operation === undefined) continue;
        for (const state of operation.states) push("service-state", state.id);
        for (let index = 1; index < operation.states.length; index += 1)
          push(
            "service-transition",
            `${operation.states[index - 1]!.id}->${operation.states[index]!.id}`,
          );
        for (const carriage of operation.carriages)
          push("service-carriage", carriage.id);
      }
  }
  return required.sort((left, right) => compareCodeUnits(left.id, right.id));
};

/** One review-phase refusal at an exact library observation address. */
const refuse = (props: {
  target: string;
  path: string | null;
  message: string;
}): IAutoMovieDiagnostic => ({
  code: "review-evidence-missing",
  category: "error",
  phase: "review",
  target: props.target,
  path: props.path,
  message: props.message,
});

/**
 * Refuse a library owner whose plan does not close its own derived population.
 *
 * Every refusal here names its own address, because a completeness gate that
 * reports one aggregate number tells a reader that something is wrong and never
 * which thing. A required observation the plan neither opens nor waives is the
 * shrunk plan the derivation exists to catch. Six more cover the ways an excuse
 * becomes a deletion with a sentence in front of it: a waiver over something the
 * topology does not require, two waivers over one observation, a waiver pointing
 * at itself, a waiver pointing at an observation the topology does not require,
 * a waiver pointing at one the plan never opens, and a waiver stating no
 * reason.
 *
 * An interior observation whose camera could not be placed inside its own space
 * is refused rather than dropped. That is the wrong-room failure stated at its
 * source: a room whose stated volume admits no eye cannot be observed from
 * inside, and a sweep that circled it from outside would answer a different
 * question while carrying this observation's id.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Refuses a plan that removes a derived viewpoint or excuses one without an addressed ground.
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Closes the derived population against the finite plan the owner declares.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Enforces that a caller may add to the derived population and never shrink it.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Contributes the derived-population refusals to the library review gate.
 * @author Samchon
 */
export const libraryObservationClosureDiagnostics = (props: {
  /** Stable `library:<branch>:<document>#<anchor>` owner address. */
  target: string;
  /** Adjacent plan path named by every refusal, or null. */
  path: string | null;
  /** Observations the compiled topology requires of this owner. */
  required: readonly IAutoMovieLibraryRequiredObservation[];
  /** Observation ids the plan actually declares. */
  declared: readonly string[];
  /** Addressed excuses the plan carries. */
  waivers: readonly IAutoMovieLibraryReviewWaiver[];
}): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const declared = new Set(props.declared);
  const requiredById = new Map(
    props.required.map((entry) => [entry.id, entry] as const),
  );
  const waivedCounts = new Map<string, number>();
  for (const waiver of props.waivers)
    waivedCounts.set(
      waiver.observation,
      (waivedCounts.get(waiver.observation) ?? 0) + 1,
    );

  for (const waiver of props.waivers) {
    const address = `${props.target}:${waiver.observation}`;
    if (requiredById.has(waiver.observation) === false) {
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation waiver names "${waiver.observation}", which this owner's compiled topology does not require. Remove the waiver or correct the id; excusing something nothing asked for hides which observation was actually dropped.`,
        }),
      );
      continue;
    }
    if (waivedCounts.get(waiver.observation) !== 1) {
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation "${waiver.observation}" carries ${waivedCounts.get(waiver.observation)} waivers. Keep one addressed excuse per observation so review reads one ground rather than choosing between them.`,
        }),
      );
      continue;
    }
    if (waiver.disclosedBy === waiver.observation) {
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation waiver for "${waiver.observation}" names itself as the observation that discloses it. Name the other required observation whose image shows the same form.`,
        }),
      );
      continue;
    }
    if (requiredById.has(waiver.disclosedBy) === false) {
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation waiver for "${waiver.observation}" is disclosed by "${waiver.disclosedBy}", which this owner's compiled topology does not require. A waiver may only defer to another observation the same topology charges for.`,
        }),
      );
      continue;
    }
    if (declared.has(waiver.disclosedBy) === false) {
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation waiver for "${waiver.observation}" is disclosed by "${waiver.disclosedBy}", which this plan does not declare. An excuse that defers to an observation nobody opens excuses both of them.`,
        }),
      );
      continue;
    }
    if (waiver.reason.trim().length === 0)
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation waiver for "${waiver.observation}" states no reason. Write the concrete fact that makes ${JSON.stringify(waiver.ground)} true of this subject; a ground with no fact behind it is a deletion with a word in front of it.`,
        }),
      );
  }

  for (const entry of props.required) {
    const address = `${props.target}:${entry.id}`;
    if (declared.has(entry.id) === false) {
      if ((waivedCounts.get(entry.id) ?? 0) === 0)
        diagnostics.push(
          refuse({
            target: address,
            path: props.path,
            message: `Library design owner "${props.target}" owes ${entry.role} observation "${entry.id}", derived from ${JSON.stringify(entry.origin)} of compiled subject "${entry.subject}"${entry.building === null ? "" : ` in building "${entry.building}"`}. Declare it or record an addressed waiver; the plan may add observations to the derived population and may never remove one.`,
          }),
        );
      continue;
    }
    if (entry.pose === null && entry.role.startsWith("interior-"))
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation "${entry.id}" is an interior view of "${entry.subject}", and no eye could be placed inside that space's own stated volume. Correct the space's cells or shell so the observation can be taken from inside the room; a camera outside it photographs the far side of its walls.`,
        }),
      );
  }
  return diagnostics;
};

/**
 * Refuse a receipt that does not say where it stood or what it read.
 *
 * The closure gate above judges the plan: which observations an owner owes and
 * which it opens. This judges what came back. A receipt names the observation
 * it pays and carries bytes, and until it carries a pose it never says the
 * bytes were drawn from the place the observation is about: an interior view
 * taken from the corridor outside is indistinguishable from one taken inside
 * the room, and being inside the room is the entire claim that observation
 * makes.
 *
 * Each refusal names its own address.
 *
 * An interior receipt with no pose is the one that matters: it is the shape
 * every receipt had before this gate existed, and reading it as "anywhere" is
 * how a sweep that circled a building from outside pays for its rooms.
 *
 * A receipt whose pose stands in a different space than the requirement proved
 * is the same failure wearing a coordinate: the eye was somewhere, and not
 * where the topology said an eye could stand for this question.
 *
 * A passed receipt carrying no measurement at all is a photograph with a
 * verdict attached. Empty is legitimate: some observations answer with the
 * picture alone, so this refuses only the pair the plan itself declared
 * measurable, which is why the requirement's own role decides rather than a
 * blanket count.
 *
 * An exterior observation supplies no authored eye, and every measurement has
 * a nonblank name and finite value. These are checked again here because a
 * tracked plan may be edited without the command that normally parses them.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Binds a paid observation to the place it was drawn from.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Makes a receipt state its own viewpoint rather than inherit the requirement's.
 * @author Samchon
 */
export const libraryObservationReceiptDiagnostics = (props: {
  /** Stable `library:<branch>:<document>#<anchor>` owner address. */
  target: string;
  /** Adjacent plan path named by every refusal, or null. */
  path: string | null;
  /** Observations the compiled topology requires of this owner. */
  required: readonly IAutoMovieLibraryRequiredObservation[];
  /** Receipts the plan carries for this owner. */
  receipts: readonly IAutoMovieLibraryReviewObservationReceipt[];
}): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const requiredById = new Map(
    props.required.map((entry) => [entry.id, entry] as const),
  );
  for (const receipt of props.receipts) {
    const requirement = requiredById.get(receipt.observation);
    if (requirement === undefined) continue;
    const address = `${props.target}:${receipt.observation}`;
    const interior = requirement.role.startsWith("interior-");
    if (interior === false && receipt.pose !== null) {
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation receipt for "${receipt.observation}" supplies a camera pose for "${requirement.subject}", whose required observation is framed from the subject's own extent. Record null rather than an unrelated authored eye.`,
        }),
      );
      continue;
    }
    if (interior && receipt.pose === null) {
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation receipt for "${receipt.observation}" is an interior view of "${requirement.subject}" and states no camera pose, so nothing says the eye stood inside the space rather than outside it. Record the pose the instrument actually used.`,
        }),
      );
      continue;
    }
    if (
      interior &&
      requirement.pose !== null &&
      receipt.pose !== null &&
      receipt.pose.space !== requirement.pose.space
    ) {
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation receipt for "${receipt.observation}" was drawn from space "${String(receipt.pose.space)}" where the topology proved an eye for "${String(requirement.pose.space)}". One room's interior says nothing about its siblings.`,
        }),
      );
      continue;
    }
    if (
      interior &&
      requirement.pose !== null &&
      receipt.pose !== null &&
      (sameVector(receipt.pose.position, requirement.pose.position) === false ||
        sameVector(receipt.pose.direction, requirement.pose.direction) ===
          false ||
        sameVector(receipt.pose.target, requirement.pose.target) === false)
    ) {
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation receipt for "${receipt.observation}" does not match the topology-derived camera pose for "${requirement.subject}". Record the exact position, direction and target the required observation used.`,
        }),
      );
      continue;
    }
    if (
      receipt.verdict === "passed" &&
      requirement.role === "interior-threshold" &&
      Object.keys(receipt.measurements).length === 0
    )
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation receipt for "${receipt.observation}" passed a threshold observation of "${requirement.subject}" without reading a single measurement, so the receipt is a picture with a verdict attached. A threshold is measured, not merely looked at.`,
        }),
      );
    const invalidMeasurement = Object.entries(receipt.measurements).find(
      ([name, value]) =>
        name.trim() !== name || name === "" || Number.isFinite(value) === false,
    );
    if (invalidMeasurement !== undefined)
      diagnostics.push(
        refuse({
          target: address,
          path: props.path,
          message: `Library observation receipt for "${receipt.observation}" carries invalid measurement ${JSON.stringify(invalidMeasurement[0])}. Measurement names must be nonblank and values must be finite numbers.`,
        }),
      );
  }
  return diagnostics;
};
