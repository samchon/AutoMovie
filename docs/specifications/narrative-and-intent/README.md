# 이야기와 의도 시스템 명세 {#narrative-intent-readme}

<!-- @evidence requirements/story/README.md#이야기-저작-요구사항 이야기 계층, 인과, 인물과 의미 약속을 시스템 계약으로 정밀화한다. -->
<!-- @evidence requirements/production-design/README.md#production-design-요구사항 이야기에서 파생한 시각 언어, continuity와 디자인 권한 약속을 시스템 계약으로 정밀화한다. -->

이 디렉터리는 이야기의 저작된 의도와 프로덕션 디자인 결정을 안정된 정체성, 관계, 상태 전이, 관찰 조건, 실패와 변경 영향으로 보존하는 package-independent 시스템 계약을 정의한다.

## 시스템 경계 {#narrative-intent-readme-system-boundary}


시스템은 사용자가 추적하고 승인한 이야기와 디자인 사실, 외부 자료의 provenance, 관찰과 판정을 입력으로 받아 정규화된 의도 상태와 진단을 출력하지만 plot, 인물, 대사, 장소, palette 또는 완성 asset을 선제 content로 제공하지 않는다.

## 문서 색인 {#narrative-intent-readme-document-index}


- [이야기 권위와 계층](./story-authority-and-hierarchy.md)
- [사건, 인과와 시간](./events-causality-and-time.md)
- [인물, 관계와 상태](./characters-relations-and-state.md)
- [대사, 언어, 주제와 의미](./dialogue-language-theme-and-meaning.md)
- [장면 Coverage와 Acceptance](./scene-coverage-and-acceptance.md)
- [디자인 권위와 시각 언어](./design-authority-and-visual-language.md)
- [장소, Subject와 Asset 계획](./locations-subjects-and-assets.md)
- [Scale, Palette, Material과 State](./scale-palette-material-and-state.md)
- [Fidelity, Reference와 Provenance](./fidelity-references-and-provenance.md)
- [Budget, Continuity와 산출물](./budgets-continuity-and-deliverables.md)
- [대안, Revision과 Compatibility](./alternatives-revisions-and-compatibility.md)

## 공통 결과 상태 {#narrative-intent-readme-common-outcomes}


모든 명세 결과는 적용 대상과 revision을 식별하고 complete, partial, conflicting, invalid, not-run, unsupported와 stale 중 실제 상태를 보존하며 누락이나 거절이 있을 때 유효한 부분, 정확한 영향 범위와 다음 결정 owner를 함께 출력한다.
