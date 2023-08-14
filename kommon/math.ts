export function randomInt(low_inclusive: number, high_exclusive: number): number {
    return low_inclusive + Math.floor(Math.random() * (high_exclusive - low_inclusive));
}

export function max(arr: number[]) {
    if (arr.length === 0) {
        return undefined
    }
    return arr[argmax(arr)!];
}

export function argmax(arr: number[]) {
    if (arr.length === 0) {
        return undefined
    }
    let res = 0;
    let biggest = arr[0];
    for (let k = 1; k < arr.length; k++) {
        if (arr[k] > biggest) {
            biggest = arr[k];
            res = k;
        }
    }
    return res;
}

export function lerp(a: number, b: number, t: number): number {
    return a * (1 - t) + b * t;
}

/** t === inverseLerp(a, b, lerp(a, b, t)) */
export function inverseLerp(a: number, b: number, value: number): number {
    if (a === b) return 0.5;
    let t = (value - a) / (b - a);
    return t;
}

export function towards(cur: number, target: number, max_delta: number): number {
    if (cur > target) {
        return Math.max(cur - max_delta, target);
    } else if (cur < target) {
        return Math.min(cur + max_delta, target);
    } else {
        return target;
    }
}

export function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}

export function remap(value: number, old_a: number, old_b: number, new_a: number, new_b: number) {
    let t = (value - old_a) / (old_b - old_a);
    return t * (new_b - new_a) + new_a;
}

export function randomChoice<T>(arr: T[]) {
    if (arr.length === 0) {
        throw new Error("can't choose out of an empty array");
    }
    return arr[Math.floor(Math.random() * arr.length)];
}

export function smoothstep(toZero: number, toOne: number, value: number) {
    let x = Math.max(0, Math.min(1, (value - toZero) / (toOne - toZero)));
    return x * x * (3 - 2 * x);
};

export function clamp(value: number, min_inclusive: number, max_inclusive: number): number {
    return Math.max(min_inclusive, Math.min(max_inclusive, value));
}

export function inRange(value: number, min_inclusive: number, max_exclusive: number): boolean {
    return value >= min_inclusive && value < max_exclusive;
}

export function onBorder(value: number, min_inclusive: number, max_exclusive: number): boolean {
    return value == min_inclusive || (value + 1) === max_exclusive;
}

// from https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
export function shuffle<T>(array: T[]) {
    let currentIndex = array.length, randomIndex;
    // While there remain elements to shuffle.
    while (currentIndex != 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}


// Use objects instead of arrays: https://jsben.ch/FgKVi
export class Vec4 {
    constructor(
        public x: number = 0.0,
        public y: number = 0.0,
        public z: number = 0.0,
        public w: number = 0.0,
    ) { }

    static fromHex(hex_str: string): Vec4 {
        // from https://stackoverflow.com/a/5624139
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex_str);
        if (result === null) {
            throw new Error(`can't parse hex: ${hex_str}`);
        }
        return new Vec4(
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16),
            255,
        );
    }

    static zero = new Vec4(0, 0, 0, 0);
    static one = new Vec4(1, 1, 1, 1);
}

type CardinalDirection = "xpos" | "xneg" | "ypos" | "yneg";

export class Vec2 {
    constructor(
        public x: number = 0.0,
        public y: number = 0.0,
    ) { }

    toString(): string {
        return `Vec2(${this.x}, ${this.y})`;
    }

    // scratchpad vectors, meant to be reused as intermediate values without allocation
    static tmp = new Vec2(0, 0);
    static tmp1 = new Vec2(0, 0);
    static tmp2 = new Vec2(0, 0);
    static tmp3 = new Vec2(0, 0);

    static zero = new Vec2(0, 0);
    static one = new Vec2(1, 1);

    static set(v: Vec2, x: number, y: number): Vec2 {
        v.x = x;
        v.y = y;
        return v;
    }

    static copy(v: Vec2, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = v.x;
        out.y = v.y;
        return out;
    }

    static add(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = a.x + b.x;
        out.y = a.y + b.y;
        return out;
    }

