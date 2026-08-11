# 대안, 인스턴스와 그룹

## 대안 표현 경계 {#asset-spec-alternatives-boundary}

### variant와 상속 {#asset-spec-variant-inheritance}

<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-representations-bounds-lod 하나의 의미 identity 아래 목적별 표현을 연결해야 한다. -->

시스템은 variant, representation, prototype, instance와 group을 서로 바꿔 부르지 않는다. variant는 같은 자산의 저작된 상태 대안이고, representation은 같은 의미를 다른 비용·목적으로 실현한 대안이며, prototype은 공유 정의, instance는 작품 속 개별 발생, group은 여러 identity 사이의 논리 관계이다.

<!-- @evidence requirements/asset-authoring/identity-and-instances.md#asset-variant-inheritance 자산 변형과 상속 관계를 추적하고 교체 가능하게 유지해야 한다. -->

variant는 부모 자산 또는 부모 variant revision, 변경한 geometry·material·rig·state·capability 사실과 적용 범위를 가진다. 상속 graph는 순환할 수 없고, 해석 결과는 inherited, overridden, removed 사실을 구분하며, 부모 갱신으로 결과가 달라질 수 있으면 해당 variant와 소비자를 stale로 표시한다.

### prototype과 instance {#asset-spec-prototype-instance}

<!-- @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance 공유 원형과 개별 배치·상태·재료 override를 분리해야 한다. -->

prototype은 공유 모델과 기본 variant·representation을 참조하고, instance는 고유 identity, prototype revision, 배치, 선택한 variant·representation, 상태와 허용된 override를 기록한다. prototype 갱신은 instance identity를 바꾸지 않으며, instance가 고정한 revision을 무음으로 최신값에 재결합하지 않는다.

### override 해석과 provenance {#asset-spec-instance-override-resolution}

<!-- @evidence requirements/asset-authoring/identity-and-instances.md#asset-instance-override-provenance instance별 차이의 저자, 근거와 적용 범위를 추적해야 한다. -->

override는 대상 element와 property, 이전 값, 새 값, 저자·source, 이유, 적용 범위와 순서를 가진다. 해석 순서는 채택 계획에 명시된 prototype, variant, group, instance layer를 따르고, 같은 우선순위에서 충돌하거나 호환되지 않는 geometry·rig·material 조합이 생기면 임의의 마지막 값으로 해결하지 않는다.

### group과 개별 identity {#asset-spec-group-individuality}

<!-- @evidence requirements/asset-authoring/identity-and-instances.md#asset-logical-group 부품·가구·군중과 같은 논리 group을 중첩해 구성해야 한다. -->
<!-- @evidence requirements/asset-authoring/identity-and-instances.md#asset-compression-individuality 압축과 instancing 뒤에도 개별 identity와 선택 가능성을 보존해야 한다. -->

group은 고유 identity, member identity, 중첩 관계, 순서 또는 배치 규칙, group-level 상태와 허용된 집단 동작을 가진다. 저장·렌더 압축은 count, index, seed와 prototype을 이용할 수 있지만 각 member의 안정된 identity, 선택·검사·영웅 교체·개별 상태 적용 가능성을 제거하지 않는다.

### 결정론적 instance 생성 {#asset-spec-deterministic-instance-generation}

<!-- @evidence requirements/asset-authoring/patterns-and-procedural-composition.md#asset-pattern-local-stability 일부 수정이 무관한 배치와 변주를 다시 섞지 않아야 한다. -->

규칙으로 만든 instance는 group revision, 안정된 slot key, prototype revision, seed와 예외 목록으로부터 identity와 변주를 결정한다. count나 영역의 국소 변경은 유지되는 slot key의 identity와 변주를 보존하며, 삭제된 slot identity를 다른 의미의 새 member에 즉시 재사용하지 않는다.

### 외부 장면 채택 방식 {#asset-spec-external-adoption-alternatives}

<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-adoption 외부 자산을 검증 가능한 작품 자산으로 명시적으로 채택할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-adoption-mode 사용자가 direct placement, native conversion 또는 group composition을 선택할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-gltf-scene 외부 3D scene의 node, mesh, material, texture, animation과 camera·light 사실을 채택할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-scene-graph-preservation direct 채택에서 원본 scene graph와 transform 관계를 보존해야 한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-group-composition 외부 root와 child를 로컬 자산과 논리 group으로 합성할 수 있어야 한다. -->
<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-intent-persistence 선택한 채택 의도를 후속 갱신과 재해석에서도 보존해야 한다. -->

외부 3D 장면을 채택할 때 시스템은 node, mesh, material, texture, skin, animation, camera, light와 transform 관계를 원본 element 사실로 읽고, `direct`, `native`, `group`을 선택 가능한 방식으로 제시하며 어느 하나도 기본으로 강제하지 않는다. `direct`는 고정된 외부 scene graph와 자원을 그대로 배치하고 의미 보강을 별도 기록으로 연결하며, `native`는 element를 내부 모델 사실로 결정론적으로 대응하고 변환 receipt를 남기며, `group`은 외부 root와 child identity를 보존한 채 로컬 자산과 논리 group으로 합성한다.

### 선택 입력과 출력 {#asset-spec-alternative-selection-output}

<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-selection shot scale, 거리, 오차, 목적과 예산에 따라 사용자가 표현을 선택할 수 있어야 한다. -->

선택 입력은 자산·instance identity, 목적, shot와 시간 범위, 필요한 능력, 허용 오차, 거리·화면 크기, 비용 한도, 사용자 채택 방식과 고정 정책을 포함한다. 출력은 선택된 variant·representation·revision과 선택 이유, 적용된 override, 예상 비용, 보존·저하된 의미, 대체 후보를 포함하며 선택 규칙이나 자원이 달라지면 비교 가능한 새 결과를 만든다.

### 실패와 교체 호환성 {#asset-spec-alternative-failure-compatibility}

<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-semantic-preservation 대체 표현이 identity, scale, pivot, contact와 필요한 동작을 보존해야 한다. -->

대안이 필수 부품, scale, pivot, anchor, material role, rig channel, state 또는 capability를 보존하지 못하면 compatibility는 `partial` 또는 `incompatible`이다. 시스템은 누락 사실과 영향받는 shot·instance를 제시하고, 사용자 승인 없는 의미 저하, direct scene graph의 평탄화, group member identity 소실 또는 부적합 variant의 자동 대체를 거부한다.
