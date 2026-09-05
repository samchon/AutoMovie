# `@automovie/render`

`@automovie/render`는 AutoMovie 결과물을 프레임과 비디오 산출물로 보내기 위한 결정론적 렌더 계획 패키지다.

이 패키지는 직접 브라우저나 ffmpeg를 소유하지 않는다. 프레임 시간표, 파일명, ffmpeg 인자, model export, host가 주입하는 capture/encode adapter만 다룬다. 실제 WebGL 캡처는 playground나 외부 host가 맡고, 이 패키지는 같은 입력이 같은 frame schedule을 만들도록 고정한다.

## 공개 표면

- `frameTimes`, `frameName`, `framePattern`, `ffmpegArgs`: render spec의 공유 `frameFormat`에서 frame schedule·출력 크기·encode 인자를 만든다.
- `planSequenceRender`: `IAutoMovieSequence`와 committed shot list를 renderable timeline manifest로 바꾼다. trim, transition overlap, per-frame live shot/blend sample, frame path, output path, ffmpeg args를 한 번에 반환한다.
- `renderVideo`: `captureFrame`과 `encode` adapter를 받아 프레임 캡처 순서와 비디오 인코딩 순서를 실행한다.
- `renderSequenceVideo` / `renderSequenceAndSee`: sequence manifest를 프레임별 capture adapter와 encode adapter에 태운다. capture host는 frame index뿐 아니라 live shot local time과 outgoing blend tail을 받는다.
- `renderAndSee`: `renderVideo` 결과에 spec, duration, frame path, sample time, ffmpeg args를 붙여 agent가 그대로 읽을 수 있는 JSON 산출물로 돌려준다.
- `createHeadlessCaptureAdapter`: Playwright-like page를 `renderVideo`의 `captureFrame` adapter로 감싼다. route miss, seek hook miss, screenshot failure, empty frame을 구조화된 오류 코드로 구분한다.
- 렌더 예산 프리플라이트(`assessAutoMovieRenderBudget`, `autoMovieRenderBudgetEvidence`, `autoMovieRenderBudgetRefusal`, `autoMovieRenderTargetRendererOfGraphics`, `autoMovieRenderTargetSettingsOfShot`, `selectAutoMovieRenderBudget`): 렌더 잡이 그리기 직전에 자기 artifact를 자기 tier의 declared budget과 대조한다. capture host의 WebGL probe를 render target renderer identity로 읽고, compiled shot이 실제로 그려질 renderer 설정을 유도해 target을 봉인하고, shot별 verdict를 하나의 evidence 문서로 접는다. `over`만 렌더를 거부하며 `incomplete`와 `not-run`은 그대로 보고한다 : probe가 없으면 verdict 자체를 만들지 않는다.
- 렌더 관찰 감사(`auditAutoMovieRenderObservation`): capture pass가 같은 프레임에서 얻은 viewer 관찰값을 프리플라이트의 보수적 측정 bound와 대조한다. 초과는 breach, 관찰할 수 없는 metric은 unchecked로 남기며 둘 다 없을 때만 `agrees`가 참이다. 관찰은 설계 budget이나 프리플라이트 결과를 다시 쓰지 않는다.
- `exportModelToGLB`: AutoMovie model AST를 glTF binary buffer로 직렬화한다.
- `planChunkedSequenceRender`(+ `IAutoMovieRenderChunk`, `IAutoMovieRenderPassManifest`, `IAutoMovieRenderReassembly`, `IAutoMovieRenderChunkPlan`): 긴 시퀀스를 청크와 패스로 쪼개고 재조립 계획을 낸다.
- 자막(`planCaptionSidecar`, `renderCaptionSidecar`, `sliceCaptionSidecar`, `IAutoMovieCaptionEntry`, `IAutoMovieCaptionSidecar`): 비트 캡션을 사이드카로 계획·직렬화하고 청크 경계로 자른다.
- 포즈 키포인트(`planPoseKeypointSidecar`, `renderPoseKeypointSidecar`, `IAutoMoviePoseKeypointActor`, `IAutoMoviePoseKeypointFrame`, `IAutoMoviePoseKeypointSidecar`): OpenPose 계열 사이드카를 프레임별로 계획·직렬화한다.
- 가이드 패스(`AUTOMOVIE_GUIDE_PASSES`, `isGuidePass`, `guidePassFrameName`, `guidePassFramePattern`): depth/mask/normal/outline 구조 패스의 이름·파일명 규약.
- `renderScreenplay` / `beatCaptions`: 커밋된 스크립트를 스크린플레이 텍스트와 비트 캡션으로 낸다.

## 경계

실제 브라우저 실행, ffmpeg 실행, wasm encoder 선택, 파일 시스템 경로 정책은 host 책임이다. 이 패키지의 역할은 engine/viewer/playground 사이의 재현 가능한 render seam을 작게 유지하는 것이다.
