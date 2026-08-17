# Building Services

Water, drainage, power, data, air, fire suppression, and control as one computational object, plus the wet zones a building grades. Read this when the work carries a system rather than only rooms.

The building itself is `BUILT_ENVIRONMENT`. What a service network is then drawn or scheduled into is `BUILDING_STUDIES`.

## Service networks and wet zones

Water, drainage, power, data, air, fire suppression, and control are one computational object rather than one record each. A service network holds systems, nodes carrying typed ports, segments joining exactly two ports, penetrations where a run crosses a boundary, and wet zones. Giving each discipline its own record would make "is this connected" a separate question with a separate answer for every discipline in the list.

A system is the smallest thing that can be asked whether everything on it is fed: one discipline from `plumbing`, `drainage`, `electrical`, `data`, `hvac`, `fire`, or `control`; one medium the discipline permits; the unit every capacity and demand is stated in (`cubic-meter-per-second`, `watt`, `ampere`, `bit-per-second`, `dimensionless`); a `flow` of `from-root`, `to-root`, or `undirected`; the node it is rooted at; and a design capacity the declared demands are summed against. Cold water off one riser, the recirculating hot leg, one lighting circuit, one supply trunk, and the sprinkler main are five systems.

A node is a `source`, `fixture`, `equipment`, `terminal`, `junction`, or `valve`, and it is authored by the production with the ports it actually has. There is no fixture library, no pipe schedule, and no equipment model here, and there will not be: a basin, a sprinkler head, and a distribution panel are your nodes. What the record owns is the part a render that merely looks plumbed cannot prove. Every port is joined to something, the medium and unit agree end to end, a run crossing a boundary declares the sleeve it passes through and whether that annulus was made good, two disciplines do not occupy the same cubic metre, and the space a panel needs in order to be opened stays clear.

A wet zone binds a logical space to a `dry`, `damp`, `wet`, or `immersed` grade and states the membrane boundaries it covers, how far the membrane turns up beyond the floor, the fall of the floor as a rise-over-run ratio, the drains it falls to, and the thresholds where it hands over to a drier region. Those are the facts a leak is found in and none of them are visible in a still frame. A `wet` or `immersed` zone with a zero slope is water standing where it lands, and an unsealed sleeve through a membrane is a leak the render cannot show. A drainage run that ends in a floor gully composes the fluid domain below rather than inventing a second model of moving water.

Declare the network from shot source, where it is validated with the building it serves, and draw it from a project script. `lowerServiceNetwork` sweeps a regular section along every authored centre line and refuses an invalid graph outright, because a picture of a working installation placed in front of the reason it does not work is the one outcome this record exists to prevent. `lowerWetZoneDrainage` turns a zone's own supply inlets and drains into the sources and sinks of the fluid domain standing in that room, which is how a floor that falls to a gully composes the water solver instead of describing water twice. A zone whose room holds no declared domain has nothing to drain into, and `npm run building:report` reports that as `not-run` rather than lowering an installation that appears to drain.

## Look at what the run does to the room

A network that validates is a network whose graph is complete. Whether a run crosses a room where nothing should cross it, or lands a terminal where a camera will see it, is a question about the picture.

`inspectSubject({ shot, subject })` on the space a run passes through shows it in place, sectioned automatically because a service run is exactly the thing an outer wall hides. `BUILDING_STUDIES` owns the drawn service view when what you need is the schematic rather than the room.

Record the verdict with `prepareReview` and `submitReview` under `REVIEW_SUBJECT`, on the space or the element that carries the run.
