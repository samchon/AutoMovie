# 설비, 물, 날씨와 Site 접점 {#building-envelope-service-water-weather-site-specification}

## 외피 Service Interface {#building-envelope-service-interface}

<!-- @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-exterior-services-interfaces building, interior와 map utility 사이의 service port, route, penetration과 equipment를 규정한다. -->

외피 service interface는 system identity, medium, unit, flow direction, building-side port, 상대 영역 port, route 또는 segment, boundary penetration과 phase state를 가진다. Building은 자기 envelope 안과 표면의 장비·route를 소유하고 interior와 map은 각자 경계 밖 network를 소유한다.

### Service 입력과 연결 출력 {#building-envelope-service-input-output}

<!-- @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-interior-interface interior shaft, riser, intake, exhaust와 exterior equipment를 같은 port identity로 연결한다. -->

입력은 building identity, system·port identity, position, orientation, profile 또는 size, medium, unit, allowed flow, boundary와 route endpoint를 제공한다. 출력은 matched port pair, resolved transform, connectivity, penetration 상태, open end와 downstream dependency이며 이름이 같은 두 port를 자동 연결하지 않는다.

### Penetration과 장비 불변식 {#building-envelope-service-penetration-equipment-invariant}

<!-- @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-envelope-penetration 외피 관통부의 cut, sleeve, seal, flashing, insulation과 clearance를 host assembly에 결속한다. -->

Penetration은 실제 host boundary와 layer stack을 절단하고 sleeve, annulus treatment, waterproof·air·fire·thermal continuity 중 project가 요구한 역할을 명시해야 한다. Exterior equipment는 support, service clearance, access, drainage와 visible attachment를 가지며 unrelated route와 같은 volume을 점유하지 않는다.

### Service 실패와 Exterior-only 호환성 {#building-envelope-service-failure-compatibility}

<!-- @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-exterior-only-service-scope exterior-only set이 외부에서 필요한 terminal과 장비만 소유하고 숨은 network를 발명하지 않게 한다. -->

Unmatched port, incompatible medium·unit·direction, duplicate connection, open required end, impossible slope, penetration 없는 boundary crossing, equipment collision과 stale counterpart는 실패다. Exterior-only set은 보이는 equipment와 boundary port까지만 표현할 수 있으며 경계 밖 network는 `out-of-scope`로 남겨 연결된 척하지 않는다.

## 날씨, 표면 상태와 배수 {#building-envelope-weather-drainage-state}

<!-- @evidence requirements/building-exterior/weather-drainage-and-temporal-state.md#building-weather-drainage-state 비, 눈, 젖음, 오염, 손상과 배수 경로를 시간·phase 상태로 결속한다. -->

Weather는 site-owned scenario이고 building은 그 scenario가 외피 surface, joint, opening, roof, balcony, equipment와 drain에 만드는 resolved state를 소유한다. Wetness, snow, dirt, corrosion, impact와 repair는 원래 material·element identity를 잃지 않는 temporal layer이며 appearance와 geometry change를 구분한다.

### Rainwater Path 입력과 출력 {#building-envelope-rainwater-path-input-output}

<!-- @evidence requirements/building-exterior/weather-drainage-and-temporal-state.md#building-rainwater-path roof, facade, balcony와 site receiving boundary를 잇는 rainwater path를 추적한다. -->

입력은 rainfall 또는 named event, catchment surface, slope, ridge·valley, gutter, inlet, downpipe, scupper, overflow와 receiving port를 제공한다. 출력은 source-to-sink path, contributing area, ponding depression, capacity fact 또는 unknown, overflow destination과 time state이다.

### 상태 연속성과 실패 {#building-envelope-weather-state-continuity-failures}

<!-- @evidence requirements/building-exterior/weather-drainage-and-temporal-state.md#building-exterior-state-continuity shot, phase와 alternative 사이에서 젖음·손상·수리 상태가 같은 story time에 모순되지 않게 한다. -->

