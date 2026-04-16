
# Psychometric Platform Backend

Backend API for the Psychometric Assessment Platform built with **Node.js, Express, TypeScript, Prisma, and PostgreSQL**.

---

## Tech Stack

* Node.js
* Express
* TypeScript
* Prisma ORM
* PostgreSQL
* Swagger API Documentation

---

## Project Architecture

Controller → Service → Prisma

Modules:

* Auth
* Institutes
* Tests
* Dimensions
* Questions
* Students
* Invites
* Responses
* Reports

---

## Installation

Install dependencies:

```
npm install
```

---

## Run Development Server

```
npm run dev
```

---

## Build Project

```
npm run build
```

---

## Run Production Server

```
npm start
```

---

## API Documentation

Swagger documentation is available at:

```
http://localhost:5000/api-docs
```

---

## Generate Swagger Documentation for Routes

A helper script automatically adds Swagger JSDoc comments to route files.

Run it from project root:

```
node .\scripts\add-swagger-to-routes.js
```

This script scans all route files inside:

```
src/modules/**/*.routes.ts
```

and injects Swagger documentation templates.

---

## API Versioning

All APIs follow versioned routes:

```
/api/v1/*
```

Example:

```
GET /api/v1/students
POST /api/v1/tests
```

---

## Versioning Strategy

Semantic versioning is used:

```
MAJOR.MINOR.PATCH
```

Example:

```
0.1.0 – Initial development
0.2.0 – Swagger documentation
0.3.0 – Redis caching
1.0.0 – First stable release
```

---

## Health Check Endpoint

```
GET /health
```

Response:

```
{
  "status": "ok"
}
```

---

## Author

Shailendra Pardeshi
=======
# Psychometric Testing Platform Backend

This is the backend for a SaaS Psychometric Testing Platform built with Node.js, Express.js, TypeScript, Prisma ORM, and PostgreSQL. The application provides an API for managing user accounts and conducting psychometric tests.

## Features

- User registration and authentication with JWT
- Secure password storage using bcrypt
- RESTful API for user management
- Centralized error handling
- Type-safe code with TypeScript
- Database interactions using Prisma ORM

## Technologies Used

- Node.js
- Express.js
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT for authentication
- bcrypt for password hashing

## Project Structure

```
psychometric-platform-backend
├── src
│   ├── app.ts
│   ├── server.ts
│   ├── config
│   │   └── index.ts
│   ├── controllers
│   │   └── user.controller.ts
│   ├── routes
│   │   └── user.routes.ts
│   ├── middlewares
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   ├── services
│   │   └── user.service.ts
│   ├── models
│   │   └── user.model.ts
│   ├── prisma
│   │   └── client.ts
│   ├── utils
│   │   └── jwt.ts
│   ├── types
│   │   └── index.ts
│   └── tests
│       └── user.test.ts
├── prisma
│   └── schema.prisma
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- PostgreSQL (version 12 or higher)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/userdeveloper100/psychometric-platform-backend.git
   cd psychometric-platform-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up the database:
   - Create a PostgreSQL database and update the connection string in the `.env` file.

4. Run the Prisma migrations:
   ```
   npx prisma migrate dev --name init
   ```

5. Start the server:
   ```
   npm run start
   ```

### Usage

- The API is available at `http://localhost:3000/api`.
- Use tools like Postman or curl to interact with the API endpoints.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
