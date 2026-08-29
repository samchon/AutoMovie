import {
  builtEnvironmentBuildingCensus,
  builtSpaceObservationStations,
} from "@automovie/engine";
import type {
  AutoMovieLibraryObservationRole,
  IAutoMovieBuiltEnvironment,
  IAutoMovieDiagnostic,
  IAutoMovieLibraryRequiredObservation,
  IAutoMovieLibraryReviewWaiver,
} from "@automovie/interface";

import { compareCodeUnits } from "./contentIdentity";

/** Stable compiled subject address of one building unit aggregate. */
const buildingSubject = (environment: string, unit: string): string =>
  `building:${environment}/${unit}`;

/** Stable compiled subject address of one logical space. */
const spaceSubject = (environment: string, space: string): string =>
  `space:${environment}/${space}`;

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
): IAutoMovieLibraryRequiredObservation[] => {
  const required: IAutoMovieLibraryRequiredObservation[] = [];
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
            message: `Library design owner "${props.target}" owes ${entry.role} observation "${entry.id}", derived from ${JSON.stringify(entry.origin)} of compiled subject "${entry.subject}". Declare it or record an addressed waiver; the plan may add observations to the derived population and may never remove one.`,
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
