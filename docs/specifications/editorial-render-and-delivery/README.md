# Editorial, render와 delivery system specifications

<!-- @evidence requirements/editorial/README.md#편집-요구사항 편집 시간, 순서, 전이와 동기 약속을 시스템 계약으로 정밀화한다. -->
<!-- @evidence requirements/rendering/README.md#rendering-요구사항 결정론적 render schedule, 산출물과 검증 약속을 시스템 계약으로 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/README.md#전달과-접근성-요구사항 전달 profile, 접근성, packaging과 publication 약속을 시스템 계약으로 정밀화한다. -->

## 문서 지도 {#spec-editorial-render-delivery-map}

이 디렉터리는 편집 결정을 exact film clock 위의 합성으로 확정하고, 그 결정을 숨은 상태 없이 frame과 media로 materialize하며, 실제 게시 bytes를 목적지별 전달·접근성 계약으로 검증하는 package 독립 system specification이다. 각 문서는 계획과 관찰 사실, current와 stale, complete와 partial을 분리하고 실패 뒤 재사용 가능한 범위를 사용자에게 드러내며, 이름이나 경로의 존재를 성공으로 간주하지 않는다.

- [Rational timeline과 composition](./rational-timeline-and-composition.md)
- [Editorial audiovisual continuity](./editorial-audiovisual-continuity.md)
- [Editorial version, conform과 validation](./editorial-version-conform-and-validation.md)
- [Render schedule, state와 headless 실행](./render-schedule-state-and-headless.md)
- [Render product, visibility와 color](./render-products-visibility-and-color.md)
- [Render budget, identity와 recovery](./render-budget-identity-and-recovery.md)
- [Render encoding과 validation](./render-encoding-and-validation.md)
- [Delivery profile, time과 picture](./delivery-profiles-time-and-picture.md)
- [Delivery audio, text와 localization](./delivery-audio-text-and-localization.md)
- [Delivery package, provenance와 publication](./delivery-package-provenance-and-publication.md)
- [Delivery validation과 release status](./delivery-validation-and-release-status.md)
