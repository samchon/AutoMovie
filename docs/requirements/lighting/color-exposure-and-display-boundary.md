# Color, Exposure와 Display 경계

## Scene Light와 표시 결과의 분리 {#lighting-color-exposure-display}

Light color와 intensity, material response, camera exposure, scene-linear working space, display transform, view와 grade를 별도 state와 provenance로 표현해야 한다.

### Color Provenance {#lighting-color-provenance}

Light, environment, emission, texture와 display value는 source color space 또는 spectral basis, encoding, transform chain과 current revision을 추적하고 unknown value를 편의상 working space로 간주하지 않아야 한다.

### Working Space {#lighting-working-color-space}

Texture, environment, emission, light와 render value의 color space 또는 role을 선언하고 encoded display RGB를 scene-linear energy처럼 계산하지 않아야 한다.

### Exposure {#lighting-camera-exposure}

Exposure는 camera 또는 shot presentation control이며 source intensity를 바꾸지 않고 같은 scene light에서 비교 가능한 metadata를 가져야 한다.

### White Balance와 Adaptation {#lighting-white-balance-adaptation}

White balance, chromatic adaptation와 artistic tint가 scene light, camera 또는 display 중 어디에 적용되는지 하나의 effective ownership과 순서를 가져야 하며 source color를 소급 변경하지 않아야 한다.

### Display Transform {#lighting-display-transform}

Output display, view와 look은 delivery profile이 소유하고, tone mapping은 scene presentation choice 또는 delivery fallback 중 한 effective source와 provenance를 가져야 한다. 같은 linear pixels를 여러 view로 변환할 수 있어야 한다.

### Comparison Boundary {#lighting-color-comparison-boundary}

Lighting A/B는 같은 material, camera, exposure, working space, display view와 raster를 고정하거나 차이로 선언하고 display 또는 grade 변경을 light 개선으로 보고하지 않아야 한다.

### Single Effective Transform {#lighting-single-effective-transform}

Scene, shot와 delivery default가 exposure 또는 tone mapping을 제안하는 경우 선택 규칙과 provenance를 명시하여 한 output에 두 curve가 중복 적용되거나 consumer마다 다른 owner를 고르지 않아야 한다.

### Color Refusal {#lighting-color-refusal}

Unknown color space, double transform, stale view, non-finite value와 source·display value 혼합을 거부해야 한다.
