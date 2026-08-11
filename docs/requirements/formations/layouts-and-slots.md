# Layout과 Slot

## Compact Rule에서 파생되는 Member 위치 {#formation-layouts-slots}

Line, column, rank, grid, arc, ring, wedge, block, route-following, scattered와 project-defined layout을 count, spacing, orientation, origin와 bounded parameter로 표현할 수 있어야 한다.

### Slot Identity {#formation-slot-identity}

각 logical slot은 layout이 움직이거나 reform되어도 stable identity와 member assignment를 유지하고 array order 변경으로 의미가 바뀌지 않아야 한다.

### Local Frame {#formation-local-frame}

Member 위치는 formation-local frame에서 계산한 뒤 group transform, facing와 terrain relation을 적용하여 layout 자체와 world movement를 분리해야 한다.

### Dressing과 Variation {#formation-layout-dressing}

Spacing, offset, facing, scale와 phase variation을 bounded seed로 줄 수 있으나 minimum clearance와 hero placement를 위반하지 않아야 한다.

### Layout Capacity {#formation-layout-capacity}

Layout이 declared count를 수용하지 못하거나 slot이 중복·누락되면 member를 drop하거나 같은 위치에 겹치지 않고 거부해야 한다.
