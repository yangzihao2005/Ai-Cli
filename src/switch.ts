import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { applyModeMarker, readActiveMode, stripModeMarker } from './template';
import type { Mode } from './types';

/** 激活态文件名。 */
export const ACTIVE_FILE = 'AGENTS.md';

/** 两种模式对应的母版文件名。 */
export const TEMPLATE_FILES = {
  fast: 'AGENTS.fast.md',
  learn: 'AGENTS.learn.md',
} as const satisfies Record<Mode, string>;

/** `switchMode` 的执行结果，供 CLI 层拼装彩色提示。 */
export interface SwitchResult {
  /** 切换前的模式。 */
  from: Mode;
  /** 切换后的模式。 */
  to: Mode;
  /** 被覆盖写入的 AGENTS.md 绝对路径。 */
  activePath: string;
}

/** 统一换行与首尾空白，便于比较“手写副本”和模板。 */
function normalizeMarkdown(md: string): string {
  return stripModeMarker(md).replace(/\r\n/g, '\n').trim();
}

/**
 * 识别当前模式：标记优先，内容比对兜底。
 * 两者都不可靠时抛错，避免误覆盖用户手写内容。
 */
function detectMode(activeRaw: string, fastPath: string, learnPath: string): Mode {
  const marked = readActiveMode(activeRaw);
  if (marked) return marked;

  const active = normalizeMarkdown(activeRaw);
  const matches: Mode[] = [];

  if (existsSync(fastPath) && normalizeMarkdown(readFileSync(fastPath, 'utf8')) === active) {
    matches.push('fast');
  }
  if (existsSync(learnPath) && normalizeMarkdown(readFileSync(learnPath, 'utf8')) === active) {
    matches.push('learn');
  }

  if (matches.length === 1) return matches[0]!;

  throw new Error(
    `无法识别当前模式：${ACTIVE_FILE} 缺少 ACTIVE_MODE 标记，且内容与两个模板都不一致`,
  );
}

/**
 * 在 Fast / Learn 之间切换目标项目根目录下的 AGENTS.md。
 *
 * 只负责读写文件并返回结果；终端提示由 `src/index.ts` 输出，
 * 这样单元测试无需 mock console。
 */
export function switchMode(targetDir: string): SwitchResult {
  const root = resolve(targetDir);
  const activePath = join(root, ACTIVE_FILE);
  const fastPath = join(root, TEMPLATE_FILES.fast);
  const learnPath = join(root, TEMPLATE_FILES.learn);

  if (!existsSync(activePath)) {
    throw new Error(`未找到 ${ACTIVE_FILE}：${activePath}（请先运行 aci init）`);
  }

  const from = detectMode(readFileSync(activePath, 'utf8'), fastPath, learnPath);
  const to: Mode = from === 'fast' ? 'learn' : 'fast';
  const targetPath = to === 'fast' ? fastPath : learnPath;

  if (!existsSync(targetPath)) {
    throw new Error(`缺少目标模板文件：${targetPath}（请先运行 aci init）`);
  }

  const next = applyModeMarker(readFileSync(targetPath, 'utf8'), to);
  writeFileSync(activePath, next, 'utf8');

  return { from, to, activePath };
}
