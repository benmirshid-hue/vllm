# SPDX-License-Identifier: Apache-2.0
"""Isolation and auth path coverage for the generated engine."""

import unittest

from core_engine import (
    AuthEngine,
    AuthError,
    InvalidToken,
    IsolationError,
    UnknownPrincipal,
)


class TenantIsolationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = AuthEngine()
        self.engine.create_tenant("alpha", "Alpha Corp")
        self.engine.create_tenant("beta", "Beta Corp")
        self.engine.register("alpha", "ada@alpha.test", "alpha-secret")
        self.engine.register("beta", "ben@beta.test", "beta-secret")

    def test_same_tenant_issue_and_verify(self) -> None:
        token = self.engine.issue("alpha", "ada@alpha.test", "alpha-secret")
        principal = self.engine.verify(token, "alpha")
        self.assertEqual(principal.tenant_id, "alpha")
        self.assertEqual(principal.subject, "ada@alpha.test")
        self.assertFalse(hasattr(principal, "secret"))

    def test_cross_tenant_verify_is_rejected(self) -> None:
        token = self.engine.issue("alpha", "ada@alpha.test", "alpha-secret")
        with self.assertRaises(IsolationError):
            self.engine.verify(token, "beta")

    def test_cross_tenant_revoke_is_rejected(self) -> None:
        token = self.engine.issue("alpha", "ada@alpha.test", "alpha-secret")
        with self.assertRaises(IsolationError):
            self.engine.revoke(token, "beta")
        principal = self.engine.verify(token, "alpha")
        self.assertEqual(principal.subject, "ada@alpha.test")

    def test_directory_does_not_leak_other_tenant(self) -> None:
        alpha = self.engine.principals_in("alpha")
        beta = self.engine.principals_in("beta")
        self.assertEqual([row.subject for row in alpha], ["ada@alpha.test"])
        self.assertEqual([row.subject for row in beta], ["ben@beta.test"])

    def test_same_subject_can_exist_in_two_tenants(self) -> None:
        self.engine.register("alpha", "shared@corp.test", "alpha-only")
        self.engine.register("beta", "shared@corp.test", "beta-only")
        alpha_token = self.engine.issue(
            "alpha", "shared@corp.test", "alpha-only"
        )
        with self.assertRaises(AuthError):
            self.engine.issue("beta", "shared@corp.test", "alpha-only")
        beta_token = self.engine.issue("beta", "shared@corp.test", "beta-only")
        self.assertEqual(
            self.engine.verify(alpha_token, "alpha").tenant_id, "alpha"
        )
        self.assertEqual(
            self.engine.verify(beta_token, "beta").tenant_id, "beta"
        )

    def test_wrong_secret_and_unknown_subject(self) -> None:
        with self.assertRaises(AuthError):
            self.engine.issue("alpha", "ada@alpha.test", "wrong")
        with self.assertRaises(UnknownPrincipal):
            self.engine.issue("alpha", "missing@alpha.test", "alpha-secret")

    def test_revoke_then_verify_fails(self) -> None:
        token = self.engine.issue("alpha", "ada@alpha.test", "alpha-secret")
        self.engine.revoke(token, "alpha")
        with self.assertRaises(InvalidToken):
            self.engine.verify(token, "alpha")

    def test_audit_has_no_secrets(self) -> None:
        token = self.engine.issue("alpha", "ada@alpha.test", "alpha-secret")
        self.engine.verify(token, "alpha")
        dumped = repr(self.engine.audit_log())
        self.assertNotIn("alpha-secret", dumped)
        self.assertNotIn(token, dumped)
        actions = [event.action for event in self.engine.audit_log()]
        self.assertIn("issue", actions)


if __name__ == "__main__":
    unittest.main()
