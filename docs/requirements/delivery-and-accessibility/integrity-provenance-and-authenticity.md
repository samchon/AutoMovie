# Integrity, Provenance와 Authenticity

## Source에서 Delivery까지의 Derivation {#delivery-integrity-provenance-authenticity}

Final artifact는 source production, compile, render, repaint 여부, edit, mix, encode, package와 publication activity의 identity, agent 또는 tool, time와 digest relation을 추적할 수 있어야 한다.

### Canonical Digest {#delivery-canonical-digest}

Structured manifest와 receipt의 canonical serialization, binary digest와 dependency closure를 사용하여 같은 artifact와 changed artifact를 구분해야 한다.

### Revision과 Invalidation {#delivery-revision-invalidation}

Input, tool, setting, external asset와 output bytes 변경이 downstream receipt, review와 publication freshness에 미치는 영향을 추적해야 한다.

### Authenticity Claim 경계 {#delivery-authenticity-claim-boundary}

Signature와 provenance manifest는 bytes와 declared history의 결속을 증명할 수 있지만 기록된 창작 내용 자체의 진실을 자동 판정한다고 주장하지 않아야 한다.

### Integrity Refusal {#delivery-integrity-refusal}

Digest mismatch, missing parent, invalid signature-like record, mutable source와 incomplete lineage를 current verified delivery로 취급하지 않아야 한다.
