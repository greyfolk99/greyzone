import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.greyzone');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface GreyzoneConfig {
  storage: 'local' | 'doppler';
  serverUrl: string;
  doppler?: {
    project?: string;
    config?: string;
  };
}

const DEFAULT_CONFIG: GreyzoneConfig = {
  storage: 'local',
  serverUrl: 'http://localhost:8080',
};

export async function getConfig(): Promise<GreyzoneConfig> {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return DEFAULT_CONFIG;
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setConfig(key: string, value: string): Promise<void> {
  const config = await getConfig();
  
  // 중첩 키 지원 (doppler.project)
  const keys = key.split('.');
  let obj: any = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in obj)) {
      obj[keys[i]] = {};
    }
    obj = obj[keys[i]];
  }
  
  obj[keys[keys.length - 1]] = value;
  
  // 저장
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function getConfigValue(key: string): Promise<string | undefined> {
  const config = await getConfig();
  
  const keys = key.split('.');
  let obj: any = config;
  
  for (const k of keys) {
    if (obj && typeof obj === 'object' && k in obj) {
      obj = obj[k];
    } else {
      return undefined;
    }
  }
  
  return typeof obj === 'string' ? obj : JSON.stringify(obj);
}
