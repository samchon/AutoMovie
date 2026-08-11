# Shutter, Exposure와 시간 Sampling

## Frame의 시간과 밝기 Metadata {#camera-shutter-exposure-sampling}

Camera는 frame time, frame rate 또는 rational timebase, shutter interval 또는 angle, exposure compensation와 supported lens-aperture metadata를 선언할 수 있어야 한다.

### Rational Timebase {#camera-rational-timebase}

Frame rate는 numerator와 denominator, frame origin, frame index 범위와 timestamp conversion을 가져야 하며 decimal seconds의 누적으로 긴 sequence의 camera, motion, light와 event sample이 서로 drift하지 않아야 한다.

### Frame Sampling {#camera-frame-sampling}

Frame start, center, end와 shutter sample의 기준을 고정하고 motion, light, effect와 camera가 같은 time convention을 사용해야 한다.

### Shutter Interval Sampling {#camera-shutter-interval-sampling}

Shutter open·close offset, sample count와 distribution, frame boundary에서의 inclusion rule과 global 또는 supported scan policy를 선언하고 같은 frame을 재평가할 때 같은 ordered samples를 사용해야 한다.

### Motion Blur 경계 {#camera-motion-blur-boundary}

Shutter metadata와 motion sampling을 선언할 수 있어도 renderer가 blur를 계산하지 않으면 unsupported 또는 not-run으로 표시하고 blur가 존재한다고 주장하지 않아야 한다.

### Exposure와 Lighting {#camera-exposure-lighting-distinction}

Scene light intensity, material emission, camera exposure와 display transform을 구분하여 exposure로 잘못된 lighting design을 숨기지 않아야 한다.

### Exposure Basis {#camera-exposure-basis}

Exposure compensation, lens aperture 또는 f-number, shutter와 sensitivity-like metadata 중 실제 brightness에 참여하는 basis, unit, valid range와 precedence를 선언하고 물리 exposure와 artistic gain을 같은 이름의 숫자로 섞지 않아야 한다.

### Temporal Reproducibility {#camera-temporal-reproducibility}

같은 source, timebase, frame index, shutter policy와 seed는 playback history와 capture order에 관계없이 같은 camera state와 exposure metadata를 만들어야 한다.

### Sampling Refusal {#camera-sampling-refusal}

Negative shutter, frame range 밖 sample, invalid timebase, non-finite exposure와 component마다 다른 frame origin을 거부해야 한다.
