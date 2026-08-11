# Integrity, Provenance와 Authenticity

## Source에서 Delivery까지의 Derivation {#delivery-integrity-provenance-authenticity}

Final artifact는 source production, compile, edit, conform, render, optional repaint, mix, translation, encode, package와 publication activity의 identity, input, output, responsible agent 또는 tool, time와 digest relation을 추적할 수 있어야 한다. Omitted stage도 not-run 또는 not-applicable로 표현해야 한다.

### Entity, Activity와 Responsibility {#delivery-provenance-entities-activities}

Artifact, revision과 receipt 같은 entity, 변환 또는 validation activity, 사람 또는 tool 같은 responsible party를 구분해야 한다. 누가 기록을 만들었는지와 누가 창작 결정을 승인했는지를 같은 author field로 합쳐서는 안 된다.

### Canonical Digest {#delivery-canonical-digest}

Structured manifest와 receipt는 canonical serialization을, binary artifact는 byte digest를, dependency set은 complete closure를 사용해야 한다. 같은 logical record의 property order나 path 표기 차이가 다른 meaning을 만들지 않아야 한다.

### Revision과 Invalidation {#delivery-revision-invalidation}

Input, tool, setting, external asset, edit, translation 또는 policy 변경이 downstream receipt, review와 publication freshness에 미치는 영향을 추적해야 한다. Superseded evidence를 삭제하여 lineage를 끊기보다 invalidated state와 replacement relation을 기록해야 한다.

### Generative와 External Transformation {#delivery-generative-provenance}

Optional generative rendition, external conversion 또는 manual modification은 original source, submitted input, returned artifact, declared provider 또는 operator, settings, receipt availability와 adoption decision을 별도 activity로 기록해야 한다. Deterministic source의 identity나 검증을 변형 output이 상속해서는 안 된다.

### Signature와 Verification {#delivery-signature-verification}

Signature-like record를 지원하는 경우 signed bytes 또는 manifest identity, signer identity, verification method, result와 trust boundary를 명시해야 한다. Record가 존재한다는 사실과 실제 cryptographic verification success를 구분해야 한다.

### Disclosure Boundary {#delivery-provenance-disclosure}

Public provenance와 restricted operational receipt의 공개 범위를 구분해야 한다. Credential, secret, private locator, absolute host path와 불필요한 personal data는 public artifact에 포함하지 않되 redaction이 required digest, responsible identity, derivation edge 또는 verification result를 모호하게 만들어서는 안 된다.

### Authenticity Claim 경계 {#delivery-authenticity-claim-boundary}

Digest와 signature는 bytes의 일치와 declared history의 결속을 증명할 수 있지만 작품 내용, 저작권, 사실성, 품질 또는 승인자의 권한 자체를 자동 판정하지 않는다. Provenance complete를 truthful content라는 주장으로 확대해서는 안 된다.

### Partial Lineage {#delivery-provenance-partial}

일부 ancestor receipt가 없으면 알려진 derivation과 missing edge를 함께 기록할 수 있지만 complete provenance 또는 current verified delivery로 표시해서는 안 된다. Later recovery는 기존 identity를 덮어쓰지 않고 새 verification activity로 연결해야 한다.

### Integrity Refusal {#delivery-integrity-refusal}

Digest mismatch, missing required parent, invalid signature-like record, mutable source, contradictory activity order와 incomplete required lineage는 거절해야 한다. Artifact bytes를 보존할 수는 있지만 verified 또는 authentic 상태를 부여해서는 안 된다.
