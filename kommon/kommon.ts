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
