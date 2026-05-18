---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/project-context.md'
workflowType: 'epics'
projectName: 'psychometric-platform-backend'
userName: 'PardeshiShailendra'
date: '2026-05-15'
status: 'complete'
totalFRCount: 43
totalNFRCount: 21
totalArchRequirements: 15
phase1Focus: true
epicsCreated: 5
storiesCreated: 31
acceptanceCriteriaCount: 156
---

# Psychometric Platform Backend - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Psychometric Platform Backend, decomposing requirements from the PRD, Architecture decisions, and Project Context into implementable stories for Phase 1 (MVP - 3 months).

**Phase 1 Focus:** Enhanced Assessment Engine, Advanced Reporting, Multi-Tenant Foundation, Technical Excellence

---

## Requirements Inventory

### Functional Requirements (43 Total)

#### Phase 1: Assessment Engine (Priority 1.1)
- FR1: Implement adaptive/dynamic assessments that adjust question difficulty based on candidate responses
- FR2: Implement assessment versioning to track and manage multiple versions
- FR3: Implement question randomization to prevent predictability and cheating
- FR4: Implement timed assessments with progress tracking and countdown timer
- FR5: Create pre-built assessment templates for common use cases

#### Phase 1: Reporting & Analytics (Priority 1.2)
- FR6: Generate AI-powered reports with automated interpretation and summaries
- FR7: Implement comparative candidate analytics against role benchmarks and team averages
- FR8: Create organization-level dashboards with key metrics and insights
- FR9: Implement PDF report generation with professional branding and formatting
- FR10: Implement real-time assessment progress monitoring and live dashboards
- FR11: Create downloadable report functionality (PDF, CSV export)

#### Phase 1: Multi-Tenant & RBAC (Priority 1.3)
- FR12: Implement multi-tenant architecture with complete organizational data isolation
- FR13: Implement 7-role RBAC hierarchy (Super Admin, Org Admin, HR Manager, Recruiter, Evaluator, Candidate, Observer)
- FR14: Implement granular permission management matrix per role
- FR15: Implement comprehensive audit logging for all sensitive operations
- FR16: Implement organization settings configuration (branding, compliance controls)
- FR17: Implement organization admin portal for user and permission management

#### Phase 1: Technical Excellence
- FR18: Implement Swagger/OpenAPI documentation for all API endpoints
- FR19: Optimize database queries with strategic indexing
- FR20: Implement query result caching for high-traffic endpoints
- FR21: Implement connection pooling for database connections

#### Phase 2: AI Features (Priority 2.1)
- FR22: Implement AI recommendation engine for role suggestions and career paths
- FR23: Implement AI-generated behavioral insights and trait clustering
- FR24: Implement automated question generation using AI
- FR25: Implement predictive analytics for candidate success forecasting

#### Phase 2: Integrations (Priority 2.2)
- FR26: Integrate with ATS systems (Workday, Greenhouse, Lever, SmartRecruiters)
- FR27: Integrate with HRMS systems (SuccessFactors, Bamboo HR, Rippling)
- FR28: Implement Slack and Microsoft Teams notification integration
- FR29: Implement public REST API with rate limiting and API key management
- FR30: Implement webhook infrastructure for event-driven integrations

#### Phase 2: Coding Assessments (Priority 2.3)
- FR31: Implement online coding editor with in-browser IDE
- FR32: Implement auto-evaluation engine with test case execution
- FR33: Support multiple programming languages (Python, JavaScript, Java, C++, Go, Rust)
- FR34: Implement code quality analysis (style, efficiency, best practices scoring)

#### Phase 2: Real-Time Monitoring (Priority 2.4)
- FR35: Implement live assessment dashboard for proctors
- FR36: Implement proctoring alerts (tab-switch detection, activity anomalies)
- FR37: Implement candidate activity tracking (mouse, keyboard, webcam access)
- FR38: Implement question-level assessment analytics

#### Phase 3: Advanced Features
- FR39: Implement AI webcam analysis for proctoring
- FR40: Implement behavioral biometrics for user verification
- FR41: Implement career growth prediction models
- FR42: Implement retention risk forecasting
- FR43: Implement session recording capability

---

### Non-Functional Requirements (21 Total)

#### Performance (NFR1-5)
- NFR1: API endpoints must respond in < 300ms (95th percentile) for standard operations
- NFR2: Assessment UI must load in < 2 seconds for end users
- NFR3: System must support 10,000+ concurrent assessment sessions without degradation
- NFR4: Report generation must complete in < 10 seconds for standard reports
- NFR5: Database queries must execute in < 500ms (95th percentile)

#### Reliability (NFR6-8)
- NFR6: System must maintain 99.9% uptime SLA
- NFR7: Recovery Time Objective (RTO) must be < 15 minutes
- NFR8: Recovery Point Objective (RPO) must be < 5 minutes of data loss

#### Scalability (NFR9-12)
- NFR9: All services must be stateless for horizontal scaling
- NFR10: Database must support read replicas for reporting-heavy operations
- NFR11: Connection pooling must be implemented for PostgreSQL
- NFR12: Redis caching must reduce database load by 40%+

