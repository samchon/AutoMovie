# medieval-baron-manor

**진행 중인 실험의 중간 기준선이다.** 샌드박스는 `experimental/` 아래에 살고
gitignore되므로, 캠페인이 닫히고 샌드박스가 지워지면 **이 파일만 남는다.** 그래서
끝날 때까지 기다리지 않고 확인된 값부터 착지시킨다. 재지 못한 값은 비우지 않고
`unverified` 또는 `n/a`와 이유를 적는다.

마지막 갱신: 2026-08-18, S4(핏아웃) 턴 진행 중.

## 1. 정체

| 항목 | 값 |
| --- | --- |
| 샌드박스 | `experimental/medieval-baron-manor` (gitignore됨) |
| 담당 이슈 | AutoMovie **#1902**, 캠페인 **#1954** |
| 생성 시점 head | `b545100a`, 브랜치 `master` |
| 저작 세션 | Codex `codex exec`, 모델 `gpt-5.6-sol`, reasoning `xhigh`, CLI `codex-cli 0.147.0` |
| 재개 식별자 | 세션 UUID **`01a01254-bc30-7f71-9c57-a5a1d62309f5`** |
| 세션 식별 방법 | **턴 1 stdout의 `session id:` 줄에서 직접 잡았다.** 내용 추론 불필요 |
| 모드 | `sandbox="workspace-write"` + `network_access=true`, `approvals_reviewer="auto_review"` (턴 2부터) |
| MCP 서버 | `automovie_medieval`, **호출 단위 등록**. 공유 `~/.codex/config.toml`에 쓰지 않음 |
| 브리프 전달 | 파일을 **stdin으로 파이프** — 바이트 동일 보장, 재실행 가능 |

드라이버가 고른 유일한 비지정 플래그는 `network_access=true`다. 브리프가 레퍼런스
이미지 5장을 URL로 주는데 `workspace-write`가 기본적으로 네트워크를 끊기 때문이다.

## 2. 규모

컴파일된 산출물에서 잰 값. 머리로 센 것이 아니라 `building:report`와
`review:status` 출력이다.

| 항목 | S1 | S2 | S3 |
| --- | --- | --- | --- |
| revision | — | **36** | **38** |
| 건축 element | 55 | **621** | `unverified` (턴 종료 시 미측정) |
| 공간 | 16 | 16 | 16 |
| 개구부 | 13 | **58** | 58 |
| 커넥터 | 12 | 12 | 12 |
| 시트 | 6 | 6 | 6 |
| 선언된 갭 | 36 | 36 | 36 |
| delivery 프레임 (누적) | 10 | 17 | 20 |

- 주체 총수 / 프로토타입 / 인스턴스 집합 / 모델 / 부품: **`unverified`** —
  `building:report`는 시트·스케줄·물량·갭을 내고 이 분해는 내지 않는다.
  **대체 명령으로 재지 않았다** — 대체하면 다른 것을 센다.
- 면적: 외곽 18.0 × 10.6 m, 층당 133.2 ㎡, 합계 **266.4 ㎡** (브리프 목표 265, +0.5 %).
  저작자가 `manorDimensions.ts`에 불변식으로 못 박았고 실제로 throw한다.
- 대조군 (`#1939` 사이클 검증 픽스처): 주체 4,003 / 프로토타입 199 / element 3,474 /
  공간 15 / 인스턴스 집합 8 / 모델 197 / 부품 398. **이 실행의 목표가 아니다** —
  이전 실행의 수치이고, 숫자를 좇는 브리프는 숫자를 잰다.

## 3. 비용

**모든 벽시계에 그 시점의 머신 부하를 병기한다.** 이 머신은 드라이버 넷과 형제
캠페인이 공유하고, 측정 중 `codex.exe` 7개가 동시 생존했다 (소유는 `unattributed`).

