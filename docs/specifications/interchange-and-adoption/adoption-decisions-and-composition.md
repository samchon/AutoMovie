# Adoption Decision과 Composition

## Adoption Decision Identity {#interchange-adoption-decision-identity}

### Direct Placement Boundary {#interchange-direct-placement-boundary}

<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-mode-choice Direct placement, native reinterpretation과 group composition을 사용자 선택으로 identity에 결속한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-adoption-mode 외부 3D 자산에 대한 동일한 mode 선택을 공통 adoption record로 구체화한다. -->

Adoption decision은 pinned source revision, selected elements와 ranges, mode, interpretation profile, placement, override, composition membership, consumer와 승인 identity를 canonical record로 묶는다. 같은 source revision이라도 이 record의 의미 있는 field가 다르면 distinct adoption identity를 만들고 system은 media complexity를 근거로 mode를 변경하지 않는다.

<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-direct-placement Source structure를 유지하는 direct placement의 입력과 보존 불변식을 정한다. -->

Direct placement는 selected source element graph와 resource bindings를 immutable imported payload로 유지하고 source-local identities, hierarchy, track·layer·stream relation과 reuse를 보존한다. Project space와 time에 연결하는 declared transform과 interpretation만 별도 placement layer로 적용하며 source를 project-native semantics로 변환했다고 표시하지 않는다.

### Native Reinterpretation Boundary {#interchange-native-reinterpretation-boundary}

<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-native-reinterpretation Source element를 project-native 의미로 바꾸는 derived revision과 mapping을 정의한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Source에 없던 의미와 author-added 의미를 구분한다. -->

Native reinterpretation은 source selection과 interpretation profile을 읽어 새 project-native element graph를 산출하고 모든 output identity를 source element mapping에 연결한다. Preserved, split, merged, approximated, synthesized와 omitted semantics를 구분하며 author-added role, constraint와 behavior는 source fact와 다른 provenance layer에 둔다.

### Group Composition Boundary {#interchange-group-composition-boundary}

<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-group-composition Imported와 reinterpreted member를 상위 관계에 합성하는 불변식을 정한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-group-composition 자산 내부 hierarchy와 상위 group relation을 동시에 보존한다. -->

Group composition은 direct 또는 reinterpreted adoption identity를 member로 참조하고 parent group, member role, order, local transform, visibility, attachment와 explicit override를 별도 relation graph에 기록한다. Composition은 member resource를 복제·병합하거나 내부 identity를 재번호화하지 않고 하나의 member가 여러 logical group에 참여할 때 각 relation identity를 유지한다.

### Selection과 Override Resolution {#interchange-selection-override-resolution}

<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-selection-overrides File 전체가 아닌 element subset과 authored override의 적용 범위를 고정한다. -->

Selection은 scene, node, clip, channel, layer, page, range 또는 schema field의 source-local identity와 boundary를 열거하고 closure computation의 root가 된다. Override는 target identity, authored value, priority와 source revision basis를 가지며 selected subset 밖 element나 새 source revision의 ambiguous target에 자동 전이되지 않는다.

### Adoption Intent Replay {#interchange-adoption-intent-replay}

<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-intent-persistence Refresh와 relink 뒤에도 사용자의 mode, selection과 composition 의도를 보존한다. -->

Relink, refresh, cache restore와 reconversion은 이전 adoption decision을 새 source revision에 replay하고 target identity, mode, placement, membership와 override가 모두 유일하게 해석될 때만 equivalent candidate를 만든다. Missing 또는 ambiguous mapping은 conflict result를 반환하고 다른 element나 mode를 선택하지 않는다.
