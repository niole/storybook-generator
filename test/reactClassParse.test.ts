import * as test from 'tape';

import Parser from '../src/parser';
import { getStringGenerator, getNumberGenerator } from '../src/literalGenerator';

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

 test('should be able to get react function elements non default export', t => {
     t.plan(1);
     const fileContents = `
         interface Props {
             name: string;
             date: number;
         }
         export const Component: React.SFC<Props> = props => <div {...props} />;
     `;
     const parser = Parser.build('x.tsx', fileContents);
     t.equals(parser.reactExports.length, 1, "Should find react component");
 });

 test('should be able to get react function elements with default export inlined type', t => {
     t.plan(1);
     const fileContents = `
         const Component: React.SFC<{ name: string; }> = ({ name }) => (
             <div>{name}</div>
         );
         export default Component;
     `;
     const parser = Parser.build('x.tsx', fileContents);
     t.equals(parser.reactExports.length, 1, "Should find react component");
 });