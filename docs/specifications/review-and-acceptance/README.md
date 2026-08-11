# Review와 Acceptance 시스템 명세

## 시스템 경계 {#review-acceptance-system-boundary}

<!-- @evidence requirements/acceptance/README.md#acceptance-topic-scope Makes the observable acceptance topic precise as target, criterion, evidence, verdict and authority state. -->
<!-- @evidence requirements/acceptance/README.md#acceptance-observable-contract Defines the system records through which a user can inspect the basis and scope of acceptance. -->
<!-- @evidence requirements/review/scope-and-authority.md#review-scope-authority Defines the identity and authority boundary of every review decision. -->
<!-- @evidence requirements/review/scope-and-authority.md#review-human-final-authority Preserves a human as the final authority above automated observations and findings. -->

이 주제는 검토 대상과 context, 표본, criterion, observation, finding, defect, verdict, approval과 재판정을 하나의 추적 가능한 상태 체계로 정의한다. 시스템은 결정 가능한 구조와 수치 사실을 계산할 수 있지만 작품의 미학, 서사와 최종 채택을 사람 대신 결정하지 않는다.

## 문서 지도 {#review-acceptance-document-map}

<!-- @evidence requirements/acceptance/README.md#acceptance-document-map Maps every acceptance concern to a package-independent system contract. -->
<!-- @evidence requirements/acceptance/README.md#acceptance-core-contract Preserves the core determinism, human-judgment, case-matrix and scope invariants across this document set. -->

- [대상, 범위와 재현 Context](./target-scope-and-context.md)
- [검토 표면과 Sampling](./surfaces-and-sampling.md)
- [Criterion, Tolerance와 비교](./criteria-tolerance-and-comparison.md)
- [Acceptance Case Matrix](./case-matrix.md)
- [Observation, Finding과 Defect](./observations-findings-and-defects.md)
- [Verdict, Authority와 이견](./verdict-authority-and-dissent.md)
- [승인, 반려, Waiver와 게시](./approval-waiver-and-publication.md)
- [Evidence, Freshness와 완결성](./evidence-freshness-and-completeness.md)
- [Alternative, 회귀와 재판정](./alternatives-regression-and-revalidation.md)
- [Profile, 집계와 부분 결과](./profiles-aggregation-and-partial-results.md)
