import { env } from './env';

// Compatibility view over the validated environment. Prefer importing `env` directly.
export default {
  db: {
    url: env.DATABASE_URL,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  PORT: env.PORT,
};
