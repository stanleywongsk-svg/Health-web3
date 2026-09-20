# Security and release gates

The first slice treats mobile input as untrusted. Supabase validates identity; fixed-search-path database functions derive auth.uid(), check account state and cloud consent, lock the account, load/pin server rules, and post only server-calculated ledger deltas. User metadata never grants administration. RLS and explicit grants prohibit cross-account data access and direct ledger writes.

Residual risk: HealthKit metadata checks and opaque source pins do not attest that a person walked. A rooted/modified client or stolen session can fabricate a structurally valid summary. No claim of fraud-proof steps is made. Stronger device attestation remains F05, with independent policy approval.

Secrets: mobile receives only project URL and publishable/anon key. Service-role/signing/private keys never enter public environment variables, client bundles, logs, error bodies or this repository. Native credentials are stored in SecureStore. Configure production key rotation and incident response outside chat; never paste credentials into a prompt.

Authorization tests must exercise anonymous/user A/user B accounts, protected RPCs and direct writes. A service-role integration test alone is not evidence of RLS. Business identities and serialized claims must survive different request IDs, revisions and mission versions.

Release blockers include real-device source metadata verification, end-to-end SMTP/OTP expiration and resend behavior, native accessibility, complete deletion/retention and backup replay, full admin authorization/MFA/two-person adjustments, abuse/rate-limit validation, and B/C human review. A green local test suite does not authorize public launch.

Incident response: pause new awards; preserve canonical ledger; revoke compromised sessions/keys through provider controls; minimize logs; investigate request IDs rather than raw health values. Reconcile with compensating entries, never edit posted history. See OPERATIONS for actual implemented controls and unimplemented drills.