    static sub(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = a.x - b.x;
        out.y = a.y - b.y;
        return out;
    }

    static mul(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = a.x * b.x;
        out.y = a.y * b.y;
        return out;
    }

    static div(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = a.x / b.x;
        out.y = a.y / b.y;
        return out;
    }

    static round(v: Vec2, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = Math.round(v.x);
        out.y = Math.round(v.y);
        return out;
    }

    static negate(v: Vec2, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = -v.x;
        out.y = -v.y;
        return out;
    }

    static scale(v: Vec2, s: number, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = v.x * s;
        out.y = v.y * s;
        return out;
    }

    static lerp(a: Vec2, b: Vec2, t: number, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = a.x * (1 - t) + b.x * t;
        out.y = a.y * (1 - t) + b.y * t;
        return out;
    }

    static inBounds(point: Vec2, bounds: Vec2): boolean {
        return inRange(point.x, 0, bounds.x) && inRange(point.y, 0, bounds.y);
    }

    // too niche for here?
    static onBorder(point: Vec2, bounds: Vec2): boolean {
        return onBorder(point.x, 0, bounds.x) || onBorder(point.y, 0, bounds.y);
    }

    static isZero(v: Vec2): boolean {
        return v.x === 0 && v.y === 0;
    }

    static equals(a: Vec2, b: Vec2): boolean {
        return a.x === b.x && a.y === b.y;
    }

    static magSq(v: Vec2): number {
        return v.x * v.x + v.y * v.y;
    }

    static taxicab(v: Vec2): number {
        return Math.abs(v.x) + Math.abs(v.y);
    }

    static lInf(v: Vec2): number {
        return Math.max(Math.abs(v.x), Math.abs(v.y));
    }

    static map1(v: Vec2, fn: (x: number) => number, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = fn(v.x);
        out.y = fn(v.y);
        return out;
    }

    static map2(a: Vec2, b: Vec2, fn: (a: number, b: number) => number, out?: Vec2): Vec2 {
        out = out || new Vec2();
        out.x = fn(a.x, b.x);
        out.y = fn(a.y, b.y);
        return out;
    }

    static isInsideBox(point: Vec2, box_center: Vec2, box_size: Vec2): boolean {
        return (Math.abs(point.x - box_center.x) < box_size.x * .5)
            && (Math.abs(point.y - box_center.y) < box_size.y * .5);
    }

    static roundToCardinal(a: Vec2): CardinalDirection {
        if (Math.abs(a.x) >= Math.abs(a.y)) {
            if (a.x >= 0) {
                return "xpos";
            } else {
                return "xneg";
            }
        } else {
            if (a.y >= 0) {
                return "ypos";
            } else {
                return "yneg";
            }
        }
    }
}

// todo: generalize, error check for too many args
export class Rectangle {
    constructor(
        public topLeft: Vec2,
        public size: Vec2) { }

    static fromParams(params: {
        topLeft?: Vec2,
        center?: Vec2,
        bottomRight?: Vec2,
        size?: Vec2,
    }): Rectangle {
        let topLeft = new Vec2();
        let size = new Vec2();

        if (params.topLeft !== undefined) {
            Vec2.copy(params.topLeft, topLeft);
            if (params.size !== undefined) {
                Vec2.copy(params.size, size);
            } else if (params.bottomRight !== undefined) {
                Vec2.sub(params.bottomRight, topLeft, size);
            } else if (params.center !== undefined) {
                Vec2.sub(params.center, topLeft, size);
                Vec2.scale(size, 2, size);
            } else {
                throw new Error("not enough data to compute rect");
            }
            return new Rectangle(topLeft, size);
        } else if (params.center !== undefined) {
            if (params.size !== undefined) {
                Vec2.copy(params.size, size);
            } else if (params.bottomRight !== undefined) {
                Vec2.sub(params.bottomRight, params.center, size);
                Vec2.scale(size, 2, size);
            } else {
                throw new Error("not enough data to compute rect");
            }
            Vec2.sub(params.center, Vec2.scale(size, .5), topLeft);
            return new Rectangle(topLeft, size);
        } else {
            throw new Error("unimplemented");
        }
    }
}
