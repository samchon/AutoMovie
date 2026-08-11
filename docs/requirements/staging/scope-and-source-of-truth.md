# 연출 범위와 정본

## Scene을 수행 가능한 공간 사건으로 변환 {#staging-scope-source}

Staging은 scene, beat, actor, object, location, semantic event, performance, camera opportunity와 required state를 하나의 production plan으로 연결하고 각 연결의 source identity와 revision을 추적해야 한다.

### Story와 Staging {#staging-story-distinction}

Story가 사건의 의미와 결과를 소유하고 staging은 누가 어디서 무엇을 언제 수행하는지 소유하며 camera와 edit 선택을 story fact로 만들지 않아야 한다.

### 저작된 Blocking {#staging-authored-blocking}

Actor position, facing, path, target, pose, prop, interaction와 timing은 tracked source가 소유하고 renderer가 빈 공간을 알아서 채우지 않아야 한다.

### 상위 Source Trace {#staging-upstream-source-trace}

각 blocking choice는 자신이 실현하는 story scene·beat·semantic event, production design subject·location·state와 검토할 acceptance를 직접 식별해야 하며 filename, 배열 위치, 비슷한 이름이나 현재 frame에서 그 관계를 역추정하지 않아야 한다.

### Resolved Scene State {#staging-resolved-scene-state}

Placement, path, contact, visibility와 camera access는 같은 scene geometry revision, coordinate frame, unit, opening·support·obstacle state와 film-time sample을 읽어야 하며 nominal plan과 실제 resolved geometry를 섞지 않아야 한다.

### 열려 있는 연출 양식 {#staging-open-style}

Static tableau, dialogue scene, action, dance, crowd event, montage source와 project-defined form을 지원하되 한 blocking grammar를 모든 장면에 강제하지 않아야 한다.

### Plan Alternative {#staging-plan-alternatives}

서로 다른 blocking, location state, choreography와 coverage plan은 공통 상위 source, 독립 identity, 차이와 적용 범위를 가져야 하며 선택 전에는 한 plan의 spatial state와 다른 plan의 timing 또는 acceptance를 조합하지 않아야 한다.

### Scope 밖 자동완성 {#staging-autofill-refusal}

Missing performance, prop, target와 event를 generic walk, random gesture, idle crowd와 default camera로 완성된 연출처럼 만들지 않아야 한다.
