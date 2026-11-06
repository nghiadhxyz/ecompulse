// Ambient type declaration for missing @modelcontextprotocol/sdk types in @google/genai
declare module '@modelcontextprotocol/sdk/client/index.js' {
  export interface Client {
    [key: string]: any;
  }
}
declare module '@modelcontextprotocol/sdk' {
  export interface Client {
    [key: string]: any;
  }
}

