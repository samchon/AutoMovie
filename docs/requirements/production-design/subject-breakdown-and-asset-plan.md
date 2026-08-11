# Subject Breakdown과 Asset 계획

## Scene 약속에서 필요한 Subject 도출 {#production-design-subject-breakdown}

Character, costume, prop, vehicle, creature proxy, furniture, set element, landscape, effect와 sound source를 scene와 semantic event에서 도출하고 owner, purpose와 required state를 지정할 수 있어야 한다.

Breakdown은 각 subject가 필요한 scene, event, viewing condition, interaction, continuity phase와 acceptance를 역으로 찾을 수 있게 해야 한다. Mention만 있는 대상과 production이 실제로 만들거나 등록해야 하는 대상을 구분해야 한다.

### Hero와 Background {#production-design-hero-background}

Close-up hero, interactive subject, repeated population, silhouette proxy, reflection·shadow-only와 distant context를 구분하여 목적에 맞는 representation tier를 정해야 한다.

같은 subject가 scene 또는 거리별로 다른 tier를 사용할 수 있으나 story identity, scale, major silhouette, state와 attachment를 보존해야 한다. Background tier를 close interaction의 근거로 사용하지 않아야 한다.

### Build, Import와 Reuse 선택 {#production-design-build-import-reuse}

Project-native authoring, external asset direct placement, native conversion, prototype reuse와 group composition 중 선택은 사용자와 저작 에이전트가 소유하고 provenance와 consequence를 기록해야 한다.

각 선택은 필요한 source bytes, license와 permission, 변환 손실, editability, rig 또는 state capability, proxy, LOD, budget와 downstream consumer를 비교할 수 있어야 한다. 제품이 특정 공급자나 catalogue entry를 자동 우선하지 않아야 한다.

### Capability Ledger {#production-design-capability-ledger}

각 subject가 scene에서 해야 하는 pose, motion, state, interaction, material change, damage와 attachment를 열거하여 외형만 있는 asset을 기능 가능한 것으로 오인하지 않아야 한다.

Capability는 요구 주체, range 또는 state, target, timing, failure condition과 이를 검증할 scene 또는 evidence를 가질 수 있어야 한다. 이름이나 외형이 기능을 암시한다는 이유로 실제 articulation과 behavior를 보유한다고 판정하지 않아야 한다.

### Missing Subject {#production-design-missing-subject}

Scene이나 acceptance가 요구하지만 model, source, state 또는 behavior owner가 없는 subject를 compile 또는 planning 단계에서 찾을 수 있어야 한다.

### Subject Identity, Prototype와 Instance {#production-design-subject-prototype-instance}

고유 subject, 공유 prototype, instance population, variant와 hero exception을 구분하고 각 occurrence가 어느 identity와 state를 소유하는지 추적할 수 있어야 한다. 반복 대상을 파일 복사로 늘려 서로 다른 asset처럼 보이게 하지 않아야 한다.

### Asset Plan 상태와 Owner {#production-design-asset-plan-status-owner}

Asset plan 항목은 owner, source strategy, required tier, dependencies, status, target milestone, review scope와 blocking issue를 가질 수 있어야 한다. Planned, acquired, authored, validated, approved와 superseded 상태를 filename 존재만으로 추정하지 않아야 한다.

### State와 Variant Inventory {#production-design-subject-state-inventory}

Costume, clean 또는 damaged, open 또는 closed, loaded 또는 empty와 같은 required state와 mutually exclusive variant를 subject별로 열거할 수 있어야 한다. 한 state의 asset과 review가 다른 state를 자동 승인하지 않아야 한다.

### External Asset Closure {#production-design-external-asset-closure}

External subject는 원본과 모든 필요한 sidecar, source hierarchy, unit와 axes, adopted representation, license, digest, conversion lineage, proxy와 consumer permission을 asset plan에서 찾을 수 있어야 한다. Remote alias나 사라진 download page만으로 accepted subject를 재구성한다고 주장하지 않아야 한다.

### 대체와 퇴역 {#production-design-subject-replacement-retirement}

Subject 또는 asset을 대체할 때 replacement identity, 대응 state, scale, silhouette, capability와 affected scene을 비교할 수 있어야 한다. 퇴역한 asset의 reference와 review가 새 subject를 가리키도록 자동 재지정되지 않아야 한다.

### Breakdown Completeness {#production-design-breakdown-completeness}

모든 required scene과 event의 subject가 plan에 포함되고 모든 plan 항목이 목적과 consumer를 가지는지 확인할 수 있어야 한다. 비어 있는 category를 자동 통과시키지 않고 작품이 해당 category를 요구하지 않는지 또는 아직 분석하지 않았는지 구분해야 한다.
