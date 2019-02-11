import * as objectHash from 'object-hash';

export function getStringGenerator(baseString: string): () => string {
    const seed = objectHash(baseString);
    let calls = -1;
    return () => {
        calls += 1;
        const endIndex = calls % seed.length;
        return seed.substr(0, endIndex) + seed.substr(endIndex, seed.length);
    };
}

export function getNumberGenerator(baseString: string): () => number {
    const seed = objectHash(baseString);
    let calls = -1;
    return () => {
        calls += 1;
        return seed.charCodeAt(calls % seed.length);
    };
}

export function getBooleanGenerator(): () => boolean {
    let calls = -1;
    return () => {
        calls += 1;
        return calls % 2 === 0;
    };
}