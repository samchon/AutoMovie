# 외관 검증과 Interior 일관성

## 외관 자체와 연결된 Interior의 검증 {#building-exterior-validation}

Exterior는 interior 존재 여부와 무관하게 geometry, support, envelope, opening, material, map contact와 state를 검증해야 하며, 같은 building identity의 interior가 있을 때에는 공동 제약도 검증해야 한다.

### 외관 형상과 관계 {#building-exterior-geometry-validation}

Gap, overlap, inverted surface, degenerate solid, unsupported attachment, invalid opening, impossible panel cut, terrain penetration와 disconnected access를 탐지해야 한다.

### 면적과 높이 {#building-exterior-area-height-validation}

Footprint, floor area scope, storey elevation, floor-to-floor height, roof와 total height의 계산과 관계가 일관되는지 확인해야 한다.

### 내외부 공동 제약 {#building-exterior-interior-shared-validation}

연결된 interior의 space, floor, ceiling, wall, core와 shaft가 exterior footprint, level, envelope thickness와 opening 안에서 성립하는지 확인해야 한다.

### 독립 Scope {#building-exterior-independent-scope}

Exterior-only와 interior-only는 누락으로 취급하지 않되 scope가 명시되어야 한다. 양쪽이 연결되지 않았다면 내외부 일관성을 검증했다고 주장하지 않는다.

### 시각적 검토 {#building-exterior-visual-review}

실제 3D 장면에서 scale, mass proportion, skyline, facade composition, opening depth, material, pattern, weathering, shadow, map relation와 set completeness를 검토하고 source 수정 뒤 같은 조건으로 다시 생성할 수 있어야 한다.
