// Override Express v5 query/params types for backward compatibility
import 'express';

declare module 'express-serve-static-core' {
  interface ParamsDictionary {
    [key: string]: string;
  }
  interface Query {
    [key: string]: string | undefined;
  }
}
