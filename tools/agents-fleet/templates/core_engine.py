# SPDX-License-Identifier: Apache-2.0
"""Cloud auth engine with tenant isolation and hashed secrets."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from dataclasses import dataclass

from models import AuditEvent, Principal, Session, Tenant

_PBKDF2_ROUNDS = 50_000
_TOKEN_BYTES = 32
_SESSION_TTL_SEC = 3600


class AuthError(Exception):
    """Auth failure. Messages must not include secrets."""


class IsolationError(AuthError):
    """A principal or token was used across a tenant boundary."""


class UnknownPrincipal(AuthError):
    """Subject is not registered in this tenant."""


class InvalidToken(AuthError):
    """Token is missing, expired, or revoked."""


@dataclass
class _Stores:
    tenants: dict[str, Tenant]
    principals: dict[tuple[str, str], Principal]
    subjects: dict[tuple[str, str], str]
    sessions: dict[str, Session]


def _require_tenant_id(tenant_id: str) -> str:
    value = (tenant_id or "").strip()
    if not value:
        raise AuthError("tenant_id is required")
    if "/" in value or "\\" in value or ".." in value:
        raise AuthError("tenant_id is invalid")
    return value


def _hash_secret(secret: str, tenant_id: str, salt: bytes | None = None) -> str:
    if not secret:
        raise AuthError("secret is required")
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        secret.encode("utf-8"),
        salt + tenant_id.encode("utf-8"),
        _PBKDF2_ROUNDS,
        dklen=32,
    )
    return f"{salt.hex()}${digest.hex()}"


def _verify_secret(secret: str, tenant_id: str, stored: str) -> bool:
    try:
        salt_hex, _digest_hex = stored.split("$", 1)
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    candidate = _hash_secret(secret, tenant_id, salt=salt)
    return hmac.compare_digest(candidate, stored)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class AuthEngine:
    """Issues tenant-bound sessions. Cross-tenant verify is IsolationError."""

    def __init__(self) -> None:
        self._store = _Stores(
            tenants={},
            principals={},
            subjects={},
            sessions={},
        )
        self._audit: list[AuditEvent] = []

    def audit_log(self) -> tuple[AuditEvent, ...]:
        return tuple(self._audit)

    def _record(
        self,
        action: str,
        tenant_id: str,
        ok: bool,
        principal_id: str | None = None,
    ) -> None:
        self._audit.append(
            AuditEvent(
                action=action,
                tenant_id=tenant_id,
                principal_id=principal_id,
                ok=ok,
            )
        )

    def create_tenant(self, tenant_id: str, name: str) -> Tenant:
        tenant_id = _require_tenant_id(tenant_id)
        if tenant_id in self._store.tenants:
            raise AuthError("tenant already exists")
        tenant = Tenant(tenant_id=tenant_id, name=name.strip() or tenant_id)
        self._store.tenants[tenant_id] = tenant
        self._record("create_tenant", tenant_id, True)
        return tenant

    def register(self, tenant_id: str, subject: str, secret: str) -> Principal:
        tenant_id = _require_tenant_id(tenant_id)
        if tenant_id not in self._store.tenants:
            raise AuthError("unknown tenant")
        subject = (subject or "").strip()
        if not subject:
            raise AuthError("subject is required")
        subject_key = (tenant_id, subject)
        if subject_key in self._store.subjects:
            self._record("register", tenant_id, False)
            raise AuthError("subject already registered in this tenant")
        principal = Principal(
            principal_id=secrets.token_hex(16),
            tenant_id=tenant_id,
            subject=subject,
            secret_hash=_hash_secret(secret, tenant_id),
        )
        self._store.principals[(tenant_id, principal.principal_id)] = principal
        self._store.subjects[subject_key] = principal.principal_id
        self._record("register", tenant_id, True, principal.principal_id)
        return principal

    def issue(self, tenant_id: str, subject: str, secret: str) -> str:
        tenant_id = _require_tenant_id(tenant_id)
        subject = (subject or "").strip()
        principal_id = self._store.subjects.get((tenant_id, subject))
        if principal_id is None:
            self._record("issue", tenant_id, False)
            raise UnknownPrincipal("unknown subject in this tenant")
        principal = self._store.principals[(tenant_id, principal_id)]
        if not _verify_secret(secret, tenant_id, principal.secret_hash):
            self._record("issue", tenant_id, False, principal_id)
            raise AuthError("invalid credentials")
        token = secrets.token_urlsafe(_TOKEN_BYTES)
        session = Session(
            session_id=secrets.token_hex(16),
            tenant_id=tenant_id,
            principal_id=principal_id,
            token_hash=_token_hash(token),
            expires_at=time.time() + _SESSION_TTL_SEC,
        )
        self._store.sessions[session.token_hash] = session
        self._record("issue", tenant_id, True, principal_id)
        return token

    def verify(self, token: str, tenant_id: str) -> Principal:
        tenant_id = _require_tenant_id(tenant_id)
        if not token:
            self._record("verify", tenant_id, False)
            raise InvalidToken("token is required")
        session = self._store.sessions.get(_token_hash(token))
        if session is None:
            self._record("verify", tenant_id, False)
            raise InvalidToken("unknown or revoked token")
        if session.tenant_id != tenant_id:
            self._record("verify", tenant_id, False, session.principal_id)
            raise IsolationError("token is bound to another tenant")
        if session.expires_at <= time.time():
            self._store.sessions.pop(session.token_hash, None)
            self._record("verify", tenant_id, False, session.principal_id)
            raise InvalidToken("token expired")
        principal = self._store.principals[(tenant_id, session.principal_id)]
        self._record("verify", tenant_id, True, principal.principal_id)
        return principal

    def revoke(self, token: str, tenant_id: str) -> None:
        tenant_id = _require_tenant_id(tenant_id)
        session = self._store.sessions.get(_token_hash(token or ""))
        if session is None:
            self._record("revoke", tenant_id, False)
            raise InvalidToken("unknown or revoked token")
        if session.tenant_id != tenant_id:
            self._record("revoke", tenant_id, False, session.principal_id)
            raise IsolationError("token is bound to another tenant")
        self._store.sessions.pop(session.token_hash, None)
        self._record("revoke", tenant_id, True, session.principal_id)

    def principals_in(self, tenant_id: str) -> tuple[Principal, ...]:
        tenant_id = _require_tenant_id(tenant_id)
        rows = [
            principal
            for (row_tenant, _pid), principal in self._store.principals.items()
            if row_tenant == tenant_id
        ]
        return tuple(rows)
