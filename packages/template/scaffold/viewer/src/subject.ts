/**
 * One authored thing, opened alone and turned around:
 * `/viewer/subject.html?shot=<id>&subject=<kind>:<id>`.
 *
 * The sibling page `inspect.html` answers "let me fly through this shot"; this
 * one answers "let me look at THAT thing". The difference is what a finding can
 * be written as afterwards. A flight ends in a coordinate, which is a place two
 * people can disagree about having visited; this ends in a subject key, which
 * is a name the authoring agent pastes back into the same field to reach the
 * same thing. That is the whole reason the page exists, and it is why the eye
 * is derived rather than flown: nobody has to agree about where they stood.
 *
 * **This is an inspection tool and not a delivery path.** The eye is one this
 * page chose from the subject's own extent, so a frame it draws belongs to no
 * authored camera and is not capture evidence. The page writes nothing : no
 * file, no receipt : and it deliberately installs no `window.__automovieCapture`
 * hook, so the capture host cannot drive it even if it is pointed here: preview
 * and render frames keep coming from `/viewer/`, composed by a shot's own
 * camera. The two caveats `inspect.html` carries apply here too: the level of
 * detail every population shows is the one this eye's distance selects, and the
 * scene holds the shot's opening second for as long as the page is open.
 *
 * What is framed is the subject's CONTENT box, never its declared one. A room
 * is declared as a convex cell and the thing standing in it is a different
 * extent; reading the first as the second is what put three of four review
 * cameras against a wall in one survey (samchon/automovie#1920). The declared
 * box is printed beside the content box so the gap is visible, and it is used
 * only for a subject that has no content box at all.
 */
import {
  type IAutoMovieSectionPlane,
  builtEnvironmentUnclaimedElements,
  describeAutoMovieSubject,
} from "@automovie/engine";
import type {
  IAutoMovieCompiledShotSource,
  IAutoMovieSubjectDescription,
  IAutoMovieSubjectMemberSummary,
} from "@automovie/interface";
import {
  type AutoMovieViewerSubjectKind,
  type IAutoMovieViewerSubject,
  type IAutoMovieViewerSubjectBounds,
  type IAutoMovieViewerSubjectPose,
  type IAutoMovieViewerViewpoint,
  applyAutoMovieSectionPlanes,
  applyAutoMovieViewerSubjectPose,
  applyRendererEnvironment,
  autoMovieViewerSubjectKey,
  autoMovieViewerTurntableViewpoints,
  frameAutoMovieViewerSubject,
  mountViewer,
  parseAutoMovieViewerSubjectKey,
} from "@automovie/viewer";
import * as THREE from "three";

import type { IAutoMovieProductionViewerRuntime } from "../../scripts/productionRuntimeState";
import { createCompiledShotRuntime } from "./shotRuntime";
import { viewerDocument } from "./viewerDocument";

/**
 * Directions the table turns through, and heights it turns at.
 *
 * Eight azimuths on three rings: a low one that reads a soffit, an eye-height
 * one that reads a proportion, and a raised one that reads a footprint. Cheap
 * and reproducible beats complete : the defects that survived one whole
 * campaign were a wrong proportion, a missing head and a brace at the wrong
 * angle, and every one of them is visible from a horizontal sweep.
 */
const AZIMUTHS = 8;

/** How far below level the soffit ring asks to look, before it is grounded. */
const LOW_ELEVATION_DEG = -20;

/** The rings above level, which no subject can push underground. */
const RAISED_ELEVATIONS_DEG: readonly number[] = [10, 45];

/** Rings altogether, low first, so index = ring * {@link AZIMUTHS} + step. */
const RINGS = RAISED_ELEVATIONS_DEG.length + 1;

/**
 * Ring the page opens on: eye height, never the grazing one.
 *
 * A soffit view is a thing you go and ask for, not the first thing a subject
 * should say about itself, and the low ring is the one that most nearly runs
 * out of room beneath a subject standing on the ground.
 */
const ENTRY_RING = 1;

/** Framing margin every planned viewpoint carries. */
const DISTANCE_FACTOR = 1.25;

/**
 * Viewport shape the PLAN is laid out for, which is not the one it is drawn at.
 *
 * The distance a subject is fitted at follows the narrower field, so it follows
 * the viewport, and a plan measured against a live viewport would rename its
 * own viewpoints when somebody dragged the window. A viewpoint id is a string
 * two agents pass back and forth, so it is fixed against one reference shape
 * here and the live shape is left to move the distance alone.
 */
const PLAN_ASPECT = 16 / 9;

/** Rows standing in the tree before the panel offers a way to narrow them. */
const FILTERABLE_FROM = 12;

/** A group whose contents have not been asked for yet. */
const CLOSED_MARK = "▸";

/** A group whose contents are listed beneath it. */
const OPEN_MARK = "▾";

/**
 * Address parameter naming the tree nodes that are open, by compiled id.
 *
 * The collapse state lives in the address rather than in storage, which is the
 * same answer this page already gives for which subject is being looked at, and
 * the same one `inspection.html` was given when a dev-server reload killed a
 * sweep mid-flight (61fed2ad): reopening one URL rebuilds the same state at the
 * same address. So a saved edit to this module, a `Back`, and a link pasted to
 * somebody else all land on the tree as it was left, and the page still writes
 * nothing : no file, no receipt, no browser storage.
 *
 * Compiled ids rather than viewer keys, because {@link viewerKeyOf} is lossy:
 * a placed part and a prototype's part both spell `part:`, and a node's
 * identity here has to survive being read back.
 */
const OPEN_PARAMETER = "open";

/** Lens the inspection looks through, narrow enough not to bow a straight run. */
const FOV_DEGREES = 35;

/** Range the distance may be pulled through, in multiples of the plan's. */
const MIN_DISTANCE_SCALE = 0.25;
const MAX_DISTANCE_SCALE = 8;

/** Multiplier per wheel notch or `-` / `=` press. */
const DISTANCE_STEP = 1.15;

