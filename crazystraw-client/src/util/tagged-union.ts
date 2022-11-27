// Distribute over union members
// https://stackoverflow.com/a/51691257
export type TaggedUnion<
    Enum extends string | number | symbol,
    T extends {[K in Enum]: unknown}
> = Enum extends unknown ? {type: Enum} & T[Enum] : never;
