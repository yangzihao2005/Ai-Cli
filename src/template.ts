import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Mode, StackPreset } from './types';

/** 生成激活态 AGENTS.md 顶部的模式标记。 */
export function modeMarker(mode: Mode): string {
  return `<!-- ACTIVE_MODE: ${mode} -->`;
}

const ACTIVE_MODE_LINE = /^(?:\uFEFF)?<!--\s*ACTIVE_MODE:\s*(fast|learn)\s*-->\r?\n?/;
const ACTIVE_MODE_TEST = /^(?:\uFEFF)?<!--\s*ACTIVE_MODE:\s*(fast|learn)\s*-->/;

/** 移除文件顶部的模式标记（若存在），确保重复调用时不会叠加。 */
export function stripModeMarker(md: string): string {
  if (!ACTIVE_MODE_TEST.test(md)) return md;
  return md.replace(ACTIVE_MODE_LINE, '').replace(/^\r?\n/, '');
}

/** 把模式标记放到文件最顶部；同一文件重复调用结果一致。 */
export function applyModeMarker(md: string, mode: Mode): string {
  return `${modeMarker(mode)}\n\n${stripModeMarker(md).replace(/^\uFEFF/, '')}`;
}

/** 读取激活态文件顶部的模式标记；没有标记时返回 `null`。 */
export function readActiveMode(md: string): Mode | null {
  const matched = ACTIVE_MODE_TEST.exec(md)?.[1];
  return matched === 'fast' || matched === 'learn' ? matched : null;
}

/**
 * 将预设注入 AGENTS 母版的 `## 项目` 章节。
 * 纯函数：不读写文件，便于单元测试。
 */
