
declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(config: { apiKey: string });
    models: {
      generateContent(params: any): Promise<any>;
      generateContentStream(params: any): AsyncIterable<any>;
      generateImages(params: any): Promise<any>;
      generateVideos(params: any): Promise<any>;
    };
    chats: {
      create(params: any): any;
    };
    live: {
      connect(params: any): Promise<any>;
    };
    operations: {
      getVideosOperation(params: any): Promise<any>;
    };
  }

  export enum Type {
    TYPE_UNSPECIFIED = 'TYPE_UNSPECIFIED',
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    INTEGER = 'INTEGER',
    BOOLEAN = 'BOOLEAN',
    ARRAY = 'ARRAY',
    OBJECT = 'OBJECT',
    NULL = 'NULL',
  }

  export enum Modality {
    AUDIO = 'AUDIO',
    TEXT = 'TEXT',
    IMAGE = 'IMAGE',
  }
}

/* Fix: Mejorar declaración para soportar import * as XLSX y evitar errores de default export runtime */
declare module 'xlsx' {
  export const utils: any;
  export function writeFile(wb: any, filename: string): void;
  export function read(data: any, options?: any): any;
  const XLSX: any;
  export default XLSX;
}

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}
