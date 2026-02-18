#!/usr/bin/env node
import { Command } from 'commander';
import { runCommand } from './commands/run';
import { secretsCommand } from './commands/secrets';
import { requestCommand } from './commands/request';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('greyzone')
  .description('환경변수 주입 및 승인 요청 CLI')
  .version('0.1.0');

// greyzone run -- <command>
program
  .command('run')
  .description('환경변수를 주입하여 명령어 실행')
  .option('-p, --project <project>', '프로젝트명')
  .option('-c, --config <config>', '환경 (dev/staging/prod)', 'dev')
  .option('-e, --env <env...>', '추가 환경변수 (KEY=VALUE)')
  .allowUnknownOption()
  .action(runCommand);

// greyzone secrets
program
  .command('secrets')
  .description('환경변수 조회')
  .option('-p, --project <project>', '프로젝트명')
  .option('-c, --config <config>', '환경', 'dev')
  .option('-f, --format <format>', '출력 형식 (env/json)', 'env')
  .action(secretsCommand);

// greyzone request-token <service>
program
  .command('request-token <service>')
  .description('토큰 요청 (웹에서 승인 필요)')
  .option('-p, --project <project>', '프로젝트명')
  .option('-d, --description <desc>', '설명')
  .action(requestCommand);

// greyzone config
program
  .command('config')
  .description('설정 관리')
  .argument('<action>', 'get/set')
  .argument('[key]', '설정 키')
  .argument('[value]', '설정 값')
  .action(configCommand);

program.parse();
