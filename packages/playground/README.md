# @automovie/playground

`@automovie/playground`는 엔진과 뷰어를 브라우저에서 직접 확인하는 개발용 표면이다.

목적은 마케팅 페이지가 아니라 렌더링, 자세, 모션, 카메라, 오브젝트 이동이 실제로 어떻게 보이는지 빠르게 확인하는 것이다.

모든 화면은 `@automovie/interface` 데이터와 `@automovie/engine` 결과를 `@automovie/viewer`가 그리는 구조를 따른다.

## 실행

```bash
pnpm --filter @automovie/playground dev
pnpm --filter @automovie/playground build
pnpm --filter @automovie/playground preview
```

개발 서버 기본 주소는 `http://127.0.0.1:5173`이다.

## 주요 페이지

- `index.html`: 절차적 blockman 캐릭터 에디터. 체형 슬라이더, 관절 포즈, 내장 wave 클립을 확인한다.
- `drivers.html`: 3관절 팔과 two-bone IK, driver resolver를 확인한다.
- `stickman.html`: stickman/humanoid 및 cat 모션 클립을 선택 재생한다.
- `gesture.html`, `showcase.html`: 엔진이 합성하는 gesture/action vocabulary를 확인한다.
- `film.html`, `perform.html`: script/stage/block/perform/cut 파이프라인의 결과를 확인한다.
- `launch.html`, `impact.html`, `attach.html`, `trampoline.html`: projectile, impact, attach, jump 계열의 엔진 모션을 확인한다.
- `knight.html`, `archery.html`, `spar.html`: mounted, archery, boxing 장면을 확인한다.
- `human.html`: VRM 아바타 표면. expression, gaze, blink, arm/head pose를 확인한다.
- `body.html`, `face.html`, `head.html`, `mhhead.html`, `mhfull.html`: face/head/body 연구 표면. 현재 제품 경로의 중심은 아니지만 asset/shape 검증용으로 보존한다.

## 모션 자산 인벤토리

현재 playground에는 세 종류의 모션 자산이 있다.

첫째, 손으로 작성한 clip library다.

- `src/stickman-motion.ts`: `jumpingJack`, `wave`, `walk`, `run`, `hop`, `kick`, `dance`, `turn`, `combo`, `shadowbox`, `stroll`, `sprint`.
- `src/horse-motion.ts`: `idle`, `walk`, `trot`, `gallop`, `gallopTravel`, `turn`, `rear`, `performance`.
- `src/cat-motion.ts`: `idle`, `walk`, `leap`, `sit`, `stretch`, `tailFlick`, `combo`, `prowl`, `bound`.
- `src/spar.ts`: `redClip`, `blueClip`. boxing 교환, 방어, KO 흐름을 하나의 장면용 clip으로 만든다.

둘째, 엔진 action에서 생성되는 장면 모션이다.

- `attach-view.ts`: `attachTo`가 부모 손 FK를 따라 오브젝트 motion을 만든다.
- `launch-view.ts`: `launch`가 투사체 motion과 피격 react를 함께 만든다.
- `impact-view.ts`: 충돌/반동 계열을 장면으로 확인한다.
- `trampoline-view.ts`, `gesture-view.ts`, `showcase-view.ts`, `film-view.ts`: `performShot`과 관련 action compiler가 생성한 clip을 확인한다.

셋째, 모델/리그 빌드 스크립트다.

- `scripts/build-stickman.ts`, `scripts/build-horse.ts`, `scripts/build-cat.ts`, `scripts/build-knight.ts`: viewer가 읽는 GLB scaffold를 만든다.
- `scripts/mh/*`: MakeHuman 계열 연구/검증 스크립트다.

## Profile 이관 기준

선언형 Profile/gait 이관은 clip을 한꺼번에 없애는 작업이 아니다.

우선 순위는 locomotion이다.

1. humanoid `walk`, `run`, `stroll`, `sprint`.
2. horse `walk`, `trot`, `gallop`, `gallopTravel`.
3. cat `walk`, `prowl`.

`jumpingJack`, `wave`, `kick`, `dance`, `shadowbox`, `rear`, `leap`, `sit`, `stretch`, `tailFlick`, boxing scene clip은 gait만으로 표현하기 어렵다.

이들은 별도 gesture/action profile이나 driven-driver 이관 기준이 생길 때까지 손작성 clip으로 둔다.

Profile-generated clip으로 바꾸는 PR은 기존 clip과 key observable을 비교하는 regression을 먼저 추가하고, playground capture로 silhouette와 timing을 확인한다.

## 외부 모델

`human.html`은 VRoid sample avatar `"Vita"`를 사용한다.

이 모델은 CC0(public domain)이며 저장소에는 커밋하지 않고 필요할 때 내려받는다.

```bash
packages/playground/scripts/fetch-models.sh
```

다른 `.vrm`을 쓰려면 `public/models/`에 넣고 `src/human.ts`의 경로를 바꾼다.
