'use strict';

function numberValue(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

module.exports = { numberValue };
