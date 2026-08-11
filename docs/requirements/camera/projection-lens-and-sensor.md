# Projection, Lens와 Sensor

## Frame Geometry를 결정하는 Projection {#camera-projection-lens-sensor}

Perspective, orthographic와 supported project-defined projection을 구분하고 field of view 또는 focal length, aperture extent, aspect와 image gate의 관계를 명시해야 한다.

### Focal Length와 Field of View {#camera-focal-fov}

Focal length, sensor 또는 aperture dimension과 horizontal·vertical field of view 중 authoring basis를 정하고 중복 값이 모순될 때 precedence를 갖지 않아야 한다.

### Gate와 Offset {#camera-gate-offset}

Image width·height, pixel aspect, aperture offset, lens shift와 projection center를 표현하여 off-axis composition을 camera rotation으로만 흉내 내지 않아야 한다.

### Orthographic Scale {#camera-orthographic-scale}

Orthographic view는 world extent, aspect와 center를 선언하고 perspective lens parameter를 함께 적용하지 않아야 한다.

### Optical Refusal {#camera-optical-refusal}

Non-finite parameter, invalid aspect, zero aperture, impossible field of view와 서로 모순된 lens basis를 거부해야 한다.
