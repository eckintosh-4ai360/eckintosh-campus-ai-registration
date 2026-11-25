import {readFile} from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in .env before running database setup.');
  process.exit(1);
}
const client = new pg.Client({connectionString: process.env.DATABASE_URL, enableChannelBinding: true, connectionTimeoutMillis: 8000});
try {
  await client.connect();
  await client.query(await readFile(new URL('../database/setup.sql', import.meta.url), 'utf8'));
  console.log('Database schema created successfully. No event was added.');
} catch (error) {
  console.error('Database setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
