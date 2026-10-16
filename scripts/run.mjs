// Node 22의 fetch가 HTTPS_PROXY 환경변수를 따르도록 켠 뒤 tsx로 스크립트를 실행한다.
import { spawn } from 'node:child_process';
const [script, ...rest] = process.argv.slice(2);
const child = spawn('npx', ['tsx', script, ...rest], {
  stdio: 'inherit',
  env: { ...process.env, NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY ?? '1' },
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 1));
