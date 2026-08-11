# Actor 입력, 선택과 교체

## 사용자가 선택한 Actor 구성 {#actor-inputs-selection-replacement}

사용자와 저작 에이전트는 actor를 이루는 model, rig, skin, morph, motion library, costume, attachment와 voice의 source를 각각 선택하고, 선택하지 않은 후보나 도구의 기본값이 결과에 섞이지 않게 해야 한다.

### 독립적인 Binding 선택 {#actor-independent-binding-selection}

하나의 actor에 project-native proxy, 외부 rig, 별도 motion clip, 다른 costume와 voice를 조합할 수 있어야 하며, 한 입력을 바꾼다고 나머지 binding을 이유 없이 교체하지 않아야 한다.

### 외부 Rig 채택 {#actor-external-rig-adoption}

사용자가 제공한 rig는 source hierarchy, joint order, rest와 bind basis, skin weight, morph, control, dependency와 embedded animation의 지원 범위를 검사한 뒤 direct use, native conversion 또는 다른 actor 자산과의 group composition 중 사용자가 선택한 방식과 explicit mapping으로 채택할 수 있어야 한다.

### Compatibility Preview {#actor-input-compatibility-preview}

채택 전에는 scale, 좌표계, bone과 control coverage, joint range, root, contact, costume anchor, motion과 expression compatibility, 예상 loss와 unsupported feature를 비교하여 사용자가 원본 유지, 변환, 대체 또는 거부를 선택할 수 있게 해야 한다.

### 선택과 교체 Receipt {#actor-selection-replacement-receipt}

선택된 source와 version, adoption mode, mapping, authored override, conversion loss와 result digest를 보존하고, source나 선택이 바뀌면 영향을 받는 performance, shot, continuity와 evidence를 stale로 식별해야 한다.
