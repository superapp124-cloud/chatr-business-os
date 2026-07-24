# ADR 022: Trust Model

## Status
Accepted

## Date
2026-07-17

## Context
Marketplace requires a cryptographic trust model to prevent malicious packages.

## Decision
Ed25519 signatures. KeyStore maps Publisher ID to Public Key. Packages must include `signature` over the package hash. Support offline verification, key rotation, and emergency revocation logic in the KeyStore.

## Consequences
Certification step now requires KeyStore lookup. Untrusted or revoked keys block installation.
