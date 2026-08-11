# Canonical Digest와 Content Identity

## Versioned content identity protocol {#evp-versioned-content-identity-protocol}

### Structured canonicalization {#evp-structured-canonicalization}

<!-- @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-canonical-content-identity 같은 허용 입력이 반복 계산에서 같은 identity를 내는 versioned digest protocol을 정의한다. -->

Identity 계산 입력은 protocol id와 version, digest algorithm, canonicalization version, domain role, payload와 dependency closure다. 출력 identity는 algorithm과 digest를 함께 표현하고 같은 입력 집합과 protocol에서 platform, locale, traversal order와 wall clock에 관계없이 byte-identical해야 한다.

Protocol, algorithm 또는 closure를 알 수 없으면 digest string만 재사용해 verified로 판정하지 않아야 한다. 지원되는 이전 protocol은 원 identity를 보존해 검증하고 새 protocol로 다시 계산할 때 migration relation을 별도로 출력해야 한다.

<!-- @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-structured-canonicalization 구조화된 record의 property, 문자, 수치, path와 omitted 값 표현을 하나로 정규화한다. -->

Canonicalizer는 schema version과 value를 입력받아 명시된 property ordering, Unicode normalization form과 UTF byte encoding, finite number serialization, string escaping, array ordering, null과 omitted 의미, identifier와 logical path 표기로 canonical bytes를 출력해야 한다. 의미 없는 object property order 차이는 같은 bytes가 되고 의미 있는 array order는 보존되어야 한다.

Duplicate key, non-finite number, 지원하지 않는 scalar, 모호한 encoding과 path collision은 canonicalization failure다. 실패 입력에 host serializer 결과나 빈 digest를 대신 사용해서는 안 된다.

### Binary closure digest {#evp-binary-closure-digest}

<!-- @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-binary-dependency-closure binary bytes와 결과를 결정하는 모든 dependency의 digest closure를 결속한다. -->

Binary identity 입력은 exact bytes, content role과 required dependency identities다. Closure identity는 dependency role, logical identity, revision, digest와 의미 있는 order를 포함하며 filesystem enumeration이나 locator 문자열을 content bytes 대신 사용해서는 안 된다.

Required dependency 누락, duplicate logical member, digest mismatch와 undeclared bytes가 결과에 참여한 경우 closure는 incomplete 또는 invalid다. Optional dependency는 optional role을 명시하고 실제로 소비되었으면 identity에 포함해야 한다.

### Byte와 semantic identity {#evp-byte-semantic-identity}

<!-- @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-byte-and-semantic-identity byte digest와 canonical semantic identity를 별도 namespace와 relation으로 유지한다. -->

System은 raw byte identity와 decoded 또는 normalized semantic identity를 각각 계산하고 `represents` relation으로 연결해야 한다. Byte identity는 exact serialization을, semantic identity는 선언된 decoder와 canonical semantic protocol 아래의 meaning을 가리킨다.

같은 semantic identity의 다른 bytes와 같은 bytes의 다른 interpretation을 모두 표현할 수 있어야 한다. 한 identity의 일치로 다른 identity의 일치를 추정하거나 decoder version이 다른 semantic digest를 같은 것으로 합쳐서는 안 된다.

### Mutable locator snapshot {#evp-mutable-locator-snapshot}

<!-- @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-mutable-reference-snapshot mutable URL, branch, tag와 service response를 fixed snapshot 또는 verified bytes에 연결한다. -->

Acquisition 입력은 locator, resolved locator, acquisition time, response identity와 bytes다. Mutable locator는 source discovery metadata로만 보존하고 current input은 immutable upstream revision 또는 acquired byte digest를 참조해야 한다.

Snapshot을 만들 수 없거나 later fetch가 다른 bytes를 반환하면 unavailable, changed 또는 non-reproducible을 출력해야 한다. Cache와 offline copy는 original locator가 아니라 exact snapshot identity로 검증해야 한다.

### Algorithm migration과 collision response {#evp-algorithm-migration-collision}

<!-- @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-algorithm-change-and-collision algorithm 변경, 지원 중단, 계산 실패와 collision의 상태 전이를 정의한다. -->

Algorithm migration은 old identity, new identity, migration protocol, actor 또는 policy, time와 verification result를 가진 activity다. 기존 record의 digest를 교체하지 않고 두 identity를 병존시키며 consumer가 요구하는 algorithm set을 명시해야 한다.

Known collision, malformed digest, unsupported algorithm과 계산 failure는 해당 identity와 그에만 의존한 verified status를 invalid 또는 unverifiable로 만든다. Alternative algorithm으로 성공해도 실패 identity의 과거 판정을 삭제하지 않아야 한다.
