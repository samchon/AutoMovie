import {
  type AutoMovieDrawingScheduleSubject,
  type IAutoMovieAcousticRequest,
  type IAutoMovieDaylightRequest,
  type IAutoMovieEnvelopeRequest,
  type IAutoMovieSpaceAirRequest,
  type IAutoMovieSubjectContribution,
  analyzeAutoMovieAcoustics,
  analyzeAutoMovieDaylight,
  analyzeAutoMovieEnvelope,
  analyzeAutoMovieSpaceAir,
  autoMovieDrawingToSvg,
  deriveAutoMovieDrawing,
  deriveAutoMovieDrawingSchedule,
  lowerServiceNetwork,
  lowerWetZoneDrainage,
  measureAutoMovieQuantities,
  summarizeAutoMovieAnalysis,
} from "@automovie/engine";
import type {
  AutoMovieAnalysisDomain,
  AutoMovieDrawingProjection,
  IAutoMovieAnalysisReport,
  IAutoMovieAnalysisRun,
  IAutoMovieBuildingUnit,
  IAutoMovieBuiltEnvironment,
  IAutoMovieDrawing,
  IAutoMovieDrawingGap,
  IAutoMovieDrawingSchedule,
  IAutoMovieDrawingStyle,
  IAutoMovieDrawingView,
  IAutoMovieEnvironmentContext,
  IAutoMovieFluidDomain,
  IAutoMovieQuantityReport,
  IAutoMovieServiceNetwork,
  IAutoMovieVector3,
  IAutoMovieWaterFeature,
} from "@automovie/interface";

/**
 * Drawing scale denominator every derived sheet is taken at: `100` means 1:100.
 *
 * A drafting convention rather than a fact about any building, which is why it
 * is a constant of this script and not something read out of the design. Edit
 * it, or add a second sheet at another scale; nothing downstream depends on the
 * number.
 */
export const AUTOMOVIE_BUILDING_SHEET_SCALE = 100;

/**
 * Height of a floor plan's cut plane above the work's own origin, in metres.
 *
 * One height, so the standard set draws one plan per building unit and not one
 * per storey: a tower of four floors cut at 1.2 m is a plan of its ground floor
 * with whatever lies below drawn as projected, exactly as the declared plane
 * says. A work that wants a sheet per storey adds one view per storey with its
 * own height rather than expecting this constant to mean four things.
 */
export const AUTOMOVIE_BUILDING_PLAN_CUT = 1.2;

/** Height of a reflected ceiling plan's cut plane, in metres. */
export const AUTOMOVIE_BUILDING_CEILING_CUT = 2.4;

/**
 * Band above a plan's cut plane that is drawn `overhead` rather than dropped.
 *
 * The dashed convention every floor plan uses: a beam or a mezzanine edge the
 * cut removed is not simply gone.
 */
export const AUTOMOVIE_BUILDING_PLAN_OVERHEAD = 1.5;

/**
 * The pen every derived sheet is drawn with.
 *
 * A fresh object per sheet rather than one shared record, because a view owns
 * its own style and two sheets sharing one mutable weight table is a way for an
 * edit to one page to restyle another.
 *
 * Line weight is the one part of a drawing measured on the paper rather than in
 * the world: a cut wall reads as a cut wall because its stroke is heavy at
 * every scale, and weights in metres would thin out as the scale denominator
 * grew.
 */
export const autoMovieBuildingPen = (): IAutoMovieDrawingStyle => ({
  weights: { cut: 0.5, projected: 0.25, overhead: 0.18, hidden: 0.13 },
  dashes: { cut: [], projected: [], overhead: [3, 2], hidden: [1.5, 1.5] },
  textHeight: 2.5,
});

/**
 * One environmental study this production asks of one logical space.
 *
 * Each is exactly the engine's own request minus the three fields this script
 * owns and the author must not restate: the run's `id`, the `inputRevision` it
 * read, and the site `context` the production declares once. Everything left is
 * the question, and the question is the author's.
 */
export type IAutoMovieDaylightStudy = Omit<
  IAutoMovieDaylightRequest,
  "id" | "inputRevision" | "context"
>;

/** One envelope study, minus the fields this script owns. */
export type IAutoMovieEnvelopeStudy = Omit<
  IAutoMovieEnvelopeRequest,
  "id" | "inputRevision" | "context"
