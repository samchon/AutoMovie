# ancient-civic-temple

**진행 중인 실험의 중간 기준선이다.** 이 사이클에서 드라이버가 두 번 죽었기 때문에
(둘 다 전송 계층 손실), 실험이 끝날 때까지 기다리지 않고 확인된 값부터 착지시킨다.
아직 재지 못한 값은 비우지 않고 `unverified`와 그 이유를 적는다.

마지막 갱신: 2026-08-14 14:55, head `64d0ef47`.

## 1. 정체

| 항목 | 값 |
| --- | --- |
| 샌드박스 | `experimental/ancient-civic-temple` (gitignore됨) |
| 담당 이슈 | AutoMovie #1951, 캠페인 #1954 |
| 생성 시점 head | `214f3a7c` (당시 pre-merge 브랜치 상태) |
| 현재 head | `64d0ef47`, 브랜치 `feat/benchmark-four-buildings-cycle-1` |
| 저작 세션 | Codex `codex exec`, 모델 `gpt-5.6-sol`, reasoning effort `xhigh` |
| 재개 식별자 | 세션 UUID `019ffe98-8555-7162-bbb8-c27a47b03f94` |
| 모드 | `--dangerously-bypass-approvals-and-sandbox` |
| MCP 서버 | `automovie_ancient`, 호출 단위 등록, 공유 `~/.codex/config.toml`에 쓰지 않음 |

체크아웃이 실험 도중 네 번 움직였다: `214f3a7c` → `11b8bdea` (squash merge) →
`feat/modern-suburban-house-s1` (다른 드라이버) → `64d0ef47`. **샌드박스가 저장소
안에 살면 자기 실험과 무관한 head 이동을 겪는다.**

세션 식별은 **내용으로** 했다. 형제 드라이버의 세션이 5초 차이로 생성되었고, 이
파일시스템에서는 rollout의 mtime이 기록 중에도 움직이지 않는다. 판정 근거는
rollout 안 `ancient-civic-temple` 109회 언급, 형제 샌드박스 언급 0회.

## 2. 규모

**현재 지어진 기하는 없다.** 이것이 측정값이다.

| 항목 | 값 |
| --- | --- |
| 주체 총수 / 프로토타입 / element / 공간 / 인스턴스 집합 / 모델 / 부품 | **0** — 컴파일이 통과하지 못했고, 소스에 engine 호출이 하나도 없다 |
| `@automovie/engine` import (`src`, `src/examples` 제외) | **0건**, 실측 |
| 저작된 소스 | `src/world/` 22개 + `temple.ts`, 합계 **664줄** (파일당 20–26줄) |
| 저작된 문서 | 21개 — logline 1, 시퀀스 3, 비트 7, 장면 7(`SCN-A03…G03`), world spec 2, art-direction 1 |
| film | `tracks.video: []` — 빈 영화. 소스가 스스로 "S0 edit boundary"라고 적고 있다 |
| shot contract | 0. `src/shots/survey.ts`는 `{ captureId, scene, surfaces, intent }` 레코드를 내는 **계획**이지 contract가 아니다 |

대조군 (`#1939` 사이클 검증 픽스처): 주체 4,003 / 프로토타입 199 / element 3,474 /
공간 15 / 인스턴스 집합 8 / 모델 197 / 부품 398.

