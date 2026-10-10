declare module 'pdf-parse' {
  interface PdfParseTextResult {
    text?: string;
    numpages?: number;
  }

  function pdfParse(dataBuffer: Buffer | Uint8Array, options?: { max?: number }): Promise<PdfParseTextResult>;

  class PDFParse {
    constructor(options: { data: Buffer | Uint8Array });
    destroy(): Promise<void>;
    getText(): Promise<PdfParseTextResult>;
  }

  export = pdfParse;
  export { PDFParse };
}
