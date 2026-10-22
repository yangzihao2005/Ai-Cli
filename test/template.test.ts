import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../src/presets';
import {
  applyModeMarker,
  buildAgentsFiles,
  ensureProjectDocs,
  injectProjectConfig,
  readActiveMode,
  writeAgentsFiles,
} from '../src/template';
import type { StackPreset } from '../src/types';

/** 与真实预设解耦的测试夹具，避免预设文案调整导致测试误报。 */
const TEST_PRESET: StackPreset = {
  id: 'node-cli',
  label: 'Node/TS CLI',
  hint: '测试用预设',
  stack: 'Node.js + TypeScript + Vitest',
  packageManager: 'npm',
  commands: {
    install: 'npm ci',
    dev: 'npm run dev',
    lint: 'npm run lint',
    typecheck: 'tsc --noEmit',
    test: 'vitest run',
    build: 'tsup',
  },
};

const FAST_TEMPLATE = [
  '# AGENTS.md',
  '',
  '## 关键规则',
  '- 先读代码再动手。',
  '',
  '## 项目',
  '- 技术栈：',
  '- 包管理器：',
  '- 命令：',
  '  - 安装：',
  '  - 开发：',
  '  - Lint：',
  '  - 类型检查：',
  '  - 测试：',
  '  - 构建：',
  '- 数据库迁移方式：',
  '- 设计系统文件路径：`DESIGN.md`',
  '',
  '## 附注',
  '- 技术栈：这段在区块外，不能被改。',
  '',
].join('\n');

const FAST_EXPECTED = [
  '# AGENTS.md',
  '',
  '## 关键规则',
  '- 先读代码再动手。',
  '',
  '## 项目',
  '- 技术栈：Node.js + TypeScript + Vitest',
  '- 包管理器：npm',
  '- 命令：',
  '  - 安装：npm ci',
  '  - 开发：npm run dev',
  '  - Lint：npm run lint',
  '  - 类型检查：tsc --noEmit',
  '  - 测试：vitest run',
  '  - 构建：tsup',
  '- 数据库迁移方式：',
  '- 设计系统文件路径：`DESIGN.md`',
  '',
  '## 附注',
  '- 技术栈：这段在区块外，不能被改。',
  '',
].join('\n');

const LEARN_TEMPLATE = [
  '# AGENTS.md (Learning & Mastery Edition)',
  '',
  '## 项目（与生产版保持一致，按需替换）',
  '- 技术栈：',
  '- 包管理器：',
  '- 命令：',
  '  - 安装：',
  '  - 开发：',
  '  - Lint：',
  '  - 类型检查：',
  '  - 测试：',
  '  - 构建：',
  '- 数据库迁移方式：',
  '- 设计系统文件路径：`DESIGN.md`',
  '',
].join('\n');

describe('injectProjectConfig', () => {
  it('精准填充 Fast 母版的全部字段，且不改动区块外内容', () => {
    expect(injectProjectConfig(FAST_TEMPLATE, TEST_PRESET)).toBe(FAST_EXPECTED);
  });

  it('兼容 Learn 母版的带后缀标题，并保留原标题文字', () => {
    const output = injectProjectConfig(LEARN_TEMPLATE, TEST_PRESET);

    expect(output).toContain('## 项目（与生产版保持一致，按需替换）');
    expect(output).toContain('- 技术栈：Node.js + TypeScript + Vitest');
    expect(output).toContain('- 包管理器：npm');
    expect(output).toContain('  - 安装：npm ci');
    expect(output).toContain('  - 开发：npm run dev');
    expect(output).toContain('  - Lint：npm run lint');
    expect(output).toContain('  - 类型检查：tsc --noEmit');
    expect(output).toContain('  - 测试：vitest run');
    expect(output).toContain('  - 构建：tsup');
  });

  it('空白预设保留空位，且不产生行尾空格', () => {
    const output = injectProjectConfig(FAST_TEMPLATE, PRESETS.blank);

    expect(output).toContain('- 技术栈：\n- 包管理器：\n- 命令：');
    for (const line of output.split('\n')) {
      expect(line).not.toMatch(/[ \t]+$/);
    }
  });

  it('重复注入结果保持一致（幂等）', () => {
    const once = injectProjectConfig(FAST_TEMPLATE, TEST_PRESET);
    expect(injectProjectConfig(once, TEST_PRESET)).toBe(once);
  });

  it('找不到 ## 项目 章节时抛出明确错误', () => {
    const withoutProject = ['# AGENTS.md', '', '## 其他', '- 技术栈：', ''].join('\n');
    expect(() => injectProjectConfig(withoutProject, TEST_PRESET)).toThrow(/项目/);
  });
});

describe('ACTIVE_MODE 标记', () => {
  it('标记位于文件最顶部，重复调用只保留一个', () => {
    const first = applyModeMarker('# AGENTS.md\n\n正文\n', 'fast');
    expect(first.startsWith('<!-- ACTIVE_MODE: fast -->\n\n# AGENTS.md')).toBe(true);

    const second = applyModeMarker(first, 'learn');
    expect(second.startsWith('<!-- ACTIVE_MODE: learn -->')).toBe(true);
    expect(second.match(/ACTIVE_MODE/g)).toHaveLength(1);
    expect(readActiveMode(second)).toBe('learn');
  });

  it('没有标记时 readActiveMode 返回 null', () => {
    expect(readActiveMode('# AGENTS.md\n')).toBeNull();
  });

  it('buildAgentsFiles 只给激活文件加标记', () => {
    const files = buildAgentsFiles(FAST_TEMPLATE, LEARN_TEMPLATE, TEST_PRESET, 'learn');

    expect(files.active.startsWith('<!-- ACTIVE_MODE: learn -->')).toBe(true);
    expect(files.active).toContain('## 项目（与生产版保持一致，按需替换）');
    expect(files.fast).not.toContain('ACTIVE_MODE');
    expect(files.learn).not.toContain('ACTIVE_MODE');
    expect(files.fast).toBe(FAST_EXPECTED);
  });
});

describe('文件落盘', () => {
  const tempDirs: string[] = [];

  function makeTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'aci-template-'));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writeAgentsFiles 写出三个 AGENTS 文件', () => {
    const dir = makeTempDir();
    const files = { fast: 'fast', learn: 'learn', active: 'active' };

    expect(writeAgentsFiles(dir, files)).toEqual([
      'AGENTS.fast.md',
      'AGENTS.learn.md',
      'AGENTS.md',
    ]);
    expect(readFileSync(join(dir, 'AGENTS.fast.md'), 'utf8')).toBe('fast');
    expect(readFileSync(join(dir, 'AGENTS.learn.md'), 'utf8')).toBe('learn');
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toBe('active');
  });

  it('ensureProjectDocs 只补齐缺失文件，不覆盖已有内容', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'SPEC.md'), '我自己的规格', 'utf8');

    expect(ensureProjectDocs(dir)).toEqual(['PROGRESS.md']);
    expect(readFileSync(join(dir, 'SPEC.md'), 'utf8')).toBe('我自己的规格');
    expect(readFileSync(join(dir, 'PROGRESS.md'), 'utf8')).toContain('# PROGRESS.md');
    expect(ensureProjectDocs(dir)).toEqual([]);
  });
});