/**
 * How each authored kind is spelled in a compiled shot, or why it is not
 * spelled there at all.
 *
 * One entry per member of the union, and that totality is the whole reason the
 * table has this shape. A kind added to the viewer's vocabulary cannot reach
 * this page without somebody deciding which of the two things it is, because
 * TypeScript refuses an incomplete `Record` and the compiler names the missing
 * kind. A dispatch that ended in a catch-all would take a new kind and do
 * something plausible with it instead, which is the silent skip this project's
 * doctrine forbids and which the starter's own lint rule exists to catch.
 *
 * A function answers with the compiled subject ids that key could name. More
 * than one only for a part, where a placed part and a prototype's part share a
 * spelling; they are tried in that order because only a placement stands
 * somewhere in this scene, and {@link resolve} refuses whatever is left in
 * model space.
 *
 * A string is a refusal, and it names what to open instead. Every one of those
 * kinds is something real that a compiled shot does not carry as a placed
 * subject. A prototype is the clearest case and the reason these refuse rather
 * than guess: a model may be placed a thousand times or not at all, so "show me
 * the model" has no answer in world space, and answering it with the origin
 * would be exactly the prototype-placement collapse a subject identity exists
 * to prevent.
 */
const SUBJECT_TARGETS: Readonly<
  Record<AutoMovieViewerSubjectKind, ((id: string) => string[]) | string>
> = {
  space: (id) => [`space:${id}`],
  element: (id) => [`element:${id}`],
  "instance-set": (id) => [`instance-set:${id}`],
  instance: (id) => [`instance:${id}`],
  part: (id) => [`element-part:${id}`, `prototype-part:${id}`],
  "built-environment":
    'a built environment is opened through its spaces, as "space:<environment>/<space>"',
  building:
    'a building is a space in the compiled artifact, so open "space:<environment>/<building-space>"',
  storey:
    'a storey is a space in the compiled artifact, so open "space:<environment>/<storey-space>"',
  model:
    'the compiled artifact calls a model a prototype, and a prototype stands nowhere in particular; open a placement of it ("element:<node>" or "instance:<set>:slot:<index>"), or the prototype turntable at /viewer/?asset=<model>&angle=0',
  prototype:
    'a prototype stands nowhere in particular; open a placement of it ("element:<node>" or "instance:<set>:slot:<index>"), or the prototype turntable at /viewer/?asset=<model>&angle=0',
  mesh: 'a mesh is carried by a part, so open "part:<node>/<part>"',
  primitive: 'a primitive is carried by a part, so open "part:<node>/<part>"',
  formation:
    "a formation is not a compiled subject; open a placement of one of its members, or the whole shot at /viewer/?shot=<id>",
  slot: 'a formation slot is not a compiled subject; a compact population member is "instance:<set>:slot:<index>"',
};

const { canvas, status } = viewerDocument();
/** The one region of the page that takes the pointer; see `subject.html`. */
const panel = ((): HTMLDivElement => {
  const found = document.querySelector<HTMLDivElement>("#subject");
  if (found === null)
    throw new Error("The subject document is missing #subject.");
  return found;
})();

const parameters = new URLSearchParams(window.location.search);
const shotId = parameters.get("shot") ?? "opening";
const response = await fetch(
  `/__automovie/shots/${encodeURIComponent(shotId)}.json`,
);
if (response.ok === false)
  throw new Error(
    `Compiled shot "${shotId}" is unavailable (${response.status}). Run npm run compile.`,
  );
// Read as text first, because the served bytes are the only revision this page
// can honestly state: the viewer route carries no digest and no version beside
// the compiled shot, and a revision invented from anything else would make an
// observation reopenable against a state that never existed.
const compiledText = await response.text();
const compiled = JSON.parse(compiledText) as IAutoMovieCompiledShotSource;
const revision = await digestOf(compiledText);
const artifact = { revision, compiled };
const requestedKey = parameters.get("subject");

/**
 * The shot's outermost subjects, as the roots of a tree that opens downward.
 *
 * A space nobody is the parent of is a root, and so is a population no
 * environment binds to a space; everything else is somebody's member and is
 * reached by opening that somebody. Listing every space flat, which is what
 * this did before, put a room beside the storey that contains it and said
 * nothing about which was which; and on the medieval residence that is
 * fourteen of fifteen spaces standing at the top level with no parent named.
 *
 * `parent` is read from the compiled environment rather than from a
 * description, because rooting the index would otherwise cost one
 * {@link describeAutoMovieSubject} per space before the reviewer has asked to
 * look at anything: measured at 45 ms each on that production, for the same
 * field the engine itself reads. A parent naming a space this environment does
 * not carry is treated as no parent, so a dangling link leaves its space
 * reachable instead of orphaning it.
 */
const indexRoots = (): string[] => {
  const environments = compiled.builtEnvironments ?? [];
  const populated = new Set(
    environments.flatMap((environment) =>
      (environment.populations ?? []).map((population) => population.set.id),
    ),
  );
  return [
    ...environments.flatMap((environment) => {
      const carried = new Set(environment.spaces.map((space) => space.id));
      return environment.spaces
        .filter(
          (space) =>
            space.parent === null || carried.has(space.parent) === false,
        )
        .map((space) => `space:${environment.id}/${space.id}`);
    }),
    // An element no space claims is correct rather than careless: an exterior
    // wall and a foundation belong to no room. Before this it was also
    // unreachable, because the only way down ran through the spaces, so one
    // measured production left 671 of 3,474 elements openable only by an author
    // who already knew the key. Only the hierarchy roots are listed; everything
    // under them arrives through its own parent's members, which is why the
    // engine no longer takes the drawn-node set: a transform-only group answers
    // for itself now, so the tops are named whether or not they draw anything
    // (`#1959`).
    ...environments.flatMap((environment) =>
      builtEnvironmentUnclaimedElements(environment).map(
        (node) => `element:${node}`,
      ),
    ),
    ...compiled.instanceSets
      .filter((set) => populated.has(set.id) === false)
      .map((set) => `instance-set:${set.id}`),
  ];
};

