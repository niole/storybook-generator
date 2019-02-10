import * as test from 'tape';
import { createSourceFile, ScriptTarget, SourceFile } from 'typescript/lib/typescript';

import { findTypeDeclarations } from '../parser';

test('integer union test', t => {
    t.plan(6);

    const stringUnion = `type Name = 1 | 2 | 3;`;
    const sourceFile: SourceFile = createSourceFile('x.ts', stringUnion, ScriptTarget.ES5);
    const decs = findTypeDeclarations(sourceFile);

    t.equal(decs.length, 1, 'total decalarations found should be one');

    const dec = decs[0];

    t.equal(decs.length, 1, 'total decalarations found should be one');
    t.equal(dec.get(), 1, 'first get() should return 1');
    t.equal(dec.get(), 2, 'second get() should return 2');
    t.equal(dec.get(), 3, 'third get() should return 3');
    t.equal(dec.get(), 1, 'fourth get() should return 1');
});