# Delivery 범위와 Profile

## 목적지별 명시적 전달 계약 {#delivery-scope-profiles}

Delivery profile은 selected edit, picture product, audio mix, language, accessibility asset, container, codec, timebase, dimensions, color, metadata, naming, package와 validation requirement를 가져야 한다.

### Profile Ownership {#delivery-profile-ownership}

Target platform, festival-like venue, archive, review, web와 project-defined destination이 자신의 constraint와 target value를 소유하고 repository default를 보편 규칙으로 강제하지 않아야 한다.

### Required와 Optional {#delivery-required-optional}

Picture, audio, caption, subtitle, audio description, transcript, sign-language rendition와 metadata 중 required, optional, unsupported와 intentionally absent를 구분해야 한다.

### Multiple Deliveries {#delivery-multiple-profiles}

같은 film에서 여러 resolution, language, accessibility, codec와 destination package를 만들 수 있고 각 output의 identity와 review를 분리해야 한다.

### Profile Refusal {#delivery-profile-refusal}

모순된 codec·container, missing required stream, unknown timebase와 검증할 수 없는 target을 best-effort publish로 통과시키지 않아야 한다.
