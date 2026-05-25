import { prisma, type ActorRole } from '@gameclub/db';
import { log } from './logger.js';

export async function audit(params: {
  actorId?: string | null;
  actorRole: ActorRole;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        actorRole: params.actorRole,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata ? (params.metadata as any) : undefined,
        ip: params.ip,
      },
    });
  } catch (e) {
    log.error('Audit log error', e);
  }
}
