# Rig, deformation과 retargeting

## Skeleton, rest와 bind 계약 {#performance-rig-skeleton-rest-bind-contract}

### Skin, rigid binding과 morph channel {#performance-rig-skin-rigid-morph-deformation}

<!-- @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-skeleton-rig-retargeting actor motion을 운반하는 rig의 정규화 경계를 정의한다. -->
<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-general-joint-relations 인물과 물체 모두의 joint graph를 같은 관계 원칙으로 다룬다. -->
<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-state-motion-distinction rig 상태와 그 위를 흐르는 motion을 구분한다. -->

Rig record는 stable rig identity, node 또는 bone hierarchy, parent-local rest transform, bind transform과 inverse bind 기준, semantic joint·control mapping, unit·axis·handedness, root와 scale 기준을 가진다. Rest는 articulation zero의 local state이고 bind는 skin weight를 해석하는 deformation 기준이므로 둘을 같다고 가정하지 않으며, source가 둘 중 하나만 제공하면 어떤 규칙으로 다른 하나를 만들었는지 derivation과 residual을 기록한다. 계층은 하나의 명확한 root 또는 선언된 여러 root 정책을 가져야 하고 cycle, dangling parent, duplicate semantic slot, non-finite transform, zero-length 필수 chain을 거부한다.

Rig output은 원본 source identity와 정규화된 hierarchy를 모두 보존하고, 변환 receipt에 source basis, target basis, rest conversion, scale factor, 이름이 아닌 authoritative mapping 근거, 손실과 override를 포함한다. 직접 생성 rig와 외부 rig는 이 정규화 이후 같은 pose·motion 계약을 받지만, 출처가 다르다는 사실과 원본 rest/bind 데이터는 사라지지 않는다.

<!-- @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation deformation 방식마다 rest와 bind의 의미를 검증한다. -->
<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface skin과 deformable surface의 binding을 명시한다. -->
<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-derived-deformation-basis 파생 deformation basis의 lineage를 보존한다. -->
<!-- @evidence requirements/actors/appearance-costume-and-attachments.md#actor-rigid-soft-binding rigid와 soft attachment가 서로 다른 state와 검증을 갖게 한다. -->

Deformation binding은 `rigid`, `skinned`, `morph`, `soft` 중 적용 mode와 대상 geometry identity를 명시한다. Rigid part는 정확히 하나의 parent frame과 local offset을 따르고, skinned surface는 joint set, per-vertex influence, normalized weight와 bind basis를 가지며, morph channel은 stable semantic name, neutral weight, 유효 범위, target topology identity를 가진다. Soft surface는 고정 boundary, rest state, solver 또는 baked-cache identity와 deterministic evaluation policy를 추가로 요구한다.

한 surface가 같은 자유도를 두 mode에 중복 위임하거나 skin weight가 존재하지 않는 joint를 가리키거나 weight 합과 index가 유효하지 않거나 morph topology가 target과 다르면 실패한다. Morph와 joint corrective가 함께 같은 영역을 움직일 수는 있지만 driver dependency와 compose order가 선언되어야 하며, 순환 dependency는 거부한다. Crude proxy에는 단순 rigid part만 있어도 되지만, 존재하지 않는 skin·morph fidelity를 있는 것처럼 보고하지 않는다.

### Humanoid와 열린 semantic mapping {#performance-rig-semantic-joint-mapping}

<!-- @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping normalized humanoid slot과 실제 rig node의 mapping을 명시한다. -->
<!-- @evidence requirements/actors/scope-and-identity.md#actor-open-performer-kind non-human performer도 semantic profile을 통해 rig에 참여하게 한다. -->
<!-- @evidence requirements/motion/scope-and-identity.md#motion-all-objects-all-motion 모든 주체가 자신의 channel과 capability vocabulary로 움직일 수 있게 한다. -->
<!-- @evidence requirements/motion/scope-and-identity.md#motion-actor-object-scope skeletal actor와 non-skeletal object의 서로 다른 mapping 경계를 보존한다. -->

Semantic mapping은 profile identity와 version, semantic joint·control·socket key, concrete node, axis frame, required 여부, visible influence evidence를 가진다. Humanoid mapping은 알려진 slot으로 portability를 제공하지만 시스템 전체를 humanoid bone 목록으로 닫지 않으며, quadruped, 기계, 문, 날개, 촉수와 새 performer는 각자 등록된 profile과 control vocabulary를 사용할 수 있다. Motion은 semantic channel을 통해 portable하게 쓰고 concrete node path는 채택된 rig binding이 해결한다.

필수 chain이 없거나 좌우·전후가 뒤집혔거나 한 concrete node가 배타적인 semantic slot 여러 개를 점유하거나 mapping 근거가 이름 추측뿐이면 compatibility preview에서 실패한다. 사용자는 더 제한된 capability profile 채택, authoritative mapping 제공, proxy rig 사용, motion 재저작 중 하나를 선택할 수 있고, 시스템은 비슷한 이름을 자동 매칭해 성공으로 만들지 않는다.

### ROM, control과 driver graph {#performance-rig-rom-control-driver-graph}

<!-- @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints joint별 range와 coupled constraint를 rig의 capability로 둔다. -->
<!-- @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers control과 driver dependency를 명시적인 graph로 평가한다. -->
<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls rig basis와 author-facing semantic control을 연결한다. -->