>;

/** One room-acoustic study, minus the fields this script owns. */
export type IAutoMovieAcousticStudy = Omit<
  IAutoMovieAcousticRequest,
  "id" | "inputRevision"
>;

/** One ventilation study, minus the fields this script owns. */
export type IAutoMovieSpaceAirStudy = Omit<
  IAutoMovieSpaceAirRequest,
  "id" | "inputRevision"
>;

/**
 * Every environmental question this production asks, and the domains it
 * requires an answer for.
 *
 * Drawings, schedules and take-offs are questions the design can answer by
 * itself. A performance study is not: a U-value needs a measured thermal
 * conductivity, a reverberation time needs a measured absorption, and a
 * ventilation rate needs a declared supply. This repository ships no material
 * catalogue and no climate data, so those numbers can only come from the
 * production, and a study the production did not declare is reported as
 * `not-run` rather than solved against a number nobody measured.
 */
export interface IAutoMovieBuildingStudies {
  /** Daylight and artificial-light studies, in report order. */
  daylight: readonly IAutoMovieDaylightStudy[];
  /** Envelope studies; each produces one thermal and one moisture run. */
  envelope: readonly IAutoMovieEnvelopeStudy[];
  /** Room-acoustic studies. */
  acoustic: readonly IAutoMovieAcousticStudy[];
  /** Ventilation studies. */
  air: readonly IAutoMovieSpaceAirStudy[];
  /**
   * Domains the production requires an answer for; at least one.
   *
   * A required domain nobody answered is a gap that forces the report to
   * `incomplete`, which is the only thing that stops silence from reading as a
   * pass.
   */
  required: readonly AutoMovieAnalysisDomain[];
}

/**
 * One thing this report could not answer, in the same words its records use.
 *
 * The drawing gap's own shape, aliased rather than restated, because a roll-up
 * spanning sheets, schedules, take-offs, services and studies has to speak one
 * vocabulary or a reader has to learn five. `unsupported` is a derivation that
 * does not exist; `not-run` is one that exists and had no input. Keeping that
 * distinction is what separates "this repository cannot draw a pipe" from "you
 * declared no pipe".
 */
export type IAutoMovieBuildingGap = IAutoMovieDrawingGap;

/** One derived sheet: the question, the answer, and the page a human opens. */
export interface IAutoMovieBuildingSheet {
  /** View that decided the cut, the direction, the filter and the pen. */
  view: IAutoMovieDrawingView;
  /** Everything the design answered when that question was put to it. */
  drawing: IAutoMovieDrawing;
  /** The same drawing as a file a human can open, meaning intact. */
  svg: string;
}

/** One service network's derived installation, and what it could not derive. */
export interface IAutoMovieBuildingServices {
  /** Network this entry answers for. */
  network: string;
  /** Staged pieces the authored runs sweep into. */
  contribution: IAutoMovieSubjectContribution;
  /** Wet zones whose floor water was lowered into a declared fluid domain. */
  drainage: IAutoMovieFluidDomain[];
}

/**
 * Everything one building answers about itself at one design revision.
 *
 * A derived artifact is only evidence about the revision it read, so the
 * revision is carried here rather than left to the file's timestamp.
 */
export interface IAutoMovieBuildingReport {
  /** Report format. */
  version: 1;
  /** Built environment this report is about. */
  environment: string;
  /** Design revision every artifact below was derived from. */
  revision: string;
  /** Derived sheets, one per view of the standard set. */
  sheets: IAutoMovieBuildingSheet[];
  /**
   * The same design counted instead of drawn, one entry per scheduled subject.
   *
   * The room schedule is the one to read for what stands in a given zone. Its
   * membership is the built environment's own declaration rather than a scan of
   * ids, so an author asking what is in a room reads this rather than writing a
   * second index that disagrees with the model.
   */
  schedules: IAutoMovieDrawingSchedule[];
  /** Every quantity the design can answer for, and every one it cannot. */
  quantities: IAutoMovieQuantityReport;
  /** One entry per service network serving this building. */
  services: IAutoMovieBuildingServices[];
  /** Every analysis run submitted for this building, in study order. */
  runs: IAutoMovieAnalysisRun[];
  /**
   * The bounded verdict over those runs, or null when no run was produced.
   *
   * A verdict over nothing would clear everything, so no report is written
   * rather than an empty one. Why there is no run : no study declared, or a
   * declared study whose site the production never stated : is in {@link gaps}.
   */
  analysis: IAutoMovieAnalysisReport | null;
  /**
   * Every gap the artifacts above declared, namespaced by the artifact that
   * declared it.
   *
   * A roll-up rather than a second source: each gap is still carried by the
   * record that produced it. What this list adds is that no reader has to open
   * twelve sheets to discover that none of them drew the pipework.
   */
  gaps: IAutoMovieBuildingGap[];
}