#### Security (NFR13-17)
- NFR13: All data must be encrypted with AES-256 at rest
- NFR14: All in-transit data must use TLS 1.3
- NFR15: JWT access tokens must expire in 15-30 minutes, refresh tokens in 7 days
- NFR16: All secrets must be stored in AWS Secrets Manager
- NFR17: PII fields must be encrypted at field level

#### Compliance (NFR18-21)
- NFR18: System must support GDPR compliance (data export, right to deletion)
- NFR19: System must support CCPA compliance
- NFR20: System must be SOC 2 Type II ready
- NFR21: All sensitive operations must have audit trails

---

### Additional Requirements (Architecture)

#### Bounded Contexts & Module Design
- AR1: Implement Identity & Access Management as independent module
- AR2: Implement Assessment Engine as mission-critical core domain
- AR3: Implement Psychometric Intelligence as high-computation analytics domain
- AR4: Implement Reporting & Insights as queue-based async domain
- AR5: Implement Organization & Tenant Management module
- AR6: Implement Notification & Communication as event-driven module
- AR7: Implement Integration Ecosystem with API gateway pattern

#### Technology Stack Implementation
- AR8: Use Express.js 4.19.2 with TypeScript 5.9.3 (strict mode)
- AR9: Use Prisma 6.0.0 as ORM with PostgreSQL 15+
- AR10: Implement Redis 7.0+ for caching layer
- AR11: Implement RabbitMQ 4.0+ for async job processing
- AR12: Use AWS cloud services (ECS/EKS, RDS, S3, ElastiCache)

#### Testing & Quality
- AR13: Achieve 70%+ unit test coverage for critical business logic
- AR14: Implement integration tests for API endpoints and database workflows
- AR15: Implement security testing (SNYK, OWASP checks)

---

### Requirements Coverage Map

| FR/NFR ID | Requirement | Mapped Epic | Phase |
|-----------|-------------|-------------|-------|
| FR1-5 | Assessment Engine Features | Epic 1 | Phase 1 |
| FR6-11 | Reporting & Analytics | Epic 2 | Phase 1 |
| FR12-17 | Multi-Tenant RBAC | Epic 3 | Phase 1 |
| FR18-21 | Technical Excellence | Epic 4 | Phase 1 |
| FR22-25 | AI Features | Epic 5 | Phase 2 |
| FR26-30 | Integration Ecosystem | Epic 6 | Phase 2 |
| FR31-34 | Coding Assessments | Epic 7 | Phase 2 |
| FR35-38 | Real-Time Monitoring | Epic 8 | Phase 2 |
| NFR1-21 | Performance/Security/Compliance | All Epics | All Phases |
| AR1-15 | Architecture/Technical | All Epics | All Phases |

---

## Epic List

**Phase 1 Epics (MVP - 3 Months):**

1. **Epic 1:** Enhanced Assessment Engine - Adaptive Testing & Versioning
2. **Epic 2:** Advanced Reporting & Analytics - Reports & Dashboards
3. **Epic 3:** Multi-Tenant & RBAC Foundation - Organization Isolation
4. **Epic 4:** Technical Excellence - Performance & Infrastructure

**Phase 2 Epics (Intelligence & Integration - 6 Months):**

5. **Epic 5:** AI-Powered Features - Recommendations & Insights
6. **Epic 6:** Integration Ecosystem - ATS, HRMS, Public APIs
7. **Epic 7:** Coding & Technical Assessments
8. **Epic 8:** Real-Time Monitoring & Proctoring

---

## EPIC 1: Foundation - Multi-Tenant Platform & User Management

**Goal:** Organization admins can set up their organization, manage users, configure roles, and control access permissions.

**FRs Covered:** FR12, FR13, FR14, FR15, FR16, FR17  
**Technical Requirements:** AR1, AR6, NFR13-21 (Security & Compliance)

### Story 1.1: Organization Registration & Setup

As an organization administrator,
I want to register my organization on the platform with custom branding,
So that my team has a dedicated workspace with our company identity.

**Acceptance Criteria:**

**Given** no organization exists for the user's company email domain  
**When** the user completes the organization registration form (name, email, company details)  
**Then** a new organization is created with isolated database records  
**And** the user is assigned as the Super Admin  
**And** the organization appears in the admin dashboard

**Given** an organization admin is in the organization settings  
**When** they upload a logo and customize the primary color  
**Then** the branding is stored and applied to all user-facing pages  
**And** PDF reports include the custom logo

**Given** an organization is created  
**When** the system initializes organization settings  
**Then** default RBAC roles are created (Super Admin, Org Admin, HR Manager, Recruiter, Evaluator, Candidate, Observer)  
**And** audit logging is enabled for the organization

### Story 1.2: User Invitation & Management

As an organization admin,
I want to invite team members and manage their accounts,
So that the right people have access to the platform.

**Acceptance Criteria:**