Control은 stable semantic name, target channel, value type와 unit, neutral, range, group, authority를 가진다. ROM은 joint의 독립 축 범위뿐 아니라 필요한 swing cone, coupled relation, conditional limit, object hinge·slide와 morph weight 범위를 표현하며, `unconstrained`와 `axis-does-not-move`를 구분한다. Driver는 input channel, output channel, evaluation rule, influence, target space, deterministic parameters와 dependency edge를 선언하고 track sampling 이후, constraint 검사 이전이라는 평가 단계 또는 별도 명시된 단계에 놓인다.

Driver graph는 stable order로 위상 정렬되어야 하며 cycle과 다중 writer conflict를 거부한다. Copy, aim, IK, parent, driven curve, spring 같은 driver family는 확장 가능하지만, 각 family는 I/O 단위와 frame, bounded iteration 또는 fixed-step 상태, failure semantics를 함께 등록해야 한다. Constraint는 값을 조용히 clamp한 뒤 성공이라 부르지 않고 requested value, resolved value, violated bound와 적용 여부를 반환하며, story intent와 contact를 깨뜨린 clamp는 실패 또는 review finding이다.

### 외부 rig 채택과 retarget characterization {#performance-rig-external-adoption-retarget-characterization}

<!-- @evidence requirements/actors/inputs-selection-and-replacement.md#actor-external-rig-adoption 사용자가 선택한 외부 rig의 byte와 mapping authority를 채택한다. -->
<!-- @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-motion-retargeting source motion과 target rig 사이의 characterization을 명시한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-adoption 외부 asset을 원본 provenance와 채택 결정으로 수용한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-conversion-receipt 변환 결과를 재현 가능한 receipt로 남긴다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment 외부 geometry에 semantic rig와 proxy 의미를 별도로 보강한다. -->

External rig intake는 원본 byte digest와 dependency closure, format profile, declared unit·axis·front, scene graph, skeleton·skin·morph inventory, authoritative humanoid 또는 domain mapping을 검사한다. Adoption decision은 `as-is`, `normalized`, `semantic-proxy`, `replacement` 같은 선택과 선택자, 이유, timestamp 대신 immutable revision identity를 기록하며, preview는 rest pose, extreme pose, skin influence, socket, required motion과 contact sample을 보여 준다.

Retarget characterization은 source·target rig identity, source와 target rest frames, semantic map, joint axes, proportion measure, root policy, contact policy, ROM source와 override를 가진다. 결과 motion만 남기지 않고 이 characterization과 source motion digest를 함께 보존해야 하며, target asset 또는 mapping이 바뀌면 결과는 stale다. 외부 appearance가 authoritative rig를 제공할 수도 있고 별도 proxy rig가 meaning을 제공할 수도 있지만, 어느 쪽이 pose를 구동하고 어느 쪽이 collision·measurement를 제공하는지 사용자가 선택해야 한다.

### Retarget 보존과 실패 출력 {#performance-rig-retarget-preservation-failure}

<!-- @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-refusal 유효하지 않거나 필요한 capability가 없는 rig를 명시적으로 거부한다. -->
<!-- @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-contact-preservation proportion 차이 뒤에도 필수 contact를 재해결한다. -->
<!-- @evidence requirements/asset-authoring/validation.md#asset-rig-validation rig hierarchy, range와 deformation을 검증한다. -->

Retarget은 semantic joint angle과 action timing을 기본적으로 보존하고, root translation은 선언된 scale·path 정책으로 변환하며, 필요하면 contact window의 hand·foot·wheel·grip target을 target rig에서 다시 해결한다. IK 보정은 보증이 아니라 시도 결과이므로 contact residual, ROM clamp, pole·twist continuity와 solver status를 출력한다. Non-humanoid source와 target은 compatible semantic chains 또는 authored correspondence가 있을 때만 같은 절차를 사용하며 bone count나 이름의 유사성으로 호환성을 추정하지 않는다.

실패 결과는 rig·motion·target identity, 실패한 mapping 또는 chain, source와 target rest measurement, unreachable distance, violated ROM, affected contact·event와 사용 가능한 대안을 포함한다. Missing weighted influence, collapsed skin, joint flip, invalid bind matrix, non-deterministic solver, unsupported morph나 secondary state는 각각 구분하며, motion을 삭제하거나 target을 rest pose로 고정하는 silent fallback을 금지한다.

### Rig 호환성과 fidelity ceiling {#performance-rig-compatibility-fidelity-ceiling}

<!-- @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation rig capability와 보이는 외형 fidelity를 별도 축으로 유지한다. -->
<!-- @evidence requirements/actors/validation.md#actor-validation-ceiling 자동 rig 검증이 appearance 품질을 보증하지 않음을 명시한다. -->
<!-- @evidence requirements/product/prototype-quality.md#product-blocking-pass rig가 finished deformation이 아니라 readable blocking을 먼저 증명하게 한다. -->

새 optional profile, control, driver family, morph channel 또는 semantic mapping을 추가해도 이를 참조하지 않는 기존 rig의 resolved state는 바뀌지 않아야 한다. Rest·bind 해석, axis convention, evaluation order, retention, constraint semantics가 달라지는 변경은 versioned migration이며 source와 target 모두에 새 characterization receipt를 요구한다. 같은 stable id 아래 byte나 mapping을 바꾸는 것은 호환 변경이 아니라 identity 위반이다.

Rig 검증 성공은 hierarchy, mapping, ROM, deterministic sampling과 요구 shot capability가 현재 proxy에서 작동한다는 뜻이다. 직접 생성 skin의 미세 volume preservation, cloth realism, 얼굴 likeness, production-quality muscle deformation은 기본 prototype claim이 아니며, 그런 fidelity가 필요하면 사용자가 외부 representation과 별도 current review를 선택해야 한다.
