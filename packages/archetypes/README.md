# `@automovie/archetypes`

A catalogue of primitive model archetypes: one parameter schema, one set of
bounds, and one deterministic geometry builder per archetype, exported as one
list a host closes into its own registry. The package is headless and does not
depend on Three.js.

The production core keeps the *shape* of a model recipe and never the
catalogue. `IAutoMovieModelRecipe.archetype` is an opaque non-blank identifier;
the compiler resolves it through an `AutoMovieModelArchetypeRegistry` and
refuses a recipe that names nothing registered. Which figures, props, or shells
a production can build is therefore a decision of the catalogue a host
registers, not a union the universal surface enumerates.

## Public surface

| Export                                          | Purpose                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `IAutoMovieModelArchetype`                      | One definition: parameter schema, bounds, bones, plan, builder.     |
| `createAutoMovieArchetypeRegistry`              | Close one catalogue into a lookup, refusing blank or duplicate ids. |
| `AUTOMOVIE_PRIMITIVE_ARCHETYPES`                | The definitions this package ships, in registration order.          |
| `STICKMAN_ARCHETYPE`, `PRIMITIVE_PROP_ARCHETYPE`| Those two definitions, individually.                                |
| `HUMANOID_GAITS`, `CAT_GAITS`, `HORSE_GAITS`    | One declarative gait table per kind of body.                        |
| `HUMANOID_PROFILE`, `CAT_PROFILE`, `HORSE_PROFILE` | The profile each table binds onto a skeleton through.            |
| `numberParameter`, `stringParameter`, `numberOf` | Write and read the parameter values a schema declares.            |

Every consumer builds its own lookup, because that call is the seam where a host
substitutes, extends, or drops definitions. The production runtime's own default is
`AUTOMOVIE_REGISTERED_ARCHETYPES` in
`packages/production/src/production/productionArchetypes.ts`, and it is a parameter
default rather than a fixed choice.

Every definition is data plus pure functions. `plan` reports which parameter
keys a map must carry, may carry, and cannot; `projectionRadius` measures a
conservative bound before any geometry exists; `build` produces parts and an
optional skeleton. The same parameters always plan, measure, and build the same
result, on every host and in every process.

## Gait tables

The gait tables ship here for the same reason the archetypes do. The engine owns
the gait *machinery* : phase, duty, amplitude, per-limb easing, root bob,
contact resolution : and that machinery describes how any jointed body walks.
Which bones swing, at which phases, with which amplitudes is data about one kind
of body, so it belongs to the catalogue a host chooses rather than to the
universal surface.

Each table is a record of named `IAutoMovieGait` values, and each ships beside an
`IAutoMovieProfile` that packages the same vocabulary for the engine's
`bindProfileGaits` to bind onto a skeleton. A production whose figure is shaped
differently authors its own table against the same shape; nothing in the engine
has to learn about it.

## What may enter, and what may not

This package is the one place a shipped, pre-made thing is allowed to live, and
it is that place because no product package will hold one. `interface`,
`engine`, and `viewer` do not depend on it at all, and `production` registers what it
ships as a parameter default a host replaces, so a production that registers its
own catalogue loses nothing. Emptying this package would leave a working engine
with nothing to build, which is the shape a catalogue is supposed to have; the
one place that is not yet true is recorded at the end of this section.

An entry may enter when all three of these hold.

- **It is a definition, not an artifact.** A parameter schema with its bounds and
  a deterministic builder, or a declarative table the engine's own machinery
  reads. A host registers it through the registry rather than reaching for it by
  name.
- **Its absence costs a production its own choice and nothing else.** No
  validator, lowering step, viewer path, or production entry point may start needing it.
- **It is not standing in for a missing capability.** An entry that exists
  because authoring the thing directly is impossible today is a capability
  defect wearing a catalogue's clothes, and the capability is the real work.

An entry may not enter when any one of these holds.

- **It is finished content for one production's subject matter**: a furniture
  model, a moulding library, a style pack, a named catalogue of parts. A customer
  authors their own assets, and a thing shipped pre-made is a thing they stop
  deciding.
- **A product package would have to import it by name** to keep working.
- **It would give `interface` a runtime dependency.** `interface` stays pure
  types.

