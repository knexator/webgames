import { mod } from "./math";

export class Vec2 {
    constructor(
        public x: number,
        public y: number,
    ) { }

    static readonly zero = new Vec2(0, 0);
    static readonly one = new Vec2(1, 1);
    static readonly half = new Vec2(0.5, 0.5);
    static readonly xpos = new Vec2(1, 0);
    static readonly ypos = new Vec2(0, 1);
    static readonly xneg = new Vec2(-1, 0);
    static readonly yneg = new Vec2(0, -1);

    static readonly tmp1 = new Vec2(0, 0);
    static readonly tmp2 = new Vec2(0, 0);
    static readonly tmp3 = new Vec2(0, 0);
    static readonly tmp4 = new Vec2(0, 0);

    toArray(): [number, number] {
        return [this.x, this.y];
    }

    toString(): string {
        return `Vec2(${this.x},${this.y})`;
    }

    static both(value: number): Vec2 {
        return new Vec2(value, value);
    }

    static lerpFixed(a: Vec2, b: Vec2, t: number, dst: Vec2): Vec2 {
        dst.x = a.x + (b.x - a.x) * t;
        dst.y = a.y + (b.y - a.y) * t;
        return dst;
    }

    set(x: number, y: number): Vec2 {
        this.x = x;
        this.y = y;
        return this;
    }

    mod(bounds: Vec2, dst: Vec2 = this): Vec2 {
        dst.x = mod(this.x, bounds.x);
        dst.y = mod(this.y, bounds.y);
        return dst;
    }

    addFixed(other: Vec2, dst: Vec2 = this): Vec2 {
        dst.x = this.x + other.x;
        dst.y = this.y + other.y;
        return dst;
    }

    addXFixed(x: number, dst: Vec2 = this): Vec2 {
        dst.x += x;
        return dst;
    }

    addYFixed(y: number, dst: Vec2 = this): Vec2 {
        dst.y += y;
        return dst;
    }

    addBoth(v: number, dst: Vec2 = this) {
        dst.x = this.x + v;
        dst.y = this.y + v;
        return dst;
    }

    addXY(x: number, y: number): Vec2 {
        return new Vec2(
            this.x + x,
            this.y + y,
        );
    }

    sub(other: Vec2): Vec2 {
        return new Vec2(
            this.x - other.x,
            this.y - other.y,
        );
    }

    subFixed(other: Vec2, dst: Vec2 = this): Vec2 {
        dst.x = this.x - other.x;
        dst.y = this.y - other.y;
        return dst;
    }

    mul(other: Vec2): Vec2 {
        return new Vec2(
            this.x * other.x,
            this.y * other.y,
        );
    }

    scale(s: number): Vec2 {
        return new Vec2(
            this.x * s,
            this.y * s,
        );
    }

    scaleFixed(s: number, dst: Vec2 = this): Vec2 {
        dst.x = this.x * s;
        dst.y = this.y * s;
        return dst;
    }

    rotate(radians: number): Vec2 {
        let c = Math.cos(radians);
        let s = Math.sin(radians);
        return new Vec2(
            this.x * c - this.y * s,
            this.x * s + this.y * c
        );
    }

    rotateTurns(turns: number): Vec2 {
        return this.rotate(turns * 2 * Math.PI);
    }

    equal(other: Vec2): boolean {
        return this.x === other.x && this.y === other.y;
    }

    equalAprox(other: Vec2, eps: number = 1e-10): boolean {
        return Math.abs(this.x - other.x) < eps && Math.abs(this.y - other.y) < eps;
    }

    magSq(): number {
        return this.x * this.x + this.y * this.y;
    }

    mag(): number {
        return Math.sqrt(this.magSq());
    }

    static fromRadians(radians: number): Vec2 {
        return new Vec2(Math.cos(radians), Math.sin(radians));
    }

    static fromTurns(turns: number): Vec2 {
        return Vec2.fromRadians(turns * Math.PI * 2);
    }

    cross(other: Vec2): number {
        return this.x * other.y - this.y * other.x;
    }

    dot(other: Vec2): number {
        return this.x * other.x + this.y * other.y;
    }

    radians(): number {
        return Math.atan2(this.y, this.x);
    }

    turns(): number {
        return this.radians() / (Math.PI * 2);
    }
}
