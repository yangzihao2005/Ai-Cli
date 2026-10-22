import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { switchMode } from '../src/switch';

const FAST_MD = ['# AGENTS.md', '', '## Fast Mode', '- 技术栈：Demo', ''].join('\n');
const LEARN_MD = [
  '# AGENTS.md (Learning & Mastery Edition)',
  '',
  '## Learn Mode',
  '- 技术栈：Demo',
  '',
].join('\n');

const tempDirs: string[] = [];

function makeProject(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'aci-switch-'));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, 'utf8');
  }
  return dir;
}

function readActive(dir: string): string {
  return readFileSync(join(dir, 'AGENTS.md'), 'utf8');
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('switchMode', () => {
  it('无标记时按内容识别 fast，并切换到 learn', () => {
    const dir = makeProject({
      'AGENTS.fast.md': FAST_MD,
      'AGENTS.learn.md': LEARN_MD,
      'AGENTS.md': FAST_MD,
    });

    const result = switchMode(dir);

    expect(result.from).toBe('fast');
    expect(result.to).toBe('learn');
    expect(result.activePath).toBe(join(dir, 'AGENTS.md'));

    const active = readActive(dir);
    expect(active.startsWith('<!-- ACTIVE_MODE: learn -->')).toBe(true);
    expect(active).toContain('Learning & Mastery Edition');

    // 两个模板文件保持纯净，不能被写入标记
    expect(readFileSync(join(dir, 'AGENTS.fast.md'), 'utf8')).toBe(FAST_MD);
    expect(readFileSync(join(dir, 'AGENTS.learn.md'), 'utf8')).toBe(LEARN_MD);
  });

  it('连续切换两次可在 fast 与 learn 之间来回往返', () => {
    const dir = makeProject({
      'AGENTS.fast.md': FAST_MD,
      'AGENTS.learn.md': LEARN_MD,
      'AGENTS.md': FAST_MD,
    });

    expect(switchMode(dir)).toMatchObject({ from: 'fast', to: 'learn' });
    expect(switchMode(dir)).toMatchObject({ from: 'learn', to: 'fast' });

    const active = readActive(dir);
    expect(active.startsWith('<!-- ACTIVE_MODE: fast -->')).toBe(true);
    expect(active).toContain('## Fast Mode');
    expect(active.match(/ACTIVE_MODE/g)).toHaveLength(1);
  });

  it('标记优先于文件内容：标记为 fast 时即使正文是 learn 也切到 learn', () => {
    const dir = makeProject({
      'AGENTS.fast.md': FAST_MD,
      'AGENTS.learn.md': LEARN_MD,
      'AGENTS.md': `<!-- ACTIVE_MODE: fast -->\n\n${LEARN_MD}`,
    });

    const result = switchMode(dir);

    expect(result).toMatchObject({ from: 'fast', to: 'learn' });
    expect(readActive(dir)).toContain('Learning & Mastery Edition');
  });

  it('无标记且内容无法识别时拒绝猜测并报错', () => {
    const dir = makeProject({
      'AGENTS.fast.md': FAST_MD,
      'AGENTS.learn.md': LEARN_MD,
      'AGENTS.md': '# 我自己手写的规则\n',
    });

    expect(() => switchMode(dir)).toThrow(/无法识别/);
    expect(readActive(dir)).toBe('# 我自己手写的规则\n');
  });

  it('AGENTS.md 不存在时给出明确错误', () => {
    const dir = makeProject({
      'AGENTS.fast.md': FAST_MD,
      'AGENTS.learn.md': LEARN_MD,
    });

    expect(() => switchMode(dir)).toThrow(/AGENTS\.md/);
  });

  it('目标模式模板缺失时指出缺失的文件名，且不改动 AGENTS.md', () => {
    const dir = makeProject({
      'AGENTS.fast.md': FAST_MD,
      'AGENTS.md': FAST_MD,
    });

    expect(() => switchMode(dir)).toThrow(/AGENTS\.learn\.md/);
    expect(readActive(dir)).toBe(FAST_MD);
  });
});
