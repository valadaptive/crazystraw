const toError = (error: unknown): Error => error instanceof Error ? error : new Error(String(error));

export default toError;
