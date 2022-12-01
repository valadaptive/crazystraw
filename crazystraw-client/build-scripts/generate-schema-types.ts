import {readdir, unlink, readFile, writeFile} from 'fs/promises';
import {resolve} from 'path';
import {schema} from 'avsc';
import {format, Options} from 'prettier';
import {ESLint} from 'eslint';

import {fullSchemaToTypescript, resolveImports} from './av2ts';

const PRETTIER_OPTIONS: Options = {
    printWidth: 60,
    tabWidth: 4,
    singleQuote: true,
    bracketSpacing: false,
    trailingComma: 'none'
};

const eslint = new ESLint({fix: true});

const main = async (): Promise<void> => {
    const dirPath = resolve(__dirname, '../src/schemas');
    const listing = await readdir(dirPath);

    // Delete previous .ts files
    await Promise.all(listing.filter(file => file.endsWith('.ts')).map(file => unlink(resolve(dirPath, file))));

    const schemas = listing.filter(file => file.endsWith('.json'));
    const partialResults = [];
    for (const schemaName of schemas) {
        const json = await readFile(resolve(dirPath, schemaName), 'utf-8');
        const schema = await JSON.parse(json) as schema.AvroSchema;
        const result = fullSchemaToTypescript(schema, {uid: 'string'});
        partialResults.push({result, filename: schemaName.replace(/\.json$/, '.ts')});
    }

    const fullResults = resolveImports(partialResults);
    await Promise.all(fullResults.map(async result => {
        const formattedCode = format(result.code, {
            parser: 'typescript',
            ...PRETTIER_OPTIONS
        });
        const resultPath = resolve(dirPath, result.filename);
        await writeFile(resultPath, formattedCode, 'utf-8');
        const linted = (await eslint.lintFiles([resultPath]))[0];
        if (linted.output) {
            await writeFile(resultPath, linted.output, 'utf-8');
        }
    }));
};

void main();
