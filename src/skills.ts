import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import type { SkillMountStrategy } from './types';

/** 单个技能的挂载结果。 */
export interface MountedSkill {
  /** 技能目录名，例如 `frontend-design`。 */
  name: string;
  /** 母版中的源目录绝对路径。 */
  source: string;
  /** 目标项目中的挂载路径（绝对路径）。 */
  destination: string;
  /** 实际使用的挂载方式。 */
  strategy: SkillMountStrategy;
  /** 已挂载；目标已存在时跳过，绝不覆盖。 */
  status: 'mounted' | 'skipped';
  /** 仅 skipped 时出现：目标是一个指向已不存在目录的链接。 */
  warning?: 'broken-link';
}

/** `mountSkills` 的入参。 */
export interface MountSkillsOptions {
  /** 母版根目录（其下应有 SKILLS 子目录）。 */
  templateDir: string;
  /** 目标项目根目录（技能会放到 `.opencode/skills/`）。 */
  targetDir: string;
  /** 要挂载的技能目录名列表。 */
  skills: readonly string[];
  /** 复制或软链接。 */
  strategy: SkillMountStrategy;
}

/**
 * 扫描 `<templateDir>/SKILLS` 下的技能子目录。
 * 目录不存在、为空、或同名路径是普通文件时返回 `[]`，绝不抛 `ENOENT`。
 */
export function discoverSkills(templateDir: string): string[] {
  const skillsRoot = join(resolve(templateDir), 'SKILLS');

  if (!existsSync(skillsRoot)) return [];
  if (!statSync(skillsRoot).isDirectory()) return [];

  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** 技能名只能是单层目录名，禁止 `..` 与路径分隔符。 */
function isValidSkillName(name: string): boolean {
  return name.length > 0 && name !== '.' && name !== '..' && !/[\\/]/.test(name);
}

/**
 * 判断目标路径状态。
 * `existsSync` 会跟随链接，因此断链必须先用 `lstatSync` 捕获。
 */
function destinationState(destination: string): 'missing' | 'healthy' | 'broken-link' {
  try {
    const stats = lstatSync(destination);
    if (stats.isSymbolicLink() && !existsSync(destination)) return 'broken-link';
    return 'healthy';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw error;
  }
}

/**
 * 把选中的技能挂载到 `<targetDir>/.opencode/skills/<name>`。
 * 目标已存在时跳过（`status: 'skipped'`），避免覆盖用户本地修改；
 * 断链会保留原链接并返回 `warning: 'broken-link'`。
 */
export function mountSkills(options: MountSkillsOptions): MountedSkill[] {
  // 先校验全部技能名，避免写到一半才发现非法输入。
  for (const name of options.skills) {
    if (!isValidSkillName(name)) throw new Error(`非法技能名：${name}`);
  }
  if (options.skills.length === 0) return [];

  const skillsSourceRoot = join(resolve(options.templateDir), 'SKILLS');
  const skillsTargetRoot = join(resolve(options.targetDir), '.opencode', 'skills');
  const results: MountedSkill[] = [];

  mkdirSync(skillsTargetRoot, { recursive: true });

  for (const name of options.skills) {
    const source = join(skillsSourceRoot, name);
    const destination = join(skillsTargetRoot, name);
    const state = destinationState(destination);

    if (state === 'broken-link') {
      results.push({
        name,
        source,
        destination,
        strategy: options.strategy,
        status: 'skipped',
        warning: 'broken-link',
      });
      continue;
    }

    if (state === 'healthy') {
      results.push({
        name,
        source,
        destination,
        strategy: options.strategy,
        status: 'skipped',
      });
      continue;
    }

    if (!existsSync(source)) throw new Error(`技能不存在：${name}（${source}）`);
    if (!statSync(source).isDirectory()) throw new Error(`技能不是目录：${name}`);

    if (options.strategy === 'copy') {
      cpSync(source, destination, { recursive: true });
    } else {
      // Windows 下用 junction，无需管理员权限；其它平台用目录软链接。
      symlinkSync(source, destination, process.platform === 'win32' ? 'junction' : 'dir');
    }

    results.push({
      name,
      source,
      destination,
      strategy: options.strategy,
      status: 'mounted',
    });
  }

  return results;
}
