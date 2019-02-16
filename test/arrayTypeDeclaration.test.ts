import * as test from 'tape';
import { createSourceFile, ScriptTarget } from 'typescript/lib/typescript';

import { 
    getUnionTypeGetter,
    getBooleanGenerator,
    getStringGenerator,
    getNumberGenerator,
    getArrayGenerator,
} from '../literalGenerator';
import { findTypeDeclarations } from '../parser';

/**
 * array type declarations are hard because arrays have variable length
 * what is the most useful set of lengths for a frontend?
 * super short, super long, medium length, no length
 * 0, 3, 10, 100
 */

test('array generation array length', t => {
    t.plan(6);
    const numberArrayType = `type NumberArray = number[];`;
    const source = createSourceFile('x.ts', numberArrayType, ScriptTarget.ES5);
    const foundTypeDeclarations = findTypeDeclarations(source);

    t.equals(foundTypeDeclarations.length, 1);
    t.deepEquals(foundTypeDeclarations[0].get(), [], "First get should return an array of no length");
    t.equals(foundTypeDeclarations[0].get().length, 3, "Second get should return an array of length 3");
    t.equals(foundTypeDeclarations[0].get().length, 10, "Third get should return an array of length 10");
    t.equals(foundTypeDeclarations[0].get().length, 100, "Fourth get should return an array of length 100");
    t.deepEquals(foundTypeDeclarations[0].get(), [], "Fifth get should return an array of no length");
});

test('number array generation', t => {
    t.plan(6);
    const numberArrayType = `type NumberArray = number[];`;
    const source = createSourceFile('x.ts', numberArrayType, ScriptTarget.ES5);
    const foundTypeDeclarations = findTypeDeclarations(source);

    const arrayGenerator = getArrayGenerator(getNumberGenerator('NumberArray'));

    t.equals(foundTypeDeclarations.length, 1);
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "First generation should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Second should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Third should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Fourth should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Fifth should be correct");
});

test('string array generation', t => {
    t.plan(6);
    const stringArrayType = `type StringArray = string[];`;
    const source = createSourceFile('x.ts', stringArrayType, ScriptTarget.ES5);
    const foundTypeDeclarations = findTypeDeclarations(source);

    const arrayGenerator = getArrayGenerator(getStringGenerator('StringArray'));

    t.equals(foundTypeDeclarations.length, 1);
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "First generation should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Second should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Third should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Fourth should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Fifth should be correct");
});

test('boolean array generation', t => {
    t.plan(6);
    const booleanArrayType = `type BooleanArray = boolean[];`;
    const source = createSourceFile('x.ts', booleanArrayType, ScriptTarget.ES5);
    const foundTypeDeclarations = findTypeDeclarations(source);

    const arrayGenerator = getArrayGenerator(getBooleanGenerator());

    t.equals(foundTypeDeclarations.length, 1);
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "First generation should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Second should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Third should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Fourth should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Fifth should be correct");
});

test('object array generation', t => {
    t.plan(6);
    const numberArrayType = `type Array = { num: number; bool: boolean; obj: { cats: [1,2,3]; dogs: 'lab' | 'collie' | 'shitzu' }}[];`;
    const source = createSourceFile('x.ts', numberArrayType, ScriptTarget.ES5);
    const foundTypeDeclarations = findTypeDeclarations(source);

    const numGenerator = getNumberGenerator('Arraynum');
    const boolGenerator = getBooleanGenerator();
    const dogsGetter = getUnionTypeGetter([() => 'lab', () => 'collie', () => 'shitzu']);
    const internalObjectGenerator = () => ({
        cats: [1,2,3],
        dogs: dogsGetter(),
    });
    const objectGenerator = () => ({
        num: numGenerator(),
        bool: boolGenerator(),
        obj: internalObjectGenerator(),
    });
    const arrayGenerator = getArrayGenerator(objectGenerator);

    t.equals(foundTypeDeclarations.length, 1);
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "First generation should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Second should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Third should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Fourth should be correct");
    t.deepEquals(foundTypeDeclarations[0].get(), arrayGenerator(), "Fifth should be correct");
});