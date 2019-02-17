import * as test from 'tape';
import { createSourceFile, ScriptTarget, SourceFile } from 'typescript/lib/typescript';

import Parser from '../parser';

test('number arrays union test', t => {
    t.plan(4);

    const a1 = [1, 2, 3];
    const a2 = [2, 3, 4];
    const formatted1 = JSON.stringify(a1);
    const formatted2 = JSON.stringify(a2);
    const union = 'type W = [ 1, 2, 3] | [2, 3, 4 ]';

    const sourceFile: SourceFile = createSourceFile('x.ts', union, ScriptTarget.ES5);
    const decs = new Parser().findTypeDeclarations(sourceFile);

    t.equal(decs.length, 1, 'total decalarations found should be one');

    const dec = decs[0];
    t.deepEqual(dec.get(), a1, `first get() should return ${formatted1}`);
    t.deepEqual(dec.get(), a2, `second get() should return ${formatted2}`);
    t.deepEqual(dec.get(), a1, `third get() should return ${formatted1}`);
});

test('string arrays union test', t => {
    t.plan(4);

    const a1 = ["1", "2", "3"];
    const a2 = ["2", "3", "4"];
    const formatted1 = JSON.stringify(a1);
    const formatted2 = JSON.stringify(a2);
    const union = 'type W = [ "1", "2", "3"] | ["2", "3", "4" ]';

    const sourceFile: SourceFile = createSourceFile('x.ts', union, ScriptTarget.ES5);
    const decs = new Parser().findTypeDeclarations(sourceFile);

    t.equal(decs.length, 1, 'total decalarations found should be one');

    const dec = decs[0];
    t.deepEqual(dec.get(), a1, `first get() should return ${formatted1}`);
    t.deepEqual(dec.get(), a2, `second get() should return ${formatted2}`);
    t.deepEqual(dec.get(), a1, `third get() should return ${formatted1}`);
});