| 측정 | 벽시계 | exit | 그때의 부하 |
| --- | --- | --- | --- |
| 샌드박스 생성 (pack + install) | `n/a` — 드라이버가 만들지 않았다 (감독관이 미리 렌더·설치) | — | — |
| `capture:install` | **19초** | 0 | codex 8 |
| `capture:doctor` (설치 전) | 14초 | **1** | codex 8 |
| `capture:doctor` (설치 후) | **7초** | 0 | codex 8 |
| 첫 컴파일 (스타터) | **7초** | 0 | codex 8 |
| 첫 렌더 (`preview`, 스타터 1프레임) | **15초** | 0 | codex 8 |
| `design` (revision 36) | **46초** | 0 | codex 7 |
| `compile` (revision 36) | **27초** | 0 | codex 7 |
| `review:status` (revision 36) | **43초** | 1 (아래 판정) | codex 7 |
| `building:report` (revision 36) | **17초** | 0 | codex 7 |
| 방 스케줄 | `building:report`에 포함 — 별도 명령 없음 | — | — |
| 텍스처 축척 | **`unverified`** — 저작자가 텍스처를 쓰지 않기로 했다 (4절) | — | — |
| 주체 관찰 1건 | `inspectSubject` 27회 실측: **1–35초**, 중앙값 약 2–4초 | 0 | codex 7 |
| 전체 프로토타입 스윕 | **`n/a`** — 하지 않았다 | — | — |

## 4. 도달

**이 절이 실험의 본체다. 저작자가 못 한 것과 제품이 길을 주지 않은 것을 나눈다.**

### 저작 에이전트가 실제로 몬 것 — 서버별로 귀속했다

`mcp_tool_call_end` **전수 49건**. 총계로 읽으면 안 된다: 형제 실행이 "3건 성공"을
철회했고 그 성공들이 다른 서버였다.

| 서버 | 도구 | OK | ERR |
| --- | --- | --- | --- |
| `automovie_medieval` (제품) | `getGuideDocument` | **6** | 4 |
| `automovie_medieval` (제품) | `captureFrame` | **8** | 2 |
| `automovie_medieval` (제품) | `inspectSubject` | **27** | 1 |
| `automovie_medieval` (제품) | `prepareReview` / `submitReview` / `repaintShot` | **0** | 0 |
| `node_repl` (전역, 남의 것) | `js` | 1 | 0 |

**제품 서버에 41 OK / 7 ERR.** 지속 시간이 실물이다 — `captureFrame` 최대 **69초**,
`inspectSubject` 35·14·11초. ERR 7건은 전부 턴 1이며 **드라이버 하네스가 만든 것**이다.

### 발견 가능성 — 이 실행이 산 축

**드라이버는 브리프에도 어떤 턴 메시지에도 MCP 도구 이름을 한 번도 쓰지 않았다.**
(브리프 파일 전문 확인, 매 메시지 발송 전 grep 검사.) 그런데도 에이전트는 세 도구에
스스로 도달했다.

**셀 순서로 통제했다.** 각 도구의 첫 호출 이전에 세션이 읽은 레코드에 그 이름이
있었는가.

| 도구 | 첫 호출 (UTC) | 첫 호출 전 이름이 있던 읽기 레코드 | 출처 |
| --- | --- | --- | --- |
| `getGuideDocument` | 00:46:53 | 2건 | `README.md` |
| `captureFrame` | 01:22:22 | 8건 | 프로젝트 스크립트 |
| `inspectSubject` | 01:23:49 | 9건 | `README.md` + `scripts/*.ts` 일괄 조사 |

**그러므로 주장하는 것과 주장하지 않는 것을 나눈다.**

- 주장하지 **않는다**: "이름 없이 알아냈다." 세 이름 모두 첫 호출 전에 읽은 파일
  안에 있었다. 도구 이름은 `node_modules` 없이도 프로젝트 파일 **8곳**에서 읽힌다
  (`README.md`, `.automovie/reviews/README.md`,
  `scripts/{mcp,preview,render,inspectSubject}.ts`, `viewer/inspection.{html,ts}`).
  `AGENTS.md`에는 도구 함수 이름이 **0개**다.
