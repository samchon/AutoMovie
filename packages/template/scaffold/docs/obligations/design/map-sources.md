# Map source obligations

These obligations divide the work of turning reviewed world designs into stable engine-facing records across the selected map-source population without making source a second world author.

## Design-owned world construction {#map-source-design-ownership}

Every exported owner realizes one reviewed map document and introduces no unreviewed extent, coordinate interpretation, feature, network, site interface, phase, population, source adoption, or level-of-detail rule.

Review question: can every emitted world fact and derivation be traced to exactly one reviewed map H2?

Sources: [NASA on bidirectional requirement traceability](https://www.nasa.gov/reference/system-engineering-handbook-appendix/); [OGC CityGML 3.0 on explicit semantic and spatial object structure](https://docs.ogc.org/is/21-006r2/21-006r2.html)

## Deterministic resolved world {#map-source-deterministic-world}

Equal reviewed inputs emit identical feature identities, coordinate transforms, topology, states, populations, partitions, and derived quantities regardless of traversal, tile-load, or evaluation order.

Review question: do repeated and differently ordered builds preserve the same identities, bounds, relations, routes, quantities, and states?

Sources: [OGC Topic 2 on coordinate operations](https://docs.ogc.org/as/18-005r5/18-005r5.html); [ECMAScript language specification](https://tc39.es/ecma262/)

## Preserved source lineage {#map-source-preserved-lineage}

Every adopted or authored input keeps its identity, coverage, reference system, accuracy or uncertainty, transformation, conversion loss, and contribution to the resolved features it produced. A derived world view or quantity does not erase the distinction between source fact, authored override, and computed result.

Review question: can every emitted world fact be followed back through the exact current inputs and transformations that authorize it?

Sources: [W3C PROV-O on derivation](https://www.w3.org/TR/prov-o/); [W3C Data Quality Vocabulary on quality measurements and provenance](https://www.w3.org/TR/vocab-dqv/)

## Invalid or incomplete worlds are refused {#map-source-invalid-world}

Missing source coverage, unresolved coordinate or datum conversion, gaps and overlaps, disconnected required networks, invalid crossings, broken terrain or water contact, incompatible site interfaces, contradictory phases, and incomplete required partitions produce exact diagnostics or bounded unavailable results rather than guessed, closed, or silently substituted world data.

Review question: does each invalid or incomplete map case fail or degrade with the exact feature, relation, source, extent, and affected output named?

Sources: [OGC CityGML 3.0 conformance classes](https://docs.ogc.org/is/21-006r2/21-006r2.html#toc45); [NASA on verification results and requirement identity](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)
