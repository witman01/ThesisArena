process.env.THESISARENA_DB = 'data/_schema_test.db';
import { rmSync } from 'node:fs';
import { getDb } from '../src/lib/db/schema';

const d = getDb();
const tables = d
  .prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name")
  .all() as { name: string }[];
console.log('tables:', tables.map((t) => t.name).join(', '));
d.close();
for (const f of ['', '-wal', '-shm']) rmSync(`data/_schema_test.db${f}`, { force: true });

export {};
