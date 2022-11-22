type MapKeyTuple<K extends unknown[], V> = K extends [infer OnlyElement] ?
    Map<OnlyElement, V> :
    K extends [infer Head, ...infer Tail] ?
        Map<Head, MapKeyTuple<Tail, V>> :
        never;

export default class MultiKeyMap<K extends unknown[], V> {
    private map: MapKeyTuple<K, V>;

    constructor () {
        this.map = new Map() as MapKeyTuple<K, V>;
    }

    /* eslint-disable
    @typescript-eslint/no-explicit-any,
    @typescript-eslint/no-unsafe-assignment,
    @typescript-eslint/no-unsafe-member-access,
    @typescript-eslint/no-unsafe-call,
    @typescript-eslint/no-unsafe-return
     */
    get (...keys: K): V | undefined {
        let item = this.map;
        for (let i = 0; i < keys.length; i++) {
            item = (item as any).get(keys[i]);
            if (typeof item === 'undefined') return undefined;
        }
        return item as (V | undefined);
    }

    set (value: V, ...keys: K): this {
        let nextMap: any = this.map;
        for (let i = 0; i < keys.length - 1; i++) {
            const prevMap = nextMap;
            nextMap = nextMap.get(keys[i]);
            if (typeof nextMap === 'undefined') {
                nextMap = new Map();
                prevMap.set(keys[i], nextMap);
            }
        }
        nextMap.set(keys[keys.length - 1], value);
        return this;
    }

    delete<T extends unknown[]> (...keys: K extends [...T, ...unknown[]] ? T : never): boolean {
        let highestParent = null;
        let childKey = null;
        let item = this.map;
        for (let i = 0; i < keys.length - 1; i++) {
            if (item.size === 1) {
                if (highestParent === null) {
                    highestParent = item;
                    childKey = keys[i];
                }
            } else {
                highestParent = null;
            }
            item = (item as any).get(keys[i]);
            if (typeof item === 'undefined') return false;
        }
        const didDelete = item.delete(keys[keys.length - 1]);
        if (highestParent && didDelete) {
            highestParent.delete(childKey);
        }
        return didDelete;
    }

    clear (): void {
        this.map.clear();
    }

    has<T extends unknown[]> (...keys: K extends [...T, ...unknown[]] ? T : never): boolean {
        let item = this.map;
        for (let i = 0; i < keys.length - 1; i++) {
            item = (item as any).get(keys[i]);
            if (typeof item === 'undefined') return false;
        }
        return item.has(keys[keys.length - 1]);
    }

    submap<T extends unknown[]> (
        ...keys: K extends [...T, ...unknown[]] ? T : never):
        (K extends [...T, ...infer Rem] ? MapKeyTuple<Rem, V> : never) | undefined {
        let item = this.map;
        for (let i = 0; i < keys.length; i++) {
            item = (item as any).get(keys[i]);
            if (typeof item === 'undefined') return undefined;
        }
        return item as any;
    }

    /* eslint-enable
    @typescript-eslint/no-explicit-any,
    @typescript-eslint/no-unsafe-assignment,
    @typescript-eslint/no-unsafe-member-access,
    @typescript-eslint/no-unsafe-call,
    @typescript-eslint/no-unsafe-return
     */
}
