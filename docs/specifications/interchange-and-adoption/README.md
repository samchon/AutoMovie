# Interchange와 Adoption 시스템 계약

## 외부 입력 시스템 경계 {#interchange-system-boundary}

<!-- @evidence requirements/external-inputs/README.md#external-inputs-scope Provider와 acquisition channel에 독립적인 시스템 입구와 사용자 권한 경계를 정의한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-adoption 외부 자료가 작품 자산이 되기 전에 거치는 공통 시스템 경계를 정의한다. -->

외부 입력 시스템은 사용자가 승인한 source locator와 acquisition channel을 immutable source revision으로 봉인하고, media inspection, quarantine validation과 adoption decision을 거쳐 consumer가 읽는 adopted revision을 산출한다. Provider와 model 이름은 source provenance일 수 있지만 dispatch key, 기본 route 또는 자동 fallback 우선순위가 될 수 없다.

## 상태 전이와 봉인 지점 {#interchange-adoption-lifecycle}

<!-- @evidence requirements/external-inputs/README.md#external-inputs-lifecycle 취득 원본부터 검역, 검증, 채택, 변환과 refresh까지의 관찰 가능한 상태를 시스템 전이로 고정한다. -->

한 입력의 상태는 `discovered`, `acquiring`, `acquired`, `quarantined`, `validating`, `accepted`, `adopted`, `degraded`, `rejected`, `unsupported` 또는 `unavailable` 중 하나로 판정되고, current consumer는 `adopted` 또는 사용자가 승인한 `degraded` revision만 읽는다. Source bytes, closure, interpretation, adoption decision과 receipt 중 하나가 바뀌면 새 revision을 만들고 이전 검증과 downstream evidence를 current에서 분리한다.

## 계약 표면과 우회 금지 {#interchange-contract-surfaces}

<!-- @evidence requirements/external-inputs/README.md#external-inputs-topics 외부 입력의 주제별 약속을 하나의 우회 불가능한 시스템 계약 집합으로 연결한다. -->

모든 intake path는 source authority, media facts, adoption mode, identity와 units, dependency closure, quarantine result, provenance와 rights, pinning과 cache, deterministic receipt, support status를 같은 revision graph에 결속한다. 이미 local인 file, pre-generated result, remote API response와 tool output도 어느 계약 표면을 생략할 수 없고, 각 표면의 결과는 다른 표면이 재해석하지 않는 authoritative record가 된다.

- [Intake authority와 provider-neutral routing](./intake-authority-and-routing.md)
- [Media inspection boundary](./media-inspection-boundaries.md)
- [Adoption decision과 composition](./adoption-decisions-and-composition.md)
- [Identity, coordinate와 unit normalization](./identity-coordinates-and-units.md)
- [Resource closure와 acquisition](./resource-closure-and-acquisition.md)
- [Validation과 quarantine](./validation-and-quarantine.md)
- [Provenance, rights와 secret](./provenance-rights-and-secrets.md)
- [Revision, refresh와 offline cache](./revision-refresh-and-offline-cache.md)
- [Conversion receipt와 determinism](./conversion-receipts-and-determinism.md)
- [Support, degradation과 refusal](./support-degradation-and-refusal.md)
