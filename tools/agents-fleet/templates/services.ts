/** Service boundary: every call takes tenant_id and never returns secrets. */

import type { AuditEvent, Principal, Tenant, TenantId } from "./types";

export interface CloudAuthService {
  createTenant(tenant_id: TenantId, name: string): Tenant;
  register(tenant_id: TenantId, subject: string, secret: string): Principal;
  issue(tenant_id: TenantId, subject: string, secret: string): string;
  verify(token: string, tenant_id: TenantId): Principal;
  revoke(token: string, tenant_id: TenantId): void;
  principalsIn(tenant_id: TenantId): Principal[];
  auditLog(): AuditEvent[];
}

export function assertSameTenant(
  recordTenant: TenantId,
  requestedTenant: TenantId,
): void {
  if (recordTenant !== requestedTenant) {
    throw new Error("token is bound to another tenant");
  }
}