One exception stands today. The production sandbox module map names `CAT_GAITS`,
`HORSE_GAITS`, and `HUMANOID_GAITS` literally, in
`packages/production/src/production/linkProductionSource.ts` and
`packages/production/src/production/AutoMovieProductionCompiler.ts`, so those three
tables cannot be removed without editing `production`. The archetypes have a registry
seam and the gait tables do not yet; closing that is the gait side's own work,
and it is not a licence to add more named exports in the meantime.

None of this reaches the scaffold. A generated project inherits examples that
teach an authoring technique, never a catalogue it can call.

## Compiler boundary

Diagnostics belong to the design gate, not here: a definition reports the facts
(`required`, `accepted`, `refusals`) and the compiler decides how to say them.
Identity is the compiler's too, which is why a builder receives its material and
skeleton ids rather than deriving them.

`@automovie/archetypes`는 원시 모델 아키타입 카탈로그다. 아키타입 하나마다 파라미터 스키마와
경계값, 그리고 결정론적 지오메트리 빌더를 담고, 이를 하나의 목록으로 내보낸다. 레지스트리는
호스트가 그 목록을 닫아 만들며, 그 호출이 호스트가 정의를 바꿔 끼우는 이음매다.

코어는 모델 레시피의 *형태*만 알고 목록은 알지 않는다. `archetype`은 불투명한 비어 있지 않은
식별자이며, 컴파일러는 등록된 레지스트리에서 이를 조회하고 등록되지 않은 이름은 진단으로
거절한다. 어떤 형상을 만들 수 있는지는 호스트가 등록한 카탈로그의 결정이지, 보편 표면이
열거하는 유니온이 아니다.

보행 테이블도 같은 이유로 여기에 있다. 엔진은 위상·듀티·진폭·이징·접지 해석이라는 보행
*기계*를 소유하며, 그 기계는 관절을 가진 모든 몸이 걷는 방식을 설명한다. 어떤 본이 어떤
위상에서 어떤 진폭으로 흔들리는지는 특정한 몸에 대한 데이터이므로, 보편 표면이 아니라
호스트가 고르는 카탈로그에 속한다.

미리 만들어 둔 것을 두는 자리는 이 패키지 하나다. `interface`·`engine`·`viewer`는 이 패키지에
의존하지 않고, `production`은 호출자가 교체할 수 있는 이음매를 통해 기본 카탈로그로 등록할 뿐이다.
여기 있는 정의를 전부 지워도 엔진은 그대로 동작하며, 만들 것이 없어질 뿐이다.

들어올 수 있는 것은 셋을 모두 만족하는 항목이다. 산출물이 아니라 정의일 것(경계값을 가진
파라미터 스키마와 결정론적 빌더, 또는 엔진의 기계가 읽는 선언적 테이블), 없어도 제품 표면이
아니라 프로덕션의 선택만 사라질 것, 그리고 빠진 보편 역량을 대신하고 있지 않을 것. 셋째가
핵심이다. 직접 저작할 수 없어서 미리 만들어야 하는 항목은 카탈로그의 옷을 입은 역량 결함이며,
진짜 할 일은 역량 쪽에 있다.

들어올 수 없는 것은 하나만 해당해도 거절이다. 한 프로덕션의 소재를 완성해 건네는 콘텐츠(가구
모델, 몰딩 라이브러리, 양식 팩, 이름 붙은 부재 카탈로그), 제품 패키지가 이름으로 import 해야만
동작하게 되는 것, `interface`에 런타임 의존을 지우는 것.

지금 예외가 하나 있다. production 샌드박스 모듈 맵이 `CAT_GAITS`·`HORSE_GAITS`·`HUMANOID_GAITS`를
문자열로 열거하므로(`packages/production/src/production/linkProductionSource.ts`,
`packages/production/src/production/AutoMovieProductionCompiler.ts`), 그 셋은 `production`을 고치지 않고는
지울 수 없다. 아키타입에는 레지스트리 이음매가 있고 보행 테이블에는 아직 없다. 그것을 닫는
일은 보행 쪽의 몫이며, 그때까지 이름으로 노출되는 항목을 더 늘려도 된다는 뜻은 아니다.

스캐폴드는 이 중 어느 것도 상속하지 않는다. 생성된 프로젝트가 받는 것은 기법을 가르치는
예제이지, 호출할 수 있는 카탈로그가 아니다.
