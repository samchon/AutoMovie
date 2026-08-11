# Material, Light와 Color

## Surface와 Scene Light의 일관된 평가 {#rendering-materials-lighting-color}

Material channel, texture, sampler, coordinate, normal과 displacement, opacity, transmission, emission, light와 environment는 declared working color space와 unit relation에서 평가되어야 한다. Rendering과 delivery transform의 경계를 분리하여 같은 변환이 두 번 적용되지 않게 해야 한다.

### Material Resolution {#rendering-material-resolution}

각 visible surface는 stable material identity와 parameter source를 가져야 하며 instance override와 authored fallback의 우선순위를 명시해야 한다. Missing binding을 임의의 default material로 숨기지 말고 허용된 diagnostic fallback과 final-capable material을 구분해야 한다.

### External Material {#rendering-external-materials}

External asset의 supported physically based channel, texture transform, alpha mode와 extension을 보존해야 한다. Unsupported extension 또는 channel은 어떤 appearance 정보가 손실되는지 보고하고, 비슷한 기본 재료로 조용히 바꾸어 verified result를 주장해서는 안 된다.

### Texture Decode {#rendering-texture-decode}

Image format, byte digest, declared color space, alpha mode, semantic channel, dimensions, wrap, filter와 mip-like representation을 검증하고 그 의미에 맞게 decode해야 한다. 같은 file을 color data와 numeric data로 사용할 때 서로 다른 decode intent를 가져야 한다.

### Lighting Evaluation {#rendering-lighting-evaluation}

Light type, transform, intensity와 unit-like meaning, color 또는 temperature, shaping, shadow와 environment contribution을 fixed scene state에서 평가해야 한다. Light enumeration order나 prior frame shadow state가 결과를 바꾸어서는 안 된다.

### Scene-linear와 Display {#rendering-scene-display-color}

Lighting calculation, scene-linear intermediate, tone mapping 또는 view transform, display-referred preview와 encoded output color를 구분해야 한다. Input texture, render buffer와 output metadata의 color identity를 receipt에서 추적할 수 있어야 한다.

### Transparency와 Alpha {#rendering-transparency-alpha}

Opaque, masked와 supported blended surface, straight 또는 premultiplied alpha 및 background composition rule을 product별로 명시해야 한다. Sorting ambiguity와 unsupported transmission을 platform-dependent appearance로 방치해서는 안 된다.

### Color Recovery 경계 {#rendering-color-recovery}

Preview를 위한 diagnostic fallback을 사용하면 affected material, texture, frame과 fallback identity를 기록해야 한다. Missing color transform이나 texture가 복구되면 affected products를 stale로 만들고 이전 fallback frame을 current로 재사용해서는 안 된다.

### Material Refusal {#rendering-material-refusal}

Missing required texture, invalid coordinate, unknown color space, non-finite parameter, unsupported transparency, cyclic material relation과 resource limit 초과는 거절해야 한다. 오류는 surface identity와 expected semantic을 포함해야 하며 검정 또는 흰 재료로 자동 성공시키면 안 된다.
