import {
  LIGHT_CHANNEL_PROPERTIES,
  formatLightPointer,
  isLightProperty,
  parseLightPointer,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

/** `parse` reduced to a comparable shape: `"<light>|<property>"` or `null`. */
const parsed = (pointer: unknown): string | null => {
  const target = parseLightPointer(pointer);
  return target === null ? null : `${target.light}|${target.property}`;
};

/**
 * The light pointer grammar (#1348): `/lights/<light id>/<property>`, the one
 * address form that can reach a light, since a light is not a scene node.
 *
 * Two properties carry the axis's safety. The light is named by its stable
 * **id**, never by its index in `scene.lights` — the benchmark agent wrote
 * `/lights/0/intensity` and an index read against an array whose order is
 * load-bearing elsewhere (the viewer's mask palette is keyed by top-level child
 * index) would silently re-target whenever staging inserts a light. And the
 * accepted property set is read out of `LIGHT_CHANNEL_PROPERTIES`, the same
 * table the applier writes through, so the grammar cannot admit a property
 * nothing applies.
 *
 * Expected values come from RFC-6901, which the channel type cites: `~1`
 * decodes to `/` and `~0` to `~`, in that order, and a pointer that is not the
 * canonical encoding of what it decodes to is not a valid pointer.
 *
 * Scenarios:
 *
 * 1. The four table properties parse on a plain id, and each round-trips back to
 *    the pointer it came from.
 * 2. An id carrying reserved characters survives: `/lights/a~1b~0c/intensity`
 *    decodes to the id `a/b~c`, and formatting that id reproduces the pointer.
 * 3. Every way a string fails to be a light pointer yields `null` rather than a
 *    partial parse: a non-string, too few and too many segments, a relative
 *    pointer, a four-segment string whose leading segment is non-empty, a
 *    different collection (`/cameras/0/fovY`, the other example the channel
 *    type advertises), an unknown property, an empty id, and an invalid escape
 *    (`~2`), which the canonicality rule catches for free.
 * 4. `isLightProperty` answers from the table's OWN keys: `constructor` and
 *    `toString` are properties of every object and neither is a light
 *    property.
 */
export const test_resolve_light_pointer = (): void => {
  // 1. the table's four properties, and the round trip.
  const PROPERTIES = ["intensity", "color", "range", "coneAngle"] as const;
  TestValidator.equals(
    "the table admits exactly these properties",
    Object.keys(LIGHT_CHANNEL_PROPERTIES),
    [...PROPERTIES],
  );
  TestValidator.equals(
    "each one parses, and formatting returns the pointer it came from",
    PROPERTIES.map((property) => [
      parsed(`/lights/candleGlow/${property}`),
      formatLightPointer("candleGlow", property),
    ]),
    PROPERTIES.map((property) => [
      `candleGlow|${property}`,
      `/lights/candleGlow/${property}`,
    ]),
  );

  // 2. RFC-6901 escaping, both directions.
  TestValidator.equals(
    "an escaped id decodes and re-encodes",
    [
      parsed("/lights/a~1b~0c/intensity"),
      formatLightPointer("a/b~c", "intensity"),
    ],
    ["a/b~c|intensity", "/lights/a~1b~0c/intensity"],
  );

  // 3. every non-pointer, refused as a whole.
  TestValidator.equals(
    "a string that is not a light pointer never half-parses",
    [
      parsed(42),
      parsed("/lights/candleGlow"),
      parsed("/lights/candleGlow/intensity/x"),
      parsed("lights/candleGlow/intensity"),
      parsed("x/lights/candleGlow/intensity"),
      parsed("/cameras/0/fovY"),
      parsed("/lights/candleGlow/temperature"),
      parsed("/lights//intensity"),
      parsed("/lights/a~2b/intensity"),
    ],
    [null, null, null, null, null, null, null, null, null],
  );

  // 4. the table's own keys, not every string an object answers to.
  TestValidator.equals(
    "an inherited object property is not a light property",
    [
      isLightProperty("intensity"),
      isLightProperty("constructor"),
      isLightProperty("toString"),
    ],
    [true, false, false],
  );
};
