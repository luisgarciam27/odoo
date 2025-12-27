
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

/* Fix: Simplify xlsx module declaration to avoid property access errors and support namespace/direct usage */
declare module 'xlsx' {
  const XLSX: any;
  export = XLSX;
}

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}
