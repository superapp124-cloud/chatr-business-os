# ADR 021: Package Lifecycle

## Status
Accepted

## Date
2026-07-17

## Context
Need a reliable pipeline for package transition from remote to executing nodes.

## Decision
Repository (disk/remote) -> Download -> Certify (Manifest, Checksum, Signature) -> Register (PackageRegistry) -> Activate (BrowserNodeRegistry). All components must be decoupled.

## Consequences
PackageManager is an orchestrator, not a god object. Rollbacks happen automatically if Activation fails.
