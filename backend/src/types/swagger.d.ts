// Type declarations for swagger packages
declare module 'swagger-jsdoc' {
  function swaggerJsdoc(options: any): any;
  export = swaggerJsdoc;
}

declare module 'swagger-ui-express' {
  import { RequestHandler } from 'express';
  export function setup(swaggerDoc: any, opts?: any): RequestHandler;
  export function serve(req: any, res: any, next: any): void;
  export const serveFiles: any;
}
