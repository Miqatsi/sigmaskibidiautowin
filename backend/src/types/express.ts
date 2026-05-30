import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request<Record<string, string>, any, any, Record<string, string>> {
  user?: AuthenticatedUser;
}
