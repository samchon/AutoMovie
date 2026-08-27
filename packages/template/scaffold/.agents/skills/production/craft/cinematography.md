# Cinematography Handbook

Cinematography converts dramatic priority into viewpoint, scale, light, movement, and duration. Begin with what the viewer must feel and know at the end of the shot. Choose geometry only after that answer.

## Shot size as meaning

- Extreme wide makes environment, formation, distance, or isolation dominant.
- Wide shows full action, relation to ground, and blocking.
- Medium balances gesture with face and supports dialogue exchange.
- Close-up gives micro-expression, object detail, or decision narrative weight.
- Extreme close-up isolates a decisive fragment and withholds context.

Changing size changes meaning. A close-up is not merely a wide shot with less margin. Motivate the transition through discovery, pressure, intimacy, rupture, or release.

## Lens and distance

Focal length and camera distance work together. A long lens at distance compresses depth and separates a subject from the environment; a near wide lens exaggerates depth and motion and can distort faces or props. Keep the intended subject scale while testing how perspective affects spatial truth.

Use headroom, lead room, frame edges, negative space, and foreground layers deliberately. Preserve silhouettes at the delivery raster. Depth requires readable overlap, scale change, atmosphere, light separation, or motion parallax, not just different numeric z values.

## Continuity grammar

Establish the axis of action before cutting across it. Place successive cameras on one side of the 180-degree line so screen direction remains stable. When a crossing serves the story, declare the violation in style intent and reorient the viewer through a neutral-on-axis shot, visible camera move, subject movement, or a clear new establishing view.

Eyeline matching is a geometric promise: the look vector, camera side, subject screen position, and target placement must agree. Screen direction carries action across shots even when the camera changes. A left-to-right advance followed by unexplained right-to-left motion reads as reversal.

Match on action by overlapping authored motion and choosing a cut where direction, pose, velocity, and contact read as one event. Do not rely on equal timestamps alone.

## Camera motion

Pan or tilt to reveal, follow, compare, or withhold. Dolly changes spatial relation and perspective; zoom changes framing without moving through space. Truck, pedestal, orbit, crane, and handheld each imply different observation and energy. Every move needs a subject, start state, end state, and dramatic reason. A motion that only proves the camera can move is noise.

Ease camera starts and stops unless impact calls for discontinuity. Coordinate subject motion and camera motion so one does not accidentally cancel or amplify the other. Check minimum distance, target visibility, occlusion, raster bounds, and motion speed through the engine and acceptance gates.

A beat authors that move with a `frame` action naming the live camera, and it is the one declaration that outranks the staged camera. Staging chooses the side the lens watches from; the action keeps that bearing and solves the distance from its declared framing and its subject, so a camera staged forty metres out for an establishing wide is pulled to whatever distance a medium of one figure demands. Both declarations are legitimate together, and the action is the one that renders. A beat with no `frame` action locks the camera off exactly where staging put it.

That makes the staged transform an input rather than a result, so read the camera that will render from the compiled realization instead: each camera sample carries a `placement` at every review time whenever the shot compiled a move, and its absence means staging and the render agree. A shot whose frame looks wrong while every staged number reads correct is the shape of that difference.

That solve reads a measured box rather than a point. A `frame` action naming a node takes the extent that node's geometry actually draws, carried out through its own placement, aims at the middle of that box at the height its framing asks for, and stands at the further of the vertical and the horizontal fit. A sixty-metre facade is therefore centred and stood back far enough to hold its width, rather than aimed at whichever corner its element origin happens to sit on, and `orbit` sweeps its arc about that same aim point, so it circles the mass. Several staged bearings still show more of a building than one sweep can, so choose between them on what the coverage has to prove.

A `group` target is the multi-subject form of the same solve: it unions the nodes and formations it names into one box and frames that, which is how an elevation and the figure standing against it, a wing of two set pieces, or a crowd beside its landmark become one subject. Reach for it to state a composition, not to recover an extent one named node already measures.

## Light and color

Design key direction, fill ratio, practical motivation, contrast, and color separation around story state. Maintain continuity where the scene is continuous; change it only when time, location, perception, or dramatic state changes. Confirm that skin, uniforms, props, smoke, and terrain remain separable under the actual material and render path.

Atmosphere is a declared value, not a mood word. A set states its `fog` as an extinction density per meter and the color an infinitely distant surface tends toward, and every drawn surface is mixed toward that color by its camera depth. Half of a subject's own color survives at roughly `0.83 / density` meters, so `0.002` reads as the barely perceptible perspective of a wide vista, `0.01` as a clear day with a soft horizon, and `0.05` as heavy weather; zero renders exactly as no atmosphere at all. Match the color to the background or the horizon cuts a visible seam where fogged geometry meets unfogged sky. Reach for it before spending the particle budget on billboards standing in for haze. Judge it from a beauty frame only: structural passes suspend fog so the channel they exist to state stays exact, so a depth or mask frame will not show the atmosphere you declared.

