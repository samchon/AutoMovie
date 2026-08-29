# Spatial Design Handbook

Spatial design turns authored world features, topology, boundaries, surfaces, and populations into one coherent place. The map, space, material, and instance principles and obligations decide what those branches must own. This document owns how to judge the result without replacing those contracts or supplying a map, plan, style, finish, or asset catalogue.

Use it for a film set, a bounded brief, or a standalone library, including a reusable 3D environment, surface, or population. Dramatic framing may reveal the work, but neutral spatial judgment comes first because a flattering shot can hide a disconnected room, an impossible threshold, an exterior-interior mismatch, or a repeated population blocking the route it was meant to serve.

## Judge the declared work

Begin with one observable question about one exact revision: which place or route is being judged, who or what must use it, under which production condition, and what result would falsify the design. A family house, a warehouse aisle, a plaza, a spacecraft compartment, and an abstract motion volume do not share one ideal plan. Judge each against the production's own use, access, setting, references, capabilities, and constraints.

Do not import a preferred floor-plan type, period rule, furniture set, or material palette. When the production claims an era, structural language, fidelity ceiling, or reference relationship, ask whether its own decisions agree with that claim. Judge the promised blocking representation rather than demanding unpromised finish, but never use the prototype ceiling to excuse wrong topology, dimensions, clearance, placement, or envelope agreement. When the production makes no style or era claim, do not invent one in review.

## Read the world before the site

When maps are active, begin at their declared extent, coordinate and vertical reference, current phase, source-resolution boundary, and review scale. Trace the terrain, water, vegetation, land use, settlement, transport, infrastructure, weather, and temporal owners the production actually selected. Do not demand an unused world family, but do not let a background image, imported terrain, or settlement label stand in for the selected features and relations that must exist in the resolved world.

Follow one consequential chain across owners: source or authored feature, resolved world identity, contact and dependency, route or state consequence, derived view, and falsifying observation. A road that floats above terrain, water that ignores its banks, vegetation rooted on an excluded surface, a bridge that joins no network, or a seasonal state that changes the image without changing the governed world is a spatial defect even when each isolated asset looks plausible.

Read the map-space interface in both directions. Map owns the site or parcel boundary as a world feature, the external terrain and network, and the approach through one named access node. Spaces consumes that boundary and node and owns the site and building topology, dimensions, openings, and routes within it. Confirm that the coordinate transform, boundary, grade, contact, and access point agree without asking either branch to restate the other's geometry. A settlement footprint may locate a building at world scale; it does not authorize map to invent the building envelope or spaces to move the road outside the site.

Use a map or plan for horizontal relations, a section or profile for height and ground contact, a route or network query for continuity, a state comparison for temporal change, and a source-resolution comparison for provenance and uncertainty. Inspect seams and representative worst cases at the scale promised by the design. A global view cannot prove a site entrance connects, and one detailed tile cannot prove the world joins across its boundary.

## Read the plan as a graph

A readable plan gives every storey, zone, room, boundary, opening, and connector one legible place in a single containment and adjacency graph. Trace from the site or building entrance to each required destination. The route must cross named thresholds in a physically possible order; a line that jumps between nearby rooms is not a route.

Look for an orphaned room, a connector that lands in no usable zone, two spaces that overlap without a declared relation, a boundary that separates the wrong regions, a doorway whose leaf exists but whose host has no void, and an arrival that requires crossing a private, dangerous, or service-only area the production said to avoid. Public and service circulation need separation only when the work declares different users or purposes for them.

Plan clarity is not rectangular neatness. A complex organization can be legible when its hierarchy, entries, choices, landmarks, and returns are intentional. A simple rectangle can fail when the only route dead-ends, the destination is hidden behind an unrelated room, or the plan's labels describe connections the built boundaries do not admit.

## Measure before interpreting

