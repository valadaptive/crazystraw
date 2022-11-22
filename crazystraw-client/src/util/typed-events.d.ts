declare class TypedEventTarget<T extends TypedEvent<string>> {
    addEventListener<K extends T['type']>(
        type: K,
        callback: (event: Extract<T, {type: K}>) => unknown,
        options?: AddEventListenerOptions | boolean
    ): void;
    dispatchEvent(event: T): boolean;
    /** Removes the event listener in target's event listener list with the same type, callback, and options. */
    removeEventListener<K extends T['type']>(
        type: K,
        callback: (event: Extract<T, {type: K}>) => unknown,
        options?: EventListenerOptions | boolean
    ): void;
}

declare class TypedEvent<T extends string> extends Event {
    readonly type: T;
    constructor(type: T, eventInitDict?: EventInit);
}

export {TypedEventTarget, TypedEvent};
