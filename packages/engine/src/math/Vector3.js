/**
 * Pure-function vector math over {@link IAutoMovieVector3} (`{ x, y, z }`).
 *
 * Stateless helpers: every operation returns a fresh object and never mutates
 * its inputs. The engine keeps its own tiny math layer (rather than depending
 * on `three.js`) so it stays renderer-agnostic and runnable headless.
 *
 * @author Samchon
 */
export var Vector3;
(function (Vector3) {
    Vector3.create = (x = 0, y = 0, z = 0) => ({
        x,
        y,
        z,
    });
    Vector3.add = (a, b) => ({
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z,
    });
    Vector3.subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    Vector3.scale = (a, s) => ({
        x: a.x * s,
        y: a.y * s,
        z: a.z * s,
    });
    Vector3.dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    Vector3.cross = (a, b) => ({
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
    });
    Vector3.length = (a) => Math.sqrt(Vector3.dot(a, a));
    Vector3.normalize = (a) => {
        const len = Vector3.length(a);
        return len === 0 ? Vector3.create(0, 0, 0) : Vector3.scale(a, 1 / len);
    };
    /** Component-wise linear interpolation, `t` in `[0, 1]`. */
    Vector3.lerp = (a, b, t) => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
    });
})(Vector3 || (Vector3 = {}));
//# sourceMappingURL=Vector3.js.map