import { getConfig, setConfig, getConfigValue } from '../utils/config';

export async function configCommand(action: string, key?: string, value?: string) {
  if (action === 'get') {
    if (key) {
      const val = await getConfigValue(key);
      if (val !== undefined) {
        console.log(val);
      } else {
        console.error(`설정 키를 찾을 수 없음: ${key}`);
        process.exit(1);
      }
    } else {
      const config = await getConfig();
      console.log(JSON.stringify(config, null, 2));
    }
  } else if (action === 'set') {
    if (!key || value === undefined) {
      console.error('Usage: greyzone config set <key> <value>');
      process.exit(1);
    }
    await setConfig(key, value);
    console.log(`✓ 설정됨: ${key} = ${value}`);
  } else {
    console.error(`알 수 없는 액션: ${action}`);
    console.error('Usage: greyzone config get [key]');
    console.error('       greyzone config set <key> <value>');
    process.exit(1);
  }
}
