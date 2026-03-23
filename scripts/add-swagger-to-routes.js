/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const MODULES_DIR = path.join(PROJECT_ROOT, 'src', 'modules');

const TAG_MAP = {
  auth: 'Auth',
  institute: 'Institutes',
  institutes: 'Institutes',
  tests: 'Tests',
  test: 'Tests',
  dimensions: 'Dimensions',
  dimension: 'Dimensions',
  questions: 'Questions',
  question: 'Questions',
  students: 'Students',
  student: 'Students',
  invites: 'Invites',
  invite: 'Invites',
  responses: 'Responses',
  response: 'Responses',
  reports: 'Reports',
  report: 'Reports'
};

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(full));
    else if (e.isFile() && e.name.endsWith('.routes.ts')) files.push(full);
  }
  return files;
}

function getModuleTag(filePath) {
  const parts = filePath.split(path.sep);
  const idx = parts.lastIndexOf('modules');
  const moduleName = idx >= 0 ? parts[idx + 1] : 'common';
  return TAG_MAP[moduleName?.toLowerCase()] || 'Common';
}

function toOpenApiPath(routePath) {
  let p = routePath.startsWith('/') ? routePath : `/${routePath}`;
  p = p.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
  return `/api/v1${p}`;
}

function extractPathParams(routePath) {
  const params = [];
  const re = /:([a-zA-Z0-9_]+)/g;
  let m;
  while ((m = re.exec(routePath)) !== null) params.push(m[1]);
  return params;
}

function isProtected(argsText) {
  return /(authenticateJWT|authMiddleware|authorizeRoles|roleMiddleware|verifyToken|auth)/i.test(argsText);
}

function buildSwaggerBlock({ method, routePath, tag, protectedRoute }) {
  const http = method.toLowerCase();
  const openApiPath = toOpenApiPath(routePath);
  const params = extractPathParams(routePath);

  const summaryMap = {
    get: 'Retrieve resource',
    post: 'Create resource',
    put: 'Update resource',
    patch: 'Partially update resource',
    delete: 'Delete resource'
  };

  const lines = [];
  lines.push('/**');
  lines.push(' * @swagger');
  lines.push(` * ${openApiPath}:`);
  lines.push(` *   ${http}:`);
  lines.push(` *     summary: ${summaryMap[http] || 'Endpoint'} (${routePath})`);
  lines.push(` *     description: ${tag} API endpoint.`);
  lines.push(` *     tags: [${tag}]`);

  if (protectedRoute) {
    lines.push(' *     security:');
    lines.push(' *       - BearerAuth: []');
  }

  if (params.length) {
    lines.push(' *     parameters:');
    for (const p of params) {
      lines.push(' *       - in: path');
      lines.push(` *         name: ${p}`);
      lines.push(' *         required: true');
      lines.push(` *         description: ${p} identifier`);
      lines.push(' *         schema:');
      lines.push(' *           type: string');
      lines.push(` *           example: "${p}-123"`);
    }
  }

  if (['post', 'put', 'patch'].includes(http)) {
    lines.push(' *     requestBody:');
    lines.push(' *       required: true');
    lines.push(' *       content:');
    lines.push(' *         application/json:');
    lines.push(' *           schema:');
    lines.push(' *             type: object');
    lines.push(' *             additionalProperties: true');
    lines.push(' *           example:');
    lines.push(' *             name: "Sample Name"');
    lines.push(' *             description: "Sample payload"');
  }

  lines.push(' *     responses:');
  lines.push(' *       200:');
  lines.push(' *         description: Request successful');
  lines.push(' *         content:');
  lines.push(' *           application/json:');
  lines.push(' *             schema:');
  lines.push(' *               type: object');
  lines.push(' *               properties:');
  lines.push(' *                 success:');
  lines.push(' *                   type: boolean');
  lines.push(' *                   example: true');
  lines.push(' *                 message:');
  lines.push(' *                   type: string');
  lines.push(' *                   example: "Success"');

  lines.push(' *       201:');
  lines.push(' *         description: Resource created successfully');
  lines.push(' *       400:');
  lines.push(' *         description: Bad request');
  lines.push(' *       404:');
  lines.push(' *         description: Resource not found');
  lines.push(' *       500:');
  lines.push(' *         description: Internal server error');
  lines.push(' */');

  return lines.join('\n');
}

function processFile(filePath) {
  const tag = getModuleTag(filePath);
  const source = fs.readFileSync(filePath, 'utf8');

  const routeRegex =
    /(router\.(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\3\s*,([\s\S]*?)\)\s*;)/gm;

  let match;
  let output = source;
  let offset = 0;
  let changed = false;

  while ((match = routeRegex.exec(source)) !== null) {
    const fullStmt = match[1];
    const method = match[2];
    const routePath = match[4];
    const argsText = match[5];

    const insertPos = match.index + offset;
    const before = output.slice(Math.max(0, insertPos - 500), insertPos);

    if (before.includes('@swagger')) continue;

    const comment = buildSwaggerBlock({
      method,
      routePath,
      tag,
      protectedRoute: isProtected(argsText)
    });

    const replacement = `${comment}\n${fullStmt}`;
    output =
      output.slice(0, insertPos) +
      replacement +
      output.slice(insertPos + fullStmt.length);

    offset += replacement.length - fullStmt.length;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, output, 'utf8');
    console.log(`Updated: ${path.relative(PROJECT_ROOT, filePath)}`);
  } else {
    console.log(`No route matches or already documented: ${path.relative(PROJECT_ROOT, filePath)}`);
  }
}

function main() {
  if (!fs.existsSync(MODULES_DIR)) {
    console.error('src/modules not found');
    process.exit(1);
  }

  const files = walk(MODULES_DIR);
  if (!files.length) {
    console.log('No .routes.ts files found');
    return;
  }

  files.forEach(processFile);
  console.log('\nDone. Restart server and open /api-docs');
}

main();