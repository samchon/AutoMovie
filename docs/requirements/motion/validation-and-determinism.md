# 동작 검증과 결정론

## 모든 Sample에서 같은 결과 {#motion-validation-determinism}

Motion은 같은 source, target, clock와 state에서 evaluation order, seek order와 platform에 관계없이 같은 pose, transform, event와 digest를 만들어야 한다.

### Scrambled Seek {#motion-scrambled-seek}

순차 재생, 임의 순서 seek, 같은 time 반복 sample와 fresh evaluation이 같은 결과를 내고 숨은 mutable cache가 truth를 바꾸지 않아야 한다.

### Interior Sample 검증 {#motion-interior-sample-validation}

Start와 end뿐 아니라 curve extrema, contact change, constraint boundary, fast movement와 transition 내부를 bounded sample로 검사해야 한다.

### Numeric Stability {#motion-numeric-stability}

Finite value, normalized quaternion, stable comparison order, fixed rounding와 tolerance ownership을 명시하고 중복 math 구현이 다른 답을 만들지 않아야 한다.

### Visual Review {#motion-visual-review}

실제 viewer에서 motion arc, weight, contact, silhouette, expression, prop relation와 camera readability를 start, middle, end와 critical event에서 확인해야 한다.

### 결과 상태 {#motion-validation-status}

Numeric pass, visual pass, failed, unsupported와 not-run을 구분하고 시각 검증을 실행하지 않았다면 motion이 자연스럽다고 보고하지 않아야 한다.
