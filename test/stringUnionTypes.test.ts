import * as test from 'tape';
import { createSourceFile, ScriptTarget, SourceFile } from 'typescript/lib/typescript';

import { findTypeDeclarations } from '../parser';

test('string union test', t => {
    t.plan(5);

    const stringUnion = `type Name = 'a' | 'b' | 'c';`;
    const sourceFile: SourceFile = createSourceFile('x.ts', stringUnion, ScriptTarget.ES5);
    const decs = findTypeDeclarations(sourceFile);

    t.equal(decs.length, 1, 'total decalarations found should be one');

    const dec = decs[0];

    t.equal(dec.get(), 'a', 'first get() should return \'a\'');
    t.equal(dec.get(), 'b', 'second get() should return \'b\'');
    t.equal(dec.get(), 'c', 'third get() should return \'c\'');
    t.equal(dec.get(), 'a', 'fourth get() should return \'a\'');
});