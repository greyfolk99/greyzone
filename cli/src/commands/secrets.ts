import { loadSecrets } from '../utils/secrets';

interface SecretsOptions {
  project?: string;
  config?: string;
  format?: string;
}

export async function secretsCommand(options: SecretsOptions) {
  const secrets = await loadSecrets({
    project: options.project,
    config: options.config || 'dev',
  });

  const format = options.format || 'env';

  if (format === 'json') {
    console.log(JSON.stringify(secrets, null, 2));
  } else {
    // env 형식
    for (const [key, value] of Object.entries(secrets)) {
      // 특수문자 이스케이프
      const escapedValue = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');
      console.log(`${key}="${escapedValue}"`);
    }
  }
}
