# `@automovie/lint`

`@automovie/lint`는 AutoMovie 프로젝트 레코드와 코딩 에이전트의 저작 코드를 검사하는 `@ttsc/lint` contributor다.
엔진이 계산한 물리·문법 사실은 엔진 진단이 소유하고, 이 패키지는 소스와 프로젝트 파일에 이미 존재하는 계약만 판정한다.

## 설정

```ts
import { automovie } from "@automovie/lint";
import type { ITtscLintConfig } from "@ttsc/lint";

export default {
  plugins: { automovie },
  rules: {
    "automovie/template-sentinel": "error",
    "automovie/asset-provenance": [
      "error",
      {
        manifests: [".automovie/assets.json"],
        assets: ["public/**/*.glb", "public/**/*.png", "public/**/*.wav"],
      },
    ],
    "automovie/screenplay-contract": [
      "error",
      {
        indexes: [
          ".automovie/design/screenplay/index.json",
          ".automovie/design/*/screenplay/index.json",
        ],
        documents: ["docs/**/*.md"],
        shots: [
          ".automovie/design/shots/*.json",
          ".automovie/design/*/shots/*.json",
        ],
        acceptance: [
          ".automovie/design/acceptance/*.json",
          ".automovie/design/*/acceptance/*.json",
        ],
        models: [
          ".automovie/design/models/*.json",
          ".automovie/design/*/models/*.json",
          ".automovie/design/shared/models/*.json",
        ],
        formations: [
          ".automovie/design/formations/*.json",
          ".automovie/design/*/formations/*.json",
          ".automovie/design/shared/formations/*.json",
        ],
        worlds: [
          ".automovie/design/world.json",
          ".automovie/design/*/world.json",
          ".automovie/design/shared/world.json",
        ],
        realizations: [
          "generated/realizations/*.json",
          "generated/*/realizations/*.json",
        ],
        reviews: [
          ".automovie/reviews/shots/*.json",
          ".automovie/reviews/film/*.json",
          ".automovie/reviews/*/shots/*.json",
          ".automovie/reviews/*/film/*.json",
        ],
      },
    ],
    "automovie/state-presence": [
      "error",
      {
        slots: [
          {
            name: "screenplay-index",
            files: [".automovie/productions/*/screenplay/index.json"],
            requires: [],
          },
          {
            name: "shot-contracts",
            files: [".automovie/productions/*/shots/*.json"],
            requires: ["screenplay-index"],
          },
        ],
      },
    ],
  },
} satisfies ITtscLintConfig;
```

첫 `ttsc check`는 contributor의 Go 소스를 lint 실행 파일에 연결하므로 오래 걸릴 수 있고, 이후 실행은 같은 cache key의 바이너리를 재사용한다.

## 규칙

### `automovie/template-sentinel`

컴파일되는 소스에 정확한 `AUTOMOVIE_IMPLEMENT_ME` 표지가 남아 있으면 실패한다.
표지가 없는 새 프로젝트에는 조용하며, 진단은 남은 사실, downstream이 이를 완성된 구현으로 소비할 수 없는 이유, 구현 후 표지를 제거하고 lint를 다시 실행하라는 복구 행동을 모두 말한다.

### `automovie/state-presence`

설정된 downstream 슬롯의 파일이 하나라도 존재하는데 필요한 upstream 슬롯이 하나도 존재하지 않으면 실패한다.
파일 내용이나 배열 길이는 읽지 않으므로 유효한 빈 레코드도 resident다.
레코드가 전혀 없는 프로젝트에서는 침묵하고, 읽을 수 없는 경로는 그 경로가 숨길 수 있는 의무만 stand-down한다.

### `automovie/screenplay-contract`

`IAutoMovieScreenplayIndex`와 사람이 쓰는 treatment/screenplay Markdown을
대조한다. treatment 비트의 exact prose가 active scene `covers`에 없거나,
SCN heading이 누락·중복·미등록이거나, active heading 아래 본문이 없으면
index 옆에서 진단한다.

