import {schema, Schema, Type} from 'avsc';

type Context = {
    logicalTypes: Partial<Record<string, string>>,
    dst: string,
    referencedTypes: Set<string>,
    definedTypes: Set<string>
};

const unionToTypescript = (types: schema.DefinedType[], ctx: Context): string => {
    return types.map(type => avroTypeToTypescript(type, ctx)).join(' | ');
};

const schemaToTypescript = (schema: schema.AvroSchema, ctx: Context): string => {
    if (Array.isArray(schema)) {
        return unionToTypescript(schema, ctx);
    }
    return avroTypeToTypescript(schema, ctx);
};

type SchemaResult = {
    generatedCode: string,
    referencedTypes: Set<string>,
    definedTypes: Set<string>
};

const fullSchemaToTypescript = (
    schema: schema.AvroSchema,
    logicalTypes: Partial<Record<string, string>>)
: SchemaResult => {
    const ctx: Context = {
        logicalTypes,
        dst: '',
        referencedTypes: new Set(),
        definedTypes: new Set()
    };
    schemaToTypescript(schema, ctx);
    return {
        generatedCode: ctx.dst,
        referencedTypes: ctx.referencedTypes,
        definedTypes: ctx.definedTypes
    };
};

const resolveImports = (schemas: {result: SchemaResult, filename: string}[]): {
    code: string,
    filename: string
}[] => {
    const processed = [];
    for (const schema of schemas) {
        const importMap = new Map<string, Set<string>>();
        for (const referencedType of schema.result.referencedTypes.values()) {
            const typeFiles = schemas.filter(otherSchema => otherSchema.result.definedTypes.has(referencedType));
            if (typeFiles.length > 1) throw new Error(`Type "${referencedType}" defined in multiple schemas: ${typeFiles.map(schema => schema.filename).join(', ')}`);
            if (typeFiles.length === 0) throw new Error(`Type ${referencedType} not defined in any files`);
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
            importsArr.push({filename, imports: Array.from(imports).sort()});
        }
        importsArr.sort((a, b) => a.filename.localeCompare(b.filename, 'en-US'));

        const importsHeader = importsArr.map(({filename, imports}) => `import {${imports.join(', ')}} from './${filename.replace(/\.[a-zA-Z]+$/, '')}';`).join('\n');
        processed.push({code: `${importsHeader}\n\n${schema.result.generatedCode}`, filename: schema.filename});
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
            return 'ArrayBuffer';
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
    return avroType.name;
};

const recordToTypescript = (avroType: schema.RecordType, ctx: Context): string => {
    const fields = avroType.fields.map(field => fieldToTypescript(field, ctx));
    ctx.dst += `export type ${avroType.name} = {${fields.join('\n')}};\n\n`;
    ctx.definedTypes.add(avroType.name);
    return avroType.name;
};

const enumToTypescript = (avroType: schema.EnumType, ctx: Context): string => {
    ctx.dst += `export enum ${avroType.name} {${avroType.symbols.join(',\n')}}\n\n`;
    ctx.definedTypes.add(avroType.name);
    return avroType.name;
};

const avroTypeToTypescript = (avroType: schema.DefinedType, ctx: Context): string => {
    if (typeof avroType === 'string') {
        const primitive = primitiveToTypescript(avroType);
        if (primitive) return primitive;
        ctx.referencedTypes.add(avroType);
        return avroType;
    }

    if ('logicalType' in avroType) {
        const mappedLogicalType = ctx.logicalTypes[avroType.logicalType];
        if (!mappedLogicalType) throw new Error(`No logical type mapped for ${avroType.logicalType}`);
        if ('name' in avroType && typeof avroType.name === 'string') {
            ctx.dst += `export type ${avroType.name} = ${mappedLogicalType};\n\n`;
            ctx.definedTypes.add(avroType.name);
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