/**
 * A subject list that cannot fall behind the derivation it drives.
 *
 * The declared type is the list itself when the tuple covers every subject the
 * engine counts, and an error tuple naming what is absent when it does not, so
 * a subject added to `AutoMovieDrawingScheduleSubject` fails this assignment
 * rather than being quietly left out of every report a production writes.
 *
 * This is not a hypothetical. The room schedule arrived in the engine while the
 * list below read `["opening", "connector"]`, and nothing said so: the report
 * kept writing, its two schedules kept reconciling, and the derivation an author
 * is told to ask for what stands in each room simply never ran.
 */
type IAutoMovieCompleteScheduleSubjects<
  T extends readonly AutoMovieDrawingScheduleSubject[],
> =
  Exclude<AutoMovieDrawingScheduleSubject, T[number]> extends never
    ? T
    : [
        "schedule subject missing from this report",
        Exclude<AutoMovieDrawingScheduleSubject, T[number]>,
      ];

/**
 * Every subject this report counts, in the order it writes them.
 *
 * The room schedule leads because it is the one a reader opens first: an
 * opening or a connector row answers "what types are there and how many", while
 * a room row answers "what is this zone, how far does it reach, and what stands
 * in it", which is the question somebody walking the building actually has.
 */
export const AUTOMOVIE_BUILDING_SCHEDULE_SUBJECTS: IAutoMovieCompleteScheduleSubjects<
  ["space", "opening", "connector"]
> = ["space", "opening", "connector"];

/**
 * The standard sheet set one building unit is asked for.
 *
 * Four projections are two decisions, not four algorithms: where the cut plane
 * is, and which side of it survives. The plan looks down, the reflected ceiling
 * plan looks up and mirrors the page basis, the section cuts on a vertical
 * plane, and the elevation has no cut at all : one derivation, four
 * conventions.
 *
 * Two of the six are here to be honest rather than to be useful. A services
 * sheet and a finish plan are the two disciplines this derivation cannot
 * actually serve: a service network and a material assembly are separate
 * records from the built environment, and the derivation is handed only the
 * environment. Asking for them anyway is what makes the `service-network` and
 * `material-build-up` gaps appear on a page somebody looks at, instead of
 * leaving an author to discover on site that the discipline label was the only
 * thing that changed.
 */
