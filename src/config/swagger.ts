import swaggerJsDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJsDoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Psychometric Platform API",
            version: "1.0.0",
            description: "API documentation for Psychometric Platform",
        },
        servers: [
            {
                url: "http://localhost:5001",
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            }
        },
        security: [
            {
                BearerAuth: []
            }
        ],
        tags: [
            { name: "Auth", description: "Authentication APIs" },
            { name: "Institutes", description: "Institute management" },
            { name: "Tests", description: "Test management" },
            { name: "Dimensions", description: "Dimension management" },
            { name: "Questions", description: "Question APIs" },
            { name: "Students", description: "Student management" },
            { name: "Invites", description: "Invite management" },
            { name: "Responses", description: "Student responses" },
            { name: "Reports", description: "Analytics reports" },
        ],
    },
    apis: ["./src/modules/**/*.routes.ts"],
});
