# Joint, Edge와 Transition

## 서로 다른 요소가 만나는 Detail {#interior-joints-edges-transitions}

Joint, gap, grout, sealant, trim, reveal, shadow line, base, cornice, nosing, cap, flashing와 transition strip을 이름, profile, width, depth와 adjacent material 관계로 표현할 수 있어야 한다.

### Edge Treatment {#interior-edge-treatment}

Square, bevel, chamfer, radius, bullnose, folded, lipped와 exposed cut edge를 host geometry와 material thickness에 맞춰 선택할 수 있어야 한다.

### Material Transition {#interior-material-transitions}

Floor-to-floor, wall-to-wall, wall-to-ceiling, wet-to-dry, soft-to-hard와 new-to-existing transition은 elevation, tolerance, movement, waterproofing와 visual alignment를 함께 가질 수 있어야 한다.

### 반복 Detail과 예외 {#interior-joint-repetition-exception}

일반 joint rule을 많은 module에 재사용하면서 corner, opening, end, repair와 feature location의 개별 detail을 override할 수 있어야 한다.

### Detail 검증 {#interior-joint-validation}

Zero-width required joint, floating trim, incompatible edge, 끊긴 seal과 geometry 두께보다 큰 profile을 탐지해야 한다.