/**
 * Every space and population of the shot, as keys that can be opened.
 *
 * This is the way in when nothing has been named yet, and it costs one pass
 * over ids: no model is decoded and no scene is built, because a reviewer
 * choosing what to look at is not yet looking at anything.
 */
const renderIndex = (): void => {
  panel.replaceChildren(
    line(`${shotId}: subjects to open`, "what"),
    line(
      "open a group to list what stands inside it; an element the environment " +
        "assigns to no space is listed here under the building it hangs from",
      "omitted",
    ),
    line("", "gap"),
    ...subjectTree(indexRoots()),
  );
};

/** The compiled subject ids one viewer subject key could name. */
const compiledSubjectIds = (subject: IAutoMovieViewerSubject): string[] => {
  const target = SUBJECT_TARGETS[subject.kind];
  if (typeof target === "string")
    throw new Error(
      `${autoMovieViewerSubjectKey(subject)} is not a placed subject of shot "${shotId}": ` +
        `${target}.`,
    );
  return target(subject.id);
};

/**
 * Resolve one subject key against the compiled shot, or say why it cannot be.
 *
 * A model-space answer is refused rather than framed. The box a prototype
 * reports is measured in its own model's coordinates, so aiming a world camera
 * at it stages the world origin and shows whatever happens to stand there;
 * agreement in form, a different thing in fact.
 */
const resolve = (
  subject: IAutoMovieViewerSubject,
): IAutoMovieSubjectDescription => {
  const found: IAutoMovieSubjectDescription[] = [];
  const refusals: string[] = [];
  for (const candidate of compiledSubjectIds(subject))
    try {
      found.push(describeAutoMovieSubject(artifact, candidate));
    } catch (error) {
      refusals.push(error instanceof Error ? error.message : `${error}`);
    }
  const placed = found.find(
    (candidate) => candidate.bounds.coordinateSpace === "world",
  );
  if (placed !== undefined) return placed;
  if (found[0] !== undefined)
    throw new Error(
      `${autoMovieViewerSubjectKey(subject)} resolves to ${found[0].id}, which is measured ` +
        "in model space and stands nowhere in this shot; open a placement of it instead.",
    );
  throw new Error(
    `${autoMovieViewerSubjectKey(subject)} names nothing in shot "${shotId}": ${refusals.join(" ")}`,
  );
};

/** Which of a description's two boxes the eye was derived from, and the other. */
interface IExtent {
  bounds: IAutoMovieViewerSubjectBounds;
  source: "content" | "declared";
  /** The declared box when one exists beside the framed content box. */
  declared: IAutoMovieViewerSubjectBounds | null;
}

/**
 * The box the eye is derived from.
 *
 * Content first, always. A declared cell answers how far a room reaches and the
 * content box answers where its contents are, and only the second is what a
 * reviewer placing an eye is asking about. The declared box is carried along so
 * the page can print both and make the gap between them something you see
 * rather than something you discover by framing a wall.
 */
const extentOf = (description: IAutoMovieSubjectDescription): IExtent => {
  const { content, declared } = description.bounds;
  if (content !== null) return { bounds: content, source: "content", declared };
  if (declared !== null)
    return { bounds: declared, source: "declared", declared: null };
  throw new Error(
    `${description.id} has neither a content nor a declared extent, so there is nothing to aim at.`,
  );
};

/**
 * How far below level this subject's soffit ring may actually go, in degrees.
 *
 * The low ring is where the underside of a thing is read, and for a slate on a
 * roof or a chandelier over a hall that is exactly right: the eye drops half a
 * metre and is still eight metres in the air. For a room it is not. A hall
 * fitted at thirty-six metres and asked for -20 degrees puts the eye seven and
 * a half metres UNDERGROUND, looking up at the building through the floor, and
 * eight of the twenty-four planned viewpoints were that. The angle is therefore
 * the subject's own to answer, exactly as its distance already is.
 *
 * The floor is grade, or the subject's own underside where that is already
 * below grade, so a cellar is still looked at from inside its own extent. The
 * fitted distance is read back from {@link frameAutoMovieViewerSubject} rather
 * than recomputed: a level eye sits one fitted distance from the centre, so
 * asking the framing rule what it did keeps this page from carrying a second
 * copy of arithmetic that a subject inspection elsewhere is pinned bit-for-bit
 * against.
 */
const groundedElevationDeg = (
  bounds: IAutoMovieViewerSubjectBounds,
): number => {
  const level = frameAutoMovieViewerSubject(
    bounds,
    {
      id: "level",
      azimuthDeg: 0,
      elevationDeg: 0,
      distanceFactor: DISTANCE_FACTOR,
    },
    { fovDeg: FOV_DEGREES, aspect: PLAN_ASPECT },
  );
  const distance = Math.hypot(
    level.position.x - level.target.x,
    level.position.y - level.target.y,
    level.position.z - level.target.z,
  );
  const drop = Math.max(level.target.y - Math.min(0, bounds.min.y), 0);
  // Never steeper than asked for, never past the floor. The result stays inside
  // [-20, 0], which is what keeps its rounded label clear of the rings above it
  // and the plan nameable.
  return Math.max(
    LOW_ELEVATION_DEG,
    -THREE.MathUtils.radToDeg(Math.asin(Math.min(drop / distance, 1))),
  );
};

/** The viewpoints this subject is turned through, low ring grounded to it. */
const turntableFor = (
  bounds: IAutoMovieViewerSubjectBounds,
): IAutoMovieViewerViewpoint[] =>
  autoMovieViewerTurntableViewpoints({
    azimuthCount: AZIMUTHS,
    elevationsDeg: [groundedElevationDeg(bounds), ...RAISED_ELEVATIONS_DEG],
    distanceFactor: DISTANCE_FACTOR,
  });

/**
 * A cut at the subject's near face that removes the half-space the eye is in.
 *
 * A room framed from outside is a room behind its own wall, so without this the
 * space subject would be reachable and still unreadable. The plane rides the
 * viewpoint, so turning the table turns the cut with it and a room stays open
 * from every angle it is looked at. The scene is not edited; the cut is a way
 * of looking rather than a second version of the building.
 */
