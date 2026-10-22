/**
 * 全局共享类型定义。
 * 这里只放跨模块复用的数据契约，具体实现放在各自的模块中。
 */

/** 运行模式：Fast 追求交付效率，Learn 追求理解与手写练习。 */
export type Mode = 'fast' | 'learn';

/** 内置技术栈预设的唯一标识。 */
export type PresetId = 'nextjs' | 'python' | 'node-cli' | 'blank';

/**
 * 需要注入到 `## 项目` 章节的六条命令。
 * 值与用户在终端实际输入的命令完全一致，可为空字符串（自定义空白预设）。
 */
export interface StackCommands {
  /** `- 安装：` */
  install: string;
  /** `- 开发：` */
  dev: string;
  /** `- Lint：` */
  lint: string;
  /** `- 类型检查：` */
  typecheck: string;
  /** `- 测试：` */
  test: string;
  /** `- 构建：` */
  build: string;
}

/** 一套完整的技术栈预设，用于填充 AGENTS 母版的 `## 项目` 章节。 */
export interface StackPreset {
  /** 预设标识，同时作为字典键。 */
  id: PresetId;
  /** 交互菜单中展示的名称，如「Next.js 全栈」。 */
  label: string;
  /** 交互菜单中的补充说明。 */
  hint: string;
  /** `- 技术栈：` 的值。 */
  stack: string;
  /** `- 包管理器：` 的值。 */
  packageManager: string;
  /** 六条命令配置。 */
  commands: StackCommands;
}

/** Skill 挂载方式：复制一份，或创建目录链接（Windows 下使用 junction）。 */
export type SkillMountStrategy = 'copy' | 'symlink';

/** `aci init` 交互流程收集到的全部选项。 */
export interface InitOptions {
  /** 目标项目根目录的绝对路径。 */
  targetDir: string;
  /** 用户选择的技术栈预设。 */
  preset: StackPreset;
  /** 初始激活模式。 */
  mode: Mode;
  /** 需要挂载的 Skill 名称列表；母版没有 SKILLS 目录时为空数组。 */
  skills: string[];
  /** Skill 挂载方式，默认 `copy`。 */
  skillMount: SkillMountStrategy;
}
