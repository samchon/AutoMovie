# 건축 요소, Furnishing과 Clearance

## 건축 요소의 host, support와 form {#interior-space-element-host-support-form}

<!-- @evidence requirements/interior/columns-beams-and-architectural-elements.md#interior-architectural-elements Requires open architectural element roles. -->
<!-- @evidence requirements/interior/columns-beams-and-architectural-elements.md#interior-structural-decorative-distinction Requires structural and decorative claims to remain distinct. -->
<!-- @evidence requirements/interior/columns-beams-and-architectural-elements.md#interior-element-host-penetration Requires host, support, attachment, and penetration relations. -->
<!-- @evidence requirements/interior/columns-beams-and-architectural-elements.md#interior-element-open-form Requires arbitrary built forms without catalogue lock-in. -->
<!-- @evidence requirements/interior/columns-beams-and-architectural-elements.md#interior-element-support-gap Requires unsupported or disconnected elements to be reported. -->
<!-- @evidence requirements/building-exterior/structure-and-envelope.md#building-structure-interior-coordination Requires linked columns, beams, slabs, cores, and shafts to share identity and position. -->

Column, beam, core, stair, railing, molding, screen, platform, built-in feature와 사용자 정의 architectural element는 stable identity, owner, parent-local transform, open roles, geometry 또는 adopted prototype, host·support·attachment·penetration, assembly, state와 phase를 입력으로 받는다. Structural 역할은 사용자가 제공한 사실이며 support relation의 형상 검증과 전문 구조 성능 해석을 구분하고, decorative element가 보를 닮았다는 이유로 하중 경로를 발명하지 않는다. 출력은 resolved full transform, support·host graph, affected boundary cut와 visible occurrence를 제공한다. Floating element, cycle, missing host, containment escape, linked exterior structure와의 section·position 불일치와 unsupported performance claim은 failure이며 새 element kind는 open vocabulary로 호환된다.

## Furniture, fixture와 equipment 배치 {#interior-space-furniture-fixture-equipment-placement}

<!-- @evidence requirements/interior/furniture-fixtures-and-equipment.md#interior-furniture-fixtures-equipment Requires arbitrary FF&E rather than a fixed catalogue. -->
<!-- @evidence requirements/interior/furniture-fixtures-and-equipment.md#interior-object-anchor-support Requires explicit anchors and supports. -->
<!-- @evidence requirements/interior/furniture-fixtures-and-equipment.md#interior-object-use-clearance Requires occupancy, use, operation, and maintenance envelopes. -->
<!-- @evidence requirements/interior/furniture-fixtures-and-equipment.md#interior-built-in-loose-distinction Requires built-in and loose items to have different ownership and phase behavior. -->
<!-- @evidence requirements/interior/furniture-fixtures-and-equipment.md#interior-story-prop-relation Requires architectural inventory and story props to remain related but distinct. -->
<!-- @evidence requirements/interior/furniture-fixtures-and-equipment.md#interior-object-placement-refusal Requires unsupported, colliding, or unusable placements to fail. -->

FF&E 입력은 arbitrary prototype 또는 native geometry, identity, placement transform, containing space·zone, anchor·support·fastener, built-in·loose·story-prop role, footprint·bounds, seating·grasp·control affordance, movable state, service ports와 install·use·maintenance envelopes를 가진다. Explicit placement, rule-generated candidates와 constraint-resolved result를 구분하고, 규칙 배치는 stable seed와 rejected candidate count를 보존한다. 출력은 resolved occurrence, support contact, current operation envelope, service connection과 inventory relation을 제공한다. Surface 밖 anchor, unsupported mass, collision, blocked door·route·panel, unreachable control, disconnected required port와 authored count 미달은 failure이며 placeholder는 accepted final furnishing으로 표시하지 않는다.

## Anthropometric clearance와 접근성 {#interior-space-anthropometric-accessibility-clearance}

<!-- @evidence requirements/interior/clearance-anthropometrics-and-accessibility.md#interior-clearance-anthropometrics-accessibility Requires explicit body and mobility profiles. -->
<!-- @evidence requirements/interior/clearance-anthropometrics-and-accessibility.md#interior-static-dynamic-clearance Requires static, movement, operation, and maintenance envelopes. -->
<!-- @evidence requirements/interior/clearance-anthropometrics-and-accessibility.md#interior-accessible-route Requires route continuity against a declared profile. -->
<!-- @evidence requirements/interior/clearance-anthropometrics-and-accessibility.md#interior-reach-operation Requires reach and operating force facts to be separated. -->
<!-- @evidence requirements/interior/clearance-anthropometrics-and-accessibility.md#interior-jurisdiction-profile Requires project-selected jurisdiction assumptions. -->
<!-- @evidence requirements/interior/clearance-anthropometrics-and-accessibility.md#interior-sightline-privacy Requires authored sightline and privacy scenarios. -->
<!-- @evidence requirements/interior/clearance-anthropometrics-and-accessibility.md#interior-accessibility-validation-level Requires honest validation levels and unknown states. -->

Clearance 검사는 사용자 또는 프로젝트가 선택한 body·mobility·reach profile, mobility aid, jurisdiction·edition, tolerance와 scenario를 입력으로 받아야 한다. Static occupancy, approach·turn·transfer·egress path, door·drawer·chair sweep, use·maintenance volume, reach range, control force, headroom와 sightline·privacy ray를 서로 다른 측정으로 유지한다. 출력은 subject, location, measured clearance, required bound, profile, state, result와 근거를 제공하며 route geometry 또는 force data가 없으면 `not-run`이나 `unknown`으로 남긴다. 최소 한 profile의 통과를 universal accessibility로 확대하거나 전문 code compliance로 주장하지 않으며, 실패하는 placement는 다른 profile을 자동 선택해 숨기지 않는다.

## Soft furnishing과 interior planting {#interior-space-soft-furnishing-planting}

<!-- @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-materials-plants Requires soft furnishings and plants as authored domains. -->
<!-- @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Requires anchors and host relations. -->
<!-- @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Requires collision and clearance boundaries. -->
<!-- @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Requires deterministic growth and placement state. -->
<!-- @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Requires bounded simulation and honest unsupported states. -->

Curtain, fabric panel, upholstery, hanging textile와 interior planting은 건축 record와 별도인 authored domain으로 입력되되 building space, rail·hook·pot·planter·support와 stable relation으로 결합한다. Rest shape, anchors, mass·stiffness·damping, collision scope, named state, solver budget와 seed를 선언하고 plant는 growth law, pruning envelope, stage, member count, spacing과 placement seed를 가진다. 출력은 resolved rest 또는 simulated state, rejected placement, collision finding와 support bounds를 제공한다. Missing anchor, 초기 관통, clearance 침범, budget 초과, nondeterministic solver와 실행되지 않은 self-collision을 solved로 표시하는 행위는 failure이며 simulation을 지원하지 않는 consumer는 pinned rest state와 explicit degradation만 사용할 수 있다.
