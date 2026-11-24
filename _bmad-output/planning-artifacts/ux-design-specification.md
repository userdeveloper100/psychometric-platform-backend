---
stepsCompleted: ['step-01-init']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/epics.md'
  - 'docs/project-context.md'
  - '_bmad-output/project-context.md'
workflowType: 'ux-design'
projectName: 'psychometric-platform'
userName: 'PardeshiShailendra'
date: '2026-06-08'
scopeDecision: 'A - Build to what is real (shipped backend), not the aspirational PRD vision'
targetStack: 'React + Vite + TypeScript + Tailwind + shadcn/ui (separate frontend repo)'
---

# UX Design Specification — Psychometric Platform

**Author:** PardeshiShailendra
**Date:** 2026-06-08

---

## Scope & Grounding (Decision: Option A — Build to What's Real)

This specification designs the UI against the **shipped, contract-stable backend**, not the
broader PRD/epics vision (multi-tenant, 7-role RBAC, AI reports, adaptive testing).

**What the backend actually supports today:**

- **Tenancy / roles:** Single-institute, two roles — `ADMIN` and `STUDENT`.
- **Auth:** JWT Bearer token, **no refresh token** (design for clean session-expiry → login).
- **Core resources:** Institute · Test (DRAFT/PUBLISHED) · Dimension · Question (numeric/Likert
  scale, `scaleMin`–`scaleMax`) · Student · Invite (token-based, PENDING/COMPLETED) ·
  Response · Report.
- **API shape:** Standardized envelope `{ success, message, data?, meta?: { pagination }, error?: { code, details } }`.
  Lists are paginated.
- **Known gaps to design around:** no email delivery (invites create records only),
  no file-upload (bulk student add is a JSON/structured list, not CSV upload).

**Target frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui, in a separate repo,
consuming the API above.

<!-- UX design content will be appended sequentially through collaborative workflow steps -->