export const autoMovieBuildingSheetViews = (
  unit: IAutoMovieBuildingUnit,
): IAutoMovieDrawingView[] => {
  /**
   * One sheet of this unit, with every array and every vector its own.
   *
   * A view owns its filter, its dimensions, its notes and its pen, so six
   * sheets sharing one array is a way for an edit to one page to change
   * another. Building each fresh costs nothing and removes the question.
   */
  const view = (props: {
    id: string;
    projection: AutoMovieDrawingProjection;
    discipline: string;
    origin: IAutoMovieVector3;
    direction: IAutoMovieVector3;
    up: IAutoMovieVector3;
    overhead: number | null;
  }): IAutoMovieDrawingView => ({
    ...props,
    scale: AUTOMOVIE_BUILDING_SHEET_SCALE,
    depth: null,
    // Naming the unit's own root space draws every storey, room and void
    // beneath it, so a work of two units is two sheets rather than one page
    // carrying both buildings.
    spaces: [unit.space],
    // Empty draws every kind. A discipline sheet narrows this to the kinds it
    // owns; the two below deliberately do not, because what they would have to
    // filter for is not in this record at all.
    elementKinds: [],
    dimensions: [],
    annotations: [],
    style: autoMovieBuildingPen(),
  });
  // A plan conventionally puts world north up the page. The hint is
  // re-orthogonalized against the view direction, so the nearest cardinal axis
  // is enough and an exact in-plane vector is never needed.
  const north = (): IAutoMovieVector3 => ({ x: 0, y: 0, z: -1 });
  const sky = (): IAutoMovieVector3 => ({ x: 0, y: 1, z: 0 });
  const planCut = (): IAutoMovieVector3 => ({
    x: 0,
    y: AUTOMOVIE_BUILDING_PLAN_CUT,
    z: 0,
  });
  const down = (): IAutoMovieVector3 => ({ x: 0, y: -1, z: 0 });
  const centre = (): IAutoMovieVector3 => ({ x: 0, y: 0, z: 0 });
  return [
    view({
      id: `${unit.id}-plan`,
      projection: "plan",
      discipline: "architectural",
      origin: planCut(),
      direction: down(),
      up: north(),
      overhead: AUTOMOVIE_BUILDING_PLAN_OVERHEAD,
    }),
    view({
      id: `${unit.id}-ceiling`,
      projection: "reflected-ceiling-plan",
      discipline: "architectural",
      origin: { x: 0, y: AUTOMOVIE_BUILDING_CEILING_CUT, z: 0 },
      direction: sky(),
      up: north(),
      overhead: AUTOMOVIE_BUILDING_PLAN_OVERHEAD,
    }),
    view({
      id: `${unit.id}-section`,
      projection: "section",
      discipline: "architectural",
      origin: centre(),
      direction: { x: 1, y: 0, z: 0 },
      up: sky(),
      overhead: null,
    }),
    view({
      id: `${unit.id}-elevation`,
      projection: "elevation",
      discipline: "architectural",
      origin: centre(),
      direction: { x: 0, y: 0, z: 1 },
      up: sky(),
      overhead: null,
    }),
    view({
      id: `${unit.id}-services`,
      projection: "plan",
      discipline: "services",
      origin: planCut(),
      direction: down(),
      up: north(),
      overhead: AUTOMOVIE_BUILDING_PLAN_OVERHEAD,
    }),
    view({
      id: `${unit.id}-finishes`,
      projection: "plan",
      discipline: "finish",
      origin: planCut(),
      direction: down(),
      up: north(),
      overhead: AUTOMOVIE_BUILDING_PLAN_OVERHEAD,
    }),
  ];
};

/**
 * Draw and serialize one view of one design.
 *
 * The two calls belong together because the pen belongs to the view:
 * serializing a drawing with a different view's pen is refused rather than
 * silently restyled, so nothing between them may substitute a second view.
 */
export const autoMovieBuildingSheet = (props: {
  /** Design the sheet is taken from. */
  environment: IAutoMovieBuiltEnvironment;
  /** View that decides the cut, the direction, the filter and the pen. */
  view: IAutoMovieDrawingView;
}): IAutoMovieBuildingSheet => {
  const drawing = deriveAutoMovieDrawing({
    environment: props.environment,
    view: props.view,
  });
  return {
    view: props.view,
    drawing,
    svg: autoMovieDrawingToSvg({ drawing, view: props.view }),
  };
};

/**
 * Lower one network's runs, and drain each wet zone into the water it reaches.
 *
 * The two are separate derivations of one record and neither implies the other.
 * The first sweeps a section along every authored centre line, which is what a
 * clash and a sleeve were measured against. The second turns a wet zone's own
 * supply ports and drains into the sources and sinks of the fluid domain
 * standing in that room, so a floor that falls to a gully composes the water
 * solver instead of inventing a second, weaker account of moving water.
 *
 * A zone whose room holds no declared fluid domain is a stated gap, not a
 * silent skip: the fall, the drain and the membrane are authored and the water
 * they lead to is not.
 */
