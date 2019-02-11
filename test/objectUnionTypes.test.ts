import * as test from 'tape';
import { createSourceFile, ScriptTarget, SourceFile } from 'typescript/lib/typescript';

import { findTypeDeclarations } from '../parser';

test('unnamed object with numbers union test', t => {
    t.plan(4);

    const union = 'type W = { x: 1, y: 1, } | { x: 2, y: 2 };';

    const sourceFile: SourceFile = createSourceFile('x.ts', union, ScriptTarget.ES5);
    const decs = findTypeDeclarations(sourceFile);

    t.equal(decs.length, 1, 'total decalarations found should be one');

    const dec = decs[0];

    const firstObject = { x: 1, y: 1, };
    const secondObject = { x: 2, y: 2 };
    const fomattedFirstObject = JSON.stringify(firstObject);
    t.deepEqual(dec.get(), firstObject, `first get() should return ${fomattedFirstObject}`);
    t.deepEqual(dec.get(), secondObject, `second get() should return ${JSON.stringify(secondObject)}`);
    t.deepEqual(dec.get(), firstObject, `third get() should return ${fomattedFirstObject}`);
});

test('unnamed object with numbers and strings union test', t => {
    t.plan(4);

    const firstObject = { x: 1, y: "1", };
    const secondObject = { x: 2, y: "2" };
    const fomattedFirstObject = JSON.stringify(firstObject);
    const union = 'type W = { x: 1, y: "1", } | { x: 2, y: "2" };';

    const sourceFile: SourceFile = createSourceFile('x.ts', union, ScriptTarget.ES5);
    const decs = findTypeDeclarations(sourceFile);

    t.equal(decs.length, 1, 'total decalarations found should be one');

    const dec = decs[0];

    t.deepEqual(dec.get(), firstObject, `first get() should return ${fomattedFirstObject}`);
    t.deepEqual(dec.get(), secondObject, `second get() should return ${JSON.stringify(secondObject)}`);
    t.deepEqual(dec.get(), firstObject, `third get() should return ${fomattedFirstObject}`);
});

test('number arrays union test', t => {
    t.plan(4);

    const a1 = [1, 2, 3];
    const a2 = [2, 3, 4];
    const formatted1 = JSON.stringify(a1);
    const formatted2 = JSON.stringify(a2);
    const union = 'type W = [ 1, 2, 3] | [2, 3, 4 ]';

    const sourceFile: SourceFile = createSourceFile('x.ts', union, ScriptTarget.ES5);
    const decs = findTypeDeclarations(sourceFile);

    t.equal(decs.length, 1, 'total decalarations found should be one');

    const dec = decs[0];
    t.deepEqual(dec.get(), a1, `first get() should return ${formatted1}`);
    t.deepEqual(dec.get(), a2, `second get() should return ${formatted2}`);
    t.deepEqual(dec.get(), a1, `third get() should return ${formatted1}`);
});