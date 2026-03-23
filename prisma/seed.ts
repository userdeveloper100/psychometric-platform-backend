import { PrismaClient, Role, TestStatus, InviteStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {

    console.log("🌱 Seeding database...");

    // ----------------------------
    // 1️⃣ Create Institute
    // ----------------------------
    const institute = await prisma.institute.create({
        data: {
            name: "Demo Psychology Institute",
            email: "admin@psychometric.com",
        },
    });

    console.log("Institute created");

    // ----------------------------
    // 2️⃣ Create Admin User
    // ----------------------------
    const password = await bcrypt.hash("Admin@123", 10);

    const admin = await prisma.user.create({
        data: {
            email: "admin@psychometric.com",
            password,
            role: Role.ADMIN,
            instituteId: institute.id,
        },
    });

    console.log("Admin user created");

    // ----------------------------
    // 3️⃣ Create Tests
    // ----------------------------
    const tests = [];

    for (let i = 1; i <= 2; i++) {
        const test = await prisma.psychometricTest.create({
            data: {
                title: `Personality Test ${i}`,
                description: "Sample personality assessment",
                status: TestStatus.PUBLISHED,
                instituteId: institute.id,
            },
        });

        tests.push(test);
    }

    console.log("Tests created");

    // ----------------------------
    // 4️⃣ Create Dimensions
    // ----------------------------
    const dimensions = [];

    const dimensionNames = [
        "Extraversion",
        "Agreeableness",
        "Conscientiousness",
        "Emotional Stability",
        "Openness",
    ];

    for (const test of tests) {
        for (const name of dimensionNames) {
            const dimension = await prisma.dimension.create({
                data: {
                    name,
                    testId: test.id,
                },
            });

            dimensions.push(dimension);
        }
    }

    console.log("Dimensions created");

    // ----------------------------
    // 5️⃣ Create Questions
    // ----------------------------
    const questions = [];

    const questionTexts = [
        "I enjoy meeting new people",
        "I stay calm under pressure",
        "I like organizing things",
        "I am open to new ideas",
        "I enjoy social gatherings",
        "I often reflect on my feelings",
        "I work well in teams",
        "I take initiative in group work",
        "I prefer planning ahead",
        "I remain positive during stress",
    ];

    for (const dimension of dimensions) {
        for (let i = 0; i < 10; i++) {
            const question = await prisma.question.create({
                data: {
                    text: questionTexts[i % questionTexts.length],
                    dimensionId: dimension.id,
                    scaleMin: 1,
                    scaleMax: 5,
                },
            });

            questions.push(question);
        }
    }

    console.log("Questions created");

    // ----------------------------
    // 6️⃣ Create Students
    // ----------------------------
    const students = [];

    for (let i = 1; i <= 30; i++) {
        const student = await prisma.student.create({
            data: {
                name: `Student ${i}`,
                email: `student${i}@mail.com`,
                instituteId: institute.id,
            },
        });

        students.push(student);
    }

    console.log("Students created");

    // ----------------------------
    // 7️⃣ Create Invites
    // ----------------------------
    const invites = [];

    for (const student of students) {
        const invite = await prisma.testInvite.create({
            data: {
                testId: tests[0].id,
                studentId: student.id,
                token: uuidv4(),
                status: InviteStatus.PENDING,
            },
        });

        invites.push(invite);
    }

    console.log("Invites created");

    // ----------------------------
    // 8️⃣ Create Responses
    // ----------------------------
    for (const student of students) {

        for (const question of questions.slice(0, 50)) {

            await prisma.response.create({
                data: {
                    studentId: student.id,
                    questionId: question.id,
                    answer: Math.floor(Math.random() * 5) + 1,
                },
            });

        }

    }

    console.log("Responses created");

    console.log("✅ Database seeded successfully");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });