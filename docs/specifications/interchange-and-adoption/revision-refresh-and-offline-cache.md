# Revision, Refresh와 Offline Cache

## Pinned Current Revision {#interchange-pinned-current-revision}

### External Version Snapshot {#interchange-external-version-snapshot}

<!-- @evidence requirements/external-inputs/refresh-version-pinning-and-offline.md#external-version-pinning Mutable source가 작품을 다시 열 때 current input을 바꾸지 못하게 한다. -->
<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-source-immutable-adoption Remote audio와 synthesis result를 immutable bytes로 봉인한다. -->

Current input pointer는 logical source가 아니라 source revision, closure digest, interpretation version와 adoption identity를 가리킨다. Open, compile, render와 review는 이 pointer를 읽기만 하고 mutable URL, latest alias, moving branch와 local pathname의 현재 bytes를 조회해 revision을 갱신하지 않는다.

<!-- @evidence requirements/external-inputs/refresh-version-pinning-and-offline.md#external-provider-tool-version-pinning Provider, model, dataset, schema와 tool version의 알려진 범위와 unknown을 기록한다. -->

Acquisition과 conversion activity는 provider, model, dataset, schema, interpreter와 tool의 exact version 또는 provider가 제공하지 않은 explicit unknown을 snapshot한다. Mutable alias만 알 수 있는 경우 revision은 non-replayable acquisition으로 표시되고 output bytes의 pinning이 version pinning을 대신했다는 사실을 숨기지 않는다.

### Refresh Transaction {#interchange-refresh-transaction}

<!-- @evidence requirements/external-inputs/refresh-version-pinning-and-offline.md#external-explicit-refresh Refresh를 비교 가능한 새 candidate를 만드는 명시적 transaction으로 정의한다. -->

Refresh는 기존 source intent와 authorization을 basis로 새 acquisition attempt를 만들고 raw digest, closure, technical facts, rights snapshot과 upstream version을 이전 revision과 비교한다. Timestamp와 locator-only 변화, content-equivalent 변화와 semantic change를 구분한 candidate를 반환하며 user adoption 전에는 current pointer를 바꾸지 않는다.

### Staleness Propagation {#interchange-refresh-staleness-propagation}

<!-- @evidence requirements/external-inputs/refresh-version-pinning-and-offline.md#external-refresh-impact-staleness Source와 interpretation 변경의 영향을 receipt, consumer, review와 publication에 전파한다. -->

Revision comparison은 element mapping, coordinates와 units, duration과 clocks, skeleton, rights, dependency, interpretation과 derived digest differences를 typed changes로 만든다. Derivation과 consumer graph는 변화가 닿는 adoption, composition, shot, render, review와 publication만 stale로 표시하고 이전 receipt와 evidence의 historical basis를 보존한다.

### Offline-ready Closure {#interchange-offline-ready-closure}

<!-- @evidence requirements/external-inputs/refresh-version-pinning-and-offline.md#external-offline-ready-inputs 채택된 closure를 network 없이 재검증하고 소비할 수 있는 상태를 정의한다. -->

`offline-ready` 상태는 adopted revision의 모든 required bytes, schemas, interpretation profile과 receipts가 locally resident하고 digest-verified이며 consumer evaluation이 network authority를 요구하지 않을 때만 성립한다. Rights 또는 size constraint로 closure를 보존하지 못하면 required remote dependencies와 rehydration conditions를 기록하고 offline-ready를 false로 유지한다.

### Content-addressed Cache Entry {#interchange-cache-entry-identity}

<!-- @evidence requirements/external-inputs/refresh-version-pinning-and-offline.md#external-cache-identity-trust Cache를 source, closure, interpretation과 result digest로 인증한다. -->

Cache key는 source revision, closure digest, interpretation version, adoption or conversion parameters와 result digest의 canonical identity이며 entry inventory는 exact member lengths와 digests를 포함한다. Lookup은 path, modification time, recency와 credential existence를 equality evidence로 사용하지 않고 incomplete, foreign-scope와 stale entries를 hit로 반환하지 않는다.

### Offline Miss와 Unavailable State {#interchange-offline-miss-state}

<!-- @evidence requirements/external-inputs/refresh-version-pinning-and-offline.md#external-cache-miss-unavailable-source Cache miss와 unavailable source를 다른 자료로 대체하지 않는 failure로 정의한다. -->

Offline cache miss 또는 deleted source, closed account와 unavailable provider는 missing revision identity, required members와 possible authorized recovery를 가진 `unavailable` result를 만든다. Recovery는 새 network authorization 또는 exact verified cache restore를 요구하고 similar filename, provider fallback과 newer revision을 current로 승격하지 않는다.
