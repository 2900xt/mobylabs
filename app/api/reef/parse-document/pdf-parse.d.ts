declare module 'pdf-parse/lib/pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  function pdf(dataBuffer: Buffer): Promise<PDFData>;
  export default pdf;
}
