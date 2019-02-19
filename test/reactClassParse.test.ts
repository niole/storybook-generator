import * as test from 'tape';
import { createSourceFile, ScriptTarget } from 'typescript/lib/typescript';

import Parser from '../parser';
import { getStringGenerator, getNumberGenerator } from '../literalGenerator';

test('should be able to get the react class default export', t => {
    t.plan(4);
    const fileContents = `
        interface Props {
            name: string;
            date: number;
        }
        export default class Component extends React.PureComponent<Props> {
            render() {
                return <div/>;
            }
        }
    `;
    const parser = Parser.build('x.ts', fileContents);

    const stringGen = getStringGenerator('Propsname');
    const numberGen = getNumberGenerator('Propsdate');
    const propGenerator = () => ({
        name: stringGen(),
        date: numberGen(),
    });

    t.ok(parser.defaultReactExport, "Should find a default export");
    t.deepEquals(parser.defaultReactExport!.props(), propGenerator(), "Should be equal");
    t.deepEquals(parser.defaultReactExport!.props(), propGenerator(), "Should be equal");
    t.deepEquals(parser.defaultReactExport!.props(), propGenerator(), "Should be equal");
});

test('should be able to get default react export that is not immediately assigned to export', t => {
    t.plan(4);
    const fileContents = `
        interface Props {
            name: string;
            date: number;
        }
        class Component extends React.PureComponent<Props> {
            render() {
                return <div/>;
            }
        }
        export default Component;
    `;
    const parser = Parser.build('x.ts', fileContents);

    const stringGen = getStringGenerator('Propsname');
    const numberGen = getNumberGenerator('Propsdate');
    const propGenerator = () => ({
        name: stringGen(),
        date: numberGen(),
    });

    t.ok(parser.defaultReactExport, "Should find a default export");
    t.deepEquals(parser.defaultReactExport!.props(), propGenerator(), "Should be equal");
    t.deepEquals(parser.defaultReactExport!.props(), propGenerator(), "Should be equal");
    t.deepEquals(parser.defaultReactExport!.props(), propGenerator(), "Should be equal");
});

 test('should be able to get react function elements', t => {
     t.plan(4);
     const fileContents = `
         interface Props {
             name: string;
             date: number;
         }
         const Component: React.SFC<Props> = props => <div {...props} />;
         export default Component;
     `;
     const parser = Parser.build('x.tsx', fileContents);
     const stringGen = getStringGenerator('Propsname');
     const numberGen = getNumberGenerator('Propsdate');
     const propGenerator = () => ({
         name: stringGen(),
         date: numberGen(),
     });
 
     t.ok(parser.defaultReactExport, "Should find a default export");
     t.deepEquals(parser.defaultReactExport!.props(), propGenerator(), "Should be equal");
     t.deepEquals(parser.defaultReactExport!.props(), propGenerator(), "Should be equal");
     t.deepEquals(parser.defaultReactExport!.props(), propGenerator(), "Should be equal");
 });