shot/acceptance의 `{ reason, scene, claim? }` 인용, 인물·세력·장소
카탈로그에서 model/formation/world landmark로 향하는 명시적 binding,
continuity claim의 단일 verification owner와 정확한 proof selector도 같은
원장에서 검사한다. scene coverage는 shot 선언이나 design review만으로 닫히지
않는다. 같은 프로덕션의 passing `generated/*/realizations/*.json`과 같은
realized shot을 관찰한 shot/film review의 `acceptance-scenarios` pass가 함께
있어야 하며, disposition과 실현이 동시에 존재하면 모순으로 진단한다.

lock 뒤 기존 숫자는 `sceneIds` 원장에 남아야 한다. 삭제는 `OMITTED`
tombstone으로 보존하고 새 장면은 `SCN-A11` 같은 alpha insertion id만
허용한다. index가 없으면 rule은 조용하다.

### `automovie/asset-provenance`

설정된 distributable asset 파일마다 `.automovie/assets.json`의 유일한 항목을
요구하고 현재 바이트의 SHA-256을 원장과 대조한다. source URL, original
SHA-256, license 식별자/URL, 재현 가능한 processing chain, production 주소와
typed consumer를 가진 reasoned use가 비어 있으면 실패한다. 외부 모델의 LOD는
유일한 hero/near/far 순서와 실제 model asset을, proxy는 원장 asset 또는 닫힌
generated recipe를 요구한다. 원장 없이 asset 파일이 존재하거나 원장 밖 파일이
생겨도 실패하므로 교체된 바이트와 미등록 배포물을 build-time에 차단한다.

외부 `.gltf`, `.glb`, `.vrm`은 ingest profile, 명시적 LOD manifest 항목,
collision proxy, measurement proxy를 추가로 기록한다. 이 rule은 파일 계층을
검증하며 `@automovie/ingest`의 고정 바이트 순수 변환 계약에는 관여하지 않는다.

## Rule 품질 원칙

모든 AutoMovie rule은 다음 여섯 요구사항을 지킨다.

1. **상주 전 침묵.** 디자인 레코드나 sentinel이 없으면 rule은 조용하다. 빈 배열은 존재하는 레코드이며 길이를 준비 상태로 오해하지 않는다.
2. **사실 범위 stand-down.** 입력을 읽지 못하거나 사실을 결정할 수 없으면 그 불확실성이 숨길 수 있는 의무만 억제하고, 무관한 rule까지 멈추지 않는다.
3. **축소 구조체.** rule option과 decoder에는 판정에 필요한 구조 필드만 둔다. logline, note 같은 산문 필드를 타입에서 제거해 산문 채점을 구조적으로 불가능하게 한다.
4. **복구 가능한 메시지.** 모든 진단은 관측 사실, 그 사실이 깨뜨리는 계약, 사용자가 실행할 정확한 복구 행동과 명령을 이 순서로 말한다. `invalid` 하나로 끝내지 않는다.
5. **checker 심볼 식별.** 엔진·생성 SDK API는 철자가 아니라 checker가 해석한 import symbol로 식별한다. 동명 로컬 변수나 shadow는 해당 API가 아니다.
6. **미러 rule 골든 벡터.** 엔진과 lint가 같은 정준화·지문을 구현하면 양쪽이 같은 벡터 파일을 읽어 결과를 상호 검증한다.

## Rule 작성과 검증

TypeScript의 plugin descriptor는 `src/index.ts`, 실제 rule은 `native/`가 소유한다.
새 rule은 발화·침묵 쌍을 한 줄 차이로 만들고, unit 함수 직접 호출이 아니라 임시 소비자 프로젝트에서 실제 `ttsc check`를 실행해 검증한다.
하네스는 먼저 빈 프로젝트의 성공 상태를 확인하고, 다음 발화 케이스에서 고유 진단 문구를 확인해 “도구가 실행되지 않아 진단이 0개”인 상태를 성공으로 오인하지 않는다.
