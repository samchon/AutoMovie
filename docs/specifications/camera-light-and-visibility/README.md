# Camera, Light와 Visibility Specifications {#camera-light-visibility-specifications}

## 시스템 경계 {#clv-system-boundary}

<!-- @evidence requirements/camera/scope-and-identity.md#camera-scope-identity Camera 관찰자 상태를 하나의 시스템 경계로 정규화한다. -->
<!-- @evidence requirements/lighting/scope-and-identity.md#lighting-scope-identity Scene-referred light 상태를 camera와 분리된 시스템 경계로 정규화한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-visibility-readability Camera와 light가 함께 만드는 관객 전달을 image-space 관찰 계약으로 연결한다. -->

이 폴더는 camera, lighting과 visibility를 구현 소유 단위가 아니라 선언 입력, 정규화된 상태, rational film clock, image-space 관찰, diagnostic, alternative와 evidence receipt의 시스템 계약으로 정의한다. Camera projection과 scene-referred light는 정본이고 exposure, display transform, structural pass와 optional appearance는 각자의 provenance와 지원 상태를 유지한다.

## 문서 색인 {#clv-document-index}

<!-- @evidence requirements/camera/scope-and-identity.md#camera-geometric-truth 이 색인은 geometric camera truth를 담당하는 계약을 직접 연결한다. -->
<!-- @evidence requirements/lighting/scope-and-identity.md#lighting-appearance-distinction 이 색인은 scene light와 표시 결과의 경계를 담당하는 계약을 직접 연결한다. -->

- [Camera state, projection과 gate](./camera-state-projection-and-gate.md)
- [Framing, axis와 camera path](./framing-axis-and-camera-path.md)
- [Target, focus, exposure와 sampling](./target-focus-exposure-and-sampling.md)
- [Light source, photometry와 environment](./light-source-photometry-and-environment.md)
- [Practical, shaping과 linking](./practical-shaping-and-linking.md)
- [Light transport, color와 budget](./light-transport-color-and-budget.md)
- [Temporal state와 continuity](./temporal-state-and-continuity.md)
- [Visibility와 image-space observation](./visibility-and-image-space-observation.md)
- [Alternative, deviation과 evidence](./alternatives-deviations-and-evidence.md)