## Render environment

A scene may declare a render `environment`, and it owns the photographic response of every beauty frame that scene produces: image lighting, its intensity and world rotation, the background, exposure, the tone-mapping curve, and the shadow-map policy.

Image lighting is what makes a physically-based interior read. An equirectangular HDR fills the roles a punctual rig cannot: sky through a window, bounce off a floor, the specular the metal and the glass in the shot are reflecting. State `image` for that, or a solid `background` colour for a scene with no environment to sample; the two are mutually exclusive, because a background painted over the image would be a second, contradictory sky.

Tone mapping has one owner. The render spec's `toneMapping` is the delivery default across a whole sequence; a scene that declares an environment overrides it, because the curve is chosen against that scene's own exposure and lighting and a night interior and a noon exterior do not share one. A scene that declares no environment keeps the spec's value, which is exactly what every production authored before environments existed renders.

That is the contract; the frame in front of you may be narrower. A scene's own environment always reaches the renderer, while the delivery default reaches it only when the page drawing the frame carries a `tone` parameter, and the scaffold's capture script does not set one. So judge a delivery curve from a page you opened with it, and read a captured review frame as the scene's own response until that gap closes.

Shadows are a declared cost, not a default. Enable them in the environment, choose the filter family deliberately, and give every casting light explicit map size, bias, normal bias, and near/far. A light that claims to cast without those settings is refused rather than staged with whatever a renderer happens to default to.

Reach for a rectangular area source when the light in the room comes from a surface: a window, a softbox, a strip, a luminous coffer. It is the one light kind with extent, and the soft wrap it gives is a function of its declared width and height rather than of an intensity tuned to imitate one. It lights physically-based materials only, and it casts no shadow map at all, so pair it with a punctual key when the shot needs occlusion; declaring `castShadow` on one is refused rather than silently ignored.

Judge all of it from beauty frames. Structural passes suspend image lighting, exposure, tone mapping and shadows exactly as they suspend fog, so depth, normal, mask and outline stay geometric facts. Frame-to-frame the compiled artifact and the renderer settings are deterministic; the pixels themselves are attributed to the target that produced them, so cite the capture, not a remembered look.

## Intentional rule breaking

Continuity rules are tools, not moral law. Break eyeline, axis, framing, exposure, focus, or stability only when the higher dramatic value is named and the result remains legible enough to achieve it. `styleIntent` records the reason and the violated rule; review checks whether the result serves that reason rather than excusing an accident.

The compile reads the edit and says what it found. An undeclared crossing, jump cut, eyeline break, screen-direction reversal, shot-size jump, or re-establish is reported as a warning naming both shots either side of the cut, so a break you meant to make and a break you did not are told apart by whether you declared it. A declaration that excepted nothing is reported too (`grammar-style-intent-unmatched`), because an intent covering a cut the reader never objected to is a note about a film that no longer exists. Declare the crossing itself as `axis-cross`; the other intents are named for the rule they excuse. None of this refuses a compile: the edit is yours, and the compiler's job is to make sure you know what it looks like.

That read measures the subject the camera was solved for, from the same box, and it takes a shot size from whichever axis the subject fills more of: its share of the frame's height, or its share of the frame's width. Because the solve stands at the further of the two fits, a mass the frame holds by its width fills less of the frame's height than its declared framing implies, so a height-only read would report a size no camera delivered and then ask you to move in until the ends of the mass left the frame. A subject with nothing horizontal to measure, the one [Contract targets](../contract-targets.md) describes as keeping a vertical segment at its root, is read vertically exactly as it always was.

For edit decisions, preserve Walter Murch's priority: emotion, story, rhythm, eye trace, two-dimensional screen plane, then three-dimensional continuity. A lower priority may yield to a higher one, but the trade must be observed and intentional.

## Coverage recipe

For each beat, design an establishing or orienting view when geography matters, the decisive readable action view, and only the reaction or detail coverage that changes interpretation. Mark required subjects, events, review times, and acceptance checks. Then inspect current captures at the intended raster, not only camera numbers.

## Look at the frames

A camera number is a claim about a frame; only the frame settles it. Capture at the production raster and never at a smaller one, because a downgraded frame can never discharge a required view.

1. `npm run preview` on the shot target at every review time the contract declares, in `beauty`.
2. `npm run preview` in a structural pass when the question is occlusion, silhouette separation, or depth rather than appearance.
3. State what those frames showed about composition, staging, and continuity in the evidence citation on the shot source that claims the scene is realized.

Judge from what came back, not from what the solve intended. `captured:false` is a refusal, not a frame.
