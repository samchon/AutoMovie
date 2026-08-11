# Reference와 Provenance

## 관찰 가능한 근거로 쓰는 Reference {#production-design-references-provenance}

Image, drawing, scan, model, text, historical source와 generated concept는 source, license 또는 usage permission, digest, observation와 design consumer를 가져야 한다.

Reference identity는 original bytes 또는 generated output, creator 또는 provider, title 또는 description, source location, acquisition date, exact version, media facts와 current availability를 구분할 수 있어야 한다. 검색 결과, repost와 filename만을 authoritative source로 제시하지 않아야 한다.

### Observation과 Interpretation {#production-design-observation-interpretation}

Reference에서 직접 관찰한 geometry, material, pattern, damage와 context를 project가 해석하거나 창작한 선택과 구분해야 한다.

각 observation은 reference의 page, frame, region 또는 timestamp, scale 또는 coordinate basis, confidence와 unresolved ambiguity를 가질 수 있어야 한다. 관찰할 수 없는 뒷면, 재료 성분과 치수를 generated completion으로 채워 원자료의 사실이라고 주장하지 않아야 한다.

### Generated Reference {#production-design-generated-reference}

서드파티 생성 서비스의 concept는 provider, model과 version, prompt, controls, source references, terms와 output digest를 기록할 수 있으나 같은 seed만으로 재현성을 보장한다고 주장하지 않아야 한다.

Request 순서의 입력, role, provider-side request identity 또는 부재, execution boundary, retention 또는 privacy 조건과 output마다 다른 digest를 기록할 수 있어야 한다. Reroll은 같은 reference의 current bytes가 아니라 새 occurrence 또는 revision으로 추적해야 한다.

### Credential 경계 {#production-design-reference-secret-boundary}

API key, access token, cookie와 account credential은 provenance가 아니며 reference ledger, prompt, log, source와 evidence에 저장하지 않아야 한다.

Credential이 없어서 source를 다시 열 수 없는 상태는 source가 존재한다는 증거와 구분해야 한다. 공개 가능한 receipt와 비밀 인증 정보를 분리하고 secret redaction이 digest, provider와 consumer identity까지 제거하지 않아야 한다.

### Reference 교체 {#production-design-reference-replacement}

Reference bytes, license 또는 interpretation이 바뀌면 affected design, asset와 review evidence를 식별하고 기존 관찰을 자동으로 current로 간주하지 않아야 한다.

### 권리와 Consumer Permission {#production-design-reference-rights-consumer}

Reference는 viewing, design study, derivative asset, redistribution, model input, repaint input와 public delivery 중 허용된 consumer role을 구분할 수 있어야 한다. 한 용도의 permission을 다른 생성 서비스 전송이나 배포 권한으로 확대 해석하지 않아야 한다.

### Original과 Derived Reference {#production-design-reference-original-derived}

Crop, annotation, color correction, tracing, conversion와 generated variation은 parent reference, processing step, tool 또는 agent, parameters, output digest와 손실을 가져야 한다. Derived drawing이나 render를 원본 관찰 자료로 되돌려 순환 근거를 만들지 않아야 한다.

### Source Authority와 Confidence {#production-design-reference-authority-confidence}

Survey, manufacturer record, primary historical source, secondary account, concept image와 generated study는 서로 다른 authority와 confidence를 가질 수 있어야 한다. 충돌하는 reference를 근거 없이 평균 내지 않고 design decision이 선택한 source와 이유를 기록해야 한다.

### 불완전하고 지원되지 않는 자료 {#production-design-reference-unsupported-incomplete}

읽을 수 없는 container, unknown scale, missing page, ambiguous candidate, unsupported geometry와 open issue를 각각 withheld 또는 not-run 상태로 보고할 수 있어야 한다. 등록되었다는 이유만으로 observation이나 design으로 승격하지 않아야 한다.

### Reference Manifest Closure {#production-design-reference-manifest-closure}

Distributable production은 실제로 사용한 reference와 asset의 exact bytes, license document, sidecar, processing chain과 consumer relation을 닫힌 inventory로 확인할 수 있어야 한다. 사라진 remote alias와 untracked local file에 의존하는 accepted design을 완전하다고 표시하지 않아야 한다.

### Reference 검토 {#production-design-reference-review}

검토자는 source identity, 권리, observation, interpretation, adopted decision와 downstream consumer를 한 관계로 열어 볼 수 있어야 한다. Provenance record는 source 내용의 진실이나 design quality를 자동 인증하지 않으며 불일치와 불확실성을 보존해야 한다.
