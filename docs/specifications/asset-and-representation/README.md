# 자산과 표현 시스템 사양

<!-- @evidence requirements/asset-authoring/README.md#자산-저작-요구사항 자산의 정체성, 표현, 수명과 검증 약속을 시스템 계약으로 정밀화한다. -->
<!-- @evidence requirements/actors/README.md#actor-요구사항 배우 표현과 rig 상태가 자산 계약과 만나는 경계를 정밀화한다. -->
<!-- @evidence requirements/repaint/README.md#repaint-요구사항 결정론적 자산과 repaint 파생물 사이의 표현 및 provenance 경계를 정밀화한다. -->

## 자산과 표현의 시스템 경계 {#asset-spec-readme-boundary}


이 사양군은 작품 속 대상을 가리키는 자산 식별자, 그 대상을 실현하는 모델과 자원, 목적별 표현, 검증 상태, 외부·생성 자산 채택, 선택적 재도색 인계 사이의 계약을 정의한다. 시스템은 사용자가 고른 입력과 표현 방식을 보존하고, 결정론적 장면 구조와 비결정적 외부 결과를 서로 다른 계보로 기록한다.

## 주제별 사양 {#asset-spec-readme-index}


- [식별자, 자원과 수명 주기](identity-resources-and-lifecycle.md)
- [모델, 기하와 표면 사실](model-geometry-and-surface-facts.md)
- [리그, 변형과 상태](rig-deformation-and-state.md)
- [대안, 인스턴스와 그룹](alternatives-instances-and-groups.md)
- [경계, 프록시와 상세도](bounds-proxies-and-lod.md)
- [충실도 경계와 검증](fidelity-and-validation.md)
- [생성 자산 채택과 재도색 인계](generated-assets-and-repaint-handoff.md)
