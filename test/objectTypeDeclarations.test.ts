import * as test from 'tape';
import { createSourceFile, ScriptTarget, SourceFile } from 'typescript/lib/typescript';

import Parser from '../parser';
import { getStringGenerator, getNumberGenerator, getBooleanGenerator } from '../literalGenerator';

test('should be able to parse single depth type declaration objects', t => {
    t.plan(2);
    const typeDeclaration = `
        type DeclarationName = {
            xyz: string;
            Z: boolean; abc: number;
        };
    `;
    const out = createSourceFile('x.ts', typeDeclaration, ScriptTarget.ES5);
    const generators = new Parser().findTypeDeclarations(out);

    const xyzGenerator = getStringGenerator('DeclarationNamexyz');
    const ZGenerator = getBooleanGenerator();
    const abcGenerator = getNumberGenerator('DeclarationNameabc');

    const expected = {
        xyz: xyzGenerator(),
        Z: ZGenerator(),
        abc: abcGenerator(),
    };

    t.equals(generators.length, 1, 'should find one generator');

    t.deepEquals(generators[0].get(), expected, `should equal ${JSON.stringify(expected)}`);
});

 test('should be able to parse multi depth type declaration objects', t => {
     t.plan(2);
     const typeDeclaration = `
         type DeclarationName = {
             xyz: {
                 TTT: string;
                 catsz: object;
             };
             Z: boolean; abc: number;
         };
     `;
     const out = createSourceFile('x.ts', typeDeclaration, ScriptTarget.ES5);
     const generators = new Parser().findTypeDeclarations(out);
 
     const xyzGenerator = {
        TTT: getStringGenerator('DeclarationNamexyzTTT')(),
        catsz: {},
     };
     const ZGenerator = getBooleanGenerator();
     const abcGenerator = getNumberGenerator('DeclarationNameabc');
 
     const expected = {
         xyz: xyzGenerator,
         Z: ZGenerator(),
         abc: abcGenerator(),
     };
 
     t.equals(generators.length, 1, 'should find one generator');
 
     t.deepEquals(generators[0].get(), expected, `should equal ${JSON.stringify(expected)}`);
 });