# SPDX-License-Identifier: Apache-2.0
"""Tenant-scoped identity records. Every row carries tenant_id."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Tenant:
    tenant_id: str
    name: str


@dataclass(frozen=True)
class Principal:
    principal_id: str
    tenant_id: str
    subject: str
    secret_hash: str


@dataclass(frozen=True)
class Session:
    session_id: str
    tenant_id: str
    principal_id: str
    token_hash: str
    expires_at: float


@dataclass(frozen=True)
class AuditEvent:
    action: str
    tenant_id: str
    principal_id: str | None
    ok: bool
