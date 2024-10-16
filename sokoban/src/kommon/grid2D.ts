import { Vec2 } from "./math";

export class Grid2D<T> {
    // 0 1 2
    // 3 4 5
    // 6 7 8
    constructor(
        public size: Vec2,
        private data: T[]) { }

    getV<S>(pos: Vec2): T;
    getV<S>(pos: Vec2, outOfBounds: S): T | S;
    getV<S>(pos: Vec2, outOfBounds?: S): T | S {
        if (!Vec2.inBounds(pos, this.size)) {
            if (arguments.length == 2) {
                return outOfBounds!;
            }
            throw new Error(`get at ${pos} was out of bounds, and no default argument was given`);
        }
        return this.data[pos.x + pos.y * this.size.x];
    }

    setV(pos: Vec2, value: T): void {
        if (!Vec2.inBounds(pos, this.size)) {
            throw new Error(`can't set at ${pos}; out of bounds`);
        }
        this.data[pos.x + pos.y * this.size.x] = value;
    }

    forEachV(callback: (pos: Vec2, element: T) => void): void {
        for (let j = 0; j < this.size.y; j++) {
            for (let i = 0; i < this.size.x; i++) {
                callback(new Vec2(i, j), this.data[i + j * this.size.x]);
            }
        }
    }

    find(discriminator: (pos: Vec2, element: T) => boolean): { pos: Vec2, element: T }[] {
        let result: { pos: Vec2, element: T }[] = [];
        this.forEachV((pos, element) => {
            if (discriminator(pos, element)) {
                result.push({ pos: pos, element: element });
            }
        });
        return result;
    }

    map<S>(mapper: (pos: Vec2, element: T) => S): Grid2D<S> {
        return Grid2D.initV(this.size, pos => mapper(pos, this.getV(pos)));
    }

    // filter(discriminator: (i: number, j: number, element: T) => boolean): T[] {
    //     let result: T[] = [];
    //     for (let i = 0; i < this.width; i++) {
    //         for (let j = 0; j < this.height; j++) {
    //             if (discriminator(i, j, this.data[i + j * this.width])) {
    //                 result.push(this.data[i + j * this.width]);
    //             }
    //         }
    //     }
    //     return result;
    // }

    static initV<T>(size: Vec2, fillFunc: (pos: Vec2) => T) {
        let buffer: T[] = [];
        for (let j = 0; j < size.y; j++) {
            for (let i = 0; i < size.x; i++) {
                buffer.push(fillFunc(new Vec2(i, j)));
            }
        }
        return new Grid2D(size, buffer);
    }

    static fromAscii(ascii: string): Grid2D<string> {
        let ascii_lines = ascii.trim().split("\n").map(x => x.trim());
        let height = ascii_lines.length;
        let width = ascii_lines[0].length;
        if (ascii_lines.some(line => line.length !== width)) {
            throw new Error(`The given ascii is not a proper rectangle: ${ascii}`);
        }
        console.log(ascii_lines);

        // return this.initV(new Vec2(width, height), ({ x, y }) => ascii_lines[y][x]);
        return Grid2D.initV(new Vec2(width, height), ({ x, y }) => {
            console.log(x, y, ascii_lines[y][x]);
            return ascii_lines[y][x];
        });
    }
}