서로 배타적인 상태가 같은 time·phase·alternative에 current일 수 없고 damage removal은 원인 event와 repair를 가져야 한다. Uphill flow, disconnected drain, negative quantity, hidden overflow, material state와 capture의 revision 불일치 및 분석 없이 충분하다고 표시한 drainage는 실패 또는 `unknown`이다.

## 건물 통합 Water {#building-envelope-integrated-water-state}

<!-- @evidence requirements/building-exterior/building-integrated-water.md#building-integrated-water fountain, pool, channel, water wall과 지붕·외피에 결합된 물의 경계, state와 검증을 규정한다. -->

건물 통합 water feature는 basin 또는 retaining boundary, building host space 또는 surface, water identity, static·flowing·simulated mode, level·depth 범위, inlet·outlet과 surface material을 가진다. 물의 solver나 자연 수계는 building이 소유하지 않고 별도 domain 또는 map water identity를 참조한다.

### Water 입력과 Map 접점 {#building-envelope-water-input-map-interface}

<!-- @evidence requirements/building-exterior/building-integrated-water.md#building-water-map-boundary building의 drain·overflow·intake가 map water와 shared port 및 datum으로 연결되게 한다. -->

입력은 host boundary, bed·rim, horizontal·vertical datum, authored water state, source·sink, simulation bound와 map-side port를 제공한다. 출력은 resolved extent, retained volume basis, building-to-map connection, time state, spill·overflow path와 solver status다.

### Water 검증과 정확성 경계 {#building-envelope-water-validation-boundary}

<!-- @evidence requirements/building-exterior/building-integrated-water.md#building-water-validation basin 누수, 음수 수심, rim escape, 잘못된 datum과 미실행 simulation을 구분한다. -->

Open retaining boundary, water below bed, negative depth, incompatible datum, source·sink 밖 volume change와 host 없는 binding은 실패한다. Authored static level은 시각적 연속성을 지원하지만 simulation을 실행하지 않았으면 flow, pressure와 수량 보존을 solved로 주장하지 않는다.

## Site 배치와 Seam {#building-envelope-site-placement-seam}

<!-- @evidence requirements/building-exterior/site-placement-and-orientation.md#building-site-placement 건물의 boundary, setback, ground contact, access, 주변 context와 map seam을 site-owned 배치에 결속한다. -->

Site placement는 building root transform, parcel 또는 authored extent, setback rule, ground-contact surface, access port, north 또는 project orientation, terrain·road·utility·water relation과 read-only context revision을 가진다. Building shape와 site placement는 별도 권한이지만 같은 world result를 생성한다.

### Site 입력과 접합 출력 {#building-envelope-site-input-seam-output}

<!-- @evidence requirements/building-exterior/site-placement-and-orientation.md#building-site-map-seams terrain, pad, foundation, access와 utility가 만나는 seam의 우선관계와 허용오차를 출력한다. -->

입력은 building footprint, world transform, site boundary, terrain 또는 pad, control point, approach route, utility·water port와 seam policy를 제공한다. 출력은 ground-contact line 또는 area, cut·fill·cover 관계, connected access, matched ports, residual과 gap·overlap finding이다.

### Site 변경과 호환성 {#building-envelope-site-change-compatibility}

<!-- @evidence requirements/building-exterior/site-placement-and-orientation.md#building-site-placement-change-impact site, transform와 terrain 변경이 건물 접촉, 접근, 설비, 물과 산출물에 미치는 영향을 전파한다. -->

Building은 site context가 없어도 local exterior set으로 유효할 수 있지만 world placement, setback와 terrain contact는 `not-run`이다. Site datum, terrain, parcel, access, utility, water 또는 root transform 변경은 ground contact, exterior circulation, drainage, lighting context, quantity와 capture를 stale로 만들며 이전 seam을 current로 유지하지 않는다.
