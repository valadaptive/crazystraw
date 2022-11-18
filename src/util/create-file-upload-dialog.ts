type FileUploadDialogOptions = {
    readonly multiple?: boolean,
    readonly accept?: string
};

const createFileUploadDialog = <O extends FileUploadDialogOptions>(options: O):
O['multiple'] extends true ? Promise<FileList | null> : Promise<File | null> => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options.multiple ?? false;
    input.accept = options.accept ?? '';

    return new Promise(resolve => {
        input.addEventListener('change', () => {
            if (options.multiple) {
                resolve(input.files);
            } else {
                resolve(input.files?.[0] ?? null);
            }
        });
        input.click();
    }) as O['multiple'] extends true ? Promise<FileList | null> : Promise<File | null>;
};

export default createFileUploadDialog;