export const autoMovieBuildingServices = (props: {
  /** Network to lower. */
  network: IAutoMovieServiceNetwork;
  /** Building it serves. */
  environment: IAutoMovieBuiltEnvironment;
  /** Fluid domains this production declares. */
  fluidDomains: readonly IAutoMovieFluidDomain[];
  /** Bindings that make a domain a building's own water feature. */
  waterFeatures: readonly IAutoMovieWaterFeature[];
  /** Sink for wet zones that reached no water. */
  gaps: IAutoMovieBuildingGap[];
}): IAutoMovieBuildingServices => {
  // Lowered before anything reads the zones, because this call is the one that
  // refuses an unsound graph. The drainage lowering answers only for the
  // placement it performs and trusts the graph it was handed, so running it
  // first would report a misplaced gully on a network whose real fault is a
  // dangling port.
  const contribution = lowerServiceNetwork({
    network: props.network,
    environment: props.environment,
  });
  const drainage: IAutoMovieFluidDomain[] = [];
  for (const zone of props.network.zones) {
    const feature = props.waterFeatures.find(
      (candidate) =>
        candidate.environment === props.environment.id &&
        candidate.space === zone.space,
    );
    const domain =
      feature === undefined
        ? undefined
        : props.fluidDomains.find(
            (candidate) => candidate.id === feature.domain,
          );
    if (domain === undefined) {
      props.gaps.push({
        subject: `services:${props.network.id}/wet-zone-drainage/${zone.id}`,
        status: "not-run",
        reason: `wet zone "${zone.id}" falls to its drains in space "${zone.space}", but no water feature binds a fluid domain to that space, so there is no water for the fall to reach`,
        remedy: `declare a fluid domain and a water feature in space "${zone.space}", or read the zone's fall and membrane as a construction claim with no simulated water behind it`,
      });
      continue;
    }
    drainage.push(
      lowerWetZoneDrainage({
        network: props.network,
        zone: zone.id,
        domain,
      }),
    );
  }
  return { network: props.network.id, contribution, drainage };
};

/**
 * Run every declared study against one building, and roll the answers up.
 *
 * The site is read once and handed to every study that needs it, because two
 * studies of one building measured against two sites would be two buildings. A
 * production that declares no site runs no analysis at all and says so: the sun
 * direction, the sky illuminance and the outdoor air are inputs this repository
 * does not invent, and a daylight number produced without them would be
 * indistinguishable from one that was measured.
 *
 * Each run is identified by the building, the domain and the study's position,
 * so the same production re-derived at the same revision produces the same run
 * ids and therefore the same bytes.
 */
export const autoMovieBuildingAnalysis = (props: {
  /** Building the studies are about. */
  environment: IAutoMovieBuiltEnvironment;
  /** Design revision the studies read. */
  revision: string;
  /** Read-only site, or null when the production declares none. */
  context: IAutoMovieEnvironmentContext | null;
  /** Studies the production asks for. */
  studies: IAutoMovieBuildingStudies;
  /** Sink for the "no site" gap. */
  gaps: IAutoMovieBuildingGap[];
}): {
  runs: IAutoMovieAnalysisRun[];
  report: IAutoMovieAnalysisReport | null;
} => {
  const runs: IAutoMovieAnalysisRun[] = [];
  const identity = (domain: string, index: number): string =>
    `${props.environment.id}.${domain}.${index}`;
  const sited = props.studies.daylight.length + props.studies.envelope.length;
  const declared =
    sited + props.studies.acoustic.length + props.studies.air.length;

  if (props.context === null) {
    if (sited !== 0)
      props.gaps.push({
        subject: "analysis/environment-context",
        status: "not-run",
        reason: `${sited} declared daylight or envelope study/studies read the site, and the production design carries no environmentContext, so no sun, sky, reference ground or outdoor air was supplied to measure them against`,
        remedy:
          "declare environmentContext on the production design with the instants this film wants answered, then derive again",
      });
  } else {
    const context = props.context;
    props.studies.daylight.forEach((study, index) => {
      runs.push(
        analyzeAutoMovieDaylight({
          request: {
            ...study,
            id: identity("daylight", index),
            inputRevision: props.revision,
            context,
          },
        }),
      );
    });
    props.studies.envelope.forEach((study, index) => {
      const solved = analyzeAutoMovieEnvelope({
        request: {
          ...study,
          id: identity("envelope", index),
          inputRevision: props.revision,
          context,
        },
      });
      runs.push(solved.thermal, solved.moisture);
    });
  }

  // Neither reads the site. A room's reverberation and its air change rate are
  // properties of the room and what it is made of, so they are answerable on a
  // production that never declared where it stands.
  props.studies.acoustic.forEach((study, index) => {
    runs.push(
      analyzeAutoMovieAcoustics({
        request: {
          ...study,
          id: identity("acoustic", index),
          inputRevision: props.revision,
        },
      }),
    );
  });
  props.studies.air.forEach((study, index) => {
    runs.push(
      analyzeAutoMovieSpaceAir({
        request: {
          ...study,
          id: identity("air", index),
          inputRevision: props.revision,
        },
      }),
    );
  });

  // Declaring nothing and declaring a study the site could not answer are two
  // different facts, and only the first is a missing study. Reporting both as
  // "no study is declared" would tell an author to write one they already
  // wrote.
  if (declared === 0)
    props.gaps.push({
      subject: "analysis/studies",
      status: "not-run",
      reason: `no environmental study is declared for "${props.environment.id}", so every required domain is unanswered`,
      remedy:
        "declare the studies this production wants in the script's own study block, or drop the domains it requires",
    });
  if (runs.length === 0) return { runs, report: null };
  return {
    runs,
    report: summarizeAutoMovieAnalysis({
      runs,
      revision: props.revision,
      required: props.studies.required,
    }),
  };
};