- 주장한다: **드라이버가 한 번도 지목하지 않은 조건에서, 제품이 배송하는 문서만으로
  에이전트가 6개 중 3개에 도달해 정확히 호출했다.** 첫 호출 인자
  `{name:"AUTOMOVIE_OVERALL"}`이 **`README.md:149`의 예제와 축자 일치**하는 것이
  경로의 증거다. 실사용 발견 경로다.
- 그리고 **제출 계열 3종은 끝내 0회**다. `review:status`가 리뷰 엔트리 15/15를
  `missing`으로 보고하는 것과 정확히 맞물린다. **관측 계열 3/3, 제출 계열 0/3.**

지난 실행과의 차이가 여기서 갈린다. 그 실행은 턴 1 메시지가 `getGuideDocument`를
지목해서 **도구가 동작한다는 증거만 있고 손을 뻗는다는 증거가 없었다.**

### 승인 게이트 — 이 실행이 양성 대조군이다

| 턴 | `approvals_reviewer` | 제품 서버 OK | ERR |
| --- | --- | --- | --- |
| 1 | `user` (플래그 없음) | **0** | **7** (`user cancelled MCP tool call`, `duration 0s`) |
| 2 | `auto_review` | **41** | **0** |

**호출 단위 등록 서버는 승인을 요구하고, 전역 등록 서버는 요구하지 않는다.
`approval_policy: never` + `approvals_reviewer: user`가 그 요청을 자동 거절한다.**
격리하려면 호출 단위 등록이 필요하고, 그것이 바로 게이트를 부른다. 따라서
**`-c approvals_reviewer="auto_review"`는 선택이 아니라 필수다.**

### 저작자가 스스로 한 것

- **치수 불변식을 기하보다 먼저 세웠다.** `manorDimensions.ts`가 266.4 ㎡를 못 박고
  어긋나면 throw한다. 일의 순서가 맞다.
- **런타임을 스스로 고쳤다.** 샌드박스에서 `os.userInfo()`가 ENOMEM으로 죽자
  `NODE_OPTIONS=--require`로 프로세스 한정 shim을 주입해 우회했다 (D1).
- **브리프와 레퍼런스의 모순을 지목받지 않고 발견했다.** `01-exterior.png`는 상층
  발코니 갤러리를 보여주는데 브리프의 고정 그래프는 지상 아케이드만 허용한다.
  고정 그래프를 유지하고 판단 근거를 문서에 남겼다 — 브리프가 요구한 그대로다.
- **드라이버의 오진을 증거로 반박했다** (5절).
- **텍스처를 의도적으로 거부했다.** primitive box 모델은 물리 UV 주장을 갖지 않고,
  로컬 레퍼런스 이미지는 배포 가능한 텍스처 provenance를 주지 않는다. 장식 텍스처를
  넣으면 축척과 provenance를 둘 다 날조하는 것이라고 스스로 적었다. **제품의 자산
  등록 규율을 스스로 지킨 판단이다.**

### 제품이 길을 주지 않은 것

- **`review:status`의 exit 0이 구조적으로 도달 불가능하다.** 리뷰 엔트리 중 하나라도
  `complete`가 아니면 exit 1이고, 갓 만든 프로덕션은 전부 `missing`이다. 게이트로
  쓰면 항상 빨갛다.
- **제출 계열 도구에 도달할 유인이 표면에 없다.** 에이전트는 자기 Self-Review를
  통과시켰다고 보고하면서 제품의 리뷰 원장은 비워 두었다.
- **coverage 명령이 없다.** 저작자가 백분율을 못 잰다고 매 턴 보고했다. `unverified`.
- **fal.ai: 미충족.** 이 체크아웃에 `.env`가 없고 환경에 fal 자격증명이 없다.
  전부 절차적 기하로 지었다. **자격증명은 값도 키 이름도 남기지 않는다.**

