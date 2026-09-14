# `@automovie/ingest`

`inspectAutoMovieExternalModelBytes` is the synchronous production builder
boundary for registered glTF 2.0, GLB 2.0, and VRM bytes. It validates a closed
ingest profile, container chunks, buffer/accessor payload ranges, render-mesh
presence, and authoritative normalized humanoid mappings. The builder supplies
exact sidecar bytes to the synchronous resolver; missing or short payloads are
rejected, and the result identifies the closed buffer/image dependency set. It
does not load files, infer missing sidecars, or guess a humanoid mapping after
ingest.

`@automovie/ingest`는 외부 media 입력을 AutoMovie 코어의 자료구조로 들여오는 헤드리스 수입(ingestion) 패키지다. 지금 admit하는 family는 두 가지다: glTF/GLB 3D 문서는 노드 그래프와 클립으로, RIFF/WAVE audio는 관찰된 source fact와 유한한 sample buffer로 들어온다.

이 패키지는 `three.js`를 소유하지 않는다. `@gltf-transform/core`로 glTF/GLB 문서를 읽어, AutoMovie `interface`가 정의한 model AST·skeleton·clip으로 변환하는 결정론적 변환만 다룬다. 실제 렌더는 `viewer`/`playground`가, 계획은 `render`가 맡고, 이 패키지는 같은 입력이 같은 AST를 만들도록 고정한다.

Audio 쪽도 같은 규칙을 따른다. `decodeProductionAudioAsset`은 넘겨받은 bytes만 읽어 container·codec·channel layout·sample rate를 관찰된 사실로 보고하고, mono downmix와 resample을 그 사실과 분리된 processing으로 기록한다. 지원하지 않는 container, 모순된 선언, 유한하지 않은 sample은 silence나 대체 source로 바꾸지 않고 자산 이름과 함께 거절한다. Output container 조립은 이 패키지가 아니라 `render`의 Node entry가 맡는다: 여기는 입력 경계이고, 거기는 출력 경계다.

## 공개 표면

| Callable | 직접 소비 목적 |
|---|---|
| `humanoidSkeleton` | 정규화된 humanoid bone mapping을 AutoMovie skeleton 계약으로 변환한다. |
| `ingestDocument` | 이미 파싱된 glTF 문서를 model·skeleton·clip AST로 수입한다. |
| `ingestFaceTemplate` | glTF face topology와 morph target을 보존된 face template로 수입한다. |
| `decodeProductionAudioAsset` | RIFF/WAVE bytes를 관찰된 source format과 유한한 mono sample buffer로 수입한다. |

이 함수들은 파일 시스템이나 브라우저를 소유하지 않는 직접 수입 경계다. 구조적
결함(중복 morph target 이름, 알 수 없는 `attachedBone` 등)은 던지거나 구조화된
오류로 구분한다.

## 경계

파일 시스템 접근, 브라우저 실행, 자산 다운로드는 host 책임이다. 이 패키지의 역할은 외부 media 자산과 engine 자료구조 사이의 재현 가능한 수입 seam을 작게 유지하는 것이다.

Family별 경계는 좁게 유지한다. glTF-family inspector는 audio container를 받지 않고, audio decoder는 3D 문서를 받지 않는다. Mix, cue timing, loudness, 그리고 delivery profile 검증은 여기서 하지 않는다: 그것들은 engine mixer와 production delivery 층이 소유하고, 이 패키지는 그들이 소비하는 입력 사실만 만든다.
