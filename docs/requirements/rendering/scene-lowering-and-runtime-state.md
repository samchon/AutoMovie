# Scene Lowering과 Runtime State

## Declared Source를 Renderable State로 변환 {#rendering-scene-lowering-runtime}

Scene lowering은 model, instance, actor, rig, formation, camera, light, environment, effect와 material의 compiled identity를 runtime object 및 state와 결정적으로 연결해야 한다. Lowering 결과는 render 전에 검증 가능해야 하며 unsupported input을 generic placeholder로 바꾸어 성공시켜서는 안 된다.

### Ownership 보존 {#rendering-lowering-ownership}

각 runtime object와 derived resource는 source subject, group, material, semantic owner와 instance placement를 역추적할 수 있어야 한다. Mask, selection, diagnostic와 structural pass가 같은 review identity를 읽을 수 있어야 하며 batching이나 instancing이 ownership을 없애서는 안 된다.

### Build Order {#rendering-runtime-build-order}

Parent, dependency와 reference relation이 build order를 결정해야 한다. 입력 배열 순서, path enumeration 또는 이전 cache order가 scene graph, material binding, light relation이나 output identity를 바꾸어서는 안 된다.

### Time Update {#rendering-runtime-time-update}

각 sample에서 transform, pose, morph, material state, light, effect와 visibility를 fixed film clock으로 평가해야 한다. 임의의 시간으로 직접 seek한 결과는 이전 frame을 순서대로 재생한 결과와 같아야 하며 이전 frame의 mutable state가 남아서는 안 된다.

### Runtime State Isolation {#rendering-runtime-state-isolation}

Camera, pass override, temporary visibility, animation accumulator와 capture setting은 frame, view와 product 사이에서 격리되어야 한다. 한 pass의 override나 실패가 다음 pass, frame 또는 concurrent job의 상태를 오염시켜서는 안 된다.

### Resource Lifecycle {#rendering-runtime-lifecycle}

Object, texture, buffer, audio-related resource, effect와 listener는 어느 render state가 획득하고 교체하며 해제하는지 추적할 수 있어야 한다. Retry, shot change, cancellation과 failure 뒤에는 stale resource나 callback이 다음 결과에 영향을 주지 않아야 하며 resource cleanup 실패를 성공으로 숨겨서는 안 된다.

### Partial Lowering과 Retry {#rendering-lowering-partial-retry}

Independent resource가 일부 준비되었더라도 required scene closure가 깨지면 renderable state는 partial이어야 한다. Missing dependency가 복구되면 영향받는 subtree를 다시 lower할 수 있으나 source identity가 같은 이미 검증된 subtree를 임의로 재해석해서는 안 된다.

### Lowering Refusal {#rendering-lowering-refusal}

Unknown model, missing required material, invalid hierarchy, duplicate runtime owner, unsupported feature, non-finite state와 incompatible resource는 거절해야 한다. Diagnostic은 source identity, failed boundary와 whether retry is safe를 포함해야 한다.
