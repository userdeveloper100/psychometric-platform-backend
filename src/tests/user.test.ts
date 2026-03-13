import request from 'supertest';
import { app } from '../app'; // Adjust the import based on your app's export
import { prisma } from '../prisma/client';

describe('User API', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany(); // Clear the user table before tests
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/users/register')
      .send({
        username: 'testuser',
        password: 'Password123!',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
  });

  it('should login an existing user', async () => {
    await request(app)
      .post('/api/users/register')
      .send({
        username: 'testuser',
        password: 'Password123!',
      });

    const response = await request(app)
      .post('/api/users/login')
      .send({
        username: 'testuser',
        password: 'Password123!',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });

  it('should return 401 for invalid login', async () => {
    const response = await request(app)
      .post('/api/users/login')
      .send({
        username: 'testuser',
        password: 'WrongPassword!',
      });

    expect(response.status).toBe(401);
  });
});