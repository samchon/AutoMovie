# `@automovie/archetypes`

A catalogue of primitive model archetypes: one parameter schema, one set of
bounds, and one deterministic geometry builder per archetype, exported through
a single registry. The package is headless and does not depend on Three.js.

The production core keeps the *shape* of a model recipe and never the
catalogue. `IAutoMovieModelRecipe.archetype` is an opaque non-blank identifier;
the compiler resolves it through an `AutoMovieModelArchetypeRegistry` and
refuses a recipe that names nothing registered. Which figures, props, or shells
a production can build is therefore a decision of the catalogue a host
registers, not a union the universal surface enumerates.

## Public surface

| Export                                | Purpose                                                             |
| ------------------------------------- | ------------------------------------------------------------------- |
| `IAutoMovieModelArchetype`            | One definition: parameter schema, bounds, bones, plan, builder.     |
| `createAutoMovieArchetypeRegistry`    | Close one catalogue into a lookup, refusing blank or duplicate ids. |
| `AUTOMOVIE_PRIMITIVE_ARCHETYPES`      | The definitions this package ships, in registration order.          |
| `AUTOMOVIE_PRIMITIVE_ARCHETYPE_REGISTRY` | Those definitions, already registered.                           |

Every definition is data plus pure functions. `plan` reports which parameter
keys a map must carry, may carry, and cannot; `projectionRadius` measures a
conservative bound before any geometry exists; `build` produces parts and an
optional skeleton. The same parameters always plan, measure, and build the same
result, on every host and in every process.

## Boundary

Diagnostics belong to the design gate, not here: a definition reports the facts
(`required`, `accepted`, `refusals`) and the compiler decides how to say them.
Identity is the compiler's too, which is why a builder receives its material and
skeleton ids rather than deriving them.

`@automovie/archetypes`는 원시 모델 아키타입 카탈로그다. 아키타입 하나마다 파라미터 스키마와
경계값, 그리고 결정론적 지오메트리 빌더를 담고, 이를 하나의 레지스트리로 내보낸다.

코어는 모델 레시피의 *형태*만 알고 목록은 알지 않는다. `archetype`은 불투명한 비어 있지 않은
식별자이며, 컴파일러는 등록된 레지스트리에서 이를 조회하고 등록되지 않은 이름은 진단으로
거절한다. 어떤 형상을 만들 수 있는지는 호스트가 등록한 카탈로그의 결정이지, 보편 표면이
열거하는 유니온이 아니다.
