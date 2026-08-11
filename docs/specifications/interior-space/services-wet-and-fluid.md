# Service, Wet Area와 Fluid

## Interior service network {#interior-space-service-network-contract}

<!-- @evidence requirements/interior/services-and-environment.md#interior-services-environment Requires building services as networks rather than decorative objects. -->
<!-- @evidence requirements/interior/services-and-environment.md#interior-service-routing Requires bounded routes, sections, and clearances. -->
<!-- @evidence requirements/interior/services-and-environment.md#interior-service-terminals-controls Requires typed terminals, equipment, and controls. -->
<!-- @evidence requirements/interior/services-and-environment.md#interior-service-capacity-environment Requires authored capacity, demand, and environmental consequences. -->
<!-- @evidence requirements/interior/services-and-environment.md#interior-service-network-validation Requires connectivity and compatibility validation. -->
<!-- @evidence requirements/interior/services-and-environment.md#interior-service-exterior-interface Requires shared exterior ports and penetrations. -->
<!-- @evidence requirements/interior/services-and-environment.md#interior-service-vibration-noise Requires vibration and noise consequences to be declared. -->

Water, drainage, power, data, HVAC, fire와 control은 system, typed node·port, directed 또는 undirected segment, route section, junction·valve·switch state, penetration, capacity·demand unit, support, maintenance clearance와 heat·noise·vibration consequence를 입력으로 받는 network다. Geometry와 connectivity는 같은 route identity를 공유하고 decorative pipe나 fixture mesh가 연결 사실을 대신하지 않는다. 출력은 canonical network, open·connected·isolated state, occupancy conflicts, capacity comparison이 가능한 declared facts와 unresolved gap을 제공한다. Missing port, incompatible medium·unit, reversed flow, unsealed penetration, route collision, blocked service volume와 capacity 초과는 failure이고 전문 hydraulic·electrical·air 성능을 실행하지 않았다면 topology pass와 분리해 `not-run`으로 남긴다.

## Envelope와 map service interface {#interior-space-service-interface-boundary}

<!-- @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-interior-interface Requires shared ports at the interior-envelope crossing. -->
<!-- @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-envelope-penetration Requires a real cut, sleeve, seal, weather boundary, and clearance. -->
<!-- @evidence requirements/map/infrastructure-and-utilities.md#map-infrastructure-utilities Requires building services to terminate at explicit map-network interfaces. -->

연결된 interior route가 slab, wall, roof 또는 envelope를 통과할 때 동일한 port·penetration identity, medium, direction, section, elevation, capacity 또는 demand, sleeve·seal·fire·weather condition과 phase를 exterior가 함께 읽어야 한다. Map utility는 building connection point까지만 shared network identity와 coordinate를 제공하고 interior가 광역 공급망을, map이 내부 분기망을 임의 완성하지 않는다. 출력은 interface 상태와 양쪽 dependency freshness를 제공하며 open end, 다른 datum, 누락 cut, seal 없는 wet·weather boundary와 maintenance access 충돌은 coordination failure다. Exterior-only stub나 map-unavailable state는 `capped`, `open`, `unknown` 또는 `out-of-scope`로 명시하고 connected로 추정하지 않는다.

## Wet zone과 waterproof assembly {#interior-space-wet-zone-waterproofing}

<!-- @evidence requirements/interior/wet-areas-and-waterproofing.md#interior-wet-areas-waterproofing Requires wet zones and waterproofing as hidden but verifiable facts. -->
<!-- @evidence requirements/interior/wet-areas-and-waterproofing.md#interior-waterproof-assembly Requires membrane extent, laps, upturns, and penetrations. -->
<!-- @evidence requirements/interior/wet-areas-and-waterproofing.md#interior-wet-slope-drainage Requires floor fall and drains to compose. -->
<!-- @evidence requirements/interior/wet-areas-and-waterproofing.md#interior-wet-dry-transition Requires explicit thresholds and transitions. -->
<!-- @evidence requirements/interior/wet-areas-and-waterproofing.md#interior-waterproofing-finding Requires addressable leak-risk findings. -->

Wet zone 입력은 logical space, `dry`·`damp`·`wet`·`immersed` grade, membrane boundary, layer order, lap·upturn·termination, drain·overflow·supply, penetration sealing, floor slope field와 wet-dry threshold를 가져야 한다. Finish texture가 방수 assembly를 증명하지 않으며 membrane은 host cut과 service sleeve를 실제로 감싸야 한다. 출력은 각 point의 drainage target, dry transition, standing-water risk, unsealed penetration과 hidden-layer quantity를 제공한다. Wet 또는 immersed zone의 zero·reversed slope, 막힌 drain, 끊긴 membrane, insufficient upturn, unsealed sleeve와 threshold overflow는 failure이며 전문 hygrothermal 분석이 없으면 waterproof topology success와 moisture performance를 분리한다.

## Water feature와 독립 fluid domain {#interior-space-water-feature-fluid-domain}

<!-- @evidence requirements/interior/water-and-fluid-features.md#interior-water-fluid-features Requires authored indoor water features without making fluid building-owned. -->
<!-- @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Requires real volume, level, and containment. -->
<!-- @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Requires sources, sinks, flow, and spray as explicit state. -->
<!-- @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Requires solver inputs and initial state to be distinct from results. -->
<!-- @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-material-interaction Requires contact with material and waterproof boundaries. -->
<!-- @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-refusal Requires unsupported simulation claims and invalid domains to fail. -->

Pond, basin, channel, fountain, waterfall, tank와 spray는 host building space·boundary identity를 참조하지만 별도 fluid domain을 입력으로 가진다. Domain은 bounds, resolution·budget, boundary condition, fluid property, initial level·velocity, source·sink·drain, collision surface, wet material relation, clock와 deterministic settings를 선언한다. 출력은 static authored level 또는 solver-produced samples, mass balance, overflow·leak·collision finding과 renderable surface를 상태별로 구분한다. Open containment, source 없는 persistent flow, sink보다 낮지 않은 drain, invalid initial state, budget 초과와 solver 미실행을 animated fluid로 표시하는 행위는 failure이며 unsupported consumer는 명시적 static representation만 채택할 수 있다.
