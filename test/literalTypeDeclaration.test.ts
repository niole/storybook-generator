import * as test from 'tape';
import { createSourceFile, ScriptTarget, SourceFile } from 'typescript/lib/typescript';

import Parser from '../parser';

test('string literal type declaration test', t => {
    t.plan(3);
    const typeDeclaration = 'type Name = "hello"';
    const out = createSourceFile('x.ts', typeDeclaration, ScriptTarget.ES5);

    const parse = new Parser().findTypeDeclarations(out);
    t.equals(parse.length, 1, 'Should find one type decalaration');
    t.equals(parse[0].identifier, 'Name', 'Identifier should be "Name"');
    t.equals(parse[0].get(), 'hello', 'Should always return "hello" from get');
});

test('number literal type declaration test', t => {
    t.plan(2);
    const typeDeclaration = 'type Name = 900.0';
    const out = createSourceFile('x.ts', typeDeclaration, ScriptTarget.ES5);

    const parse = new Parser().findTypeDeclarations(out);
    t.equals(parse.length, 1, 'Should find one type decalaration');
    t.equals(parse[0].get(), 900.0, 'Should always return 900.0 from get');
});

test('array literal type declaration test', t => {
    t.plan(2);
    const typeDeclaration = 'type Name = [1,2,3 , 4 ]';
    const out = createSourceFile('x.ts', typeDeclaration, ScriptTarget.ES5);

    const parse = new Parser().findTypeDeclarations(out);
    t.equals(parse.length, 1, 'Should find one type decalaration');
    t.deepEquals(parse[0].get(), [1,2,3,4], 'Should always return [1,2,3,4] from get');
});

test('nested arrays literal type declaration test', t => {
    t.plan(2);
    const typeDeclaration = 'type Name = [[ 1],[2],[3] , [ 4 ] ]';
    const out = createSourceFile('x.ts', typeDeclaration, ScriptTarget.ES5);

    const parse = new Parser().findTypeDeclarations(out);
    t.equals(parse.length, 1, 'Should find one type decalaration');
    t.deepEquals(parse[0].get(), [[1],[2],[3],[4]], 'Should always return [[1],[2],[3],[4]] from get');
});

test('nested array with objects literal type declaration test', t => {
    t.plan(2);
    const typeDeclaration = 'type Name = [{x: 1},{x:2},{x:3} , {x: 4 } ]';
    const out = createSourceFile('x.ts', typeDeclaration, ScriptTarget.ES5);

    const parse = new Parser().findTypeDeclarations(out);
    t.equals(parse.length, 1, 'Should find one type decalaration');
    t.deepEquals(parse[0].get(), [{x: 1},{x:2},{x:3} , {x: 4 } ], 'Should always return [{x: 1},{x:2},{x:3} , {x: 4 } ] from get');
});

test('object literal type declaration test', t => {
    t.plan(2);
    const expected = { cat: 1, dog: "2", horse: { hay: "hey" }, rat: ["a", "b"]};
    const typeDeclaration = 'type Name = { cat: 1, dog: "2", horse: { hay: "hey" }, rat: ["a", "b"]};';
    const out = createSourceFile('x.ts', typeDeclaration, ScriptTarget.ES5);

    const parse = new Parser().findTypeDeclarations(out);
    t.equals(parse.length, 1, 'Should find one type decalaration');
    t.deepEquals(parse[0].get(), expected, `Should always return ${JSON.stringify(expected)} from get`);
});