/**
 * Ask one building every question this project derives, at one revision.
 *
 * Every artifact below is a projection of the same compiler-owned record, taken
 * in one pass, so a sheet and a take-off cannot be readings of two different
 * revisions of one design. That is the reason this is one derivation and not
 * five commands: the drawings, the schedules, the quantities, the installation
 * and the studies are only comparable while they answer for the same bytes.
 *
 * Nothing here is authored back into the design. The arrow points one way, from
 * design to document, so a sheet cannot become a second source of truth for the
 * building it depicts.
 */
export const deriveAutoMovieBuildingReport = (props: {
  /** Compiler-owned building record to ask. */
  environment: IAutoMovieBuiltEnvironment;
  /** Design revision it was compiled at. */
  revision: string;
  /** Service networks the production declares, in any order. */
  serviceNetworks: readonly IAutoMovieServiceNetwork[];
  /** Fluid domains the production declares. */
  fluidDomains: readonly IAutoMovieFluidDomain[];
  /** Water features binding those domains to building spaces. */
  waterFeatures: readonly IAutoMovieWaterFeature[];
  /** Read-only site, or null when the production declares none. */
  context: IAutoMovieEnvironmentContext | null;
  /** Studies the production asks of this building. */
  studies: IAutoMovieBuildingStudies;
}): IAutoMovieBuildingReport => {
  const gaps: IAutoMovieBuildingGap[] = [];
  const sheets = props.environment.buildings.flatMap((unit) =>
    autoMovieBuildingSheetViews(unit).map((view) =>
      autoMovieBuildingSheet({ environment: props.environment, view }),
    ),
  );
  for (const sheet of sheets)
    for (const gap of sheet.drawing.gaps)
      gaps.push({ ...gap, subject: `sheet:${sheet.view.id}/${gap.subject}` });

  const schedules = AUTOMOVIE_BUILDING_SCHEDULE_SUBJECTS.map((subject) =>
    deriveAutoMovieDrawingSchedule({
      environment: props.environment,
      subject,
    }),
  );
  for (const schedule of schedules)
    for (const gap of schedule.gaps)
      gaps.push({
        ...gap,
        subject: `schedule:${schedule.subject}/${gap.subject}`,
      });

  const quantities = measureAutoMovieQuantities({
    environment: props.environment,
  });
  for (const gap of quantities.gaps)
    gaps.push({ ...gap, subject: `quantities/${gap.subject}` });

  const services = props.serviceNetworks
    .filter((network) => network.environment === props.environment.id)
    .map((network) =>
      autoMovieBuildingServices({
        network,
        environment: props.environment,
        fluidDomains: props.fluidDomains,
        waterFeatures: props.waterFeatures,
        gaps,
      }),
    );

  const analysis = autoMovieBuildingAnalysis({
    environment: props.environment,
    revision: props.revision,
    context: props.context,
    studies: props.studies,
    gaps,
  });
  for (const gap of analysis.report?.gaps ?? [])
    gaps.push({
      subject: `analysis:${gap.domain}/${gap.metric ?? gap.run ?? "run"}`,
      status: gap.status,
      reason: gap.reason,
      remedy: gap.remedy,
    });

  return {
    version: 1,
    environment: props.environment.id,
    revision: props.revision,
    sheets,
    schedules,
    quantities,
    services,
    runs: analysis.runs,
    analysis: analysis.report,
    gaps,
  };
};
