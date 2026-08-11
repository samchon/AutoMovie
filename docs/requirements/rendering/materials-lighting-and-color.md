# Material, Light와 Color

## Surface와 Scene Light의 일관된 평가 {#rendering-materials-lighting-color}

Material channel, texture, sampler, coordinate, normal·displacement, opacity, transmission, emission, light와 environment를 declared working color space에서 평가해야 한다.

### External Material {#rendering-external-materials}

glTF와 external asset의 supported PBR material, texture, transform, extension와 fallback policy를 명시하고 unsupported extension을 비슷한 기본 재료로 조용히 바꾸지 않아야 한다.

### Texture Decode {#rendering-texture-decode}

Image format, color space, alpha mode, channel, resolution, wrap, filter, mip-like representation와 byte digest를 검증하고 declared semantic에 맞게 decode해야 한다.

### Scene-linear와 Display {#rendering-scene-display-color}

Lighting 계산, render buffer, tone mapping, view transform와 encoded output color를 구분하고 double transform과 clipped source를 탐지해야 한다.

### Material Refusal {#rendering-material-refusal}

Missing texture, invalid UV, unknown color space, non-finite parameter, unsupported transparency와 resource budget 초과를 거부해야 한다.
