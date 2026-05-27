import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { AuthenticatedRequest } from '../types/express';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

interface AuditLogParams {
  userId: string;
  action: AuditAction;
  tableName: string;
  recordId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Audit policy:
 * - "strict": If audit fails, throw error (transaction rolls back).
 *   Use for: QC approval, lot creation, inventory movements.
 * - "best-effort": If audit fails, log warning but don't break operation.
 *   Use for: Login, profile views, non-critical reads.
 */
type AuditPolicy = 'strict' | 'best-effort';

/**
 * Creates an audit log entry.
 * @param params - Audit data
 * @param policy - "strict" fails the operation if audit fails, "best-effort" logs and continues
 */
export async function createAuditLog(
  params: AuditLogParams,
  policy: AuditPolicy = 'best-effort'
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        tableName: params.tableName,
        recordId: params.recordId,
        oldData: params.oldData ?? undefined,
        newData: params.newData ?? undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (error) {
    if (policy === 'strict') {
      logger.error({ err: error, params }, '[AuditLog] STRICT: Audit failed, aborting operation');
      throw new Error('Audit log gagal disimpan. Operasi dibatalkan.');
    }
    logger.warn({ err: error, params }, '[AuditLog] Best-effort: Failed to create audit entry');
  }
}

/**
 * Extracts audit context (IP, user agent) from an Express request.
 */
export function getAuditContext(req: AuthenticatedRequest): {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
} {
  const userId = req.user?.id ?? 'SYSTEM';
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || null;
  const userAgent = (req.headers['user-agent'] as string) || null;
  return { userId, ipAddress, userAgent };
}

/**
 * Helper: log a CREATE operation
 */
export async function auditCreate(
  req: AuthenticatedRequest,
  tableName: string,
  recordId: string,
  newData: Record<string, unknown>,
  policy: AuditPolicy = 'strict'
): Promise<void> {
  const { userId, ipAddress, userAgent } = getAuditContext(req);
  await createAuditLog(
    { userId, action: 'CREATE', tableName, recordId, oldData: null, newData, ipAddress, userAgent },
    policy
  );
}

/**
 * Helper: log an UPDATE operation
 */
export async function auditUpdate(
  req: AuthenticatedRequest,
  tableName: string,
  recordId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  policy: AuditPolicy = 'strict'
): Promise<void> {
  const { userId, ipAddress, userAgent } = getAuditContext(req);
  await createAuditLog(
    { userId, action: 'UPDATE', tableName, recordId, oldData, newData, ipAddress, userAgent },
    policy
  );
}

/**
 * Helper: log a DELETE (soft-delete) operation
 */
export async function auditDelete(
  req: AuthenticatedRequest,
  tableName: string,
  recordId: string,
  oldData: Record<string, unknown>,
  policy: AuditPolicy = 'strict'
): Promise<void> {
  const { userId, ipAddress, userAgent } = getAuditContext(req);
  await createAuditLog(
    { userId, action: 'DELETE', tableName, recordId, oldData, newData: null, ipAddress, userAgent },
    policy
  );
}