export function injectProjectConfig(rawMd: string, preset: StackPreset): string {
  // TODO(human): 核心逻辑留白 —— 按下述 4 步补全，然后运行 `npm test` 看红灯转绿。
  //
  // Step 1｜定位区块
  //   - 用 /^##\s*项目.*$/m 找到 `## 项目`，同时兼容
  //     `## 项目（与生产版保持一致，按需替换）` 这种标题后缀。
  //   - 区块起点 = 标题行结束后的位置；从下一行起找 /^##\s+/m（下一个二级标题）
  //     或字符串末尾，作为区块终点。
  //   - 找不到 `## 项目` 时抛出 Error('未找到 "## 项目" 章节')。
    const titleMatch = rawMd.match(/^##[ \t]*项目.*$/m);
    if (!titleMatch) {
      throw new Error('未找到 "## 项目" 章节');
    }

    let start = titleMatch.index! + titleMatch[0].length;
    if(rawMd[start]==='\n') start+=1;
    else if(rawMd[start]==='\r' && rawMd[start+1]==='\n') start+=2;

    const rest=rawMd.slice(start);
    const nextMatch = rest.match(/^##[ \t]+/m);
    const end =nextMatch ? start + nextMatch.index! : rawMd.length;
    
  //
  // Step 2｜建立「标签 → 值」替换表
  //   - 技术栈 → preset.stack
  //   - 包管理器 → preset.packageManager
  //   - 安装 / 开发 / Lint / 类型检查 / 测试 / 构建 → preset.commands 的对应字段
  //   - 注意 `- 命令：` 只是分组标题，本身不变；6 个子项保持两空格缩进。
  //
    const replacements: Record<string, string> = {
      技术栈: preset.stack,
      包管理器: preset.packageManager,
      安装: preset.commands.install,
      开发: preset.commands.dev,
      Lint: preset.commands.lint,
      类型检查: preset.commands.typecheck,
      测试: preset.commands.test,
      构建: preset.commands.build,
  };
  // Step 3｜只改区块内的目标行
  //   - 逐行匹配 /^(\s*)- (技术栈|包管理器)：\s*(.*)$/ 与
  //     /^(\s*)- (安装|开发|Lint|类型检查|测试|构建)：\s*(.*)$/。
  //   - 用替换表的值重建整行并保留原缩进；值为空时写成 `- 技术栈：`，
  //     绝不能留下行尾空格。
  //   - 区块外的同名行必须原样保留。
  //
    const sectionBody = rawMd.slice(start, end).replace(
    /^(\s*)- (技术栈|包管理器|安装|开发|Lint|类型检查|测试|构建)：[^\r\n]*$/gm,
    (_line, indent: string, label: string) => `${indent}- ${label}：${replacements[label]}`,
  );
  // Step 4｜拼回全文
  //   - 用 rawMd.slice(0, start) + 处理后的区块 + rawMd.slice(end) 拼接，
  //     保证标题、前后文和末尾换行都不变。
  //   - 同一输入连续调用两次，输出必须完全一致（幂等）。
  //
  // 两种可行方案（请自行选择）：
  //   A. split('\n') 后按行索引原地修改：易调试、缩进和前后文天然保留，推荐。
  //   B. 截出区块字符串后整块正则替换：代码更短，但容易误伤区块外同名行，
  //      空值与缩进处理也更绕。
  //
  // 编译占位：body 补全后删除下面两行（否则 tsconfig 的 noUnusedParameters 会报 TS6133）.
  return rawMd.slice(0, start) + sectionBody + rawMd.slice(end);
}

/** 三个目标文件的最终内容。 */
export interface AgentsFileSet {
  fast: string;
  learn: string;
  active: string;
}

/**
 * 分别注入 Fast / Learn 母版，再按初始模式生成带标记的激活版 AGENTS.md。
 * 模式标记只加在激活文件上，模板文件保持纯净。
 */
export function buildAgentsFiles(
  fastTemplate: string,
  learnTemplate: string,
  preset: StackPreset,
  mode: Mode,
): AgentsFileSet {
  const fast = injectProjectConfig(fastTemplate, preset);
  const learn = injectProjectConfig(learnTemplate, preset);
  const active = applyModeMarker(mode === 'fast' ? fast : learn, mode);
  return { fast, learn, active };
}

/** 将三个 AGENTS 文件写入目标项目根目录，返回写入的文件名。 */
export function writeAgentsFiles(targetDir: string, files: AgentsFileSet): string[] {
  const dir = resolve(targetDir);
  mkdirSync(dir, { recursive: true });

  const entries: Array<[string, string]> = [
    ['AGENTS.fast.md', files.fast],
    ['AGENTS.learn.md', files.learn],
    ['AGENTS.md', files.active],
  ];

  for (const [name, content] of entries) {
    writeFileSync(join(dir, name), content, 'utf8');
  }
  return entries.map(([name]) => name);
}

/** 目标项目缺失时使用的初始 PROGRESS.md。 */
export const DEFAULT_PROGRESS_MD = [
  '# PROGRESS.md',
  '',
  '## 当前状态',
  '- [ ] 待开始',
  '',
  '## 进展记录',
  '',
  '<!-- 按时间倒序记录：完成内容 / 遇到的问题 / 下一步 -->',
  '',
].join('\n');

/** 目标项目缺失时使用的初始 SPEC.md。 */
export const DEFAULT_SPEC_MD = [
  '# SPEC.md',
  '',
  '## 目标',
  '待补充',
  '',
  '## 范围',
  '待补充',
  '',
  '## 验收标准',
  '- [ ] 待补充',
  '',
].join('\n');

/** 仅在文件不存在时生成 PROGRESS.md / SPEC.md，绝不覆盖用户已有内容。 */
export function ensureProjectDocs(targetDir: string): string[] {
  const dir = resolve(targetDir);
  mkdirSync(dir, { recursive: true });

  const docs: Array<[string, string]> = [
    ['PROGRESS.md', DEFAULT_PROGRESS_MD],
    ['SPEC.md', DEFAULT_SPEC_MD],
  ];

  const created: string[] = [];
  for (const [name, content] of docs) {
    const filePath = join(dir, name);
    if (existsSync(filePath)) continue;
    writeFileSync(filePath, content, 'utf8');
    created.push(name);
  }
  return created;
}
