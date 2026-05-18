---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-bounded-contexts', 'step-04-style', 'step-05-technical', 'step-06-scalability', 'step-07-security', 'step-08-devops']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/project-context.md'
  - 'docs/architecture/backend-architecture.md'
workflowType: 'architecture'
projectName: 'psychometric-platform-backend'
userName: 'PardeshiShailendra'
date: '2026-05-15'
status: 'complete'
architectureStyle: 'Modular Monolith → Event-Driven Microservices'
boundedContexts: 7
techStackLayers: 11
implementationTasks: 10
---

# Architecture Decision Document - Psychometric Platform Backend

**Author:** PardeshiShailendra  
**Date:** 2026-05-15  
**Project Type:** Brownfield Enhancement  
**Status:** ✅ Complete (All 8 Steps)

---

## Document Overview

_This document captures architectural decisions collaboratively discovered through step-by-step analysis. Sections build progressively as we work through each architectural dimension._

---

## Table of Contents

1. [Project Context Analysis](#project-context-analysis)
2. [Bounded Contexts](#bounded-contexts)
3. [Architectural Style & System Design](#architectural-style--system-design)
4. [Technical Architecture](#technical-architecture)
5. [Scalability & Performance](#scalability--performance)
6. [Security & Compliance](#security--compliance)
7. [DevOps & Observability](#devops--observability)
8. [Testing Architecture](#testing-architecture)
9. [Final Recommendations](#final-recommendations)

---

## Project Context Analysis

### Business Objective Alignment

The platform architecture is designed to support:

- AI-powered talent intelligence
- Enterprise psychometric assessments
- Workforce analytics
- Recruitment automation
- Multi-tenant SaaS operations

### Current Technical Baseline

Existing backend stack:

- TypeScript
- Node.js
- Express.js
- Prisma ORM
- PostgreSQL

### Strategic Architectural Direction

Adopt a:

- **Modular monolith initially** — faster iteration, lower operational complexity
- **Event-driven microservices progressively** — enterprise-scale evolution path

This minimizes early operational complexity while preparing for enterprise-scale evolution.

---

## Bounded Contexts

### Core Bounded Contexts Identified

#### 1. Identity & Access Management

**Responsibilities:**
- Authentication and authorization
- RBAC (Role-Based Access Control)
- Multi-tenant authorization
- Session management

**Recommended Isolation:** Independent module/service

---

#### 2. Assessment Engine (Mission-Critical Core Domain)

**Responsibilities:**
- Question management and versioning
- Adaptive/dynamic testing logic
- Scoring algorithms and calibration
- Time tracking and session management
- Candidate response handling

**Strategic Importance:** Highest — core product differentiator

---

#### 3. Psychometric Intelligence (High-Computation Domain)

**Responsibilities:**
- Trait scoring and calibration
- Personality analytics and clustering
- AI-generated interpretation
- Benchmark calculations and comparisons

**Characteristics:** Heavy computation, AI/ML intensive

---

#### 4. Reporting & Insights (Async-Heavy Domain)

**Responsibilities:**
- PDF report generation
- Dashboard aggregations
- Comparative analytics
- AI-generated summaries
- Export functionality

**Requirements:** Queue-based async processing

---

#### 5. Organization & Tenant Management

**Responsibilities:**
- Organization isolation and data boundaries
- Branding and customization
- Subscription management
- Tenant configuration

---

#### 6. Notification & Communication (Event-Driven)

**Responsibilities:**
- Email workflows and templates
- In-app notifications
- Assessment reminders
- Event broadcasting

**Architecture:** Queue/event-driven model

---

#### 7. Integration Ecosystem (API Gateway Pattern)

**Responsibilities:**
- ATS system integrations (Workday, Greenhouse, etc.)
- HRMS system integrations (SuccessFactors, etc.)
- Public REST API
- Webhook management and delivery

---

## Architectural Style & System Design

### Recommended Near-Term Architecture: Modular Monolith

**Why This Approach?**

Best fit for:
- Current team size (2-4 backend developers)
- Faster iteration and deployment
- Easier debugging and local development
- Lower infrastructure complexity and cost
- Simpler operational overhead

**Module Organization:**

```
src/
 ├── modules/
 │    ├── auth/                    (Identity & Access)
 │    ├── assessments/             (Assessment Engine)
 │    ├── analytics/               (Psychometric Intelligence)
 │    ├── reports/                 (Reporting & Insights)
 │    ├── organizations/           (Tenant Management)
 │    ├── notifications/           (Communication)
 │    └── integrations/            (External APIs)
 │
 ├── shared/                       (Cross-cutting concerns)
 ├── infrastructure/               (Configuration, DB setup)
 ├── queues/                       (Job processing)
 ├── prisma/                       (Schema & migrations)
 └── tests/                        (All test layers)
```

### Long-Term Architecture: Event-Driven Microservices

**Target Timeline:** 12-24 months

**Planned Services:**
1. Identity Service — Authentication & authorization
2. Assessment Service — Core assessment delivery
3. AI Analytics Service — Psychometric computation
4. Reporting Service — Report generation and aggregation
5. Notification Service — Email, SMS, push notifications
6. Integration Gateway — Third-party integrations
7. Event Bus — RabbitMQ/Kafka for inter-service communication

### Core Design Principles

- **Domain-Driven Design (DDD)** — Clear bounded contexts and ubiquitous language
- **Clean Architecture** — Separation of concerns, testability
- **SOLID Principles** — Single responsibility, Open/closed, etc.
- **Event-Driven Workflows** — Async processing, eventual consistency
- **Stateless Services** — Easy horizontal scaling
- **Async-First Heavy Processing** — Reports, notifications, AI computations

---

## Technical Architecture

### Backend Framework

#### Short-Term

**Continue with:** Express.js 4.19.2

#### Medium-Term (12 months)

**Gradual migration toward:** NestJS

**Benefits:**
- Built-in modularity and structure
- Dependency injection framework
- Enterprise-grade maintainability
- Easier microservices transition
- Reduced boilerplate

### Database Architecture

#### Primary Database: PostgreSQL

**Reasons:**
- ACID compliance for critical operations
- JSON support for flexible data structures
- Excellent analytical query capabilities
- Strong scalability and reliability
- GDPR-compliance friendly features

#### ORM: Prisma 6.0.0

**Why Continue:**
- Type-safe queries with TypeScript
- Excellent migration management
- Strong TypeScript support
- Clean API for data access
- Automatic schema generation

### Caching Strategy

#### Redis 5.11.0

**Use Cases:**
- Session caching and management
- Assessment session state
- Rate limiting and throttling
- Frequently accessed assessments and question banks
- Analytics and report caching
- User permission caching (RBAC lookups)

**Configuration:**
- Cache-aside pattern for read-heavy operations
- TTL-based expiration for session data
- Cluster support for high availability

### Messaging & Queue Infrastructure

#### Phase 1: RabbitMQ

**Use Cases:**
- Email job queue
- Report generation jobs
- Notification delivery queue
- Assessment event processing
- Data aggregation jobs

#### Future: Kafka

**Use Cases:**
- Event streaming for analytics
- Real-time assessment events
- AI processing pipelines
- Long-term event auditing

### API Architecture

#### Current: REST-First

**Characteristics:**
- RESTful endpoints for all operations
- JWT token-based authentication
- Rate limiting and throttling
- API versioning support
- Comprehensive API documentation (Swagger/OpenAPI)

#### Future Enhancement: GraphQL

**Planned for:** Analytics dashboards and complex data fetching

### Authentication Strategy

**Recommended Stack:**
- JWT access tokens (short-lived, 15-30 min)
- Refresh token rotation (long-lived, 7 days)
- Device/session tracking
- SSO-ready architecture (OIDC/SAML support)
- Multi-factor authentication (MFA) support

### File Storage

**Service:** Amazon S3

**Store:**
- PDF reports (with versioning)
- Assessment attachments
- Candidate media (audio/video responses)
- Question bank assets
- Branding assets

**Configuration:**
- Versioning enabled
- Lifecycle policies for archival
- Server-side encryption
- CDN integration (CloudFront)

---

## Scalability & Performance

### Scalability Model

#### Horizontal Scaling

**Requirements:**
- All services/modules must be stateless
- Shared state in Redis
- Load balanced across instances

**Infrastructure:**
- Docker containerization
- Kubernetes orchestration (EKS) or ECS
- Auto-scaling groups
- Load balancer (ALB/NLB)

### Database Scaling Strategy

#### Phase 1 (Current)

- Query optimization
- Strategic indexing
- Connection pooling (PgBouncer)

#### Phase 2 (6 months)

- Read replicas for reporting queries
- Query result caching

#### Phase 3 (12+ months)

- Partitioning by organization/tenant
- Sharding by assessment volume
- Dedicated analytics warehouse

### Heavy Operations Must Be Async

**Examples:**
- AI report generation
- PDF export
- Email delivery
- Analytics aggregation
- Bulk imports

**Implementation:**
- RabbitMQ job queues
- Celery-like job workers
- Retry logic with exponential backoff
- DLQ (Dead Letter Queue) handling

### Performance Targets

| Metric | Target |
|--------|--------|
| API Response Time (95th percentile) | < 300ms |
| Assessment UI Load Time | < 2 seconds |
| Concurrent Assessment Sessions | 10,000+ |
| System Uptime SLA | 99.9% |
| Database Query Time (95th percentile) | < 500ms |
| Report Generation | < 10 seconds |

### Real-Time Architecture (Future)

**Technology:** WebSockets with Socket.IO

**Use Cases:**
- Live assessment progress tracking
- Proctoring event alerts
- Admin dashboard real-time updates
- Notification delivery confirmations

---

## Security & Compliance

### Authentication & Authorization

#### RBAC Hierarchy

1. **Super Admin** — Platform-level access
2. **Organization Admin** — Organization configuration
3. **HR Manager** — Assessment creation and evaluation
4. **Recruiter** — Candidate management
5. **Evaluator** — Assessment review and scoring
6. **Candidate** — Self-assessment access
7. **Observer** — Read-only access

#### JWT Authentication

- Access tokens: 15-30 minute expiry
- Refresh tokens: 7-30 day expiry
- Token rotation on refresh
- Device fingerprinting
- Session revocation capability

### Multi-Tenant Security

#### Recommended Strategy

**Shared database with strict isolation:**
- Tenant isolation keys on all tables
- Row-level access policies
- Audit logging per tenant
- Data export/deletion per tenant

**Future:**
- Dedicated databases for enterprise tenants
- Separate compute resources
- Custom data residency

### Data Security Requirements

**Mandatory:**
- TLS 1.3 for all in-transit data
- AES-256 encryption at rest
- Secrets management (AWS Secrets Manager)
- Field-level encryption for PII
- Comprehensive audit logging
- IP whitelisting for high-privilege operations

### Compliance Readiness

**Target Certifications:**
- GDPR compliance
- CCPA compliance
- SOC 2 Type II
- ISO 27001 (future)

**Key Requirements:**
- Data retention policies
- Right to deletion enforcement
- Consent management
- Audit trail for all sensitive operations
- Incident response procedures

### AI Governance Requirements

**Critical:**
- Explainable AI scoring (transparent algorithms)
- Bias detection and monitoring
- Human override capability
- AI decision audit trails
- Model versioning and tracking
- Fairness metrics and reporting

### Security Monitoring

**Stack:**
- Web Application Firewall (AWS WAF)
- Rate limiting and DDoS protection
- Threat detection and alerting
- Centralized audit logging (CloudWatch)
- Regular penetration testing
- Vulnerability scanning

---

## DevOps & Observability

### Cloud Strategy

**Primary Provider:** Amazon Web Services (AWS)

**Rationale:**
- Managed services reduce operational overhead
- Proven enterprise SaaS infrastructure
- Strong security and compliance certifications
- Regional redundancy options
- Cost optimization tools

### Recommended AWS Services

| Purpose | AWS Service | Reason |
|---------|-------------|--------|
| Compute | ECS/EKS | Container orchestration, auto-scaling |
| Database | RDS PostgreSQL | Managed relational database |
| Cache | ElastiCache Redis | In-memory data store |
| File Storage | S3 | Scalable object storage |
| CDN | CloudFront | Content distribution |
| Secrets | Secrets Manager | Secure credential storage |
| Logging | CloudWatch | Centralized logging |
| Monitoring | CloudWatch | Metrics and alarms |
| CI/CD | CodePipeline | Automated deployment |

### Containerization Strategy

**Standard:**
- Dockerfile per service
- Environment-based configuration
- Immutable container images
- Multi-stage builds for optimization

### CI/CD Pipeline

```
Code Push (GitHub)
    ↓
Linting (ESLint)
    ↓
Unit Tests (Jest)
    ↓
Build Application
    ↓
Integration Tests
    ↓
Security Scans (SNYK, OWASP)
    ↓
Build Docker Image
    ↓
Push to ECR
    ↓
Deploy to Staging
    ↓
Smoke Tests
    ↓
Manual Approval (Production)
    ↓
Production Deployment (Blue-Green)
    ↓
Health Checks
```

### Infrastructure as Code

**Tool:** Terraform

**Benefits:**
- Reproducible infrastructure
- Version-controlled deployments
- Easy scaling and environment parity
- Infrastructure as documentation
- Disaster recovery capabilities

### Observability Stack

#### Logging

**Tool:** Winston or Pino

**Implementation:**
- Structured JSON logging
- Centralized log aggregation (CloudWatch or ELK)
- Log retention policies
- Searchable and filterable logs

#### Monitoring

**Tools:** Prometheus + Grafana

**Metrics:**
- Application metrics (request latency, error rates)
- Database performance
- Cache hit/miss rates
- Queue depth and processing time
- API endpoint latency
- Resource utilization

#### Error Tracking

**Tool:** Sentry

**Tracking:**
- Real-time error alerts
- Error grouping and trending
- Stack traces and context
- Release tracking

#### Distributed Tracing (Future)

**Tool:** Jaeger or DataDog

**Trace:**
- Request flow across services
- Service-to-service latency
- Bottleneck identification

---

## Testing Architecture

### Required Testing Layers

#### 1. Unit Testing

**Framework:** Jest or Vitest

**Coverage Target:**
- 70%+ for critical business logic
- 50%+ for utilities and helpers

**Scope:**
- Service layer functions
- Utility functions
- Validation logic

#### 2. Integration Testing

**Focus:**
- API endpoint testing (Supertest)
- Database workflows
- Queue processing
- External API mocking

**Coverage:**
- Happy paths and error cases
- Edge cases and boundary conditions

#### 3. Contract Testing

**Scope:**
- Internal API contracts (Pact)
- External integration contracts
- Webhook payload validation

#### 4. Load Testing

**Tool:** k6 or Artillery

**Scenarios:**
- Concurrent assessment sessions
- Report generation under load
- API rate limiting
- Database connection pooling

#### 5. Security Testing

**Implementations:**
- Dependency vulnerability scanning (Snyk)
- OWASP Top 10 checks
- JWT and auth flow testing
- SQL injection prevention validation
- XSS prevention checks

---

## Final Recommendations

### Immediate Architecture Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 18+ LTS |
| Framework | Express | 4.19.2 |
| Future Framework | NestJS | 10+ |
| Language | TypeScript | 5.9.3 |
| Database | PostgreSQL | 15+ |
| ORM | Prisma | 6.0.0 |
| Cache | Redis | 7.0+ |
| Queue | RabbitMQ | 4.0+ |
| Storage | AWS S3 | - |
| Container | Docker | Latest |
| Cloud | AWS | - |
| Orchestration | ECS/EKS | - |

### Strategic Long-Term Architecture

**Evolution Path:**

```
Modular Monolith (Now)
    ↓ (6 months)
Express + RabbitMQ (Phase 1)
    ↓ (12 months)
NestJS Modular (Phase 2)
    ↓ (18 months)
Event-Driven Microservices (Phase 3)
    ↓ (24+ months)
Enterprise AI Talent Intelligence Platform
```

**Target Characteristics:**
- Event-driven architecture
- AI-powered assessments
- Multi-tenant SaaS
- Horizontally scalable
- Analytics-first design
- Compliance-ready
- Microservices ready

### Critical Success Factors

**Highest Priority Areas:**

1. **Assessment Scalability** — Support 10K+ concurrent sessions
2. **Psychometric Accuracy** — Maintain test validity and reliability
3. **Multi-Tenant Security** — Strict data isolation and compliance
4. **AI Explainability** — Transparent scoring and decision-making
5. **Async Processing** — Reliable queue and job management
6. **Reporting Performance** — Sub-10 second report generation

### Biggest Technical Risks & Mitigations

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| AI bias in recommendations | Medium | High | Explainable AI framework + human review |
| Heavy analytics load impact | Medium | High | Read replicas + Redis caching + partitioning |
| Performance at 10K concurrent users | Medium | High | Load testing + horizontal scaling + DB optimization |
| Multi-tenant data leakage | Low | Critical | Strict isolation + audit logging + penetration testing |
| Slow report generation | Medium | Medium | Queue-based async + caching + incremental processing |
| Third-party integration failures | Medium | Medium | Webhook fallbacks + retry logic + circuit breakers |

### Recommended Immediate Engineering Tasks

**Priority Order for Implementation:**

1. **Refactor into Strict Bounded Contexts**
   - Separate auth, assessments, analytics, reports modules
   - Clear module boundaries
   - Interface contracts between modules

2. **Introduce Redis Caching Layer**
   - Session caching
   - Question bank caching
   - Report result caching
   - RBAC lookup caching

3. **Add RabbitMQ Async Infrastructure**
   - Email job queue
   - Report generation jobs
   - Notification delivery queue
   - Event processing

4. **Implement RBAC Middleware Architecture**
   - Define role hierarchy
   - Create permission matrix
   - Build RBAC middleware
   - Add audit logging

5. **Build Centralized Audit Logging**
   - User action tracking
   - Configuration changes
   - Data access logs
   - AI decision logs

6. **Introduce Observability Stack**
   - Structured logging (Winston/Pino)
   - Monitoring (Prometheus + Grafana)
   - Error tracking (Sentry)
   - Performance monitoring

7. **Add Performance & Load Testing**
   - k6 load test scenarios
   - Database query optimization
   - Cache effectiveness testing
   - Queue performance testing

8. **Prepare Docker & CI/CD Pipeline**
   - Dockerfile optimization
   - ECR registry setup
   - CodePipeline configuration
   - Automated testing in pipeline

9. **Begin NestJS-Compatible Structure**
   - Migrate to dependency injection
   - Modular structure
   - Decorators for route handling
   - Guards and interceptors

10. **Create Analytics Aggregation Service Foundation**
    - Event collection system
    - Aggregation pipeline
    - Real-time dashboard support
    - Historical analytics storage

---

## Implementation Roadmap

### Phase 1: Foundation (Months 1-3)

- Tasks 1-4: Module refactoring, Redis, RabbitMQ, RBAC
- Goal: Scalable monolith foundation

### Phase 2: Intelligence (Months 4-9)

- Tasks 5-7: Observability, testing, performance
- Goal: Production-ready with monitoring

### Phase 3: Enterprise (Months 10+)

- Tasks 8-10: CI/CD, NestJS migration, analytics
- Goal: Microservices-ready architecture