const sectionAt = (
  pose: IAutoMovieViewerSubjectPose,
  bounds: IAutoMovieViewerSubjectBounds,
): IAutoMovieSectionPlane => {
  const middle = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  const away = new THREE.Vector3(
    pose.position.x - middle.x,
    pose.position.y - middle.y,
    pose.position.z - middle.z,
  ).normalize();
  const radius = Math.max(
    Math.hypot(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
    ) / 2,
    0.5,
  );
  return {
    point: {
      x: middle.x + away.x * radius,
      y: middle.y + away.y * radius,
      z: middle.z + away.z * radius,
    },
    normal: { x: away.x, y: away.y, z: away.z },
  };
};

/**
 * The viewer key spelling of one compiled subject id.
 *
 * A placed part and a prototype's part are one kind to the viewer, which is
 * what lets one key name a part without the reviewer having to know which table
 * the compiler wrote it into.
 */
const viewerKeyOf = (compiledId: string): string =>
  compiledId.replace(/^(?:element|prototype)-part:/, "part:");

const subjectLink = (compiledId: string, prefix: string): HTMLDivElement => {
  const key = viewerKeyOf(compiledId);
  const target = new URLSearchParams();
  target.set("shot", shotId);
  target.set("subject", key);
  const anchor = document.createElement("a");
  anchor.href = `?${target.toString()}`;
  anchor.dataset.subject = key;
  anchor.textContent = `${prefix}${key}`;
  const row = document.createElement("div");
  row.className = prefix === "" ? "member" : "up";
  row.append(anchor);
  return row;
};

const line = (text: string, className: string): HTMLDivElement => {
  const row = document.createElement("div");
  row.className = className;
  row.textContent = text;
  return row;
};

/** The open set as the address states it, which is the only place it lives. */
const openedFromAddress = (): Set<string> =>
  new Set(
    (new URLSearchParams(window.location.search).get(OPEN_PARAMETER) ?? "")
      .split(",")
      .filter((id) => id.length !== 0),
  );

/** Compiled ids the address currently says are open. */
let openIds = openedFromAddress();

/**
 * Record the open set in the address without adding a history entry.
 *
 * Opening a node is a way of looking at one subject rather than a move to
 * another, so `Back` still steps between subjects instead of unwinding every
 * twist the reviewer turned. The subject and shot parameters are carried
 * through untouched, so this never renames what the page is looking at.
 */
const writeOpenState = (): void => {
  const next = new URLSearchParams(window.location.search);
  if (openIds.size === 0) next.delete(OPEN_PARAMETER);
  else next.set(OPEN_PARAMETER, [...openIds].join(","));
  const query = next.toString();
  // A bare `?` is not the same address as no query at all, and closing the last
  // twist on a page opened without parameters would otherwise leave one.
  window.history.replaceState(
    null,
    "",
    query.length === 0 ? window.location.pathname : `?${query}`,
  );
};

/**
 * One description per compiled id, for as long as the page holds one artifact.
 *
 * A refusal is remembered as well as an answer. The lookup walks every
 * prototype, then every scene node's parts, before it reaches spaces, so a
 * miss is the most expensive question this page asks: 45 ms on the medieval
 * residence's 3,381 scene nodes and 197 prototypes. Reopening a node the
 * reviewer just closed must not pay it again.
 */
const described = new Map<string, IAutoMovieSubjectDescription | Error>();

const describedSubject = (
  compiledId: string,
  memberOffset: number = 0,
): IAutoMovieSubjectDescription | Error => {
  // Remembered per page, not per subject: two pages of one node are two
  // answers, and keying them together would hand the second reader the first
  // reader's rows.
  const key = `${compiledId}\0${memberOffset}`;
  const remembered = described.get(key);
  if (remembered !== undefined) return remembered;
  let answer: IAutoMovieSubjectDescription | Error;
  try {
    answer = describeAutoMovieSubject(artifact, compiledId, { memberOffset });
  } catch (error) {
    answer = error instanceof Error ? error : new Error(`${error}`);
  }
  described.set(key, answer);
  return answer;
};

/**
 * What one node says about its own contents, including what it is not showing.
 *
 * `items` is a bounded sample the description chose, so a node that listed its
 * sample and said nothing else would be claiming the sample is the population.
 * On the medieval residence the largest room holds 629 members and names 64 of
 * them, so that claim would be wrong by 565 subjects at one node.
 *
 * `listed` is what the tree has actually laid out, which grows as the reviewer
 * asks for further pages and is not what any single description reports. Read
 * off the summary instead of off `items` because a second page arrives in its
 * own answer, and a line derived from that answer alone would count backwards.
 */
const membershipLine = (
  members: IAutoMovieSubjectMemberSummary,
  listed: number,
): string =>
  members.total === 0
    ? "nothing inside"
    : listed >= members.total
      ? `${members.total} inside`
      : `${members.total} inside · ${listed} listed · ` +
        `${members.total - listed} not yet listed`;

/** One row of the tree: what it names, what it holds, and whether it is open. */
interface ISubjectTreeRow {
  /** Compiled id the row is described and remembered by. */
  compiledId: string;
  /** Viewer key spelling, which is what the filter reads. */
  key: string;
  /** Row and its children together, hidden as one by the filter. */
  node: HTMLDivElement;
  /** Container holding the membership line and the child rows. */
  children: HTMLDivElement;
  /** The twist the reviewer clicks. */
  toggle: HTMLSpanElement;
  /** Whether the reviewer has this node open, independent of any filter. */
  open: boolean;
  /** Child rows once the node has been opened, `null` before that. */
  loaded: ISubjectTreeRow[] | null;
  /** The line stating this node's population, rewritten as pages arrive. */
  summary: HTMLDivElement | null;
}

