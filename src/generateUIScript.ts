import * as path from 'path';
import * as glob from 'glob';
import { readFile, writeFile, exists, mkdirSync } from 'fs';
import Parser from './parser';

const typescriptExtTest = /\.tsx/;

const removeTSXEXT = (filePath: string) => filePath.replace(typescriptExtTest, '');

type File = {
    name: string;
    content: string;
};

type ImportSpecification = {
    filePath: string;
    content: string;
    componentName: string;
};

/**
 * 
 * @param filePattern string
 * @returns a promise of all files specified by the file pattern
 */
function getFileContents(filePattern: string): Promise<File[]> {
    return new Promise((resolve, reject) => {
        glob(filePattern, {}, (er, files) => {
            if (er !== null) {
                reject(`Could not get files. error: ${er}`);
            } else {
                const resolvedFiles: Promise<File>[] = files.map((fileName: string) => {
                    return new Promise((fileResolve, fileReject) => {
                        readFile(fileName, 'utf8', (err, fileContents) => {
                            if (err) {
                                fileReject(`Could not read file ${fileName}. error: ${err}`);
                            } else {
                                fileResolve({
                                    name: fileName,
                                    content: fileContents,
                                });
                            }
                        });
                    });
                });
                resolve(Promise.all(resolvedFiles));
            }
        });
    });
}

function parseExports(file: File): Parser {
    return Parser.build(file.name, file.content);
}

function generateComponentFromParsedExports(parsedExports: Parser): { renderingLogic: string; componentName: string; } | undefined {
    if (parsedExports.defaultReactExport) {
        const { name, props } = parsedExports.defaultReactExport;
        // TODO should probably be more careful with stringify
        return {
            renderingLogic: `
                <div>
                    <h2>${name}</h2>
                    <div>
                        <${name} {...${JSON.stringify(props())}} />
                        <${name} {...${JSON.stringify(props())}} />
                        <${name} {...${JSON.stringify(props())}} />
                        <${name} {...${JSON.stringify(props())}} />
                    </div>
                </div>
            `,
            componentName: name,
        };
    }
    return;
}

function generateUIScript(filePattern: string): Promise<string> {
    return getFileContents(filePattern)
    .then((files: File[]) => {
        const componentSpecs: ImportSpecification[] = files.map((file: File) => {
            const exports: Parser = parseExports(file);
            const componentRenderingLogic = generateComponentFromParsedExports(exports);
            if (componentRenderingLogic) {
                return {
                    filePath: removeTSXEXT(file.name),
                    content: componentRenderingLogic.renderingLogic,
                    componentName: componentRenderingLogic.componentName,
                };
            }
            return;
        }).filter(x => !!x);
        const { imports, renderingLogic } = componentSpecs.reduce((acc, nextSpec) => {
            // TODO will have to come up with scheme for relative path interpolation
            // from user bc not all files will be in my test dir lol
            // TODO also need to come up with a way to let users provide webpack and tsconfigs
            // for parsing and bundling their source files
            acc.imports.push(`import ${nextSpec.componentName} from '../${nextSpec.filePath}';\n`);
            acc.renderingLogic.push(nextSpec.content);
            return acc;
        }, { imports: [], renderingLogic: []});
        const componentRenderingLogic = renderingLogic.join(', ');
        const componentImportStatements = imports.join('');
        const parentRenderer = `ReactDOM.render(<div>{[${componentRenderingLogic}]}</div>, document.getElementById(\'main\'));`;
        const reactImportStatement = 'import * as React from \'react\';\nimport * as ReactDOM from \'react-dom\';\n';
        return `${componentImportStatements}${reactImportStatement}${parentRenderer}`;
    })
    .catch((error: any) => {
        console.error(`Something went wrong while generateing the UI script. error: ${error}`);
        return error;
    });
}

generateUIScript('test/*.tsx')
.then(script => {
    writeFile('./out/main.tsx', script, 'utf8', error => {
        if (error) {
            Promise.reject(error);
        }
    });
})
.catch((error: any) => {
    console.error(error);
});