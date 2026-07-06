# `@automovie/render`

`@automovie/render`는 AutoMovie 결과물을 프레임과 비디오 산출물로 보내기 위한 결정론적 렌더 계획 패키지다.

이 패키지는 직접 브라우저나 ffmpeg를 소유하지 않는다. 프레임 시간표, 파일명, ffmpeg 인자, model export, host가 주입하는 capture/encode adapter만 다룬다. 실제 WebGL 캡처는 playground나 외부 host가 맡고, 이 패키지는 같은 입력이 같은 frame schedule을 만들도록 고정한다.

## 공개 표면

- `frameTimes`, `frameName`, `framePattern`, `ffmpegArgs`: render spec에서 frame schedule과 encode 인자를 만든다.
- `renderVideo`: `captureFrame`과 `encode` adapter를 받아 프레임 캡처 순서와 비디오 인코딩 순서를 실행한다.
- `renderAndSee`: `renderVideo` 결과에 spec, duration, frame path, sample time, ffmpeg args를 붙여 agent가 그대로 읽을 수 있는 JSON 산출물로 돌려준다.
- `createHeadlessCaptureAdapter`: Playwright-like page를 `renderVideo`의 `captureFrame` adapter로 감싼다. route miss, seek hook miss, screenshot failure, empty frame을 구조화된 오류 코드로 구분한다.
- `exportModelToGLB`: AutoMovie model AST를 glTF binary buffer로 직렬화한다.

## 경계

실제 브라우저 실행, ffmpeg 실행, wasm encoder 선택, 파일 시스템 경로 정책은 host 책임이다. 이 패키지의 역할은 engine/viewer/playground 사이의 재현 가능한 render seam을 작게 유지하는 것이다.
