'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { withSession } = require('./ydb');

function statements(sql) {
  return sql.split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean);
}

function alreadyExists(cause) {
  const text = `${cause && cause.message || ''} ${cause && cause.issues || ''}`.toLowerCase();
  return text.includes('already exist') || text.includes('precondition_failed');
}

async function runMigrations(config, directory = path.join(__dirname, '..', '..', 'migrations')) {
  const files = (await fs.readdir(directory))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(directory, file), 'utf8');
    for (const statement of statements(sql)) {
      try {
        await withSession(config, (session) => session.executeQuery(statement));
      } catch (cause) {
        if (!alreadyExists(cause)) throw cause;
      }
    }
  }
  return files;
}

module.exports = { runMigrations, statements, alreadyExists };
