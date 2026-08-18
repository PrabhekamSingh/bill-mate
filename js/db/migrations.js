/**
 * Database Migrations
 * Handle schema version upgrades
 */

import { SCHEMA_VERSION } from './schema.js';

export const MIGRATIONS = {
  // Example future migration:
  // 2: (db) => {
  //   db.run(`ALTER TABLE customers ADD COLUMN gstin TEXT`);
  // },
};

export async function runMigrations(db) {
  const result = db.exec('SELECT version FROM schema_version');
  let currentVersion = 1;

  if (result.length > 0 && result[0].values.length > 0) {
    currentVersion = result[0].values[0][0];
  }

  for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
    if (MIGRATIONS[v]) {
      console.log(`Running migration to version ${v}`);
      MIGRATIONS[v](db);
    }
  }

  if (currentVersion !== SCHEMA_VERSION) {
    db.run(`UPDATE schema_version SET version = ${SCHEMA_VERSION}`);
  }
}