import {readdir, unlink, readFile, writeFile} from 'fs/promises';
import {resolve} from 'path';
import {schema} from 'avsc';
import {format, Options} from 'prettier';

import {fullSchemaToTypescript, resolveImports} from './av2ts';

const PRETTIER_OPTIONS: Options = {
    printWidth: 60,
    tabWidth: 4,
    singleQuote: true,
    bracketSpacing: false
};

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
        const result = fullSchemaToTypescript(schema, {uuid: 'string'});
        partialResults.push({result, filename: schemaName.replace(/\.json$/, '.ts')});
    }

    const fullResults = resolveImports(partialResults);
    await Promise.all(fullResults.map(result => {
        const formattedCode = format(result.code, {
            parser: 'typescript',
            ...PRETTIER_OPTIONS
        });
        return writeFile(resolve(dirPath, result.filename), formattedCode, 'utf-8');
    }));
};

void main();
