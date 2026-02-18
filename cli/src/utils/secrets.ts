import { getConfig } from './config';
import { execSync } from 'child_process';

interface LoadSecretsOptions {
  project?: string;
  config?: string;
}

export async function loadSecrets(options: LoadSecretsOptions): Promise<Record<string, string>> {
  const config = await getConfig();
  const storage = config.storage || 'local';

  if (storage === 'doppler') {
    return loadFromDoppler(options);
  } else {
    return loadFromLocal(options);
  }
}

/**
 * Doppler에서 시크릿 로드 (래핑)
 */
async function loadFromDoppler(options: LoadSecretsOptions): Promise<Record<string, string>> {
  const project = options.project || process.env.GREYZONE_PROJECT;
  const configEnv = options.config || 'dev';

  if (!project) {
    console.warn('Warning: 프로젝트가 지정되지 않음. doppler.yaml 또는 --project 사용');
  }

  try {
    // doppler secrets --json 실행
    const args = ['secrets', '--json'];
    if (project) args.push('--project', project);
    args.push('--config', configEnv);

    const result = execSync(`doppler ${args.join(' ')}`, {
      encoding: 'utf-8',
      timeout: 30000,
    });

    const secrets = JSON.parse(result);
    
    // Doppler 응답 형식: { KEY: { computed: "value" }, ... }
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(secrets)) {
      if (typeof value === 'object' && value !== null && 'computed' in value) {
        env[key] = (value as any).computed;
      }
    }
    
    return env;
  } catch (error: any) {
    // Doppler 실패 시 fallback
    console.warn(`Warning: Doppler 로드 실패, 로컬로 fallback: ${error.message}`);
    return loadFromLocal(options);
  }
}

/**
 * 로컬 저장소에서 시크릿 로드
 */
async function loadFromLocal(options: LoadSecretsOptions): Promise<Record<string, string>> {
  const config = await getConfig();
  const serverUrl = config.serverUrl || 'http://localhost:8080';
  const project = options.project;
  const configEnv = options.config || 'dev';

  if (!project) {
    return {};
  }

  try {
    const response = await fetch(
      `${serverUrl}/api/secrets/${project}/${configEnv}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.secrets || {};
  } catch (error: any) {
    console.warn(`Warning: 로컬 서버 로드 실패: ${error.message}`);
    return {};
  }
}

/**
 * 환경변수 값 파싱 (엣지 케이스 처리)
 */
export function parseEnvValue(value: string): string {
  // 멀티라인 처리
  if (value.includes('\\n')) {
    value = value.replace(/\\n/g, '\n');
  }
  
  // 따옴표 제거
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  
  return value;
}
