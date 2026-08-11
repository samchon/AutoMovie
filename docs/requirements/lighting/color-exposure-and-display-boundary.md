# Color, Exposure와 Display 경계

## Scene Light와 표시 결과의 분리 {#lighting-color-exposure-display}

Light color와 intensity, material response, camera exposure, scene-linear working space, display transform, view와 grade를 별도 state와 provenance로 표현해야 한다.

### Working Space {#lighting-working-color-space}

Texture, environment, emission, light와 render value의 color space 또는 role을 선언하고 encoded display RGB를 scene-linear energy처럼 계산하지 않아야 한다.

### Exposure {#lighting-camera-exposure}

Exposure는 camera 또는 shot presentation control이며 source intensity를 바꾸지 않고 같은 scene light에서 비교 가능한 metadata를 가져야 한다.

### Display Transform {#lighting-display-transform}

Output display, view, tone mapping와 look을 delivery profile이 소유하고 같은 linear pixels를 여러 view로 변환할 수 있어야 한다.

### Color Refusal {#lighting-color-refusal}

Unknown color space, double transform, stale view, non-finite value와 source·display value 혼합을 거부해야 한다.
