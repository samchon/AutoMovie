# Shutter, Exposure와 시간 Sampling

## Frame의 시간과 밝기 Metadata {#camera-shutter-exposure-sampling}

Camera는 frame time, frame rate 또는 rational timebase, shutter interval 또는 angle, exposure compensation와 supported aperture metadata를 선언할 수 있어야 한다.

### Frame Sampling {#camera-frame-sampling}

Frame start, center, end와 shutter sample의 기준을 고정하고 motion, light, effect와 camera가 같은 time convention을 사용해야 한다.

### Motion Blur 경계 {#camera-motion-blur-boundary}

Shutter metadata와 motion sampling을 선언할 수 있어도 renderer가 blur를 계산하지 않으면 unsupported 또는 not-run으로 표시하고 blur가 존재한다고 주장하지 않아야 한다.

### Exposure와 Lighting {#camera-exposure-lighting-distinction}

Scene light intensity, material emission, camera exposure와 display transform을 구분하여 exposure로 잘못된 lighting design을 숨기지 않아야 한다.

### Sampling Refusal {#camera-sampling-refusal}

Negative shutter, frame range 밖 sample, invalid timebase, non-finite exposure와 component마다 다른 frame origin을 거부해야 한다.
