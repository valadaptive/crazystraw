import {schema, Schema, Type} from 'avsc';

const WRAP_UNIONS = true;

type DefSchema = {name: string, schema: schema.DefinedType, deps: string[], logicalType?: string};

type Context = {
    logicalTypes: Partial<Record<string, string>>,
    dst: string,
    referencedTypes: Set<string>,
    definedTypes: Set<string>,
    depsScratch: string[],
    referencedLogicalTypes: Set<string>,
    defSchemas: DefSchema[]
};

const getBranchName = (type: schema.DefinedType): string => {
    if (typeof type === 'string') return type;
    if ('name' in type && typeof type.name === 'string') return type.name;
    return type.type;
};

const unionToTypescript = (types: schema.DefinedType[], ctx: Context): string => {
    const unionMember = (type: schema.DefinedType): string => {
        const convertedType = avroTypeToTypescript(type, ctx);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!WRAP_UNIONS || convertedType === 'null') return convertedType;
        return `{${getBranchName(type)}: ${convertedType}}`;
    };
    return types.map(type => unionMember(type)).join(' | ');
};

const schemaToTypescript = (schema: schema.AvroSchema, ctx: Context): string => {
    if (Array.isArray(schema)) {
        return unionToTypescript(schema, ctx);
    }
    return avroTypeToTypescript(schema, ctx);
};

type SchemaResult = {
    generatedCode: string,
    schema: schema.AvroSchema,
    referencedTypes: Set<string>,
    definedTypes: Set<string>,
    depsScratch: string[],
    referencedLogicalTypes: Set<string>,
    defSchemas: DefSchema[]
};

const fullSchemaToTypescript = (
    schema: schema.AvroSchema,
    logicalTypes: Partial<Record<string, string>>)
: SchemaResult => {
    const ctx: Context = {
        logicalTypes,
        dst: '',
        referencedTypes: new Set(),
        definedTypes: new Set(),
        depsScratch: [],
        referencedLogicalTypes: new Set(),
        defSchemas: []
    };
    schemaToTypescript(schema, ctx);
    return {
        generatedCode: ctx.dst,
        schema,
        referencedTypes: ctx.referencedTypes,
        definedTypes: ctx.definedTypes,
        depsScratch: [],
        referencedLogicalTypes: ctx.referencedLogicalTypes,
        defSchemas: ctx.defSchemas
    };
};

const resolveImports = (schemas: {result: SchemaResult, filename: string}[]): {
    code: string,
    filename: string
}[] => {
    const processed = [];
    const avroPrefix = (str: string): string => 'Avro' + str.replace(/^[a-z]/, v => v.toUpperCase());
    const logicalPrefix = (str: string): string => 'Logical' + str.replace(/^[a-z]/, v => v.toUpperCase());
    for (const schema of schemas) {
        const importMap = new Map<string, Set<string>>();
        for (const referencedType of schema.result.referencedTypes.values()) {
            const typeFiles = schemas.filter(otherSchema => otherSchema.result.definedTypes.has(referencedType));
            if (typeFiles.length > 1) throw new Error(`Type "${referencedType}" defined in multiple schemas: ${typeFiles.map(schema => schema.filename).join(', ')}`);
            if (typeFiles.length === 0) throw new Error(`Type ${referencedType} not defined in any files (in ${schema.filename})`);
            const typeFilename = typeFiles[0].filename;
            if (typeFilename === schema.filename) continue;
            let importsFromFile = importMap.get(typeFilename);
            if (!importsFromFile) {
                importsFromFile = new Set();
                importMap.set(typeFilename, importsFromFile);
            }
            importsFromFile.add(referencedType);
        }
        const importsArr = [];
        for (const [filename, imports] of importMap.entries()) {
            const fileImports = Array.from(imports).sort();
            for (let i = 0, len = fileImports.length; i < len; i++) {
                fileImports.push(avroPrefix(fileImports[i]));
            }
            importsArr.push({filename, imports: fileImports});
        }
        importsArr.sort((a, b) => a.filename.localeCompare(b.filename, 'en-US'));

        const importsHeader = importsArr.map(({filename, imports}) => `import {${imports.join(', ')}} from './${filename.replace(/\.[a-zA-Z]+$/, '')}';`).join('\n');

        const schemaExports = [];
        for (const {name, schema: typeSchema, deps, logicalType} of schema.result.defSchemas) {
            const registry: string[] = [];
            for (const dep of deps) {
                registry.push(`${dep}: ${avroPrefix(dep)}`);
            }
            const registryOption = registry.length ? `, registry: {${registry.join(', ')}}` : '';
            const logicalRegistryOption = logicalType ? `, logicalTypes: {${logicalType}: ${logicalPrefix(logicalType)}}` : '';
            const schemaExport = `export const ${avroPrefix(name)} = Type.forSchema(${JSON.stringify(typeSchema)}, {wrapUnions: ${String(WRAP_UNIONS)}${registryOption}${logicalRegistryOption}})`;
            schemaExports.push(schemaExport);
        }
        const typeImport = schemaExports.length > 0 ? "import {Type} from 'avsc';\n\n" : '';

        const logicalTypesArr = Array.from(schema.result.referencedLogicalTypes).sort()
            .map(t => logicalPrefix(t));
        const logicalTypeReExports = logicalTypesArr.length > 0 ? `import {${logicalTypesArr.join(', ')}} from '../util/logical-types';\n\n` : '';

        processed.push({code: `${typeImport}${importsHeader}\n\n${logicalTypeReExports}${schema.result.generatedCode}\n\n${schemaExports.join('\n\n')}`, filename: schema.filename});
    }
    return processed;
};

