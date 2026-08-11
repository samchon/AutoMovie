# Projection, Lens와 Sensor

## Frame Geometry를 결정하는 Projection {#camera-projection-lens-sensor}

Perspective, orthographic와 supported project-defined projection을 구분하고 field of view 또는 focal length, image aperture extent, aspect와 image gate의 관계를 명시해야 한다.

### Optical Convention {#camera-optical-conventions}

Length와 angle unit, optical axis, handedness, image origin, horizontal·vertical image-aperture orientation와 projection transform 순서를 선언하여 같은 camera가 consumer마다 mirror, rotate 또는 다른 field of view로 해석되지 않아야 한다.

### Focal Length와 Field of View {#camera-focal-fov}

Focal length, sensor 또는 image-aperture dimension과 horizontal·vertical field of view 중 authoring basis를 정하고 중복 값이 모순될 때 precedence를 갖지 않아야 한다.

### Sensor와 Gate Fit {#camera-sensor-gate-fit}

Sensor 또는 image-aperture width·height, acquisition aspect, delivery raster, crop·fit·overscan policy와 pixel aspect를 구분하여 framing 변경이 lens 변경인지 gate 적용인지 추적할 수 있어야 한다.

### Image Gate와 Lens Aperture {#camera-aperture-distinction}

Field of view를 결정하는 sensor·filmback의 image aperture와 exposure·focus intent에 쓰이는 lens aperture 또는 f-number를 별도 quantity와 unit로 표현하고 한 값을 다른 값의 alias로 해석하지 않아야 한다.

### Gate와 Offset {#camera-gate-offset}

Image width·height, pixel aspect, aperture offset, lens shift와 projection center를 표현하여 off-axis composition을 camera rotation으로만 흉내 내지 않아야 한다.

### Lens Character {#camera-lens-character}

Anamorphic squeeze, distortion, breathing와 project-defined optical effect를 결과로 주장하는 경우 지원 model, parameters, calibration state와 framing consequence를 선언해야 하며 단순 focal length metadata로 실제 왜곡이 구현되었다고 주장하지 않아야 한다.

### Projection Sampling {#camera-projection-time-sampling}

Zoom, lens shift와 gate가 시간에 따라 변하면 bounded curve와 film-time sample을 가져야 하며 한 frame의 camera transform과 optical state는 같은 sample convention에서 평가되어야 한다. Projection mode 전환은 named event, 전환 전후 state와 discontinuity acceptance를 가져야 한다.

### Orthographic Scale {#camera-orthographic-scale}

Orthographic view는 world extent, aspect와 center를 선언하고 perspective lens parameter를 함께 적용하지 않아야 한다.

### Optical Refusal {#camera-optical-refusal}

Non-finite parameter, invalid aspect, zero image aperture, non-positive f-number, impossible field of view와 서로 모순된 lens basis를 거부해야 한다.
