import { spawn } from 'child_process';
import { loadSecrets } from '../utils/secrets';

interface RunOptions {
  project?: string;
  config?: string;
  env?: string[];
}

export async function runCommand(options: RunOptions, command: any) {
  const args = command.args;
  
  if (args.length === 0) {
    console.error('Error: 실행할 명령어를 지정하세요');
    console.error('Usage: greyzone run -- <command>');
    process.exit(1);
  }

  try {
    // 1. 시크릿 로드 (우선순위: CLI 인자 > Greyzone > 시스템 환경변수)
    const secrets = await loadSecrets({
      project: options.project,
      config: options.config || 'dev',
    });

    // 2. CLI에서 전달된 환경변수 추가 (최우선)
    const cliEnv: Record<string, string> = {};
    if (options.env) {
      for (const e of options.env) {
        const [key, ...valueParts] = e.split('=');
        cliEnv[key] = valueParts.join('='); // 값에 = 있을 수 있음
      }
    }

    // 3. 환경변수 병합
    const env = {
      ...process.env,      // 시스템 환경변수
      ...secrets,          // Greyzone 시크릿
      ...cliEnv,           // CLI 인자 (최우선)
    };

    // 4. 명령어 실행
    const [cmd, ...cmdArgs] = args;
    const child = spawn(cmd, cmdArgs, {
      env,
      stdio: 'inherit',
      shell: true,
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });

    child.on('error', (err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });

  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