const primitiveToTypescript = (type: string): string | null => {
    switch (type) {
        case 'long':
        case 'int':
        case 'double':
        case 'float':
            return 'number';
        case 'bytes':
            return 'Buffer';
        case 'null':
        case 'boolean':
        case 'string':
            return type;
        default:
            return null;
    }
};

const fieldToTypescript = (field: {name: string, type: Schema}, ctx: Context): string => {
    if (field.type instanceof Type) throw new Error('avro.Type not supported');
    return `${field.name}: ${schemaToTypescript(field.type, ctx)};`;
};

const arrayToTypescript = (arr: schema.ArrayType, ctx: Context): string => {
    if (arr.items instanceof Type) throw new Error('avro.Type not supported');
    return `(${schemaToTypescript(arr.items, ctx)})[]`;
};

const mapToTypescript = (map: schema.MapType, ctx: Context): string => {
    if (map.values instanceof Type) throw new Error('avro.Type not supported');
    return `Partial<Record<string, ${schemaToTypescript(map.values, ctx)}>>`;
};

const fixedToTypescript = (avroType: schema.FixedType, ctx: Context): string => {
    ctx.dst += `export type ${avroType.name} = ArrayBuffer;\n\n`;
    ctx.definedTypes.add(avroType.name);
    ctx.defSchemas.push({name: avroType.name, schema: avroType, deps: []});
    return avroType.name;
};

const recordToTypescript = (avroType: schema.RecordType, ctx: Context): string => {
    // track direct dependencies only
    const oldDeps = ctx.depsScratch;
    ctx.depsScratch = [];
    const fields = avroType.fields.map(field => fieldToTypescript(field, ctx));
    ctx.dst += `export type ${avroType.name} = {${fields.join('\n')}};\n\n`;
    ctx.definedTypes.add(avroType.name);
    ctx.defSchemas.push({name: avroType.name, schema: avroType, deps: ctx.depsScratch});
    ctx.depsScratch = oldDeps;
    return avroType.name;
};

const enumToTypescript = (avroType: schema.EnumType, ctx: Context): string => {
    ctx.dst += `export enum ${avroType.name} {${avroType.symbols.join(',\n')}}\n\n`;
    ctx.definedTypes.add(avroType.name);
    ctx.defSchemas.push({name: avroType.name, schema: avroType, deps: []});
    return avroType.name;
};

const avroTypeToTypescript = (avroType: schema.DefinedType, ctx: Context): string => {
    if (typeof avroType === 'string') {
        const primitive = primitiveToTypescript(avroType);
        if (primitive) return primitive;
        ctx.referencedTypes.add(avroType);
        ctx.depsScratch.push(avroType);
        return avroType;
    }

    if ('logicalType' in avroType) {
        const mappedLogicalType = ctx.logicalTypes[avroType.logicalType];
        if (!mappedLogicalType) throw new Error(`No logical type mapped for ${avroType.logicalType}`);
        if ('name' in avroType && typeof avroType.name === 'string') {
            ctx.dst += `export type ${avroType.name} = ${mappedLogicalType};\n\n`;
            ctx.definedTypes.add(avroType.name);
            ctx.referencedLogicalTypes.add(avroType.name);
            ctx.defSchemas.push({
                name: avroType.name,
                schema: avroType,
                deps: ctx.depsScratch,
                logicalType: avroType.logicalType
            });
        }
        return mappedLogicalType;
    }

    const type = avroType.type;

    if (type === 'record' || type === 'error') {
        return recordToTypescript(avroType, ctx);
    }

    if (type === 'enum') {
        return enumToTypescript(avroType, ctx);
    }

    if (type === 'array') {
        return arrayToTypescript(avroType, ctx);
    }

    if (type === 'map') {
        return mapToTypescript(avroType, ctx);
    }

    if (type === 'fixed') {
        return fixedToTypescript(avroType, ctx);
    }

    return type;
};

export {fullSchemaToTypescript, resolveImports};
