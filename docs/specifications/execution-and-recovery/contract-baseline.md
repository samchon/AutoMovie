# 생성 프로젝트 계약 Baseline

## Portable record {#execution-contract-baseline}

### Baseline record {#execution-contract-baseline-identity}

<!-- @evidence requirements/operations-and-recovery/contract-baseline.md#operations-contract-baseline-identity exact generation과 governed target identity를 portable record로 보존한다. -->

Baseline record는 protocol, exact template contract generation, selected production language와 정렬된 `{ path, digest, H2 identities }` 집합을 가진다. JSON reader는 duplicate member, unknown required field, invalid path, noncanonical ordering과 declared inventory 밖 entry를 거부한다. Governed text의 newline identity는 checkout policy 또는 명시적인 canonicalization으로 고정하고 원래 authored bytes와 혼동하지 않는다.
