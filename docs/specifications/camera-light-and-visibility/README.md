# Camera, Light와 Visibility Specifications {#camera-light-visibility-specifications}

<!-- @evidence requirements/camera/README.md#camera-요구사항 camera 상태, 투영, 경로와 관찰 약속을 시스템 계약으로 정밀화한다. -->
<!-- @evidence requirements/lighting/README.md#조명-요구사항 광원, 환경광, 색과 조명 연속성 약속을 시스템 계약으로 정밀화한다. -->

## 시스템 경계 {#clv-system-boundary}


이 폴더는 camera, lighting과 visibility를 구현 소유 단위가 아니라 선언 입력, 정규화된 상태, rational film clock, image-space 관찰, diagnostic, alternative와 evidence receipt의 시스템 계약으로 정의한다. Camera projection과 scene-referred light는 정본이고 exposure, display transform, structural pass와 optional appearance는 각자의 provenance와 지원 상태를 유지한다.

## 문서 색인 {#clv-document-index}


- [Camera state, projection과 gate](./camera-state-projection-and-gate.md)
- [Framing, axis와 camera path](./framing-axis-and-camera-path.md)
- [Target, focus, exposure와 sampling](./target-focus-exposure-and-sampling.md)
- [Light source, photometry와 environment](./light-source-photometry-and-environment.md)
- [Practical, shaping과 linking](./practical-shaping-and-linking.md)
- [Light transport, color와 budget](./light-transport-color-and-budget.md)
- [Temporal state와 continuity](./temporal-state-and-continuity.md)
- [Visibility와 image-space observation](./visibility-and-image-space-observation.md)
- [Alternative, deviation과 evidence](./alternatives-deviations-and-evidence.md)
