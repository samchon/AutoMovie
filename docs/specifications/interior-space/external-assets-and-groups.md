# 외부 자산, Group과 반복

## Contract units {#spec-external-assets-and-groups-contract-units}

### 외부 glTF 채택 gate {#interior-space-external-gltf-adoption-gate}

<!-- @evidence requirements/interior/external-assets-and-placement.md#interior-external-asset-placement Requires user-selected glTF and GLB as interior inputs. -->
<!-- @evidence requirements/interior/external-assets-and-placement.md#interior-external-adoption-choice Requires the user to choose the adoption mode. -->
<!-- @evidence requirements/interior/external-assets-and-placement.md#interior-external-asset-closure Requires complete resource closure and bounded decoding. -->
<!-- @evidence requirements/interior/external-assets-and-placement.md#interior-external-provenance-secrets Requires provenance without credentials. -->
<!-- @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-gltf-glb Requires scene, node, mesh, material, texture, skin, morph, animation, camera, light, and extension support to be distinguished. -->
<!-- @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-adoption-gate Requires validation before an external revision becomes current input. -->

사용자 또는 위임받은 저작 에이전트가 선택한 glTF·GLB revision은 raw bytes, selected scene·node subset, buffer·image·URI·extension closure, digest, axis·handedness·unit·origin·pivot·bounds, license, acquisition provenance와 supported feature set을 입력으로 받는다. Acquired·quarantined·accepted·rejected·unsupported·degraded·unavailable 상태를 구분하고 accepted revision만 current interior에 참여시킨다. Path escape, surprise fetch, missing dependency, digest mismatch, unsafe active content, resource budget 초과, unsupported required feature와 credential 포함은 hard failure다. API key·token·cookie는 receipt와 artifact에 들어가지 않으며, provider·model·prompt·seed는 provenance이지 동일 bytes 재생성 보장이 아니다.

### Direct placement와 native reinterpretation {#interior-space-external-direct-native-adoption}

<!-- @evidence requirements/interior/external-assets-and-placement.md#interior-external-direct-placement Requires supported source hierarchy and local transforms to survive direct placement. -->
<!-- @evidence requirements/interior/external-assets-and-placement.md#interior-external-native-conversion Requires a source-to-native mapping and explicit loss. -->
<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-direct-placement Defines direct placement without claiming native authorship. -->
<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-native-reinterpretation Defines project-native reinterpretation and its mapping obligations. -->
<!-- @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-mapping Requires every split, merge, transform, approximation, and omission in the receipt. -->

`direct` mode는 source scene graph, node identity·hierarchy, local transform, mesh reuse, material·texture와 지원되는 skin·morph·animation을 보존하면서 building space·element identity와 placement relation만 추가한다. `native` mode는 선택한 source element를 authorable geometry, material, furnishing, architectural element, state와 relation으로 재해석하고 source-to-result mapping, split·merge, transform baking, unit·coordinate conversion, approximation, generated topology, substitution, omission과 unsupported behavior를 canonical receipt에 기록한다. 두 mode는 같은 source를 사용해도 다른 adoption identity이며 refresh가 몰래 mode를 바꾸지 않는다. Direct 결과를 native semantic truth로 표시하거나 native 결과가 원본 fidelity를 전부 보존했다고 표시하는 것은 failure다.

### Group composition과 host 적합성 {#interior-space-external-group-host-fit}

<!-- @evidence requirements/interior/external-assets-and-placement.md#interior-external-group-composition Requires direct and converted assets inside larger authored groups. -->
<!-- @evidence requirements/interior/external-assets-and-placement.md#interior-external-host-constraint Requires final placement to satisfy host size, level, opening, support, and clearance constraints. -->
<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-group-composition Requires stable membership, transforms, order, roles, and overrides. -->
<!-- @evidence requirements/building-exterior/external-assets-and-placement.md#building-exterior-external-size-level-constraints Requires imported geometry to respect footprint, height, level, envelope, openings, and linked interior boundaries. -->

`group` mode는 direct와 native member를 authored element, furnishing, assembly 또는 nested group과 함께 stable membership, local transform, order, role, override, phase와 source relation으로 합성한다. 최종 resolved geometry는 building footprint와 usable volume, level elevation·clear height, wall·floor·ceiling, opening, support, collision, access·operation·maintenance clearance와 service connection을 검증받아야 한다. Imported bounds나 frame appearance만으로 host fit을 통과시키지 않고 bare geometry에 source가 제공하지 않은 structure·opening·service 의미를 발명하지 않는다. Host escape, unsupported member semantics, lost hierarchy, invalid transform와 group override conflict는 failure이며 explicit degradation은 사용자의 사전 선택과 receipt를 요구한다.

### 반복 group과 identity 보존 {#interior-space-repeated-group-identity}

<!-- @evidence requirements/interior/groups-instances-and-repetition.md#interior-groups-instances-repetition Requires groups and instances with stable prototype relations. -->
<!-- @evidence requirements/interior/groups-instances-and-repetition.md#interior-nested-groups Requires nested composition without destructive flattening. -->
<!-- @evidence requirements/interior/groups-instances-and-repetition.md#interior-repeated-storey-room Requires repeated levels and rooms with explicit resolved identity. -->
<!-- @evidence requirements/interior/groups-instances-and-repetition.md#interior-instance-overrides Requires bounded per-member exceptions. -->
<!-- @evidence requirements/interior/groups-instances-and-repetition.md#interior-group-seed-correlation Requires group-level seed and correlated variation. -->
<!-- @evidence requirements/interior/groups-instances-and-repetition.md#interior-group-bounded-expansion Requires expansion budgets and bounded diagnostics. -->
<!-- @evidence requirements/interior/groups-instances-and-repetition.md#interior-group-identity-preservation Requires identities to survive instancing, LOD, and export. -->

반복 floor, room, ceiling bay, tile group, furniture set와 fixture bank는 prototype identity, bounded member law, count·layout, group transform, stable seed, shared tolerance field, member identity와 explicit exception을 입력으로 받는다. Nested group은 transform과 membership provenance를 합성하되 원형을 파괴적으로 flatten하지 않고, 각 resolved member는 LOD·culling·instancing 뒤에도 quantity, selection, diagnostic와 phase target으로 다시 식별되어야 한다. 새 exception은 다른 member의 seed 결과를 바꾸지 않고 prototype update는 영향을 받는 override conflict와 stale result를 보고한다. Count·budget 초과, duplicate member id, unsupported deformation instancing, non-rigid transform loss와 완전 전개를 요구하는 unbounded 진단은 failure이며 bounded sample 뒤의 omitted count를 숨기지 않는다.
