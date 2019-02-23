import * as path from 'path';
import * as glob from 'glob';
import { readFile, writeFile, exists, mkdirSync } from 'fs';
import Parser from './parser';

type File = {
    name: string;
    content: string;
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

function generateComponentFromParsedExports(parsedExports: Parser): string | undefined {
    if (parsedExports.defaultReactExport) {
        const { name, props } = parsedExports.defaultReactExport;
        // TODO should probably be more careful with stringify
        return `React.createElement('${name}', ${JSON.stringify(props())})`;
    }
    return;
}

function generateUIScript(filePattern: string): Promise<string> {
    return getFileContents(filePattern)
    .then((files: File[]) => {
        const componentRenderingLogic = files.map((file: File) => {
            const exports = parseExports(file);
            return generateComponentFromParsedExports(exports);
        }).filter(x => !!x).join(', ');
        const parentRenderer = `ReactDOM.render(React.createElement(\'div\', {}, [${componentRenderingLogic}]), document.getElementById(\'main\'));`;
        const reactImportStatement = 'import React from \'react\';\nimport ReactDOM from \'react-dom\';\n';
        return `${reactImportStatement}${parentRenderer}`;
    })
    .catch((error: any) => {
        console.error(`Something went wrong while generateing the UI script. error: ${error}`);
        return error;
    });
}

generateUIScript('test/*.tsx')
.then(script => {
    writeFile('./out/main.js', script, 'utf8', error => {
        if (error) {
            Promise.reject(error);
        }
    });
})
.catch((error: any) => {
    console.error(error);
});