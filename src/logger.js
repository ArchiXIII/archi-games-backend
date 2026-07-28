'use strict';

function write(level, data) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    ...data
  };
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else console.log(output);
}

module.exports = {
  info(data) {
    write('info', data);
  },
  warn(data) {
    write('warn', data);
  },
  error(data) {
    write('error', data);
  }
};