그 대조군의 **형상**도 함께 적어둔다. 루트 하나 아래 2,999개가 전부 깊이 2로 거의
완전히 평평했고, 모델 194개 중 178개가 단일 부품이었다. 이 실험의 브리핑은 그
평평함을 명시적으로 금지했다("건물이 그룹, 각 구획이 그룹, 오브젝트도 그룹, 그 안에
또 그룹"), **API는 주지 않았다.** 그 요구가 실제 계층으로 나타나는지는 기하가 생긴
뒤에야 잴 수 있다 — 현재 `unverified`.

## 3. 비용

**모든 벽시계에 그 시점의 머신 부하를 병기한다.** 이 머신은 AutoMovie 드라이버 넷과
형제 캠페인(`interior-automation-experiment`)이 공유한다.

| 측정 | 벽시계 | 그때의 머신 부하 |
| --- | --- | --- |
| 샌드박스 생성 (8개 패키지 pack + `npm install` 253개) | ~6분 (13:17→13:23) | 형제 드라이버 셋이 같은 `packages/*/lib`에 동시 pack |
| 첫 컴파일 (starter, exit 0) | `unverified` — 별도로 재지 않음 | — |
| 컴파일 (신전 소스, exit 1, 진단 29건) | **10초** | commit free 15,996 MB, node 107, codex 15 |
| 컴파일 (같은 것, 전임 측정) | 13초 | 드라이버 넷 + 형제 캠페인, `xhigh` 턴 1개 구동 중 |
| `npm run lint` | 42초 (전임 측정, exit 1, 48건) | 위와 같음 |
| `npm run capture:doctor` | **18초**, exit 0 | commit free 15,996 MB, node 107, codex 15 |
| `npm run building:report` (starter, 기하 0) | 17초, exit 0 | 드라이버 넷 + 형제 캠페인 |
| `npm run texture:scale` (starter) | 16초, exit 0 | 위와 같음 |
| MCP `initialize` + `tools/list` | **9.1초** / 9.13초 | commit free 15,996 MB, node 107, codex 15 |
| MCP `initialize` (전임 측정, 같은 샌드박스) | **20.5초** | 머신이 더 무거웠을 때 |
| 첫 렌더 | **n/a — 렌더한 적이 없다.** 기하가 없어 렌더할 대상이 없다 |
| 방 스케줄 / 텍스처 축척 (신전 소스 기준) | `unverified` — 기하 0에서는 새로 말할 것이 없어 재실행하지 않았다 |
| 주체 관찰 1건 / 프로토타입 스윕 | **n/a** — 주체가 0개다 |

MCP `initialize`가 같은 샌드박스에서 **20.5초 → 9.1초**로 갈린 것이 부하 병기의
근거다. 부하를 적지 않은 이 수치들은 서로 비교할 수 없었을 것이다.

## 4. 도달

이 절이 실험의 본체다. **저작자가 못 한 것과 제품이 길을 주지 않은 것을 나눈다.**

### 저작 에이전트가 실제로 몬 것

| 도구 | 결과 |
| --- | --- |
| MCP `getGuideDocument` | **9회, 8개 가이드** — `AUTOMOVIE_OVERALL`, `COMPILATION`, `EVIDENCE_GRAPH`, `PRODUCTION_DESIGN`, `SCREENPLAY_WRITING`, `SOURCE_OWNERSHIP`, `WORLD_BUILDING`(2회), `WORLD_DESIGN` |
| MCP `captureFrame` / `repaintShot` / `inspectSubject` / `prepareReview` / `submitReview` | **0회** — 다섯 도구 모두 한 번도 부르지 않았다 |
| `user cancelled MCP tool call` | **0건** (정확한 문자열로 셈) |
| 외부 MCP 서버 호출 | **0건**. 턴 1 동안 `automovie_modern`·`automovie_medieval`·`automovie_future`가 도구 목록에 보였는데도 그렇다 |

**`getGuideDocument` 9회는 깨끗한 증거가 아니다.** 전임 드라이버의 턴 1 메시지가
그 도구를 이름으로 지목하고 `AUTOMOVIE_OVERALL`을 먼저 읽으라고 지시했다.

### 세션 내부 대조군 — 이 실험에서 가장 강한 관측

같은 세션의 두 턴이 서로의 대조군이 된다. rollout의 `turn_context`로 턴 경계를
확정하고 턴별로 셌다.

| 턴 | `approvals_reviewer` | exec 호출 | MCP 호출 | 도구를 지목받았나 |
| --- | --- | --- | --- | --- |
| T1 (04:47Z) | `user` | 56 | **9** (전부 `getGuideDocument`) | **예** |
| T2a (05:27Z) | `auto_review` | 0 | 0 | 아니오 (즉시 전송사) |
| T2b (05:30Z) | `auto_review` | 23 | **0** | 아니오 |
| T3 (05:58Z) | `auto_review` | 진행 중 | — | 아니오 |

턴별로 exec 셀을 분류해 세면 이렇다. (T1의 MCP 셀 7개가 호출 9회인 것은 한 셀이
`["PRODUCTION_DESIGN","WORLD_DESIGN"]`처럼 이름 배열을 돌기 때문이다.)

| 턴 | exec 셀 | MCP를 부른 셀 | `shell_command` 셀 | `node_modules/@automovie` 를 읽은 셀 |
| --- | --- | --- | --- | --- |
| T1 | 56 | **7** (호출 9회) | 39 | **12** |
| T2b | 23 | **0** | 23 | **20** (87 %) |
| T3 (중단 시점) | 32 | **0** | 22 | 8 |

**여기서 이분법을 버려야 한다.** 도구를 9번 쓴 T1조차 같은 턴에
`node_modules/@automovie/**`를 **12번 읽었다.** 즉 가이드 표면은 소스 읽기를
**대체하지 않는다.** 지목받으면 *추가로* 쓰는 채널일 뿐이고, 지목이 없으면 그 채널만
사라지고 소스 읽기는 그대로 남는다.

**T2b의 23개 exec 호출은 전부 `tools.shell_command`였고, 그중 20개가
`node_modules/@automovie/**`의 제품 소스를 읽었다.** 무엇을 읽었는지가 핵심이다 —
`realizeShotContract.ts`, `stageScene.ts`, `blockBeat.ts`,
`AutoMovieProductionCompiler.ts`, `IAutoMovieProductionCompiler.ts`,
`requiredSubjects` 정의, `IAutoMovieVideoEdit` 정의. **전부
`getGuideDocument`의 `SHOT_CONTRACT`·`TYPESCRIPT`·`COMPILATION` 가이드가 답하는
질문이다.** 같은 세션이 바로 전 턴에 그 도구를 9번 성공적으로 불렀는데도 그랬다.

**다만 T2b 시점에 서버가 실제로 등록돼 있었는지는 `unverified`다.** 등록은 호출
단위 플래그로 들어가는데, 전임의 턴 2 실행은 인라인이었고 그 트랜스크립트가
남지 않았다. rollout의 `world_state`와 `thread_settings_applied` 어디에도 **MCP
서버나 도구 목록이 기록되지 않는다** (확인함: `world_state`의 상태 키는
`agents_md, apps_instructions, environments, host_skills, model, permissions,
personality, plugins_instructions, realtime, skills` — 도구 표면이 없다).

그러므로 T2b의 0건은 **"갖고도 안 썼다"와 "없어서 못 썼다"를 구별할 수 없다.**
로그에서 둘은 똑같이 0으로 보인다. 이것을 기록해 두는 이유가 그것이다.

확실한 것만 남기면 이렇다.

- **도구는 이 세션에 실제로 제공됐고 정상 동작했다** — T1의 9회가 증명한다.
- **호출 단위 등록은 실재하며 서버 프로세스를 띄운다** — T3 실행 중 실측했다.
  `node .../ancient-civic-temple/node_modules/tsx/dist/cli.mjs .../scripts/mcp.ts`가
  codex의 자식으로 살아 있었다.
- **`codex mcp list`에는 이 서버가 처음부터 없다.** 전역 레지스트리에 쓰지 않는 것이
  격리 설계이고, 전역 등록은 다른 캠페인이 소유한 공유 설정을 건드리는 일이다.
  T1이 부른 심볼이 `tools.mcp__automovie_ancient__getGuideDocument`로 **밑줄**
  이름인 것이 그 증거다 — 전역 목록의 이름들은 전부 하이픈이다.
  **전역 목록에 없다는 것을 "사라졌다"로 읽으면 안 된다.**

### 왜 그런가 — Codex가 code mode로 돈다

MCP 도구가 네이티브 도구 호출이 아니라 **실행되는 코드 셀 안의 함수**로 노출된다.

```
tools.mcp__automovie_ancient__getGuideDocument({ name: "WORLD_BUILDING" })
tools.shell_command({ command: "rg -n ... node_modules/@automovie" })
```

**둘이 같은 namespace의 형제다.** 가이드를 부르는 비용과 셸을 부르는 비용이 같다.
마찰 차이가 없으므로 "비싼 크레딧 경로를 피한다"는 설명은 이 데이터로 지지되지
않는다. 지목하면 쓰고, 안 하면 **셸로 제품 소스를 직접 읽는다.**

`approvals_reviewer` 가설도 이 세션은 **지지하지 않는다.** MCP를 실제로 쓴 유일한
턴이 `user`였고 `auto_review` 턴들이 0이다. 상관이 예측과 반대 방향이다. 다만 지목
여부와 등록 여부라는 교란이 겹쳐 있으므로, 옳은 결론은 "`auto_review`가 원인이
아니다"가 아니라 **"이 세션의 데이터로는 구성이 설명이 되지 못한다"**이다.

**T3도 깨끗한 대조군이 아니다.** 후임 드라이버의 턴 3 메시지가 열람 범위를 적으면서
`getGuideDocument`를 이름으로 언급했다. 사용을 지시한 것은 아니지만 이름이 다시
등장했으므로, T3의 결과를 "지목 없는 조건"으로 셀 수 없다. **지목 없는 조건을 재려면
그 이름이 한 번도 나오지 않는 턴이 필요하다.**

**제품에 대한 함의.** 가이드 표면의 가치가 `node_modules`가 통째로 읽힌다는 사실과
경쟁한다. 저작 에이전트는 `SHOT_CONTRACT`를 물어보는 대신 컴파일러 소스를 읽어
같은 지식에 도달했다. 이것이 "관찰 표면 > 배송 표면"이 실제로 무는 지점이다.

### 진행 상태 — 두 턴, 약 90분, 기하 0

- **턴 1** (13:47→14:38, ~50분): 문서 사다리 + 표면 분해. 전송 손실로 중단.
  디스크에 남은 것: 문서 21개, `src/world/` 22개. 컴파일 exit 1, 진단 29.
- **턴 2** (~40분, 418,410 토큰): starter 영화 → 신전 이주. 전송 손실로 중단.
  디스크에 남은 것: starter 소스·문서가 **실제로 삭제**되고 신전 것으로 교체됨.
  컴파일 exit 1, 진단 **29** — 개수가 줄지 않았다.

**두 턴 모두 인프라 손실이다.** `stream disconnected before completion`,
`Reconnecting... 1/5..5/5`. 저작 실패가 아니다. 두 번 다 디스크에서 산출물을 확인한
뒤에야 이 판정을 내렸다 — 로그만 보면 "아무것도 못 냈다"로 잘못 기록된다.

### 막힌 지점과 그때 제품이 준 진단

**제품이 준 것 (긍정).** 컴파일 오류 18건이 **전부 대상·파일·시정 조치를 이름으로**
말했다. 절반만 이주된 상태가 진단만으로 완전히 읽혔다 — 원인을 알기 위해 소스를 읽을
필요가 없었다. 예: `acceptance "opening-pose"가 없는 claim "cue-arm-readable"을
인용합니다. 수정하거나 claim을 추가한 뒤 다시 컴파일하십시오.`

**제품이 길을 주지 않은 것 — 증거 의무의 양방향성.** 스타터 교체가 **전부 아니면
전무**다. 증거 의무가 문서→소스 양방향이라 스타터 문서를 지우면 스타터 소스가
빌드를 깨고(클래스 10개 `cites 0`, `Unresolved evidence target` 약 45건), 그 역도
같다. 결과로 **"문서 전용 단계"를 초록 빌드로 닫는 것이 원리적으로 불가능**하다.
전임의 S0 종료 조건이 그 때문에 성립하지 않아 턴 2에서 정정되었다.

같은 덫이 **세 번째 층에도 걸려 있다.** 턴 2가 `docs`와 `src`를 옮겼는데
`.automovie/design`은 그대로 스타터다 — `shots/{opening,answer}.json`,
`acceptance/{opening,answer}-*.json`, `shared/models/{soloist,chorus-*}.json`,
`shared/formations/chorus.json`. 현재 컴파일이 아직 shot `opening`과 claim
`cue-arm-readable`을 인용하는 이유가 이것이다.

**저작자가 스스로 한 것 (긍정).** `buildingDimensions.ts`에
`assertTempleDimensions`를 두어 **지붕 아래 총면적이 433.5㎡가 아니면 throw**하게
했다. 목표 430㎡ 대비 +0.8%. 외곽 깊이 21.5, 처마 4.2, 용마루 6.4, 주랑 유효폭 2.5,
외벽 0.5 m. 픽셀 비례가 아니라 동선·목재 스팬에서 유도했다고 스스로 적었다.
**기하를 세우기 전에 치수 불변식을 먼저 못 박은 것은 일의 순서가 맞다.**
(턴 1 중간의 25.0 × 22.0 / 426㎡에서 스스로 개정한 값이다.)

### 캠페인이 실측으로 확정한 환경 사실

- `npm`이 아니라 **`npm.cmd`**. `.ps1` 심이 `RemoteSigned` 실행 정책에 막힌다.
- `codex exec resume`에는 `-s/--sandbox`가 없다. 전역이 `sandbox = "elevated"`라
  `-c sandbox="workspace-write"`를 주지 않으면 **턴 중간에 모드가 조용히 바뀐다.**
- `codex exec`에 **`< /dev/null`**. 없으면 `Reading additional input from stdin...`
  에서 멈추고, 그 정지는 "긴 사고 중"과 구별되지 않는다.
- `codex exec resume`은 `-C`를 받지 않는다. `--last`는 서브에이전트 스레드로
  해석되어 실패한다. 프롬프트는 **stdin**으로 — `-i/--image`가 가변 인자라 뒤따르는
  프롬프트 인자를 삼킨다.
- `--approve-for-me`는 bypass 플래그와 상호 배타이고, 그 모드에서는 `npm` 자체가
  `PSSecurityException`으로 막혀 컴파일·렌더·검증이 전부 불가능하다.
- **세션 생존 판단에 mtime을 쓰면 안 된다.** 이 파일시스템에서 rollout이 88 KB
  자라는 동안 스탬프가 고정된 것이 실측되었다. 일차 신호는 프로세스 종료, 교차
  확인은 파일 **크기**.
- `capture:doctor`가 "실행 파일 서술자의 스탬프가 열려 있는 동안 움직였다"며 실패하면
  몇 초 뒤 **`capture:doctor`를 다시** 돌린다. `capture:install`을 재실행하지
  않는다 — 제품 자신의 메시지가 그렇게 말한다.
- codex의 MCP 등록은 **전역이고 전부 enabled**다. 격리하지 않으면 세션이 남의
  샌드박스에 쓰는 도구를 본다. 끌 목록은 손으로 박지 말고 **실행 시점에
  `codex mcp list`에서 센다** — 드라이버가 붙을 때마다 서버가 하나씩 는다.

### 이슈 본문과 실제가 어긋난 것

- `examples/era-reference-images/**`가 **없다.** 레퍼런스 5장은 이슈의 GitHub 자산
  URL에서 직접 받았다.
- `npm run status`, `npm run contribution`, `gltf`, `derive:example` 스크립트가
  **없다.** `status`는 `review:status`로 읽었다. `contribution`은 대체하지 않고
  `unverified`로 남긴다 — 대체하면 다른 것을 재게 된다.
- `internals/scorecard.mjs`가 없다.
- 이슈가 지목한 `renderer-verification` 스킬은 존재하지 않는 이름이다. 실제 스킬은
  `viewer-verification`.
- fal.ai 경로는 **사용자 지시로 취소**되었다. 자산 생성 없이 전부 코드로 짓는
  절차적 기하다. `.env`는 읽지도 넘기지도 않았다.

## 5. 판정

### 제품이 감당한 것

- **진단의 질.** 절반만 이주된 프로덕션의 상태가 진단만으로 완전히 읽혔다. 이것이
  이 실험에서 제품이 보인 가장 강한 성질이다.
- **정직한 거절.** `building:report`가 기하 0에서 "이 프로덕션이 무대에 올린 건축
  환경이 없으므로 그릴 것도, 셀 것도, 연구할 것도 없다"고 exit 0으로 거절했다.
  **알려진 0에서 정직하게 거절하는 것이 나중의 비-0 출력을 믿을 수 있게 만든다.**
- **`texture:scale`의 자기 서술.** starter에서 모델 4·부품 52 중 텍스처 좌표를
  가진 것 0, 검사 가능한 좌표 소스를 선언한 것 0이었고, 도구가 스스로
  "아무것도 측정되지 않았으며 이 실행은 texture-scale 리뷰가 아니다"라고 말했다.
  **exit 0을 초록으로 읽으면 안 되는 상태를 제품이 먼저 말해준다.**
- **결정론적 캡처.** `angle:swiftshader`는 조용한 소프트웨어 폴백이 아니라 제품이
  결정론을 위해 **요청한** 백엔드다. `capture:doctor`가 renderer 문자열과 실행 파일
  digest까지 영수증으로 낸다.

### 제품이 거절한 것과 그 정당성

**증거 의무의 양방향성이 스타터 교체를 전부-아니면-전무로 만든다.** 이 거절은
**정당하다** — 증거 그래프의 목적이 문서와 소스가 서로를 놓치지 않게 하는 것이고,
한쪽만 지우는 것은 정확히 그 그래프가 막아야 할 상태다.

다만 **비용이 스캐폴드 설계에 있다.** 스타터가 완결된 영화 하나로 심겨 있어서, 실제
프로덕션을 시작하려면 첫 걸음이 "전부 교체"가 된다. 저작 에이전트가 두 턴에 걸쳐
그 교체를 하느라 **자기 건물은 한 줄도 짓지 못했다.** 이것이 결함인지 의도된
설계인지는 이 실험이 판정할 것이 아니다 — 관찰로 남긴다.

### 측정 불가로 선언하는 축 (오염)

`HANDOFF.md`가 저작 세션에 **읽혔다.** 실측이다 — 세션 턴 1에서
`Get-Content -Raw -Encoding utf8 -LiteralPath "HANDOFF.md"`와 그 본문이 트랜스크립트에
있다. 원인은 부주의가 아니라 **구조적 충돌**이다: 캠페인이 `HANDOFF.md`를
`experimental/<name>/`에 두라고 요구하는데 그곳이 곧 저작 에이전트의 작업 루트이고,
같은 캠페인이 방법론은 감추라고 요구한다.

이 실행에서 다음 축은 **측정 불가**다.

| 축 | 이유 |
| --- | --- |
| `texture:scale` / `coordinateSource` | 핸드오프가 "exit 0은 아무것도 측정되지 않았다는 뜻"이고 좌표 소스 선언이 0이었다고 이미 적어두었다. 지금 프로덕션이 `coordinateSource`를 선언해도 발견과 상기를 구별할 수 없다 |
| 경계 준수 | `git status --porcelain`이 비어 있고 감시된다는 것을 알게 되었다. `experimental/` 안에 머문 것이 더 이상 독립 증거가 아니다 |
| 캠페인 이슈 결함 발견 | 없는 스크립트 목록·fal.ai 미배선·`scorecard.mjs` 부재를 통보받았다. 독립적으로 재발견할 수 없다 |
| 계측기 함정 인지 | 래퍼 종료 코드 함정과 `capture:doctor` AV 설명을 받았다 |

**회복 수단은 같은 브리핑으로 슬림한 핸드오프를 놓고 다시 도는 것뿐이다.**
14:1x에 `HANDOFF.md`를 운영 사실만 남기고 줄였고, 나머지는 작업 루트 밖으로 옮겼다.

부수 오염 둘.

- 세션이 저장소 SKILL.md 다섯 개(`project`, `evidence-graph`, `documentation`,
  `scaffold`, `development`)를 읽었다. 전임의 턴 1 메시지가 샌드박스 밖 열람을
  허용했기 때문이고, 턴 2에서 철회되었다. 더불어 Codex가 **14개 스킬 색인 전체를
  자동 주입**했다 — 샌드박스가 저장소 안에 있어 Codex가 git 루트에서 `.agents/skills/`를
  발견한다. 이쪽 절반은 요청하지 않은 것이다.
  **`.agents/skills/experiment/**`와 `.wiki/`는 읽히지 않았다.** 실험의 방법론
  문서는 새지 않았고, 저장소의 엔지니어링 관행이 샜다.
- `getGuideDocument` 사용은 전임이 그 도구를 지목했으므로 자발적 도달의 증거가
  아니다 (위 4절).

**저장소 전체가 읽힌다는 사실 자체도 기준선에 남긴다.** `workspace-write`는 쓰기만
제한한다. 따라서 **저작 에이전트가 관찰한 표면은 제품이 배송하는 표면보다 크다.**

### 아직 확인하지 못한 것 — 전부 `unverified`

- **시각적 주장 일체.** 렌더가 없고 이미지가 없다. 외관·절개·중정·제실·기록 구역
  캡처는 이슈의 완료 조건인데 **하나도 수행되지 않았다.**
- 공간 그래프 준수(모든 방이 연속 주랑에 문을 낸다, 단일 storey) — 기하가 없어 잴 수
  없다.
- 그룹 계층의 깊이와 비평평성 — 같은 이유.
- 7개 장면·비트·시퀀스의 극작 품질. 정독하지 않았다.
- `npm run verify`, `npm run contribution` 결과. 전자는 미실행, 후자는 스크립트 부재.

### 결함 (재현 절차 포함)

**D1 — `capture:doctor`가 갓 설치된 브라우저에서 1회 거짓 실패한다.**
재현: `npm run capture:install` 직후 `npm run capture:doctor`. 실행 파일 서술자의
스탬프가 열려 있는 동안 움직였다며 exit 1. 몇 초 뒤 재실행하면 `status: ready`.
AV/인덱서가 새 파일을 만지는 것과 경합한다. **제품 메시지가 재실행을 지시하므로
치명적이지 않으나, 첫 사용자가 만나는 첫 게이트다.**

**D2 — 이슈 본문이 존재하지 않는 명령과 경로를 지시한다.** 위 4절 목록.
재현: `npm run status`, `npm run contribution`, `ls examples/era-reference-images`.