## 5. 판정

### 제품이 감당한 것

- **스타터 교체 벽을 턴 1에 뚫었다.** 지난 캠페인의 실행 전체를 삼킨 지점이다.
  revision 36 실측: `design.models: []`, `design.formations: []`,
  `design.shots: ["manor-survey"]`, `source.unownedGenerated: []`,
  `source.missing: []`, 디스크에 스타터 잔재 grep **0건**.
- **정직한 거절.** `building:report`가 기하 0일 때 "이 프로덕션이 무대에 올린 건축
  환경이 없으므로 그릴 것도, 셀 것도, 연구할 것도 없다"고 exit 0으로 거절했다.
  **알려진 0에서 정직하게 거절하는 것이 나중의 비-0 출력을 믿게 만든다.**
- **결정론적 캡처와 영수증.** `capture:doctor`가 renderer 문자열
  (`ANGLE ... SwiftShader`)과 실행 파일 digest를 영수증으로 낸다. `preview`의 receipt가
  `compileFingerprint`·`targetFingerprint`·`outputDigest`를 낸다 — **드라이버가 자기
  해시 도구를 만들 필요가 없다.**
- **인스턴스 티어를 캡처 경로가 이미 해석한다.** 스타터 프레임에 합창단 군집이 그대로
  보였다. 지난 실행의 자체 스윕이 놓친 것이 정확히 이 지점이다.
- **컴파일 idempotence.** `design` 레코드 4개 전부 `unchanged`, 뒤이은 `compile`
  생성물 9개 전부 `unchanged`, 진단 0건.

### 제품이 거절한 것과 그 정당성

- **`review:status` exit 1** — 리뷰가 없으니 거절한다. **정당하다.** 다만 게이트로
  쓸 수 없다는 것은 기록해 둔다.
- **첫 MCP 캡처가 `CAPTURE_FRAME` 가이드 크레딧이 없다고 거절했다.** 저작자가 그
  가이드를 읽고 **변경 없이 재시도해 성공했다.** 지식 게이트가 의도대로 작동했다 —
  **정당하다.**

### 결함 (재현 절차 포함)

**D1 — 샌드박스 안에서 `os.userInfo()`가 간헐적으로 ENOMEM.**
재현: Codex `workspace-write` 샌드박스에서 이 프로젝트의 `tsx` 기반 스크립트를 돈다.

```
uv_os_get_passwd returned ENOMEM
  at Object.userInfo (node:os:305:11)
  at .../node_modules/tsx/dist/temporary-directory-BDDVQOvU.mjs:1:84
```

대조: 드라이버 셸에서는 `os.userInfo().username` → `samch`로 성공, 메모리 수 GB 여유.
**간헐적이다** — 같은 샌드박스가 revision 38까지 컴파일했다. 따라서 "패키지를
임포트할 수 없다"는 서술은 **반증된다.** 결함의 모양은 **모듈 로드 경로의 syscall이
간헐적으로 실패하고 그 한 번이 패키지 전체를 가져간다**는 것. automovie가 고칠 수
있는 부분은 모듈 스코프 `os.userInfo()` 호출을 지연 호출로 내리는 것.
저작 에이전트가 `.ttsc-tmp/tsx-user-preload.cjs` shim으로 스스로 우회했다.

**D2 — 제품의 MCP 바인딩이 턴 3·4에서 도구 네임스페이스에서 사라졌다.**
재현: 같은 세션을 같은 호출 단위 등록 플래그로 연속 resume 한다. 턴 1–2는 바인딩이
있었고 **턴 3·4는 없다.** 에이전트 기록: *"the prior turn's MCP tool binding is not
present in this fresh tool namespace"*, 그리고
`TypeError: tools.mcp__automovie_medieval__getGuideDocument is not a function`.
거절이 아니라 **대상 부재**다. **원인 `unverified`** — 서버 프로세스 사망(D1 계열)과
codex 미등록을 구별할 증거가 없다. 에이전트는 프로젝트 거절로 오해하지 않고
`node_modules`의 가이드 코퍼스를 직접 읽고 일반 `preview` 명령으로 계속했다.