/**
 * Subject links as a tree that opens and closes one node at a time.
 *
 * A subject is a group and a group holds groups; a residence holds storeys,
 * a storey holds rooms, a room holds elements, an element holds its parts;
 * and a flat list of sixty-four rows of `great-hall-chandelier-0-ring-13`
 * spells that structure in the ids and shows none of it.
 *
 * **Nothing is expanded until it is opened.** A node's children arrive from one
 * {@link describeAutoMovieSubject} call, and that call is the only way to learn
 * them: the description carries an exact `total` and a bounded id sample for
 * ONE subject, and there is no bulk answer for a subtree. Measured against the
 * medieval residence's `great-hall` shot (14.3 MB compiled, 3,381 scene nodes,
 * 3,474 built elements, 15 spaces, 8 instance sets, 197 prototypes, 4,003
 * enumerable subjects): one element answers in about 1.6 ms and one space in
 * about 45 ms, opening the largest room costs 102 ms for its 64 listed
 * members, and describing that room two levels deep is 128 calls in 212 ms.
 * Building every descendant up front is therefore thousands of calls for a
 * reviewer who is going to open four of them.
 *
 * **Every opened node states its own population**, through
 * {@link membershipLine}, because `items` is a sample. A node that turns out to
 * name nothing this shot carries; the compiled artifact lets a space list a
 * grouping element that owns no scene node, and 24 of the residence's do;
 * shows that refusal where its children would be, which is a cheaper way to
 * learn it than clicking through and losing the picture you were looking at.
 *
 * **The filter reaches exactly what is open, and says so.** It hides rows
 * rather than rebuilding them, so what is filtered is the same DOM a click
 * still navigates from, and it matches the key, which is the string a reviewer
 * already has in hand. What it deliberately does not do is search closed
 * nodes: their members have not been described, and a tree whose every node is
 * a bounded sample could not honestly report a whole-subtree search anyway. So
 * the box counts the rows it can actually see. Within that reach a match is
 * never buried: an ancestor holding one lists its children even when the
 * reviewer had closed it, and clearing the box hides them again, because the
 * reveal is a way of looking rather than a change to their state.
 *
 * A revealed ancestor keeps its twist reading CLOSED while it lists them, and
 * that disagreement is the honest one. The twist is the reviewer's own state
 * and it is the state {@link OPEN_PARAMETER} carries, so a mark that flipped
 * under a needle would show an open set the address does not name, and would
 * leave no way to tell which nodes survive clearing the box. The rows appear
 * because the filter is looking; the mark stays because nobody opened it.
 */
const subjectTree = (rootIds: readonly string[]): HTMLElement[] => {
  const built: ISubjectTreeRow[] = [];
  const box = document.createElement("input");
  box.type = "text";
  box.className = "filter";
  box.hidden = true;
  const tree = document.createElement("div");
  tree.className = "tree";

  const refreshFilter = (): void => {
    box.hidden = built.length < FILTERABLE_FROM;
    box.placeholder = `narrow the ${built.length} rows now open`;
  };

  /**
   * Ask one node for one page of what it holds, and lay it out beneath it.
   *
   * A page rather than the whole, because the description's sample is bounded
   * and a building is flat: one measured manor is a single root owning 988
   * children, so the first page names 64 and the reviewer used to reach no
   * further. The rest were never lost; the subject census enumerates every one
   *; but the tree, which is how a reviewer actually looks, stopped there.
   */
  const expandFrom = (row: ISubjectTreeRow, offset: number): void => {
    const answer = describedSubject(row.compiledId, offset);
    if (answer instanceof Error) {
      row.loaded ??= [];
      row.children.append(line(answer.message, "stale"));
      return;
    }
    const kids = row.loaded ?? [];
    row.loaded = kids;
    if (row.summary === null) {
      row.summary = line("", "omitted");
      row.children.append(row.summary);
    }
    for (const id of answer.members.items) {
      const kid = buildRow(id);
      kids.push(kid);
      row.children.append(kid.node);
    }
    row.summary.textContent = membershipLine(answer.members, kids.length);
    const remaining =
      answer.members.total - (offset + answer.members.items.length);
    if (remaining > 0) {
      const more = line(`list ${remaining} more`, "more");
      more.addEventListener("click", () => {
        more.remove();
        expandFrom(row, offset + answer.members.items.length);
        refreshFilter();
      });
      row.children.append(more);
    }
  };

  /** Ask one node what it holds, once, and lay its first page out beneath it. */
  const expand = (row: ISubjectTreeRow): void => {
    if (row.loaded !== null) return;
    expandFrom(row, 0);
  };

  function buildRow(compiledId: string): ISubjectTreeRow {
    const element = subjectLink(compiledId, "");
    const toggle = document.createElement("span");
    toggle.className = "twist";
    toggle.textContent = CLOSED_MARK;
    // Ahead of the link in the DOM so the row's reversed flow puts it at the
    // right edge, where one column of twists stands clear of keys that wrap.
    element.prepend(toggle);
    const children = document.createElement("div");
    children.className = "kids";
    children.hidden = true;
    const node = document.createElement("div");
    node.className = "node";
    node.append(element, children);
    const row: ISubjectTreeRow = {
      compiledId,
      key: viewerKeyOf(compiledId),
      node,
      children,
      toggle,
      open: false,
      loaded: null,
      summary: null,
    };
    built.push(row);
    toggle.addEventListener("click", () => {
      row.open = row.open === false;
      if (row.open) {
        expand(row);
        openIds.add(compiledId);
      } else openIds.delete(compiledId);
      row.children.hidden = row.open === false;
      toggle.textContent = row.open ? OPEN_MARK : CLOSED_MARK;
      writeOpenState();
      refreshFilter();
      applyFilter();
    });
    // Restored top down, so a node the address names is opened only once the
    // node holding it has been, and an id this tree does not carry simply never
    // arrives here.
    if (openIds.has(compiledId)) {
      row.open = true;
      toggle.textContent = OPEN_MARK;
      children.hidden = false;
      expand(row);
    }
    return row;
  }

  /** Hide what the needle excludes, and open what it would otherwise bury. */
  const filterRow = (row: ISubjectTreeRow, needle: string): boolean => {
    let inside = false;
    for (const kid of row.loaded ?? [])
      if (filterRow(kid, needle)) inside = true;
    const matched =
      needle === "" || inside || row.key.toLowerCase().includes(needle);
    row.node.hidden = matched === false;
    row.children.hidden =
      row.loaded === null ||
      (needle === "" ? row.open === false : inside === false);
    return matched;
  };

  const applyFilter = (): void => {
    const needle = box.value.trim().toLowerCase();
    for (const root of roots) filterRow(root, needle);
  };

  box.addEventListener("input", applyFilter);
  const roots = rootIds.map((id) => buildRow(id));
  for (const root of roots) tree.append(root.node);
  // Whatever the address named that this tree has no row for is dropped, so the
  // next twist does not write an open set describing a subject nobody is
  // looking at any more.
  openIds = new Set(
    built.filter((row) => row.open).map((row) => row.compiledId),
  );
  refreshFilter();
  return [box, tree];
};

