# Rendering 요구사항

Rendering은 compiled scene과 selected edit를 고정된 film clock에서 frame, structural pass, image sequence와 encoded media로 materialize한다. 같은 입력 identity, schedule, runtime profile과 product 설정은 같은 의미의 결과를 내야 하며, 실행 순서나 이전 frame의 숨은 상태가 결과를 바꾸어서는 안 된다.

이 디렉터리는 계획된 output부터 검증된 artifact까지의 상태, deterministic sampling, runtime lowering, pass와 channel, resource budget, headless 실행, content identity, chunk recovery와 encoding 계약을 정의한다. Deterministic blocking pass와 optional generative rendition은 서로 다른 identity와 검증 경계를 유지한다.

- [Render 범위와 Artifact Identity](./scope-and-artifact-identity.md)
- [Frame Schedule과 Sampling](./frame-schedules-and-sampling.md)
- [Scene Lowering과 Runtime State](./scene-lowering-and-runtime-state.md)
- [Pass, Channel과 Product](./passes-channels-and-products.md)
- [Geometry, Visibility와 Culling](./geometry-visibility-and-culling.md)
- [Material, Light와 Color](./materials-lighting-and-color.md)
- [Render Budget](./budgets.md)
- [Headless와 Platform Determinism](./headless-and-platform-determinism.md)
- [Frame Identity와 Content Addressing](./frame-identity-and-content-addressing.md)
- [Chunk, Resume와 Recovery](./chunks-resume-and-recovery.md)
- [Encoding과 Multiplexing](./encoding-and-multiplexing.md)
- [Render 검증](./validation.md)
