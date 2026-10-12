// Mocha root hooks (loaded via --require, see package.json).
// Every test starts from the fixtures in seed.sql, so tests neither depend on each other nor need to clean up after themselves.

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'

const DATA_DIR = process.env.PB_DATA_DIR
const SEED = readFileSync(new URL('./seed.sql', import.meta.url), 'utf8')

// Run SQL against the test database directly, e.g. to set up state that can't be created via the API
export function sqlite(input) {
    return execFileSync('sqlite3', ['-bail', `${DATA_DIR}/data.db`], { input: `.timeout 5000\n${input}`, encoding: 'utf8' })
}

// Empty all non-system tables (including ones created by tests, e.g. settings) and re-insert the fixtures
function resetData() {
    const tables = sqlite("select name from sqlite_master where type = 'table' and name not like '\\_%' escape '\\' and name not like 'sqlite\\_%' escape '\\';")
        .split('\n')
        .filter((t) => t)
    sqlite(`BEGIN; ${tables.map((t) => `DELETE FROM "${t}";`).join(' ')} COMMIT;\n${SEED}`)
}

export const mochaHooks = {
    beforeAll() {
        if (!DATA_DIR) throw new Error('PB_DATA_DIR is not set, run tests via run_tests.sh')
    },
    beforeEach() {
        resetData()
    },
}
