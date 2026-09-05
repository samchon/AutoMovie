# Review와 Acceptance 시스템 명세

<!-- @evidence requirements/acceptance/README.md#acceptance-요구사항 acceptance 기준, 관찰, 증거, 판정과 승인 약속을 시스템 계약으로 정밀화한다. -->
<!-- @evidence requirements/review/README.md#검토-요구사항 compiled subject 검사와 시각 변경 보고의 제품 경계를 시스템 계약으로 정밀화한다. -->

## 시스템 경계 {#review-acceptance-system-boundary}


이 주제는 제품이 소유하는 compiled subject 검사와 시각 변경 보고, 그리고 acceptance requirement가 요구하는 criterion, evidence, verdict와 publication 계약을 정의한다. Production consumer는 compiler-derived subject와 현재 observation population을 다시 여는 경계만 소유한다. AutoMovie는 작품 review의 annotation, finding lifecycle, 대안 선택, 승인, 반려와 waiver를 저장하는 서비스를 제공하지 않는다. Repository review는 [Review skill](../../../.agents/skills/review/SKILL.md)이, 생성 production review는 [shipped Production review](../../../packages/template/scaffold/.agents/skills/review-verification/review.md)가 절차로 소유한다.

## 문서 지도 {#review-acceptance-document-map}

- [대상, 범위와 재현 Context](./target-scope-and-context.md)
- [검토 표면과 Sampling](./surfaces-and-sampling.md)
- [주체 표면과 검사](./subject-surface-and-inspection.md)
- [주체 기술과 구조 Diff](./subject-description-and-structural-diff.md)
- [시각 변경 보고](./visual-change-reporting.md)
- [Criterion, Tolerance와 비교](./criteria-tolerance-and-comparison.md)
- [Acceptance Case Matrix](./case-matrix.md)
- [Verdict, Authority와 이견](./verdict-authority-and-dissent.md)
- [승인, 반려, Waiver와 게시](./approval-waiver-and-publication.md)
- [Evidence, Freshness와 완결성](./evidence-freshness-and-completeness.md)
- [Alternative, 회귀와 재판정](./alternatives-regression-and-revalidation.md)
- [Profile, 집계와 부분 결과](./profiles-aggregation-and-partial-results.md)
