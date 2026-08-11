# Identity와 Instance

## 의미를 보존하는 자산 identity {#asset-stable-identity}

Model, component, material region, rig, variant, prototype과 instance는 downstream consumer가 같은 대상을 추적할 수 있는 안정된 identity를 가져야 한다.

### Prototype과 instance {#asset-prototype-instance}

같은 형상이나 구성을 반복할 때 prototype을 재사용하되 각 instance의 identity, transform, owner, state, material override와 authored exception을 유지해야 한다.

### 논리 group {#asset-logical-group}

Instance는 공간 소속과 별개로 formation, facade bay, furniture set, vegetation cluster, army unit와 같은 저작·검토 group에 속할 수 있어야 하며 group은 중첩될 수 있어야 한다.

### 압축과 개별성 {#asset-compression-individuality}

많은 instance를 압축하여 저장하거나 함께 render하더라도 선택, 진단, visibility, quantity, collision과 변경 영향에서 필요한 개별 identity를 잃지 않아야 한다.

### Override provenance {#asset-instance-override-provenance}

최종 instance 값은 prototype, inheritance chain, deterministic variation과 explicit override 중 어느 사실에서 왔는지 추적할 수 있어야 한다.
