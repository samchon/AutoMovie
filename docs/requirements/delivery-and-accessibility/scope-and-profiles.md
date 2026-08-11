# Delivery 범위와 Profile

## 목적지별 명시적 전달 계약 {#delivery-scope-profiles}

Delivery profile은 stable identity와 revision, selected edit, picture product, audio mix, language, accessibility asset, container, codec, timebase, dimensions, color, metadata, naming, package, validation과 publication 요구를 가져야 한다. 같은 profile revision은 항상 같은 constraint set을 뜻해야 한다.

### Profile Ownership {#delivery-profile-ownership}

Target platform, venue, archive, review, web 또는 project-defined destination이 자신의 constraint와 acceptance criteria를 소유해야 한다. Repository default나 가장 최근 성공 setting을 모든 목적지에 보편 규칙으로 강제해서는 안 된다.

### Required와 Optional {#delivery-required-optional}

Picture, audio, caption, subtitle, audio description, transcript, sign-language rendition, clean audio, metadata와 provenance 각각을 required, optional, intentionally absent 또는 unsupported로 구분해야 한다. 요청된 optional asset의 생성 실패를 complete로 숨기거나 required asset의 부재를 intentionally absent로 바꾸어서는 안 된다.

### Multiple Deliveries {#delivery-multiple-profiles}

같은 film에서 여러 resolution, language, accessibility set, codec와 destination package를 만들 수 있어야 한다. 각 output은 독립 identity, status, review와 publication lineage를 가져야 하며 한 profile의 성공이 다른 profile의 검증을 대신해서는 안 된다.

### Constraint Precedence {#delivery-profile-precedence}

Destination constraint, project choice와 source capability가 충돌하면 적용된 precedence와 unresolved conflict를 사용자에게 보여줘야 한다. 임의로 품질을 낮추거나 stream을 제거하여 best-effort output을 원 요청으로 승인해서는 안 된다.

### Version과 Freshness {#delivery-profile-freshness}

Selected edit, mix, translation, caption, render 또는 profile revision이 바뀌면 영향을 받는 delivery plan, encode, probe, review와 publication을 stale로 만들어야 한다. 영향이 없는 결과를 재사용할 때는 exact dependency closure와 범위를 기록해야 한다.

### Partial Profile Result {#delivery-profile-partial}

한 profile의 independent products 일부가 성공하면 candidate 또는 partial package로 보존할 수 있다. Expected, completed, failed, unsupported와 not-run items를 나열하고 public delivery 또는 complete accessibility set으로 표시해서는 안 된다.

### Profile Refusal {#delivery-profile-refusal}

모순된 codec과 container, missing required stream, unknown timebase, unmeasurable acceptance target, duplicate output identity와 unresolved constraint는 거절해야 한다. Diagnostic은 충돌한 rule, observed source capability와 사용자가 선택할 수 있는 명시적 대안을 설명해야 한다.
