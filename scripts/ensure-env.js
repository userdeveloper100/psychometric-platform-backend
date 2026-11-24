/* eslint-disable no-console */
// Creates .env from .env.example on first run. An existing .env is never overwritten.
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const EXAMPLE_PATH = path.join(PROJECT_ROOT, '.env.example');
const PLACEHOLDER = 'CHANGE_ME';

// Used only if .env.example is missing from the checkout.
const FALLBACK_TEMPLATE = [
  'PORT=5001',
  'DATABASE_URL="postgresql://psychometric:local_dev_password@localhost:5433/psychometric_db?schema=public"',
  `JWT_SECRET=${PLACEHOLDER}`,
  'NODE_ENV=development',
  'REDIS_URL=redis://localhost:6379',
  'CORS_ORIGINS=http://localhost:5173',
  '',
].join('\n');

const createEnvFile = () => {
  if (fs.existsSync(ENV_PATH)) {
    return false;
  }

  const template = fs.existsSync(EXAMPLE_PATH)
    ? fs.readFileSync(EXAMPLE_PATH, 'utf8')
    : FALLBACK_TEMPLATE;

  try {
    // 'wx' fails if .env appears between the check above and this write,
    // so an existing file is never overwritten.
    fs.writeFileSync(ENV_PATH, template, { flag: 'wx' });
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') {
      return false;
    }
    throw error;
  }
};

const warnAboutPlaceholders = () => {
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  const placeholderKeys = lines
    .filter((line) => line.includes(PLACEHOLDER) && !line.trimStart().startsWith('#'))
    .map((line) => line.split('=')[0].trim());

  if (placeholderKeys.length > 0) {
    console.warn(
      `[env] .env still has placeholder values for: ${placeholderKeys.join(', ')}. ` +
        'Replace them with real values before starting the server.'
    );
  }
};

const created = createEnvFile();

if (created) {
  console.log('[env] Created .env from the template (.env.example).');
  console.log('[env] Review .env and fill in every CHANGE_ME value (JWT_SECRET, and DATABASE_URL if your setup differs).');
}

if (fs.existsSync(ENV_PATH)) {
  warnAboutPlaceholders();
}
