# Resource Closure와 Acquisition

## Immutable Resource Closure {#interchange-resource-closure}

<!-- @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-closure 채택 revision을 해석에 필요한 dependency의 닫힌 집합으로 봉인한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-resource-closure glTF와 GLB의 buffer, image와 URI를 포함한 closure를 검증한다. -->

Resource closure는 root selections에서 parser-declared dependency edge를 따라 도달하는 finite graph이며 각 member의 canonical locator, role, required 여부, content digest, byte length와 parent edge를 포함한다. Accepted revision은 모든 required member가 resident하고 digest-verified인 closure digest를 가지며 closure 밖 fetch나 file read가 interpretation result에 영향을 줄 수 없다.

### Media Dependency Extraction {#interchange-media-dependency-extraction}

<!-- @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-media-dependencies Media별 sidecar와 linked resource를 required·optional dependency로 식별한다. -->

각 media inspector는 glTF buffer·image, material texture, color profile, audiovisual stream과 subtitle, motion skeleton, spatial tile·reference, text schema·link와 archive member를 typed dependency edge로 반환한다. Optional edge를 제외한 결과는 exclusion consequence를 support report에 남기고 required edge가 missing이면 closure를 seal하지 않는다.

### Locator와 Redirect Fence {#interchange-locator-redirect-fence}

<!-- @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-location-boundary Path escape, undeclared host와 surprise fetch를 resource resolution에서 차단한다. -->

Locator resolution은 authorized project root, archive root 또는 network authority 안에서 canonical target을 계산하고 symlink-like indirection, redirect chain과 final authority를 기록한다. Root escape, local secret path, undeclared protocol·host와 authorization 밖 redirect는 resolution error이며 import 이후에는 remote locator를 다시 열지 않는다.

### Expanded Resource Budget {#interchange-expanded-resource-budget}

<!-- @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-archive-bounds Compressed size뿐 아니라 expanded bytes, count, nesting과 fan-out을 제한한다. -->

Closure validation은 raw·compressed bytes, expanded bytes, member count, nesting depth, dependency depth와 fan-out, decoded dimensions, duration, samples, points, nodes와 parser work의 declared limits를 누적한다. Overflow, unsafe integer, recursion, cycle과 budget 초과는 allocation 또는 full decode 전에 refusal을 반환하고 partial result를 adopted closure로 사용하지 않는다.

### Raw와 Normalized Revision 분리 {#interchange-original-byte-preservation}

<!-- @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-original-bytes Validation과 normalization이 취득 원본을 덮어쓰지 못하게 한다. -->

Raw source closure는 immutable acquisition artifact로 남고 metadata repair, decompression, normalization과 conversion은 parent closure digest를 인용하는 derived revision을 만든다. Current path가 derived bytes를 가리켜도 original, normalized와 adopted digests를 각각 조회할 수 있으며 processing failure가 raw revision을 변경하지 않는다.

### Live Network Dependency State {#interchange-live-network-dependency-state}

<!-- @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-network-dependency Acquisition-time network와 adoption 뒤 live dependency를 구분한다. -->

Adoption record는 network를 acquisition에만 사용하고 sealed closure로 실행하는 `offline-capable` 상태와 consumer evaluation 때 remote dependency가 필요한 `live-dependent` 상태를 구분한다. Live-dependent revision은 authority, freshness rule, failure behavior와 offline refusal을 포함하고 local-complete 또는 deterministic closure로 표시되지 않는다.
