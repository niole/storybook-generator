import * as objectHash from 'object-hash';

export type ObjectGeneratorHelper = () => {} | any[];
export type KeywordGeneratorHelper = () => string | number | boolean | {} | null | undefined;

export function getStringGenerator(baseString: string): KeywordGeneratorHelper {
    const seed = objectHash(baseString);
    let calls = -1;
    return () => {
        calls += 1;
        const endIndex = calls % seed.length;
        return seed.substr(0, endIndex) + seed.substr(endIndex, seed.length);
    };
}

export function getNumberGenerator(baseString: string): KeywordGeneratorHelper {
    const seed = objectHash(baseString);
    let calls = -1;
    return () => {
        calls += 1;
        return seed.charCodeAt(calls % seed.length);
    };
}

export function getBooleanGenerator(): KeywordGeneratorHelper {
    let calls = -1;
    return () => {
        calls += 1;
        return calls % 2 === 0;
    };
}

const arrayLengths = [0, 3, 10, 100];
export function getArrayGenerator(entryGenerator: ObjectGeneratorHelper): () => any[] {
    let calls = -1;
    return () => {
        calls += 1;
        return Array(arrayLengths[calls % arrayLengths.length])
        .fill(null)
        .map(() => entryGenerator());
    };
}

export function getUnionTypeGetter(literals: ObjectGeneratorHelper[]): () => any {
	let totalCalls = -1;
	return () => {
		totalCalls += 1;
		return literals[totalCalls % literals.length]();
	};
}