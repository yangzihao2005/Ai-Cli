#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { DEFAULT_PRESET_ID, PRESET_LIST, getPreset } from './presets';
import { discoverSkills, mountSkills } from './skills';
import { switchMode } from './switch';
import { buildAgentsFiles, ensureProjectDocs, writeAgentsFiles } from './template';
import type { Mode, PresetId, SkillMountStrategy } from './types';

/** 母版默认目录，可用 AI_TEMPLATE_DIR 覆盖。 */
const DEFAULT_TEMPLATE_DIR = 'D:\\Necessary_md';

function getTemplateDir(): string {
  const fromEnv = process.env.AI_TEMPLATE_DIR?.trim();
  return fromEnv ? resolve(fromEnv) : DEFAULT_TEMPLATE_DIR;
}

function getVersion(): string {
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printHelp(): void {
  console.log(
    [
      '',
      pc.bold('aci') + pc.dim(' - AI Context Initializer'),
      '',
      pc.bold('用法：'),
      '  aci                     交互式初始化当前目录',
      '  aci init [--symlink]    同上；--symlink 用目录链接挂载 Skills',
      '  aci switch              在 Fast / Learn 模式之间切换',
      '  aci --help              显示帮助',
      '  aci --version           显示版本',
      '',
      pc.bold('环境变量：'),
      '  AI_TEMPLATE_DIR         母版目录，默认 D:\\Necessary_md',
      '',
    ].join('\n'),
  );
}

/** clack 取消时返回 symbol，这里统一转成正常退出。 */
function unwrap<T>(value: T | typeof p.CANCEL_SYMBOL): T {
  if (p.isCancel(value)) {
    p.cancel('操作已取消');
    process.exit(0);
  }
  return value;
}

async function runInit(args: string[]): Promise<void> {
  const targetDir = process.cwd();
  const templateDir = getTemplateDir();
  const fastPath = join(templateDir, 'AGENTS.fast.md');
  const learnPath = join(templateDir, 'AGENTS.learn.md');

  if (!existsSync(fastPath) || !existsSync(learnPath)) {
    throw new Error(`母版目录缺少 AGENTS.fast.md 或 AGENTS.learn.md：${templateDir}`);
  }

  p.intro(pc.bgCyan(pc.black(' aci · AI Context Initializer ')));

  if (existsSync(join(targetDir, 'AGENTS.md'))) {
    const overwrite = unwrap(
      await p.confirm({
        message: '当前目录已存在 AGENTS.md，继续会覆盖它，是否继续？',
        initialValue: false,
      }),
    );
    if (!overwrite) {
      p.cancel('已取消，未修改任何文件');
      return;
    }
  }

  const presetId = unwrap(
    await p.select<PresetId>({
      message: '选择技术栈预设',
      options: PRESET_LIST.map((preset) => ({
        value: preset.id,
        label: preset.label,
        hint: preset.hint,
      })),
      initialValue: DEFAULT_PRESET_ID,
    }),
  );

  const preset = getPreset(presetId);
  if (!preset) throw new Error(`未知的技术栈预设：${presetId}`);

  const mode = unwrap(
    await p.select<Mode>({
      message: '选择初始模式',
      options: [
        { value: 'fast', label: 'Fast', hint: '效率优先：直接交付，少解释' },
        { value: 'learn', label: 'Learn', hint: '学习优先：讲透原理，核心逻辑留白' },
      ],
      initialValue: 'fast',
    }),
  );

  const availableSkills = discoverSkills(templateDir);
  let selectedSkills: string[] = [];

  if (availableSkills.length === 0) {
    p.log.info('当前未检测到 SKILLS 目录，已跳过技能挂载');
  } else {
    selectedSkills = unwrap(
      await p.multiselect<string>({
        message: '选择要挂载的 Skills（空格选择，回车确认）',
        options: availableSkills.map((name) => ({ value: name, label: name })),
        required: false,
      }),
    );
    if (selectedSkills.length === 0) {
      p.log.info('未选择任何 Skill，已跳过技能挂载');
    }
  }

  const strategy: SkillMountStrategy = args.includes('--symlink') ? 'symlink' : 'copy';
  const files = buildAgentsFiles(
    readFileSync(fastPath, 'utf8'),
    readFileSync(learnPath, 'utf8'),
    preset,
    mode,
  );
  const written = writeAgentsFiles(targetDir, files);
  const docs = ensureProjectDocs(targetDir);

  p.log.success(`已生成 ${written.join('、')}`);
  if (docs.length > 0) {
    p.log.success(`已生成 ${docs.join('、')}`);
  }

  if (selectedSkills.length > 0) {
    const mounted = mountSkills({
      templateDir,
      targetDir,
      skills: selectedSkills,
      strategy,
    });

    for (const item of mounted) {
      if (item.warning === 'broken-link') {
        p.log.warn(`${item.name} 的挂载链接已失效，已保留原链接；请检查母版目录是否被移动`);
      } else if (item.status === 'mounted') {
        p.log.success(`已挂载 Skill：${item.name}（${item.strategy}）`);
      } else {
        p.log.info(`已跳过 Skill：${item.name}（目标已存在）`);
      }
    }
  }

  p.note(
    [
      `目录：${targetDir}`,
      `母版：${templateDir}`,
      `预设：${preset.label}`,
      `模式：${mode === 'fast' ? 'Fast' : 'Learn'}`,
      `Skills：${selectedSkills.length > 0 ? selectedSkills.join('、') : '未挂载'}`,
    ].join('\n'),
    '初始化完成',
  );
  p.outro(`随时运行 ${pc.cyan('aci switch')} 切换 Fast / Learn 模式`);
}

function runSwitch(): void {
  const result = switchMode(process.cwd());
  const label = result.to === 'fast' ? 'Fast（效率模式）' : 'Learn（学习模式）';

  console.log('');
  console.log(
    `  ${pc.bgCyan(pc.black(` ${result.from.toUpperCase()} → ${result.to.toUpperCase()} `))}  ${pc.bold(label)}`,
  );
  console.log(pc.dim(`  ${result.activePath}`));
  console.log('');
  p.outro(`已切换到 ${label}，再次运行 ${pc.cyan('aci switch')} 可切回`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const first = args[0];

  if (first === '-h' || first === '--help' || first === 'help') {
    printHelp();
    return;
  }
  if (first === '-v' || first === '--version' || first === 'version') {
    console.log(getVersion());
    return;
  }

  const command = first && !first.startsWith('-') ? first : 'init';

  if (command === 'switch') {
    runSwitch();
    return;
  }
  if (command === 'init') {
    await runInit(args);
    return;
  }

  console.error(pc.red(`未知命令：${command}`));
  printHelp();
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  p.cancel(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
