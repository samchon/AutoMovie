# Scale, Proportion과 Silhouette

## 실제 단위의 시각적 관계 {#production-design-scale-proportion}

Subject와 location은 실제 length unit, human reference, host boundary와 서로의 proportion을 가져야 하며 shot composition을 맞추기 위한 숨은 scale로 관계를 바꾸지 않아야 한다.

측정값은 source, basis, tolerance, coordinate frame와 적용 variant를 가질 수 있어야 한다. Reference가 없는 concept scale과 survey 또는 manufacturer dimension을 같은 confidence로 제시하지 않아야 한다.

### Silhouette Identity {#production-design-silhouette-identity}

중요 subject는 예상 camera distance와 angle에서 다른 대상과 구분되는 silhouette, major mass, landmark와 negative space를 가져야 한다.

Silhouette requirement는 front, side, three-quarter, action pose와 project-defined critical view 중 필요한 관찰 방향을 지정할 수 있어야 한다. 한 hero angle만 통과한 대상을 모든 방향에서 식별 가능하다고 주장하지 않아야 한다.

### Detail Frequency {#production-design-detail-frequency}

Large, medium와 small form의 빈도와 실제 크기를 delivery tier에 맞추고 texture noise가 구조와 silhouette를 대신하지 않아야 한다.

Detail은 예상 projected size, contrast, motion blur, outline와 lighting condition에서 살아야 하는 목적을 가질 수 있어야 한다. 보이지 않는 세부는 구조, interaction 또는 evidence 목적이 없다면 필수 build scope에서 제외할 수 있어야 한다.

### Repeated Scale {#production-design-repeated-scale}

Crowd, building, tree, tile, furniture와 prop population의 prototype scale과 variation range를 선언하고 instance마다 무관한 scale drift가 생기지 않아야 한다.

Variation은 허용 분포, correlated group seed, axis별 범위와 hero override를 구분할 수 있어야 한다. 무작위 크기 변화가 human clearance, pattern module, formation spacing와 story hierarchy를 깨지 않아야 한다.

### Scale Evidence {#production-design-scale-evidence}

Dimension, reference actor, bounds, plan·section과 actual render를 통해 scale을 확인할 수 있어야 하며 perspective 착시만으로 검증하지 않아야 한다.

### Unit와 Coordinate Frame {#production-design-units-coordinate-frame}

Project는 length, angle, area와 volume의 unit, up와 forward, local와 world frame, measurement origin을 선언할 수 있어야 한다. External asset과 reference의 다른 unit 또는 axis는 adopted design과의 변환을 기록해야 한다.

### Coordinate Magnitude Bound {#production-design-coordinate-magnitude-bound}

Project는 deterministic runtime이 안전하게 표현하고 검증할 수 있는 local·world coordinate magnitude bound를 선언해야 한다. Non-finite 값과 bound를 넘는 position, extent 또는 derived endpoint는 임의 clamp나 origin 이동으로 숨기지 않고 affected subject와 허용 범위를 포함해 거절해야 한다.

### Host와 Clearance 관계 {#production-design-host-clearance}

Door, furniture, vehicle, costume, held prop와 other hosted subject는 host opening, support, reach, travel와 keep-out clearance를 실제 scale에서 비교할 수 있어야 한다. Render에서 겹치지 않는 한 frame만으로 전체 movement range의 fit을 증명하지 않아야 한다.

### Proportion 규칙과 예외 {#production-design-proportion-rules-exceptions}

Character family, building system, vehicle set와 repeated prop의 shared proportion rule과 승인된 exception을 표현할 수 있어야 한다. Exception은 대상, 이유, 범위와 downstream effect를 가져야 하며 prototype 자체를 조용히 바꾸지 않아야 한다.

### Tier 간 Scale 보존 {#production-design-scale-across-tiers}

Proxy, standard, hero, imported와 repainted representation 사이에서 world extent, landmarks, contact points와 major mass를 보존해야 한다. Detail tier 교체가 object를 더 크거나 작게 보이게 만드는 경우 검토 가능한 drift로 보고해야 한다.

### Scale Conflict와 Refusal {#production-design-scale-conflict-refusal}

서로 모순된 dimension, 불가능한 clearance, non-positive scale, collapsed axis와 host 밖 placement를 owner와 source별로 보고하고 자동 보정하지 않아야 한다. 근거 없는 평균값으로 conflict를 숨기지 않아야 한다.

### Silhouette Acceptance {#production-design-silhouette-acceptance}

예상 delivery raster, camera distance, required angle, pose와 background contrast에서 subject identity와 hierarchy를 current image와 structural evidence로 검토할 수 있어야 한다. 확대된 turntable 또는 prose 선언만으로 actual shot readability를 통과시키지 않아야 한다.
