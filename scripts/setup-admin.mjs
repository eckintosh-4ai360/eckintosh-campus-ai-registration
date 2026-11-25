import {randomBytes, scryptSync} from 'node:crypto';
import {readFile, writeFile, chmod} from 'node:fs/promises';

const email = process.env.ADMIN_SETUP_EMAIL?.trim();
const password = process.env.ADMIN_SETUP_PASSWORD;
if (!email || !password || email.length > 254 || password.length > 256 || /[\r\n=]/.test(email)) {
  console.error('Set ADMIN_SETUP_EMAIL and ADMIN_SETUP_PASSWORD before running this script.');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = `${salt.toString('hex')}:${scryptSync(password, salt, 32).toString('hex')}`;
const values = {ADMIN_EMAIL:email, ADMIN_PASSWORD_HASH:hash, ADMIN_SESSION_SECRET:randomBytes(32).toString('hex')};
let contents = await readFile('.env','utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
for (const [key,value] of Object.entries(values)) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(contents)) contents = contents.replace(pattern, () => `${key}=${value}`);
  else contents += `${contents && !contents.endsWith('\n') ? '\n' : ''}${key}=${value}\n`;
}
await writeFile('.env', contents, {mode:0o600});
await chmod('.env', 0o600);
console.log('Admin credentials configured in .env. Restart the local server.');