**D3 (드라이버 하네스, 제품 아님) — `approvals_reviewer` 미지정이 MCP를 조용히 죽인다.**
위 「승인 게이트」. 제품 결함이 아니라 **측정 장치의 결함**으로 기록한다.
그대로 두면 하네스가 만든 null을 제품의 성질로 보고하게 된다.

### 확인하지 못한 것 — 전부 `unverified`

- **5개 레퍼런스에 대한 최종 충실도 판정.** 실행이 S4 진행 중이다.
- element 이외의 분해 (프로토타입·인스턴스 집합·모델·부품) — 명령이 없다.
- coverage 백분율 — 명령이 없다.
- `texture:scale` — 저작자가 텍스처를 쓰지 않기로 했으므로 잴 것이 없다.
- 실내 13개 공간의 시각적 정합 — 저작자 스스로 "subject 이미지가 방 내부가 아니라
  외관을 보여준다"고 미해결 항목으로 신고했다. 드라이버는 확인하지 않았다.
- 전파 형태(propagation shape) 측정 — 턴 경계에서 할 예정. 턴 중간에 `compile`을
  돌리면 저작자의 상태에 간섭한다.
- 브리프 vs 레퍼런스 모순(상층 발코니)은 **브리프의 결함**으로 기록하며 프로덕션의
  충실도로 계산하지 않는다.

### 프레임 비교에 대한 단서 — 결정론이 아니다

프레임은 **content-addressed**다. revision마다 digest 디렉터리를 새로 쓰고 기존 경로를
덮어쓰지 않는다. 따라서 `changed`는 **구조적으로 항상 0**이며,
**프레임 해시 비교로 결정론을 측정할 수 없다.** 회귀 감지용 tripwire일 뿐이다.

그래도 해시만 잡아낸 사실이 하나 있다: beauty 렌더 **11회에 고유 이미지 9개**로,
`81e18c70`이 3회 `6e7c491d`가 2회 반복된다. 즉 **revision 둘은 산출물을 바꾸고 픽셀은
바꾸지 않았다.** 서술로는 잡히지 않는다.

| 라운드 | delivery 프레임 | 신규 | 변경 | 소실 | 현재 beauty digest |
| --- | --- | --- | --- | --- | --- |
| S1 | 10 | 9 | 0 | 0 | `8f2b9e04c40cbf0a` |
| S2 | 17 | 7 | 0 | 0 | `81e18c70c9a078e6` |
| S3 | 20 | 3 | 0 | 0 | `14c6da840250d621` |

### 방법론에서 실제로 값을 한 것

- **원인 없이 관측만 보낸 규칙.** "바깥 면과 안뜰 면이 다르게 읽힌다"를 진단 없이
  보냈고, 에이전트가 normal 패스로 **방향성 조명 응답**임을 반박했다. 드라이버가
  normal 패스를 직접 열어 반박을 검증했고 관측을 철회했다. **지난 실행은 같은 함정에서
  석조를 통째로 되물렸다.**
- **출처를 댈 수 없는 수치는 보내지 않는 규칙.** 공유 scratchpad에서 드라이버의 메시지
  파일이 **다른 드라이버의 내용으로 덮어써졌고**, 그 내용은 element 67·공간 20을
  주장했다 (실측은 621·16, `medieval-baron-manor` 언급 0회). 검증 전에 보내지 않아
  막았다. **운이 아니라 절차가 잡았다.**
- **부재는 잰 산출물을 밝힌다.** 드라이버가 "굴뚝이 없다"고 쓴 것은 프레임 한 장에서
  잰 것을 프로덕션에 대한 주장으로 쓴 오류였고, 에이전트가 반박하기 전에 스스로 정정했다.
