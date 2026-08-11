# Camera 요구사항

Camera는 story event를 관객에게 보여 주는 projection, frame, position, orientation, movement와 sampling 계약을 소유한다. 렌즈 용어와 camera grammar는 의도를 전달하는 수단이며 의도적 위반도 명시적으로 저작할 수 있다.

각 camera take는 [scene의 관찰 가능한 행동](../story/scenes-and-observable-action.md#story-scenes-observable-action), staging의 subject·mark·event delivery, [production design의 scale과 silhouette](../production-design/scale-proportion-and-silhouette.md#production-design-scale-proportion), 같은 revision의 resolved [scene geometry](../asset-authoring/geometry.md#asset-general-geometry)를 추적한다. Camera가 만든 perspective, crop, occlusion와 exposure는 그 source 사실을 바꾸지 않으며, 대안 take와 의도적 문법 위반은 독립된 선택과 acceptance로 남는다.

- [Camera 범위와 Identity](./scope-and-identity.md)
- [Projection, Lens와 Sensor](./projection-lens-and-sensor.md)
- [Framing과 Shot Size](./framing-and-shot-size.md)
- [축선, Eyeline과 Screen Direction](./axis-eyeline-and-screen-direction.md)
- [Camera Position과 Movement](./position-and-movement.md)
- [Target, Focus와 Depth 경계](./targets-focus-and-depth-boundary.md)
- [Clipping, Occlusion과 공간 제약](./clipping-occlusion-and-spatial-constraints.md)
- [Shutter, Exposure와 시간 Sampling](./shutter-exposure-and-sampling.md)
- [Camera Continuity와 의도적 위반](./continuity-and-intentional-violations.md)
- [Camera 검증](./validation.md)
