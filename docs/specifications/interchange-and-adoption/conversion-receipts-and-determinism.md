# Conversion Receipt와 Determinism

## Deterministic Interpretation Boundary {#interchange-deterministic-interpretation}

### Receipt Input Basis {#interchange-receipt-input-basis}

<!-- @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-determinism 같은 pinned input과 declared interpretation이 같은 adopted identity를 만들게 한다. -->

Interpretation과 conversion은 pinned closure, selection, adoption mode, ordered transforms, profile version, settings와 deterministic runtime identity의 pure function으로 정의된다. 지원되는 determinism scope에서 같은 input identity는 canonical output와 receipt digests를 재현하고 platform-dependent 결과는 scope, tolerance와 pinned result bytes를 별도 facts로 기록한다.

<!-- @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Receipt가 source closure, selection, units, mode, placement, tool와 budget을 결과에 결속한다. -->

Receipt input basis는 raw와 dependency digests, selected element identities와 ranges, coordinate·unit·time·color interpretation, adoption mode, placement, overrides, profile와 tool versions, serializable settings와 observed resource budget을 포함한다. Unordered set은 code-unit-stable order로 canonicalize하고 semantic order는 원본 순서를 identity에 보존한다.

### Element Mapping과 Transform Ledger {#interchange-receipt-element-mapping}

<!-- @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-mapping Source와 result element 대응 및 모든 변환을 receipt에 기록한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-conversion-receipt Native conversion의 좌표·단위, merge, approximation과 loss를 재생 가능하게 한다. -->

Transform ledger는 source-to-result mappings과 split, merge, transform bake, coordinate·unit·time·color conversion, resample, retarget, material substitution, metadata normalization과 composition relation을 ordered activities로 기록한다. Direct placement도 identity mapping, inspected support set과 placement transform을 receipt에 남겨 no-op과 unrecorded conversion을 구분한다.

### Loss와 Approximation Ledger {#interchange-receipt-loss-ledger}

<!-- @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-loss Unsupported, dropped, approximated와 precision loss를 element consequence와 함께 기록한다. -->

Loss entry는 affected source elements, feature, chosen fallback, numeric precision 또는 semantic difference, downstream consequence와 user authorization을 가진다. Omitted extension, channel, event, topology와 behavior는 successful open 또는 visible output으로 보존되었다고 표시되지 않고 support report와 result status에 함께 반영된다.

### Canonical Receipt와 Result Digest {#interchange-canonical-receipt-result}

<!-- @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result 의미가 같은 receipt와 output의 stable identity를 정의한다. -->

Receipt serialization은 schema version, normalized paths와 strings, deterministic number representation, sorted unordered fields와 preserved semantic arrays를 사용하며 duplicate keys와 non-finite values를 거부한다. Receipt digest와 output inventory digest는 서로 결속되고 의미 있는 source, settings, version 또는 result 차이는 distinct identity가 된다.

### Nondeterministic Generation Boundary {#interchange-nondeterministic-generation-boundary}

<!-- @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-generation-reproducibility-boundary External generation은 request replay가 아니라 returned bytes를 재현 기준으로 삼는다. -->

External service가 bit-identical replay를 증명하지 못하면 acquisition activity는 nondeterministic이고 returned raw bytes와 digest가 downstream deterministic boundary의 input이 된다. Prompt, seed, model label, request id와 current service state는 provenance이며 output digest를 재생했다는 evidence 없이 reproducible flag를 true로 만들지 않는다.

### Receipt Freshness와 Revision Diff {#interchange-receipt-freshness-diff}

<!-- @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-freshness Source, interpretation, conversion 또는 output 변경 시 이전 receipt를 stale로 처리한다. -->

Receipt freshness는 recorded input basis, closure, interpretation·tool versions와 current output inventory를 다시 계산해 equality를 판정한다. Revision diff는 source, mapping, transform, loss와 result changes를 separate sets로 반환하여 사용자가 new candidate를 채택하거나 prior result를 current로 유지할 수 있게 한다.
