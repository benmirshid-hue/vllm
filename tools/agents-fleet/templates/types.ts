/** Tenant-isolated cloud auth contracts. */

export type TenantId = string;

export interface Tenant {
  tenant_id: TenantId;
  name: string;
}

export interface Principal {
  principal_id: string;
  tenant_id: TenantId;
  subject: string;
}

export interface Session {
  session_id: string;
  tenant_id: TenantId;
  principal_id: string;
  expires_at: number;
}

export interface AuditEvent {
  action: "create_tenant" | "register" | "issue" | "verify" | "revoke";
  tenant_id: TenantId;
  principal_id: string | null;
  ok: boolean;
}

export interface IsolationError {
  name: "IsolationError";
  message: "token is bound to another tenant";
}
