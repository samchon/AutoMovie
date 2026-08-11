# 증거와 출처 계보 시스템 명세

<!-- @evidence requirements/evidence-and-provenance/README.md#증거와-출처-계보-요구사항 evidence identity, lineage, freshness와 보존 약속을 시스템 계약으로 정밀화한다. -->

제품 evidence와 provenance를 만드는 시스템은 관찰, 주장, 판단, artifact와 activity의 관계를 검증 가능한 기록으로 보존하고, 기록의 무결성·현재성·공개 가능성을 별도 상태로 판정한다. 이 명세는 작품과 산출물의 evidence boundary를 다루며 저장소 문서와 source 사이의 구현 추적 graph를 제품 record로 취급하지 않는다.

## 시스템 경계와 문서 지도 {#evp-system-boundary-and-map}


시스템 경계는 source, artifact, evidence record, activity, actor와 policy를 입력으로 받아 immutable record, typed relation, status event와 verification result를 출력한다. 구현 위치, 저장 매체와 호출 방식이 달라도 아래 record identity와 판정 의미는 유지되어야 한다.

- [기록 envelope와 상태 기계](./scope-identity-and-status.md)
- [관찰, 주장과 판단 record](./observations-claims-and-human-judgments.md)
- [Entity, activity, actor와 lineage](./entities-activities-agents-and-lineage.md)
- [생성, 변환과 derivation](./generation-transformation-and-derivation.md)
- [Canonical digest와 content identity](./canonical-digests-and-content-identity.md)
- [Custody와 tamper detection](./chain-of-custody-and-tamper-detection.md)
- [Privacy, credential과 disclosure](./privacy-credentials-and-disclosure.md)
- [Retention, invalidation과 disposal](./retention-invalidation-and-disposal.md)
- [Third-party source, rights와 attribution](./third-party-sources-rights-and-attribution.md)
- [Completeness, freshness와 refusal](./completeness-freshness-and-refusal.md)
