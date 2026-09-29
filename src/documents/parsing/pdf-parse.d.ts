declare module 'pdf-parse' {
  export interface PdfParseResult {
    text: string;
    numpages?: number;
    info?: unknown;
  }

  const pdfParse: (data: Uint8Array | ArrayBuffer) => Promise<PdfParseResult>;
  export default pdfParse;
}
