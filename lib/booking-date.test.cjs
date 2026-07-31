const test = require('node:test')
const assert = require('node:assert/strict')
const { buildDateKeyFromParts, addDaysToDateKey } = require('./booking-date.js')

test('buildDateKeyFromParts preserves the selected calendar date', () => {
  assert.equal(buildDateKeyFromParts(2025, 8, 2), '2025-08-02')
  assert.equal(buildDateKeyFromParts(2025, 1, 1), '2025-01-01')
})

test('addDaysToDateKey handles month transitions correctly', () => {
  assert.equal(addDaysToDateKey('2025-07-31', 1), '2025-08-01')
  assert.equal(addDaysToDateKey('2025-12-31', 1), '2026-01-01')
})
