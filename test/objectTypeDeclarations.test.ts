import * as test from 'tape';
import { createSourceFile, ScriptTarget } from 'typescript/lib/typescript';

import Parser from '../src/parser';
import { getArrayGenerator, getOptionalGetter, getStringGenerator, getNumberGenerator, getBooleanGenerator } from '../src/literalGenerator';

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

 test('should be able to parse optional types', t => {
    t.plan(5);
    const typeDeclaration = `
        interface INTERFACE {
            a?: boolean;
            b?: string;
            c?: object;
            d?: string[];
        }
    `;
    const out = createSourceFile('x.ts', typeDeclaration, ScriptTarget.ES5);
    const parser = new Parser();
    const decs = parser.findTypeDeclarations(out);

    const boolGen = getOptionalGetter(getBooleanGenerator());
    const stringGen = getOptionalGetter(getStringGenerator('INTERFACEb'));
    const arrayStringGen = getOptionalGetter(getArrayGenerator(getStringGenerator('INTERFACEd')));
    const objectGen = getOptionalGetter(() => ({}));
    const actualGenerator = () => ({
        a: boolGen(),
        b: stringGen(),
        c: objectGen(),
        d: arrayStringGen(),
    });

    t.equals(decs.length, 1, "Should find 1 declaration");
    actualGenerator();
    t.deepEquals(parser.typeMap.INTERFACE(), {}, "Should be all empty");
    t.deepEquals(parser.typeMap.INTERFACE(), actualGenerator(), "Should be the same");
    actualGenerator();
    t.deepEquals(parser.typeMap.INTERFACE(), {}, "Should be all empty");
    t.deepEquals(parser.typeMap.INTERFACE(), actualGenerator(), "Should be the same");
 });