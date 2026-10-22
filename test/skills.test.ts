import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverSkills, mountSkills } from '../src/skills';

const tempDirs: string[] = [];

function makeTempDir(prefix = 'aci-skills-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** 在 templateDir/SKILLS/<name> 下创建一个最小技能。 */
function createSkill(templateDir: string, name: string, body = `# ${name}\n`): string {
  const skillDir = join(templateDir, 'SKILLS', name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), body, 'utf8');
  return skillDir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('discoverSkills', () => {
  it('母版没有 SKILLS 目录时安全返回空数组', () => {
    const templateDir = makeTempDir();

    expect(discoverSkills(templateDir)).toEqual([]);
  });

  it('SKILLS 目录为空时返回空数组', () => {
    const templateDir = makeTempDir();
    mkdirSync(join(templateDir, 'SKILLS'));

    expect(discoverSkills(templateDir)).toEqual([]);
  });

  it('返回排序后的子目录名，并忽略普通文件', () => {
    const templateDir = makeTempDir();
    createSkill(templateDir, 'beta');
    createSkill(templateDir, 'alpha');
    writeFileSync(join(templateDir, 'SKILLS', 'README.md'), '不是技能', 'utf8');

    expect(discoverSkills(templateDir)).toEqual(['alpha', 'beta']);
  });

  it('SKILLS 是普通文件时也按“不存在”处理', () => {
    const templateDir = makeTempDir();
    writeFileSync(join(templateDir, 'SKILLS'), '我是文件不是目录', 'utf8');

    expect(discoverSkills(templateDir)).toEqual([]);
  });
});

describe('mountSkills - copy', () => {
  it('把技能目录完整复制到 .opencode/skills 下', () => {
    const templateDir = makeTempDir();
    const projectDir = makeTempDir();
    const source = createSkill(templateDir, 'alpha', '# Alpha\n\n规则内容\n');

    const results = mountSkills({
      templateDir,
      targetDir: projectDir,
      skills: ['alpha'],
      strategy: 'copy',
    });

    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result).toMatchObject({
      name: 'alpha',
      source,
      strategy: 'copy',
      status: 'mounted',
    });

    const destination = join(projectDir, '.opencode', 'skills', 'alpha');
    expect(result.destination).toBe(destination);
    expect(lstatSync(destination).isDirectory()).toBe(true);
    expect(lstatSync(destination).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(destination, 'SKILL.md'), 'utf8')).toBe('# Alpha\n\n规则内容\n');
    // 源目录必须原样保留
    expect(readFileSync(join(source, 'SKILL.md'), 'utf8')).toBe('# Alpha\n\n规则内容\n');
  });

  it('重复挂载时跳过已存在的目标，不覆盖本地修改', () => {
    const templateDir = makeTempDir();
    const projectDir = makeTempDir();
    createSkill(templateDir, 'alpha', '# 原始内容\n');

    const first = mountSkills({
      templateDir,
      targetDir: projectDir,
      skills: ['alpha'],
      strategy: 'copy',
    });
    expect(first[0]!.status).toBe('mounted');

    const destination = join(projectDir, '.opencode', 'skills', 'alpha');
    writeFileSync(join(destination, 'SKILL.md'), '# 我本地改过\n', 'utf8');

    const second = mountSkills({
      templateDir,
      targetDir: projectDir,
      skills: ['alpha'],
      strategy: 'copy',
    });
    expect(second[0]!.status).toBe('skipped');
    expect(readFileSync(join(destination, 'SKILL.md'), 'utf8')).toBe('# 我本地改过\n');
  });
});

describe('mountSkills - symlink', () => {
  it('创建目录链接，链接目标与源目录一致且内容可读', () => {
    const templateDir = makeTempDir();
    const projectDir = makeTempDir();
    const source = createSkill(templateDir, 'beta', '# Beta\n');

    const results = mountSkills({
      templateDir,
      targetDir: projectDir,
      skills: ['beta'],
      strategy: 'symlink',
    });

    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result).toMatchObject({
      name: 'beta',
      source,
      strategy: 'symlink',
      status: 'mounted',
    });

    const destination = join(projectDir, '.opencode', 'skills', 'beta');
    expect(lstatSync(destination).isSymbolicLink()).toBe(true);
    expect(realpathSync(destination)).toBe(realpathSync(source));
    expect(readFileSync(join(destination, 'SKILL.md'), 'utf8')).toBe('# Beta\n');
  });

  it('源目录消失后保留断链，并返回 broken-link 警告', () => {
    const templateDir = makeTempDir();
    const projectDir = makeTempDir();
    const source = createSkill(templateDir, 'gamma', '# Gamma\n');

    mountSkills({
      templateDir,
      targetDir: projectDir,
      skills: ['gamma'],
      strategy: 'symlink',
    });
    const destination = join(projectDir, '.opencode', 'skills', 'gamma');

    // 模拟母版技能目录被移动或删除，链接变成断链。
    rmSync(source, { recursive: true, force: true });

    const results = mountSkills({
      templateDir,
      targetDir: projectDir,
      skills: ['gamma'],
      strategy: 'symlink',
    });

    expect(results[0]).toMatchObject({
      name: 'gamma',
      status: 'skipped',
      warning: 'broken-link',
    });
    expect(lstatSync(destination).isSymbolicLink()).toBe(true);
  });
});

describe('mountSkills - 非法输入', () => {
  it('技能名包含路径分隔符时抛出明确错误', () => {
    const templateDir = makeTempDir();
    const projectDir = makeTempDir();

    expect(() =>
      mountSkills({
        templateDir,
        targetDir: projectDir,
        skills: ['../escape'],
        strategy: 'copy',
      }),
    ).toThrow(/非法|技能名/);
  });

  it('技能源目录不存在时指出具体技能名', () => {
    const templateDir = makeTempDir();
    const projectDir = makeTempDir();
    mkdirSync(join(templateDir, 'SKILLS'));

    expect(() =>
      mountSkills({
        templateDir,
        targetDir: projectDir,
        skills: ['ghost'],
        strategy: 'copy',
      }),
    ).toThrow(/ghost/);
  });
});
