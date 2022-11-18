declare module '*.svg' {
    const url: string;
    export default url;
}

declare module '*.scss' {
    const content: Record<string, string>;
    export default content;
}