const size = (bounds: IAutoMovieViewerSubjectBounds): string =>
  `${(bounds.max.x - bounds.min.x).toFixed(2)}×` +
  `${(bounds.max.y - bounds.min.y).toFixed(2)}×` +
  `${(bounds.max.z - bounds.min.z).toFixed(2)}m`;

const point = (value: { x: number; y: number; z: number }): string =>
  `(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)})`;

const middleOf = (bounds: IAutoMovieViewerSubjectBounds): string =>
  point({
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  });

/**
 * The revision this page states, taken from the bytes it was served.
 *
 * `SubtleCrypto` is only there in a secure context, and the viewer is normally
 * bound to `127.0.0.1`, which is one. When it is not, the page says it has no
 * revision instead of composing something that would look like one: an
 * observation stamped with a fabricated revision is worse than an observation
 * that admits it cannot name the state it saw.
 */
async function digestOf(text: string): Promise<string> {
  if (
    window.isSecureContext === false ||
    globalThis.crypto?.subtle === undefined
  )
    return "unrevisioned (SubtleCrypto needs a secure context)";
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return `sha256:${[...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * The one click handler both ways of drawing the panel install.
 *
 * A member row is an anchor so it can be hovered, copied, and opened in a new
 * tab like the link it is; this is what makes a plain click INSIDE the page
 * mean "show me that" rather than "throw this page away and load another one".
 * Both ways in want it for the same reason, and only one of them used to have
 * it. On the index the anchor's own href ran instead, so a member the compiled
 * shot cannot describe landed the reviewer on a page carrying one line of
 * refusal, no tree and no link; the loss that the twist's in-place refusal was
 * written to avoid, reached from the other side. A tree that refuses a dead id
 * where its children would be and then hands the same id over as a live link
 * has not stopped costing the click; it has moved it one row across.
 */
const openMemberOnClick = (open: (key: string) => void): void =>
  panel.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement | null)?.closest("a")?.dataset
      .subject;
    if (target === undefined) return;
    // A modified click is the reader asking the BROWSER for the link, not this
    // page for the subject, and the anchor is written to be worth asking for.
    // Swallowing it would take back the new tab and the new window this row
    // offers by being an anchor at all, which is the same promise the href
    // keeps for hovering and copying.
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    event.preventDefault();
    open(target);
  });

/** Stage the named subject and keep the page on it until another is opened. */
const openSubjectPage = async (key: string): Promise<void> => {
  // Resolved before anything is decoded, so a mistyped key costs a message
  // rather than a whole scene's worth of textures.
  let asked = parseAutoMovieViewerSubjectKey(key);
  let description = resolve(asked);
  let extent = extentOf(description);
  const productionRuntimeResponse = await fetch(
    "/__automovie/production-runtime.json",
  );
  if (productionRuntimeResponse.ok === false)
    throw new Error(
      `Production runtime is unavailable (${productionRuntimeResponse.status}).`,
    );
  const productionRuntime =
    (await productionRuntimeResponse.json()) as IAutoMovieProductionViewerRuntime;
  // The same compiled shot the shot page builds, admitting the same live soft
  // bodies, so what is judged here is what the shot draws rather than a
  // lookalike assembled with different runtime choices. No delivery tone is
  // passed: this page stands in for no delivery, so the scene's own environment
  // owns the curve.
  const runtime = await createCompiledShotRuntime(compiled, undefined, {
    dialogue: productionRuntime.dialogue,
    liveWearableSoftBodies: productionRuntime.liveWearableSoftBodies,
  });
  const eye = new THREE.PerspectiveCamera(FOV_DEGREES, 1, 0.1, 1000);
  // No capture options: the shot page pins antialiasing off and preserves the
  // drawing buffer so a readback is byte-stable. Nothing reads bytes back here,
  // so the eye gets the smoother picture instead. Mounting this early is what
  // gives the statements below a renderer; the loop it starts does not run
  // until the next animation frame, so everything is in place first.
  const mounted = mountViewer(canvas, runtime.scene, eye, () => frame());
  mounted.renderer.setClearColor(0x11151b, 1);
  // One draw through the shot's own camera lowers the scene to its opening
  // second. `render` is what applies poses, prop articulation, object motion
  // and light motion, and nothing else does, so a subject framed before this
  // would be judged in the rest pose its model was imported in.
  runtime.render(mounted.renderer, 0, "beauty");
  // Applied once and kept. `render` restores the renderer environment after
  // each draw because a capture shares one renderer across guide passes; this
  // page draws one beauty pass for as long as it is open.
  applyRendererEnvironment(
    mounted.renderer,
    compiled.scene.environment,
    "beauty",
  );

  let plan = turntableFor(extent.bounds);
  let viewpoint = ENTRY_RING * AZIMUTHS;
  let distanceScale = 1;
  let sectioned = false;
  /** Whether the scene currently carries a cut, so an uncut one costs nothing. */
  let cutting = false;
  let viewWidth = 0;
  let viewHeight = 0;
  let pose = stage();
  renderPanel();

  /** Resolve the pose for the current subject, angle and distance, and aim. */
  function stage(): IAutoMovieViewerSubjectPose {
    const planned = plan[viewpoint]!;
    const staged = frameAutoMovieViewerSubject(
      extent.bounds,
      { ...planned, distanceFactor: planned.distanceFactor * distanceScale },
      {
        fovDeg: FOV_DEGREES,
        aspect: (canvas.clientWidth || 1) / (canvas.clientHeight || 1),
      },
    );
    applyAutoMovieViewerSubjectPose(eye, staged);
    // A cut rides the eye, so it is rewritten whenever one is in force, and
    // released exactly once when it stops being. Skipping the uncut case
    // matters: the call walks every material in the scene, and a shot of a few
    // thousand nodes would pay that walk on every wheel notch for a section
    // nobody asked for.
    if (sectioned || cutting) {
      applyAutoMovieSectionPlanes({
        renderer: mounted.renderer,
        root: runtime.scene,
        planes: sectioned ? [sectionAt(staged, extent.bounds)] : [],
      });
      cutting = sectioned;
    }
    return staged;
  }

  function frame(): boolean {
    // The canvas is sized once when the viewer is mounted, which is enough for
    // a capture at a fixed viewport and not for a page somebody keeps open
    // while dragging the window. Following the element here keeps the picture
    // unstretched, keeps the height the populations resolve against the height
    // actually being drawn, and refits the subject to the new shape.
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    if (width !== viewWidth || height !== viewHeight) {
      viewWidth = width;
      viewHeight = height;
      mounted.renderer.setSize(width, height, false);
      pose = stage();
    }
    // The scene is not renderable until the populations have been told where
    // the eye is: each instance set and formation builds its levels of detail
    // hidden and reveals one only here. A frame drawn without this call keeps
    // the ordinary meshes and silently drops every instanced population, which
    // reads as a roof laid only at its edges rather than as a missing call.
    runtime.resolveForCamera(eye, canvas.height);
    mounted.renderer.render(runtime.scene, eye);
    status.textContent = statusLines(pose);
    return true;
  }

  /** The three facts a finding is written from, then the picture's conditions. */
  function statusLines(staged: IAutoMovieViewerSubjectPose): string {
    const planned = plan[viewpoint]!;
    return (
      `${autoMovieViewerSubjectKey({ ...asked, revision })}\n` +
      `viewpoint ${planned.id}  (${viewpoint + 1}/${plan.length})` +
      `  az=${planned.azimuthDeg.toFixed(0)}° el=${planned.elevationDeg.toFixed(1)}°` +
      `  distance ${(planned.distanceFactor * distanceScale).toFixed(2)}× fitted` +
      `${distanceScale === 1 ? "" : " (off plan)"}\n` +
      `${extent.source} extent ${size(extent.bounds)} at ${middleOf(extent.bounds)}` +
      `${
        extent.declared === null
          ? ""
          : `   declared ${size(extent.declared)} at ${middleOf(extent.declared)}`
      }\n` +
      `eye ${point(staged.position)}  near=${staged.near.toFixed(3)}` +
      ` far=${staged.far.toFixed(1)}  fov=${staged.lens.fovDeg.toFixed(0)}°` +
      ` aspect=${staged.lens.aspect.toFixed(2)}` +
      `  section ${sectioned ? "on" : "off"}`
    );
  }

  /** Identity to copy into a finding, the way out, and the ways in. */
  function renderPanel(): void {
    const members = description.members;
    panel.replaceChildren(
      line(autoMovieViewerSubjectKey({ ...asked, revision }), "target"),
      line(
        `${description.kind} · ${description.semanticKind}` +
          `${description.name === null ? "" : ` · ${description.name}`}`,
        "what",
      ),
    );
    // One spelling is the viewer's and one is the compiled artifact's, and they
    // differ only where a part could have been either table's. Printing the
    // compiled id when it differs is what keeps this page and the subject tools
    // that take compiled ids naming the same thing.
    if (
      description.id !== autoMovieViewerSubjectKey({ ...asked, revision: null })
    )
      panel.append(line(`compiled id ${description.id}`, "omitted"));
    if (asked.revision !== null && asked.revision !== revision)
      panel.append(
        line(
          `asked for @${asked.revision}; this shot compiles to @${revision}. ` +
            "This page draws only what is compiled now.",
          "stale",
        ),
      );
    // Said out loud, because a slate turned at -20 degrees beside a hall turned
    // at -8 looks like an inconsistent tool until you know the hall would have
    // been underground.
    const low = plan[0]!.elevationDeg;
    if (low > LOW_ELEVATION_DEG)
      panel.append(
        line(
          `soffit ring grounded to ${low.toFixed(1)}°, ` +
            `since ${LOW_ELEVATION_DEG}° puts this eye below grade`,
          "omitted",
        ),
      );
    if (description.owner !== null)
      panel.append(line("", "gap"), subjectLink(description.owner, "↑ "));
    // `members.items` is a bounded sample the description chose, so the whole
    // sample is listed here and the remainder is stated rather than truncated a
    // second time. The root is the one node with no page control of its own:
    // the tree pages from a node's own twist, and this panel has none, so a
    // reviewer reaches the rest by opening the root's children rather than by
    // asking this line for more. Every node of the tree below pages itself.
    panel.append(
      line("", "gap"),
      line(membershipLine(members, members.items.length), "omitted"),
      ...subjectTree(members.items),
    );
  }

  /**
   * Stage another subject, keeping the current angle so a descent from a room
   * to a moulding is a step inward rather than a jump to a new orientation.
   *
   * A refusal is written where the subject was and the previous one keeps its
   * frame, because losing the picture you were looking at is a worse answer to
   * a mistyped id than a line of text. The tree's open set is replaced only on
   * a subject that actually opened, and by whatever the caller's address says:
   * a step inward starts closed, and a `Back` restores the twists that entry of
   * the history carries.
   */
  function show(
    subject: IAutoMovieViewerSubject,
    nextOpen: Set<string>,
  ): boolean {
    let next: IAutoMovieSubjectDescription;
    let box: IExtent;
    try {
      next = resolve(subject);
      // Inside the same guard as the lookup: a subject that resolves and then
      // reports no extent at all is refused the same way one that does not
      // resolve is, rather than by an exception out of a click handler.
      box = extentOf(next);
    } catch (error) {
      // The panel is rebuilt first so the ways out and in survive a refusal;
      // an error that also took the navigation away would strand whoever
      // mistyped a key on a page with nothing to click.
      renderPanel();
      panel.prepend(
        line(error instanceof Error ? error.message : `${error}`, "stale"),
      );
      return false;
    }
    asked = subject;
    description = next;
    extent = box;
    openIds = nextOpen;
    // The angle is kept across a descent so a room and the moulding inside it
    // are read from the same side, but the plan itself is the new subject's:
    // how far its soffit ring may drop is its own extent's answer.
    plan = turntableFor(box.bounds);
    distanceScale = 1;
    pose = stage();
    renderPanel();
    return true;
  }

  /** Open a subject key, recording it in history when it opened. */
  function navigate(target: string): void {
    if (show(parseAutoMovieViewerSubjectKey(target), new Set()) === false)
      return;
    const next = new URLSearchParams();
    next.set("shot", shotId);
    next.set("subject", target);
    window.history.pushState(null, "", `?${next.toString()}`);
  }

  /** A key off the address bar, which nothing guarantees is even well formed. */
  function opened(key: string): boolean {
    try {
      return show(parseAutoMovieViewerSubjectKey(key), openedFromAddress());
    } catch {
      return false;
    }
  }

  window.addEventListener("keydown", (event) => {
    // The panel's filter is the one place on this page that wants letters, and
    // every key below is a letter or an arrow. Without this, narrowing a list
    // would turn the table and `Backspace` would leave the subject entirely.
    if (event.target instanceof HTMLInputElement) return;
    if (event.code === "ArrowRight") viewpoint = turn(1);
    else if (event.code === "ArrowLeft") viewpoint = turn(-1);
    else if (event.code === "ArrowUp") viewpoint = ring(1);
    else if (event.code === "ArrowDown") viewpoint = ring(-1);
    else if (event.code === "Minus") distanceScale = pulled(DISTANCE_STEP);
    else if (event.code === "Equal") distanceScale = pulled(1 / DISTANCE_STEP);
    else if (event.code === "KeyF") distanceScale = 1;
    else if (event.code === "KeyX") sectioned = sectioned === false;
    else if (event.code === "Backspace") {
      event.preventDefault();
      if (description.owner !== null) navigate(viewerKeyOf(description.owner));
      return;
    } else return;
    event.preventDefault();
    pose = stage();
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      // The wheel pulls the eye along the viewpoint's own direction rather than
      // changing the lens, because the angle is what the plan names: a viewpoint
      // id would otherwise stop describing the picture it is printed beside.
      distanceScale = pulled(Math.exp(event.deltaY * 0.001));
      pose = stage();
    },
    // The page owns the wheel, so the listener must be able to refuse the
    // scroll.
    { passive: false },
  );
  openMemberOnClick(navigate);
  window.addEventListener("popstate", () => {
    const next = new URLSearchParams(window.location.search);
    const back = next.get("subject");
    // Only a subject of this same shot can be staged in place; anything else
    // wants a different scene built, which is a fresh page.
    if (
      back === null ||
      (next.get("shot") ?? "opening") !== shotId ||
      opened(back) === false
    )
      window.location.reload();
  });

  /** The next planned viewpoint around the ring the eye is already on. */
  function turn(delta: number): number {
    const base = Math.floor(viewpoint / AZIMUTHS) * AZIMUTHS;
    const within = viewpoint - base;
    return base + ((((within + delta) % AZIMUTHS) + AZIMUTHS) % AZIMUTHS);
  }

  /** The same azimuth on the next elevation ring. */
  function ring(delta: number): number {
    const at = Math.floor(viewpoint / AZIMUTHS);
    return (
      ((((at + delta) % RINGS) + RINGS) % RINGS) * AZIMUTHS +
      (viewpoint - at * AZIMUTHS)
    );
  }

  function pulled(factor: number): number {
    return THREE.MathUtils.clamp(
      distanceScale * factor,
      MIN_DISTANCE_SCALE,
      MAX_DISTANCE_SCALE,
    );
  }
};

/**
 * Open a member named on the index, or refuse it and keep the tree standing.
 *
 * The index holds no scene, so opening a subject from here is a page load
 * rather than a restage. The refusal therefore has to happen BEFORE that load:
 * a member the compiled shot does not carry; a space may list a grouping
 * element that owns no scene node, and 24 of the medieval residence's do;
 * would otherwise be discovered by the next page, which has nothing left to
 * show but the message. Asking first costs one memoised description and leaves
 * the reviewer where they were, with the twists they had opened still open,
 * exactly as a refused descent does on the subject page.
 *
 * Both boxes are checked because both are refusals a staged page would have
 * raised: a key naming nothing, and a key naming something with no extent to
 * aim at.
 */
const openFromIndex = (key: string): void => {
  try {
    extentOf(resolve(parseAutoMovieViewerSubjectKey(key)));
  } catch (error) {
    // Redrawn first so the ways in survive the refusal, then the reason is put
    // above them. `renderIndex` rebuilds from the same open set the address
    // carries, so the tree comes back as the reviewer left it.
    renderIndex();
    panel.prepend(
      line(error instanceof Error ? error.message : `${error}`, "stale"),
    );
    return;
  }
  const next = new URLSearchParams();
  next.set("shot", shotId);
  next.set("subject", key);
  // The address the row's own href already carries, so a click and a middle
  // click reach the same page.
  window.location.search = next.toString();
};

if (requestedKey === null) {
  renderIndex();
  openMemberOnClick(openFromIndex);
  status.textContent =
    `${shotId}: no subject named.\n` +
    "Add ?subject=<kind>:<id>, or pick one on the right.\n" +
    `rev=${revision}`;
} else
  try {
    await openSubjectPage(requestedKey);
  } catch (error) {
    // Written where the subject would have been as well as thrown, because a
    // page that fails only in the console looks to a reviewer like a page that
    // renders nothing for no reason.
    const message = error instanceof Error ? error.message : `${error}`;
    panel.replaceChildren(line(message, "stale"));
    status.textContent = `${shotId}: ${message}`;
    throw error;
  }
