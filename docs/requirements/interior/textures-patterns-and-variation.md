# Texture, Pattern과 변주

## 실제 Surface에 놓이는 Pattern {#interior-texture-pattern-variation}

Tile, plank, brick, panel, wallpaper, textile, perforation, inlay와 project-defined pattern을 actual module, surface coordinate, scale, direction, repeat와 boundary rule로 배치할 수 있어야 한다.

### Image와 Procedural Source {#interior-pattern-source}

Pattern은 사용자 image, 외부 texture, procedural field, geometry module 또는 이들의 조합에서 올 수 있으며 source와 decoding, color space, channel 의미를 추적해야 한다.

사용자는 자신의 image, generated texture, scanned stock 또는 procedural source를 선택하고 coordinate set, world scale, pivot, rotation, wrap·clamp·mirror, filter, resolution, bit depth와 alpha 의미를 지정할 수 있어야 한다. Base color와 linear data, normal, bump와 actual displacement를 같은 channel로 취급하지 않아야 한다.

### 절단과 Border {#interior-pattern-cuts-borders}

Opening, edge, corner, drain, fixture와 불규칙 boundary에서 full unit, cut unit, border, minimum piece, waste와 intentional alignment를 계산할 수 있어야 한다.

### 결정론적 변주 {#interior-pattern-deterministic-variation}

색, 무늬, rotation, offset, wear와 handmade irregularity는 bounded rule과 stable seed로 재현되어야 하며 관련 없는 수정으로 기존 배치가 다시 섞이지 않아야 한다.

Seed만이 아니라 generator 또는 noise algorithm identity와 version, stream key, distribution, quantization, outlier, channel correlation와 composition order를 기록해야 한다. Stable module identity에서 각 channel을 파생하여 앞선 tile 추가·삭제가 뒤쪽 field 전체를 바꾸지 않아야 한다.

### Group 상관 변주 {#interior-pattern-group-correlated-variation}

하나의 tile lot, row, course, panel batch와 installation zone은 group-level seed와 bias를 공유하고 각 instance는 그 안에서 파생된 bounded deviation을 가질 수 있어야 한다.

Position, in-plane rotation, tilt, height, module size, joint width·depth·local curve, edge, color, roughness, wear와 pattern phase를 독립 또는 correlated channel로 지정할 수 있어야 한다. Shared substrate drift, gradual installation bias와 cluster variation을 independent random noise로 축약하지 않아야 한다.

### Pattern 거부 {#interior-pattern-refusal}

숨은 scale, zero module, 끝나지 않는 subdivision, unsupported sampler, invalid coordinate와 budget을 넘는 expansion을 명시적 진단으로 거부해야 한다.

영역, module, grout 또는 gap, border, minimum piece와 opening constraint를 동시에 풀 수 없으면 module을 몰래 찌그러뜨리거나 누락하지 않고 unresolved constraint, affected instance, applied fallback과 residual error를 보고해야 한다.
