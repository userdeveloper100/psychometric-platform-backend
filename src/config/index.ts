import { config } from 'dotenv';

config();

const dbConfig = {
  url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/mydb',
};

const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your_jwt_secret',
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
};

export default {
  db: dbConfig,
  jwt: jwtConfig,
  PORT: process.env.PORT || 5000,
};