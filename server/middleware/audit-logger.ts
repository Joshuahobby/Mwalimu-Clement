import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { AuditActionType } from '@shared/schema';

export interface AuditLogRequest extends Request {
  auditLog?: {
    actionType: AuditActionType;
    targetType: string;
    targetId?: number;
    details?: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      message?: string;
      additionalInfo?: Record<string, unknown>;
    };
  };
}

export async function auditLogger(req: AuditLogRequest, res: Response, next: NextFunction) {
  const originalJson = res.json;

  res.json = function(body) {
    if (req.auditLog && req.user?.isAdmin) {
      const { actionType, targetType, targetId, details } = req.auditLog;

      storage.createAuditLog({
        adminId: req.user.id,
        actionType,
        targetType,
        targetId,
        details: {
          ...details,
          additionalInfo: { response: body }
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
      }).catch(error => {
        console.error('Failed to create audit log:', error);
      });
    }

    return originalJson.call(res, body);
  };

  next();
}

export function withAuditLog(
  actionType: AuditActionType,
  targetType: string,
  getTargetId?: (req: Request) => number | undefined,
  getDetails?: (req: Request) => {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    message?: string;
    additionalInfo?: Record<string, unknown>;
  } | undefined
) {
  return function(req: AuditLogRequest, _res: Response, next: NextFunction) {
    req.auditLog = {
      actionType,
      targetType,
      targetId: getTargetId?.(req),
      details: {
        ...getDetails?.(req),
        additionalInfo: {
          requestBody: req.body
        }
      },
    };
    next();
  };
}