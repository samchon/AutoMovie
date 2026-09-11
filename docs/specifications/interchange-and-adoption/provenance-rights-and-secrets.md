# 자산 식별과 Secret

## Provenance Ledger Boundary {#interchange-provenance-ledger}

### Secret Reference Boundary {#interchange-secret-reference-boundary}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-rights-contract 채택한 bytes와 이를 사용하는 consumer를 연결한다. -->

Asset manifest는 project-relative path, current digest와 typed consumer relation을 연결한다. Compiler는 등록한 bytes와 consumer가 현재 production에 존재하는지 검증한다.

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-credential-separation Credential을 source, receipt, log, cache와 evidence에서 분리한다. -->
<!-- @evidence requirements/repaint/providers-models-and-credentials.md#repaint-credential-separation External execution receipt에서도 account secret을 배제한다. -->

Credential, cookie, token, private key와 session은 secret authority가 소유하고 intake에는 opaque reference, permitted operation과 scope만 전달된다. Raw secret, reversible derivative와 secret-bearing URL은 source payload, provenance, request·conversion receipt, diagnostic, cache key, generated artifact와 evidence serialization에서 거부된다.

### 채택한 자산 Snapshot {#interchange-source-provenance-snapshot}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-source-record Project-relative path와 current bytes의 digest를 결속한다. -->

채택한 자산 snapshot은 project-relative path, current digest와 해당 media 또는 model consumer가 요구하는 technical facts를 가진다. Compiler는 local bytes를 읽어 digest를 확인하고 decoder는 형식별 declared facts와 observed facts를 비교한다.

### Generated Acquisition Snapshot {#interchange-generated-acquisition-snapshot}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-acquisition-activity Provider, model, request, prompt, controls, inputs와 output digest를 재현성 한계와 함께 기록한다. -->
<!-- @evidence requirements/repaint/identity-and-provenance.md#repaint-nondeterminism-record Seed와 prompt가 external generation의 재현성을 충분히 보장하지 않음을 기록한다. -->

Generated acquisition은 execution boundary, provider와 exact model 또는 explicit unknown, request identity, publishable instruction 또는 its digest, ordered reference input digests, seed와 controls, returned output digest와 replay result를 기록한다. `reproducible`은 같은 declared inputs로 output digest를 재생해 확인한 경우에만 true이고 service hidden state나 seed를 근거로 추정하지 않는다.

### Sensitive Metadata Projection {#interchange-sensitive-metadata-projection}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-sensitive-data 개인 정보와 비공개 locator의 보존, redaction과 공개 범위를 분리한다. -->

Provenance field는 sensitivity class와 private ledger value, public projection을 구분하고 공개 projection은 redacted field identity와 redaction reason을 보존한다. Redaction 후에도 content와 activity digest relation을 검증할 수 있어야 하며 private value, exact location와 account identity를 hash만 바꾸어 공개 identifier로 재노출하지 않는다.

### Derivation과 Consumer Reachability {#interchange-derivation-consumer-reachability}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-derivation-consumers 채택한 자산과 현재 consumer의 revision을 연결한다. -->

Asset manifest의 typed consumer는 현재 production graph의 identity로 해석된다. Compiler가 만든 derived artifact는 실제 읽은 input digest를 보존하며, 입력 bytes 변경은 해당 artifact의 freshness를 무효화한다.
