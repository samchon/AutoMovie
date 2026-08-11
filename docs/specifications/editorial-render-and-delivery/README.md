# Editorial, render와 delivery system specifications

## 문서 지도 {#spec-editorial-render-delivery-map}
<!-- @evidence requirements/editorial/scope-and-identity.md#editorial-scope-identity 이 사양 묶음의 편집 경계는 선택된 film identity에서 시작한다. -->
<!-- @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-scope-artifact-identity 이 사양 묶음의 렌더 경계는 compiled truth의 산출물 identity를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-scope-profiles 이 사양 묶음의 전달 경계는 목적지 profile을 정밀화한다. -->

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
