declare module 'multer' {
  type MulterStringCallback = (
    error: Error | null,
    value: string,
  ) => void;

  export function diskStorage(options: {
    destination:
      | string
      | ((
          req: unknown,
          file: unknown,
          callback: MulterStringCallback,
        ) => void);
    filename?: (
      req: unknown,
      file: unknown,
      callback: MulterStringCallback,
    ) => void;
  }): unknown;
}
