# 생성 프로젝트 계약 Migration Publication

## Durable successor {#execution-contract-migration-publication-boundary}

### Publication and receipt {#execution-contract-migration-publication}

<!-- @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication successor validation, receipt와 predecessor 보존 순서를 정밀화한다. -->

Publisher는 최초 관측한 physical root·parent identity, descriptor generation과 bytes에 계획을 결속한다. 변경 전 bytes와 successor candidate를 immutable archive에 flush하고 exclusive pending journal을 게시한 뒤, 정확한 predecessor를 보존 slot으로 옮기고 빈 current slot에 successor를 no-replace 방식으로 설치한다. Competitor를 덮어쓰거나 pathname unlink로 지우지 않는다. Rename source는 published target의 byte identity를 재개방한 뒤에만 retire한다.

Receipt는 protocol, from/to baseline identity, selected language, plan digest, observed input digest, action별 before/after identity, validation 결과와 publication generation을 기록한다. Successor 검증과 receipt 보존 뒤 baseline을 마지막으로 활성화한다. Baseline bytes가 그대로이거나 baseline 없는 TOC 작업은 journal 아래 `committed.json`의 durable publication을 마지막 commit point로 사용한다.

전체 파일 트리의 atomic compare-and-swap이나 중단 중 current pathname의 연속 존재를 보장하지 않는다. Displacement와 activation 사이에는 current slot이 비어 있을 수 있다. Pending journal은 immutable `.before`, 원래 `.displaced` 또는 retired generation, candidate와 완료 여부를 가리키며, pending이 남은 계약·TOC 트리는 maintenance 및 evidence admission에서 성공으로 해석하지 않는다. 같은 종류의 명시적 mutating command만 복구를 시도하고 dry-run·check는 거부한다. 복구도 자기 generation만 되돌리며 경쟁 generation과 원래 실패 원인을 보존한다. 완료 이후 pending 정리 실패는 이미 게시된 결과와 미완 정리 상태를 함께 보고한다.

Client 등록은 같은 보존 protocol의 별도 private `automovie/reference-client-maintenance` namespace를 사용하며 계약 이력의 tracked whitelist에 넣지 않는다. Client 설정에는 다른 사용자 값이 들어 있을 수 있다. 서로 다른 maintenance namespace의 pending이 있으면 새 작업을 시작하지 않는다. Client 등록 중단은 production 계약 그래프의 의미를 바꾸지 않는다.
