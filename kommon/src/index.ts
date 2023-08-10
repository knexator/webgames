import Shaku from "shaku/lib/shaku";
import Vector2 from "shaku/lib/utils/vector2";

// utility
export function choose<T>(list: T[]): T {
    if (list.length === 0) {
        throw new Error("Empty list");
    }
    return list[Math.floor(Math.random() * list.length)];
}

export function modVec(v: Vector2, n: number): Vector2 {
    return new Vector2(
        Shaku.utils.MathHelper.mod(v.x, n),
        Shaku.utils.MathHelper.mod(v.y, n),
    );
}

export function floorVec(v: Vector2): Vector2 {
    return new Vector2(Math.floor(v.x), Math.floor(v.y));
}

export function dir(v: Vector2): Vector2 {
    if (v.x === 0 && v.y === 0) return Vector2.zero;
    if (Math.abs(v.x) > Math.abs(v.y)) {
        return (v.x > 0) ? Vector2.right : Vector2.left;
    } else {
        return (v.y > 0) ? Vector2.down : Vector2.up;
    }
}

export function towards(cur_val: number, target_val: number, max_delta: number): number {
    if (target_val > cur_val) {
        return Math.min(cur_val + max_delta, target_val);
    } else if (target_val < cur_val) {
        return Math.max(cur_val - max_delta, target_val);
    } else {
        return target_val;
    }
}

export function clamp(value: number, a: number, b: number) {
    if (value < a) return a;
    if (value > b) return b;
    return value;
}

export function rotateAround(p: Vector2, center: Vector2, radians: number): Vector2 {
    return p.sub(center).rotatedRadians(radians).add(center);
}