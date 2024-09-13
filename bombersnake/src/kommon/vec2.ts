import { fromCount } from "./kommon";

export class Vec2 {
    private static pool: Vec2[] = fromCount(4000, k => {
        const asdf = new Vec2(0, 0);
        asdf.pool_index = k;
        return asdf;
    });
    private static freePoolIndex: number = 0;

    private _x: number;
    private _y: number;
    private pool_index: number = -1;

    constructor(x: number, y: number) {
        this._x = x;
        this._y = y;
    }

    get x(): number { return this._x; }
    get y(): number { return this._y; }

    static clearPool(): void {
        // console.log('cleared: ', Vec2.freePoolIndex);
        Vec2.freePoolIndex = 0;
    }

    // static clearPoolExcept(vecs: Vec2[]): void {
    //     vecs.forEach(v => {
    //         v.persist();
    //     });
    //     Vec2.freePoolIndex = 0;
    // }

    static fromPool(x: number, y: number): Vec2 {
        while (Vec2.freePoolIndex >= Vec2.pool.length) {
            // throw new Error("not enough pool left");
            // console.log('growing');
            Vec2.pool.push(new Vec2(0, 0));
        }

        const v = Vec2.pool[Vec2.freePoolIndex];
        Vec2.freePoolIndex += 1;
        v._x = x;
        v._y = y;
        return v;
    }

    persist(): Vec2 {
        if (this.pool_index !== -1) {
            const k = this.pool_index;
            Vec2.pool[k] = new Vec2(0, 0);
            Vec2.pool[k].pool_index = k;
            this.pool_index = -1;
        }
        return this;
    }

    static readonly zero = new Vec2(0, 0);
    static readonly one = new Vec2(1, 1);
    static readonly half = new Vec2(0.5, 0.5);
    static readonly xpos = new Vec2(1, 0);
    static readonly ypos = new Vec2(0, 1);
    static readonly xneg = new Vec2(-1, 0);
    static readonly yneg = new Vec2(0, -1);

    toArray(): [number, number] {
        return [this.x, this.y];
    }

    toString(): string {
        return `Vec2(${this.x},${this.y})`;
    }

    static both(value: number): Vec2 {
        return Vec2.fromPool(value, value);
    }

    static lerp(a: Vec2, b: Vec2, t: number): Vec2 {
        return a.scale(1 - t).add(b.scale(t));
    }

    add(other: Vec2): Vec2 {
        return Vec2.fromPool(
            this.x + other.x,
            this.y + other.y,
        );
    }

    addX(x: number): Vec2 {
        return Vec2.fromPool(
            this.x + x,
            this.y,
        );
    }

    addY(y: number): Vec2 {
        return Vec2.fromPool(
            this.x,
            this.y + y,
        );
    }

    addXY(x: number, y: number): Vec2 {
        return Vec2.fromPool(
            this.x + x,
            this.y + y,
        );
    }

    sub(other: Vec2): Vec2 {
        return Vec2.fromPool(
            this.x - other.x,
            this.y - other.y,
        );
    }

    mul(other: Vec2): Vec2 {
        return Vec2.fromPool(
            this.x * other.x,
            this.y * other.y,
        );
    }

    scale(s: number): Vec2 {
        return Vec2.fromPool(
            this.x * s,
            this.y * s,
        );
    }

    rotate(radians: number): Vec2 {
        let c = Math.cos(radians);
        let s = Math.sin(radians);
        return Vec2.fromPool(
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
        return Vec2.fromPool(Math.cos(radians), Math.sin(radians));
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