For a film or brief whose compiled shots stage a built environment, follow [Building reports](../review-verification/measurements.md#building-reports) and run `npm run building:report` against current state. Read the `space` schedule before inventing a second room index. Each space row keeps its `parent`, `adjacent`, `connectors`, bounded `contents`, authored `place.declared` box, and measured `place.content` box. A large declared cell with a small content box may be deliberate emptiness, a sparse room, or missing realization; the two boxes expose the question but do not answer it for you.

The standard report derives one plan per building unit at world Y = 1.2 metres, plus one reflected ceiling plan, section, elevation, services plan, and finish plan. One root plan is not automatically one plan per storey, and the fixed world cut is not automatically relative to a raised unit. If the required level is not actually exposed by that cut, the review set needs a production-owned view at the relevant level before anyone claims that storey was checked.

Read every reported gap and remedy at the artifact that produced it. Use each as a question for the owning design and actual view rather than turning the total into a good-building or bad-building verdict. The measurement guide owns the command's empty-population and library boundaries; this guide owns the spatial judgment made from an applicable report.

## Walk circulation

Trace the actual route in order, not only its endpoints. Start outside the entrance, cross each opening and connector, turn where the user turns, and arrive where the task occurs. Repeat for every independently required actor, camera, operator, vehicle, or service path. Check the production's declared clear width and height through the whole route, including the swept travel of doors and other operable leaves.

The plan settles topology and nominal dimensions. Traversal settles sequence, orientation, occlusion, and the clearance left after contents and populations are placed. A route can be connected in the graph and still fail because a repeated set blocks it, a door opens into its narrowest point, the next threshold cannot be found from the current one, or the destination is visible only after walking past it.

Walk both directions where return matters. A legible arrival can become an illegible exit, and a stair or ramp that reads from below can lose its landing from above. For a staged environment, `npm run viewer` exposes `viewer/inspect.html?shot=<id>` as a hand-driven route through the compiled opening state. It writes no receipt and its free camera can pass through geometry, so use it to inspect orientation and sequence, not to prove clearance or collision. Record the exact start, destination, route, user, coordinates, and obstruction rather than reporting that circulation generally feels wrong.

## Read openings, light, privacy, and view together

An opening is a relation among its host boundary, the regions it connects, the exterior or interior face it changes, and the light, sight, access, ventilation, or service purpose the production assigns it. Confirm the void exists in the host instead of accepting a leaf or frame as proof that the wall was opened.

Judge orientation and time only from the site's and production's declared basis. Window count alone does not prove daylight, and a bright beauty frame may be exposure or image lighting rather than useful illumination. A declared daylight study may measure a stated workplane and sun/sky context; a missing context stays `not-run` rather than becoming a guessed climate.

Privacy and view are exchanges, not quantities to maximize. Follow the line of sight from the relevant eye positions in both directions, then compare what is revealed or screened against the work's own access conditions. A view that serves one room may expose another, and an opening that lights a route may erase the separation the route was meant to preserve.

## Judge proportion and scale in use

Compare storey height to plan depth, opening size and spacing to the wall that holds them, connector rise and run to its landings, and room volume to the bodies and actions it must contain. Use declared dimensions and measured extents as the basis, then look at the place from the height and distance of its intended user. Numbers can prove a clearance and still fail to make the scale readable.

Look for scale drift across owners: an exterior that implies one storey count while the section carries another, furniture or equipment that makes a nominally large room unusable, a door sized from its leaf instead of its void, or repeated members whose density changes the apparent scale and access of the space. Do not repair a scale failure by shrinking the observing camera or omitting the comparison subject.

## Reconcile exterior and interior

Read the building as one envelope. Match every consequential level, opening, shared surface, roof or floor edge, and vertical connector across plan, section, elevation, exterior perspective, and interior perspective. An attractive elevation and a workable room plan still fail together when they describe different storey datums or when an exterior opening reaches no interior region.

Use the section to test relationships a plan or elevation can hide: floor-to-floor height, slab and roof position, stair or ramp continuity, ceiling clearance, opening head and sill, and the thickness between exterior and interior faces. Use the elevation to test whether the openings and levels exposed outside are the ones the plan and section own. Treat a filling element measured in a schedule as a leaf, not proof of a host void.

## Read surfaces and populations as spatial consequences

A material belongs to a stable host surface, and an instance belongs to a reviewed prototype and placement rule. Judge their spatial result without taking ownership away from those branches. Construction and finish should agree with the production's declared structure, environment, use, and era; repeated populations should preserve the routes, clearances, hierarchy, and density their space owners require.

Inspect junctions, edges, orientation, texture scale, face assignment, and transitions under repeatable conditions before dramatic light hides them. Repeatable does not mean a flat wash: use a directional key or normal view that reveals form for geometry, and the material branch's declared neutral sample for surface response. When texture scale is an authored claim, follow [Texture scale](../review-verification/measurements.md#texture-scale) and judge its census and findings against the visible surface rather than treating a command exit as review. For a population, inspect representative members and the worst cases: thresholds, corners, edges, steep terrain, tight clearances, tier transitions, and hero overrides. A bounded room-schedule `contents` sample is an index, not proof that every repeated member was seen; keep `contents.length + omittedContents` as the exact total and the omitted count in the review basis.

Repetition should reveal an authored rule rather than evaluation order. Random-looking variation is still deterministic work and needs a declared seed and bounds. A member whose silhouette, construction, or role changes beyond the permitted variation returns to its prototype or material owner instead of becoming an unexplained exception in placement.

## What each observation can falsify

| Observation | Look for | A defect it can expose |
| --- | --- | --- |
| Map | extent, coordinates, terrain and water, networks, land use, population, phase, site boundary | a disconnected access road, a feature in the wrong datum, a source gap disguised as terrain, or a phase change that leaves stale routes |
| Plan | containment, adjacency, thresholds, route choice, usable width, population footprint | an orphaned zone, a blocked path, a door with no wall void, or a service route crossing the public one against declared intent |
| Section | levels, heights, slab and roof relation, stairs and ramps, vertical openings, clear headroom | incompatible storey datums, a connector missing its landing, or an exterior opening at no interior height |
| Elevation | massing, storey expression, opening rhythm and ownership, envelope continuity, material transitions | a blank host behind an authored opening, an outside level absent inside, or a finish boundary with no construction reason |
| Perspective | human scale, depth, threshold sequence, junctions, material reading, view and privacy | a room that measures correctly but reads at the wrong scale, an obscured entrance, or an exposed private zone |
| Traversal | ordered access, orientation, occlusion, turning and operating clearance, return path | a graph-connected route that cannot be followed, found, or passed by its declared user |

No single observation substitutes for another. A world map cannot prove a site threshold, a plan cannot prove eye-level orientation, a perspective cannot prove a continuous route, and a traversal cannot reconcile an unseen roof or floor datum. The applicable map and space review sets are finite because each view answers a different failure class.

## Look at the place

Spatial quality is a relation among observations, so finish by opening the complete review set rather than choosing one favourable view.

1. When maps are active, open their declared map or plan views, profiles or sections, network and route results, state comparisons, source-resolution comparisons, and boundary or seam checks at the exact reviewed revision. Name the extent, coordinate basis, phase, scale, selected feature families, and sample limits.
2. For a staged film or brief environment, follow the building-report procedure, open the relevant plan, section, elevation, schedule rows, and gaps, and name the exact report revision. For a library, open the neutral observation population its reviewed space design declared; do not substitute the staged-shot command's empty result.
3. Open the current neutral perspectives for the exact spaces, surfaces, and populations under review. Follow [inspection](../review-verification/inspection.md) for stable subject identities, content versus declared bounds, sections, and the limit of the hand-driven subject page.
4. Traverse every required route from its declared start to destination and back where return matters, beginning on the external map network when that approach is promised. For a staged environment, use the hand-driven inspection page to see the sequence and the report or engine measurements to settle dimensions and obstruction. Name the revision, start, destination, user, viewpoint or coordinates, and any sample limit.
5. State what the map, plan, section, elevation, perspectives, state comparisons, and traversal actually showed in the evidence citations on the design or source owners that claim the result is realized. A citation that names no observation is not a spatial judgment.

The report provides measurements and the views provide observations. Neither writes the verdict for you.
