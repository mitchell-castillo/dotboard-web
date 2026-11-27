import fs from 'node:fs';
import { hosting as diagnosticHosting } from './SwaArtifact.mjs';
import { readArtifact, validateArtifactFiles } from './PublicArtifact.mjs';
import { LOCAL_API_BASE } from '../frontend-auth/internal-session-transport.mjs';

export const fullConfig = Object.freeze({provider: 'internal', apiBaseUrl: LOCAL_API_BASE});
export const hosting = {
  globalHeaders: {
    ...diagnosticHosting.globalHeaders,
    'Content-Security-Policy': [
      "default-src 'none'", "script-src 'self'", "style-src 'self'", "style-src-attr 'unsafe-inline'",
      "connect-src 'self' " + LOCAL_API_BASE + '/', "img-src 'self' data:", "base-uri 'none'",
      "form-action 'none'", "frame-ancestors 'none'", "object-src 'none'",
    ].join('; '),
  },
  routes: [{route: '/.auth/login/aad', statusCode: 404}, {route: '/api/*', statusCode: 404}],
};

export function auditFull(entries) {
  if (entries['dotboard-config.json'] !== JSON.stringify(fullConfig)) throw Error('Unexpected login configuration');
  if (JSON.stringify(JSON.parse(entries['staticwebapp.config.json'])) !== JSON.stringify(hosting)) throw Error('Hosting differs');
  const core = {...entries};
  delete core['staticwebapp.config.json'];
  for (const page of ['app.html', 'identity.html']) {
    if (!core[page] || core[page] !== core['index.html']) throw Error('Login entry differs: ' + page);
    delete core[page];
  }
  if (core['index.html'].includes('http') || !core['index.html'].includes('/assets/')) throw Error('External entry');
  validateArtifactFiles(core);
}

if (process.argv[2] === 'full-prepare') {
  const dir = 'frontend-auth/dist-full/';
  for (const alias of ['index.html', 'identity.html']) fs.copyFileSync(dir + 'app.html', dir + alias);
  fs.writeFileSync(dir + 'dotboard-config.json', JSON.stringify(fullConfig));
  fs.writeFileSync(dir + 'staticwebapp.config.json', JSON.stringify(hosting));
}
if (['full-prepare', 'full-check'].includes(process.argv[2])) {
  auditFull(readArtifact('frontend-auth/dist-full'));
  console.log('Verified internal sign-in artifact.');
}
