import * as test from 'tape';
import { createSourceFile, ScriptTarget, SourceFile } from 'typescript/lib/typescript';

import Parser from '../src/parser';

test('string union test', t => {
    t.plan(5);

    const stringUnion = `type Name = 'a' | 'b' | 'c';`;
    const sourceFile: SourceFile = createSourceFile('x.ts', stringUnion, ScriptTarget.ES5);
    const decs = new Parser().findTypeDeclarations(sourceFile);

    t.equal(decs.length, 1, 'total decalarations found should be one');

    const dec = decs[0];

    t.equal(dec.get(), 'a', 'first get() should return \'a\'');
    t.equal(dec.get(), 'b', 'second get() should return \'b\'');
    t.equal(dec.get(), 'c', 'third get() should return \'c\'');
    t.equal(dec.get(), 'a', 'fourth get() should return \'a\'');
});

test('string union referencing other types', t => {
    t.plan(5);
    const stringUnion = `
        type A = 'a';
        type B = 'b';
        type Name = A | B | C;
        type C = 'c';
    `;

    const source = createSourceFile('x.ts', stringUnion, ScriptTarget.ES5);
    const parser = new Parser();
    const declarations = parser.findTypeDeclarations(source);
    t.equal(declarations.length, 4, 'should get 4 declarations');
    t.equal(parser.typeMap.Name(), 'a', 'should get an "a" to start');
    t.equal(parser.typeMap.Name(), 'b', 'should get a "b"');
    t.equal(parser.typeMap.Name(), 'c', 'should get a "c"');
    t.equal(parser.typeMap.Name(), 'a', 'should get an "a"');
});