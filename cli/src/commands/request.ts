import { getConfig } from '../utils/config';

interface RequestOptions {
  project?: string;
  description?: string;
}

export async function requestCommand(service: string, options: RequestOptions) {
  const config = await getConfig();
  const serverUrl = config.serverUrl || 'http://localhost:8080';

  const body = {
    type: 'token',
    service,
    project: options.project,
    description: options.description,
    requestedAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${serverUrl}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`✓ 토큰 요청 생성됨: ${data.id}`);
    console.log(`  서비스: ${service}`);
    console.log(`  프로젝트: ${options.project || '(미지정)'}`);
    console.log('');
    console.log('웹에서 승인 대기 중...');
    console.log(`${serverUrl}/requests/${data.id}`);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