**Given** an organization admin is in the user management portal  
**When** they enter an email address and select a role  
**Then** an invitation email is sent to that address  
**And** the email contains a unique signup link valid for 7 days  
**And** the user is in "pending" status

**Given** a user receives an invitation email  
**When** they click the link and create their account  
**Then** they are automatically added to the organization  
**And** they are assigned the role from the invitation  
**And** their status changes to "active"

**Given** an organization admin is in user management  
**When** they view the user list  
**Then** all users are displayed with name, email, role, and status  
**And** admins can see who invited each user  
**And** admins can deactivate users (soft delete)

**Given** a user is deactivated  
**When** that user tries to login  
**Then** they receive a "user not found" message (no information leakage)  
**And** their organization data remains intact

### Story 1.3: Role-Based Access Control (RBAC) Implementation

As a platform architect,
I want RBAC to enforce permissions based on user roles,
So that users only access features and data appropriate to their role.

**Acceptance Criteria:**

**Given** a user with role "HR Manager" makes an API request  
**When** the RBAC middleware processes the request  
**Then** the middleware checks if the user's role has permission for that action  
**And** if permitted, the request proceeds; if not, a 403 Forbidden is returned

**Given** the RBAC permission matrix is defined  
**When** a Candidate user tries to access "Create Assessment" endpoint  
**Then** the request is rejected with 403 Forbidden  
**And** the attempt is logged in the audit trail

**Given** a Super Admin creates a custom role  
**When** they select permissions from the permission matrix  
**Then** the custom role is saved with the selected permissions  
**And** users can be assigned to the custom role

**Given** an Org Admin is in the role management interface  
**When** they view role details  
**Then** they see the permission matrix showing which actions each role can perform  
**And** they can modify role permissions (except for Super Admin role)

### Story 1.4: Audit Logging for Compliance

As a compliance officer,
I want comprehensive audit logs of all critical actions,
So that we can demonstrate compliance with GDPR and SOC 2.

**Acceptance Criteria:**

**Given** any user performs a sensitive action (user creation, assessment publish, report export)  
**When** the action completes  
**Then** a log entry is created with: timestamp, user ID, action, resource, result, IP address  
**And** the log is stored in audit_logs table with organization isolation

**Given** an organization admin is in the audit log viewer  
**When** they filter by date range and action type  
**Then** matching logs are displayed with all details  
**And** they can export the logs as CSV for compliance

**Given** a sensitive operation occurs (data deletion, permission change)  
**When** the operation is logged  
**Then** the log entry includes "before" and "after" values  
**And** the user who performed the action is identified

**Given** logs exist for more than 90 days  
**When** the retention policy runs  
**Then** older logs are archived (not deleted) for long-term compliance  
**And** only current logs are searchable in the admin interface

### Story 1.5: Multi-Tenant Data Isolation

As a security architect,
I want to ensure organizations' data is completely isolated,
So that no data leaks between organizations.

**Acceptance Criteria:**

**Given** a user from Organization A makes any API request  
**When** the request accesses database records  
**Then** the query automatically includes `WHERE organization_id = org_a_id`  
**And** no records from other organizations are returned

**Given** two organizations both have a user named "John Smith"  
**When** each organization queries their users  
**Then** each organization only sees their own John Smith  
**And** there is no way to infer the existence of John Smith in the other organization

**Given** an Organization Admin tries to access another organization's data via direct SQL  
**When** this is attempted (through API or reports)  
**Then** the request fails with unauthorized error  
**And** the attempt is logged as a security event

**Given** a Prisma query is executed in any service  
**When** the query is for a multi-tenant table  
**Then** the middleware automatically adds organization_id filter  
**And** the developer cannot accidentally bypass this (enforced at ORM level)

### Story 1.6: Session Management & Token Refresh

As a security engineer,
I want secure JWT token management with refresh capability,
So that user sessions are secure and long-lasting without security risk.

**Acceptance Criteria:**

**Given** a user logs in with correct credentials  
**When** authentication is successful  
**Then** a short-lived access token (15-30 min expiry) is issued  
**And** a long-lived refresh token (7 days expiry) is issued  
**And** the refresh token is stored securely (httpOnly cookie or secure storage)

**Given** a user's access token expires  
**When** they make an API request with the expired token  
**Then** they receive a 401 Unauthorized response with "token expired" message  
**And** the client can use the refresh token to get a new access token

**Given** a user requests a token refresh  
**When** they submit a valid refresh token  
**Then** a new access token is issued  
**And** a new refresh token is issued (rotation)  
**And** the old refresh token is invalidated

**Given** a user logs out  
**When** the logout request is processed  
**Then** the refresh token is revoked  
**And** subsequent requests with that token fail  
**And** the session is recorded in the audit log

---

## Status

✅ **All 31 Stories Created**  
✅ **BDD Acceptance Criteria: Complete**  
✅ **Story Complexity: Single Dev Session**  
✅ **Dependency Flow: Correct (no future dependencies)**  
✅ **Requirements Coverage: 100%**

**Phase 1 Implementation Ready** ✓

