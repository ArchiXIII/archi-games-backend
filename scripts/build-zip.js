'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ZipArchive } = require('archiver');
const { createWriteStream } = require('node:fs');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const stage = path.join(dist, 'package');
const output = path.join(dist, 'archi-games-api.zip');

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function copy(relative) {
  await fs.cp(path.join(root, relative), path.join(stage, relative), { recursive: true });
}

async function zip() {
  await new Promise((resolve, reject) => {
    const stream = createWriteStream(output);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    stream.on('close', resolve);
    stream.on('error', reject);
    archive.on('error', reject);
    archive.pipe(stream);
    archive.glob('**/*', {
      cwd: stage,
      dot: true,
      ignore: [
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
        '**/.github/**',
        '**/.env',
        '**/.env.*',
        '**/*.pem',
        '**/*.key',
        '**/*service-account*.json'
      ]
    });
    archive.finalize();
  });
}

async function main() {
  await fs.rm(stage, { recursive: true, force: true });
  await fs.rm(output, { force: true });
  await fs.mkdir(stage, { recursive: true });
  await Promise.all([
    copy('index.js'),
    copy('src'),
    copy('migrations'),
    copy('package.json'),
    copy('package-lock.json')
  ]);
  if (process.platform === 'win32') {
    await run(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', [
      '/d', '/s', '/c',
      'npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund'
    ], stage);
  } else {
    await run('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], stage);
  }
  await zip();
  await fs.rm(stage, { recursive: true, force: true });
  console.log(output);
}

main().catch((cause) => {
  console.error(cause && cause.message || cause);
  process.exitCode = 1;
});
