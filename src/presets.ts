import type { PresetId, StackPreset } from './types';

/** 默认选中的预设。 */
export const DEFAULT_PRESET_ID: PresetId = 'nextjs';

/**
 * 内置技术栈预设字典。
 * `blank` 保留全部空位，交给用户后续手动填写。
 */
export const PRESETS = {
  nextjs: {
    id: 'nextjs',
    label: 'Next.js 全栈',
    hint: 'Next.js + React + TypeScript + Tailwind CSS v4',
    stack: 'Next.js + React + TypeScript + Tailwind CSS v4',
    packageManager: 'npm',
    commands: {
      install: 'npm install',
      dev: 'npm run dev',
      lint: 'npm run lint',
      typecheck: 'npm run typecheck',
      test: 'npm test',
      build: 'npm run build',
    },
  },
  python: {
    id: 'python',
    label: 'Python 工具',
    hint: 'Python 3.12 + uv + Ruff + mypy + pytest',
    stack: 'Python 3.12 + uv',
    packageManager: 'uv',
    commands: {
      install: 'uv sync',
      dev: 'uv run main.py',
      lint: 'ruff check .',
      typecheck: 'mypy .',
      test: 'pytest',
      build: 'uv build',
    },
  },
  'node-cli': {
    id: 'node-cli',
    label: 'Node/TS CLI',
    hint: 'Node.js + TypeScript + tsup + Vitest',
    stack: 'Node.js + TypeScript + Vitest',
    packageManager: 'npm',
    commands: {
      install: 'npm install',
      dev: 'npm run dev',
      lint: 'npm run lint',
      typecheck: 'npm run typecheck',
      test: 'npm test',
      build: 'npm run build',
    },
  },
  blank: {
    id: 'blank',
    label: '自定义空白',
    hint: '保留空位，稍后手动填写',
    stack: '',
    packageManager: '',
    commands: {
      install: '',
      dev: '',
      lint: '',
      typecheck: '',
      test: '',
      build: '',
    },
  },
} as const satisfies Record<PresetId, StackPreset>;

/** 供交互菜单使用的稳定顺序列表。 */
export const PRESET_LIST: readonly StackPreset[] = [
  PRESETS.nextjs,
  PRESETS.python,
  PRESETS['node-cli'],
  PRESETS.blank,
];

/** 判断任意字符串是否为合法的预设标识。 */
export function isPresetId(value: string): value is PresetId {
  return Object.hasOwn(PRESETS, value);
}

/** 按标识取预设；传入非法值时返回 `undefined`。 */
export function getPreset(id: string): StackPreset | undefined {
  return isPresetId(id) ? PRESETS[id] : undefined;
}
