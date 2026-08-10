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

## Light and color

Design key direction, fill ratio, practical motivation, contrast, and color separation around story state. Maintain continuity where the scene is continuous; change it only when time, location, perception, or dramatic state changes. Confirm that skin, uniforms, props, smoke, and terrain remain separable under the actual material and render path.

Atmosphere is a declared value, not a mood word. A set states its `fog` as an extinction density per meter and the color an infinitely distant surface tends toward, and every drawn surface is mixed toward that color by its camera depth. Half of a subject's own color survives at roughly `0.83 / density` meters, so `0.002` reads as the barely perceptible perspective of a wide vista, `0.01` as a clear day with a soft horizon, and `0.05` as heavy weather; zero renders exactly as no atmosphere at all. Match the color to the background or the horizon cuts a visible seam where fogged geometry meets unfogged sky. Reach for it before spending the particle budget on billboards standing in for haze. Judge it from a beauty frame only: structural passes suspend fog so the channel they exist to state stays exact, so a depth or mask frame will not show the atmosphere you declared.

## Intentional rule breaking

Continuity rules are tools, not moral law. Break eyeline, axis, framing, exposure, focus, or stability only when the higher dramatic value is named and the result remains legible enough to achieve it. `styleIntent` records the reason and the violated rule; review checks whether the result serves that reason rather than excusing an accident.

The compile reads the edit and says what it found. An undeclared crossing, jump cut, eyeline break, screen-direction reversal, shot-size jump, or re-establish is reported as a warning naming both shots either side of the cut, so a break you meant to make and a break you did not are told apart by whether you declared it. A declaration that excepted nothing is reported too (`grammar-style-intent-unmatched`), because an intent covering a cut the reader never objected to is a note about a film that no longer exists. Declare the crossing itself as `axis-cross`; the other intents are named for the rule they excuse. None of this refuses a compile: the edit is yours, and the compiler's job is to make sure you know what it looks like.

For edit decisions, preserve Walter Murch’s priority: emotion, story, rhythm, eye trace, two-dimensional screen plane, then three-dimensional continuity. A lower priority may yield to a higher one, but the trade must be observed and intentional.

## Coverage recipe

For each beat, design an establishing or orienting view when geography matters, the decisive readable action view, and only the reaction or detail coverage that changes interpretation. Mark required subjects, events, review times, and acceptance checks. Then inspect current captures at the intended raster, not only camera numbers.
