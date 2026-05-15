# Backend Architecture

## Project Overview

This is a psychometric assessment platform backend.

Main responsibilities:

* User authentication
* Assessment management
* Question management
* Test submission
* Psychometric scoring
* Report generation
* Analytics

Tech Stack:

* Node.js
* Express/NestJS
* PostgreSQL
* Sequelize ORM
* JWT Authentication

---

## Folder Structure

src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── assessments/
│   ├── questions/
│   ├── submissions/
│   ├── reports/
│   └── analytics/
│
├── common/
│   ├── middleware/
│   ├── guards/
│   ├── utils/
│   ├── constants/
│   └── exceptions/
│
├── database/
├── config/
└── tests/

---

## Request Flow

Client Request
→ Route
→ Middleware
→ Authentication Guard
→ Controller
→ Service
→ Repository/ORM
→ PostgreSQL
→ Response DTO

Validation happens before controller execution.

Error handling is centralized using global exception middleware.

---

## Authentication Flow

Authentication type:

* JWT Access Token
* Refresh Token

Flow:

1. User logs in
2. JWT token generated
3. Token sent in Authorization header
4. Middleware validates token
5. User context attached to request

Protected APIs require JWT authentication.

---

## Database Relationships

Main Tables:

* users
* assessments
* questions
* assessment_submissions
* reports

Relationships:

* One user can submit many assessments
* One assessment has many questions
* One submission belongs to one user
* One report belongs to one submission

---

## External Integrations

Current Integrations:

* Email Service
* Analytics APIs

Future Integrations:

* Payment Gateway
* AI Report Generation

---

## Caching Strategy

Current:

* No Redis cache

Future Plan:

* Redis for:

  * session caching
  * assessment metadata
  * analytics aggregation

---

## Queue / Background Jobs

Planned:

* Report generation queue
* Email queue
* Analytics processing queue

Suggested:

* BullMQ + Redis

---

## Coding Standards

Architecture:

* Service-based architecture
* Repository pattern
* DTO validation

Rules:

* No business logic in controllers
* Centralized error handling
* Use async/await
* Proper logging required
* Unit tests required for services

Testing:

* Jest
* Integration testing for APIs
