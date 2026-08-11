# Texture, Pattern과 변주

## 실제 Surface에 놓이는 Pattern {#interior-texture-pattern-variation}

Tile, plank, brick, panel, wallpaper, textile, perforation, inlay와 project-defined pattern을 actual module, surface coordinate, scale, direction, repeat와 boundary rule로 배치할 수 있어야 한다.

### Image와 Procedural Source {#interior-pattern-source}

Pattern은 사용자 image, 외부 texture, procedural field, geometry module 또는 이들의 조합에서 올 수 있으며 source와 decoding, color space, channel 의미를 추적해야 한다.

### 절단과 Border {#interior-pattern-cuts-borders}

Opening, edge, corner, drain, fixture와 불규칙 boundary에서 full unit, cut unit, border, minimum piece, waste와 intentional alignment를 계산할 수 있어야 한다.

### 결정론적 변주 {#interior-pattern-deterministic-variation}

색, 무늬, rotation, offset, wear와 handmade irregularity는 bounded rule과 stable seed로 재현되어야 하며 관련 없는 수정으로 기존 배치가 다시 섞이지 않아야 한다.

### Pattern 거부 {#interior-pattern-refusal}

숨은 scale, zero module, 끝나지 않는 subdivision, unsupported sampler, invalid coordinate와 budget을 넘는 expansion을 명시적 진단으로 거부해야 한다.
