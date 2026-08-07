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
            files: [
              ".automovie/design/screenplay/index.json",
              ".automovie/design/*/screenplay/index.json",
            ],
            requires: [],
          },
          {
            name: "shot-contracts",
            files: [
              ".automovie/design/shots/*.json",
              ".automovie/design/*/shots/*.json",
            ],
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

