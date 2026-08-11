# Provenance, Rights와 Secret

## Provenance Ledger Boundary {#interchange-provenance-ledger}

### Secret Reference Boundary {#interchange-secret-reference-boundary}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-rights-contract 외부 입력의 source, rights와 derivation을 추적하되 진실과 법률을 자동 보증하지 않는다. -->

Provenance ledger는 source entity, acquisition 또는 generation activity, raw·derived entities, responsible actor claim, rights snapshot과 consumer relation을 immutable ids와 digests로 연결한다. Ledger validation은 기록의 완전성과 결속을 판정하지만 creator claim, source 내용과 legal entitlement의 진실을 판정했다는 status를 만들지 않는다.

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-credential-separation Credential을 source, receipt, log, cache와 evidence에서 분리한다. -->
<!-- @evidence requirements/repaint/providers-models-and-credentials.md#repaint-credential-separation External execution receipt에서도 account secret을 배제한다. -->

Credential, cookie, token, private key와 session은 secret authority가 소유하고 intake에는 opaque reference, permitted operation과 scope만 전달된다. Raw secret, reversible derivative와 secret-bearing URL은 source payload, provenance, request·conversion receipt, diagnostic, cache key, generated artifact와 evidence serialization에서 거부된다.

### Source Provenance Snapshot {#interchange-source-provenance-snapshot}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-source-record Source locator, author claim, acquisition time, format, digest와 upstream revision을 기록한다. -->

Fetched 또는 supplied source snapshot은 locator와 final resolved authority, publisher·creator claims, acquisition time, source filename 또는 member, declared와 observed format, upstream version·revision, raw digest와 closure digest를 가진다. 알 수 없는 field는 explicit unknown이고 placeholder author, license, date와 version을 생성하지 않는다.

### Generated Acquisition Snapshot {#interchange-generated-acquisition-snapshot}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-acquisition-activity Provider, model, request, prompt, controls, inputs와 output digest를 재현성 한계와 함께 기록한다. -->
<!-- @evidence requirements/repaint/identity-and-provenance.md#repaint-nondeterminism-record Seed와 prompt가 external generation의 재현성을 충분히 보장하지 않음을 기록한다. -->

Generated acquisition은 execution boundary, provider와 exact model 또는 explicit unknown, request identity, publishable instruction 또는 its digest, ordered reference input digests, seed와 controls, returned output digest와 replay result를 기록한다. `reproducible`은 같은 declared inputs로 output digest를 재생해 확인한 경우에만 true이고 service hidden state나 seed를 근거로 추정하지 않는다.

### Rights Snapshot과 Publication Gate {#interchange-rights-publication-gate}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-rights-license-conditions License, attribution, use, modification, redistribution와 적용 조건을 acquisition 시점에 고정한다. -->

Rights snapshot은 stable license identifier 또는 terms locator, applicable text digest 또는 retrieval time, attribution notice, allowed use, modification·redistribution, region·period·account·project constraints와 확인 actor를 가진다. Missing, expired 또는 intended consumer와 contradictory rights는 publication gate를 block하지만 system은 이 결과를 법률 자문 또는 권리 진실의 보증으로 표시하지 않는다.

### Sensitive Metadata Projection {#interchange-sensitive-metadata-projection}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-sensitive-data 개인 정보와 비공개 locator의 보존, redaction과 공개 범위를 분리한다. -->

Provenance field는 sensitivity class와 private ledger value, public projection을 구분하고 공개 projection은 redacted field identity와 redaction reason을 보존한다. Redaction 후에도 content와 activity digest relation을 검증할 수 있어야 하며 private value, exact location와 account identity를 hash만 바꾸어 공개 identifier로 재노출하지 않는다.

### Derivation과 Consumer Reachability {#interchange-derivation-consumer-reachability}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-derivation-consumers Raw source에서 derived result와 downstream consumer까지의 lineage를 추적한다. -->

Derivation graph는 activity가 사용한 exact parent revisions와 생성한 child revision, processing order, consumer가 읽는 adoption identity와 review·publication artifact를 positive edges로 연결한다. Source 또는 rights 변경은 reverse reachability로 affected consumers와 stale artifacts를 계산하고 unrelated consumer의 freshness를 바꾸지 않는다.
