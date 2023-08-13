export function fromCount<T>(n: number, callback: (index: number) => T): T[] {
    let result = Array(n);
    for (let k = 0; k < n; k++) {
        result[k] = callback(k);
    }
    return result;
}

export function fromRange<T>(lo: number, hi: number, callback: (index: number) => T): T[] {
    let count = hi - lo;
    let result = Array(count);
    for (let k = 0; k < count; k++) {
        result[k] = callback(k + lo);
    }
    return result;
}

export function* zip(...arrays: Iterable<any>[]): Generator<any> {
    let iterators = arrays.map(a => a[Symbol.iterator]());
    while (true) {
        let nexts = iterators.map(a => a.next());
        let done = nexts.some(n => n.done);
        if (done) return;
        yield nexts.map(n => n.value);
    }
}

export function objectMap<T, S>(object: Record<string, T>, map_fn: (x: T) => S): Record<string, S> {
    let result: Record<string, S> = {};
    for (let [k, v] of Object.entries(object)) {
        result[k] = map_fn(v);
    }
    return result;
}

export class DefaultDict<T> {
    constructor(init_fn: () => T) {
        // typing doesn't work :(
        let target: Record<string | symbol | number, T> = {};
        return new Proxy(target, {
            get: (target, name): T => {
                if (name in target) {
                    return target[name];
                } else {
                    target[name] = init_fn();
                    return target[name];
                }
            }
        })
    }
}

// from https://gist.github.com/rosszurowski/67f04465c424a9bc0dae
// and https://gist.github.com/nikolas/b0cce2261f1382159b507dd492e1ceef
export function lerpHexColor(a: string, b: string, t: number): string {
    const ah = Number(a.replace('#', '0x'));
    const bh = Number(b.replace('#', '0x'));

    const ar = (ah & 0xFF0000) >> 16,
        ag = (ah & 0x00FF00) >> 8,
        ab = (ah & 0x0000FF),

        br = (bh & 0xFF0000) >> 16,
        bg = (bh & 0x00FF00) >> 8,
        bb = (bh & 0x0000FF),

        rr = ar + t * (br - ar),
        rg = ag + t * (bg - ag),
        rb = ab + t * (bb - ab);


    return `#${((rr << 16) + (rg << 8) + (rb | 0)).toString(16).padStart(6, '0').slice(-6)}`
}
