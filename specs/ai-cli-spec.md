# specs/ai-cli-spec.md

## [目标与产出]
构建一个基于 Node.js + TypeScript 的全局命令行工具 `aci`（AI Context Initializer），用于在任意新项目目录下一键拉取 `D:\Necessary_md` 中的模板文件、动态注入技术栈命令配置、按需挂载 Skills，并支持在 `Fast`（效率模式）与 `Learn`（学习模式）之间一秒切换。

**预期产出文件列表：**
- `package.json`：包含 `bin` 全局命令映射（`aci`）、脚本命令（`build`, `dev`, `test`, `typecheck`）及依赖配置（`@clack/prompts`, `picocolors`, `tsup`, `vitest`, `typescript`）。
- `tsconfig.json`：TypeScript 严格模式配置。
- `src/types.ts`：定义技术栈预设（`StackPreset`）、用户交互选项（`InitOptions`）及运行模式（`'fast' | 'learn'`）接口。
- `src/presets.ts`：内置常用技术栈预设字典（Next.js 全栈、Python 工具、Node/TS CLI、自定义空白）。
- `src/template.ts`：**[核心逻辑 - 适用于 Learn 模式留白]** 读取母版 `.md` 文件并动态替换 `## 项目` 章节的技术栈与命令配置[cite: 9, 10]。
- `src/skills.ts`：**[核心逻辑 - 适用于 Learn 模式留白]** 扫描母版库下的 `SKILLS` 目录（若目录不存在则优雅降级跳过），支持复制或软链接（Symlink/Junction）挂载选中的 Skill。
- `src/switch.ts`：实现 `aci switch` 命令逻辑，自动检测当前项目根目录的 `AGENTS.md` 模式并在 `AGENTS.fast.md` 与 `AGENTS.learn.md` 之间切换。
- `src/index.ts`：CLI 入口文件，解析命令参数（`aci init` 默认交互流程 与 `aci switch` 快速切换流程）。
- `test/template.test.ts`：针对模板注入与模式切换的 Vitest 单元测试。

---

## [输入材料]
1. **本地母版源路径**：固定默认读取 `D:\Necessary_md`（支持通过环境变量 `AI_TEMPLATE_DIR` 覆盖）：
   - 必读母版文件：`D:\Necessary_md\AGENTS.fast.md`、`D:\Necessary_md\AGENTS.learn.md`。
   - 可选母版文件：`D:\Necessary_md\DESIGN.md`、`D:\Necessary_md\PROGRESS.md`。
   - 可选技能目录：`D:\Necessary_md\SKILLS`（**关键约束**：当前该文件夹不存在，代码必须先使用 `fs.existsSync` 检测；若不存在则直接跳过 Skills 询问步骤，绝不可抛出 `ENOENT` 崩溃）。
2. **当前工作目录已有文件**：`ai-cli` 项目根目录下已存在 `AGENTS.fast.md` 与 `AGENTS.learn.md`（启动 `opencode` 前先手动将 `AGENTS.fast.md` 复制一份命名为 `AGENTS.md` 作为初始激活规则）。

---

## [分步执行指令]

### 第一步：项目基建与预设定义（使用 `AGENTS.fast.md` 激活态执行）
1. 初始化 Node.js + TypeScript (ESM) 项目结构，配置 `package.json`（设置 `"bin": { "aci": "./dist/index.js" }`）与 `tsconfig.json`。
2. 创建 `src/types.ts` 与 `src/presets.ts`，内置以下 3 套默认技术栈预设参数（对应 `.md` 底部的 `## 项目` 字段）[cite: 9, 10]：
   - `nextjs`: Next.js + React + TS + Tailwind v4（`npm install` / `npm run dev` / `npm run lint` / `npm run typecheck` / `npm test` / `npm run build`）[cite: 6, 7]。
   - `python`: Python 3.12 + uv（`uv sync` / `uv run main.py` / `ruff check .` / `mypy .` / `pytest` / `uv build`）。
   - `node-cli`: Node.js + TypeScript + Vitest（`npm install` / `npm run dev` / `npm run lint` / `npm run typecheck` / `npm test` / `npm run build`）。

### 第二步：核心引擎开发与单元测试（将 `AGENTS.learn.md` 覆盖为 `AGENTS.md`，切换至留白手写模式）[cite: 10]
1. 先编写 `test/template.test.ts` 单元测试，验证给定一段包含空 `## 项目` 章节的 Markdown 文本和一个 `StackPreset` 对象后，能精准填充对应的命令字段[cite: 9, 10]。
2. 创建 `src/template.ts`，实现 `injectProjectConfig(rawMd: string, preset: StackPreset): string`：
   - 定位 Markdown 中的 `## 项目` 区块，将 `- 技术栈：`、`- 包管理器：` 以及 `- 安装：` 到 `- 构建：` 的空位替换为 `preset` 中的具体值[cite: 9, 10]。
   - 将处理后的内容分别写入目标项目的 `AGENTS.fast.md`、`AGENTS.learn.md`，并根据用户选择的初始模式生成激活态的 `AGENTS.md`（在文件顶部注入一行 `<!-- ACTIVE_MODE: fast|learn -->` 标记以便后续识别）。
   - 若目标项目不存在 `PROGRESS.md` 与 `SPEC.md`，自动生成标准初始模板文件。

### 第三步：可选 Skills 探测与模式切换器实现（保持 `AGENTS.learn.md` 或按需输入 `@fast`）[cite: 10]
1. 创建 `src/skills.ts`，实现 `discoverSkills(templateDir: string): string[]` 与 `mountSkills(...)`：
   - 检查 `path.join(templateDir, 'SKILLS')` 是否存在且为非空目录。若不存在或为空，直接返回空数组 `[]`。
   - 若存在子文件夹，支持将其复制到目标项目的 `.opencode/skills/` 下，或在 Windows 下使用 `fs.symlink(src, dest, 'junction')` 创建目录软链接（无需管理员权限）。
2. 创建 `src/switch.ts`，实现 `switchMode(targetDir: string)`：
   - 读取当前目录 `AGENTS.md` 顶部的 `<!-- ACTIVE_MODE: xxx -->` 标记（或对比文件特征），若当前为 `fast` 则将 `AGENTS.learn.md` 覆盖至 `AGENTS.md`，反之亦然，并在终端输出醒目的模式切换提示。

### 第四步：交互式 CLI 组装与全局挂载（将 `AGENTS.fast.md` 覆盖回 `AGENTS.md` 收尾）[cite: 9]
1. 创建 `src/index.ts`（顶部包含 `#!/usr/bin/env node`）：
   - 当执行 `aci switch` 时，直接调用 `switchMode(process.cwd())`。
   - 当执行 `aci` 或 `aci init` 时，使用 `@clack/prompts` 依次询问：① 选择技术栈预设；② 选择初始模式（Fast / Learn）；③ 若 `discoverSkills` 返回非空列表，则展示多选框询问挂载哪些 Skills，否则自动跳过该问题并提示“当前未检测到 SKILLS 目录，已跳过技能挂载”。
2. 运行构建与链接命令（`npm run build && npm link`），使 `aci` 在系统任意终端路径下可直接调用。

---

## [验收标准]
1. **静态检查与测试全绿**：运行 `npm run typecheck` 无任何 TS 类型错误，运行 `npm test` 所有单元测试全部通过[cite: 6, 7]。
2. **无 `SKILLS` 目录容错验证**：在 `D:\Necessary_md` 下没有 `SKILLS` 文件夹的情况下，在任意空文件夹运行 `aci`，工具不报错、不崩溃，顺滑跳过技能选择步骤并成功生成 `AGENTS.fast.md`、`AGENTS.learn.md`、`AGENTS.md`、`PROGRESS.md` 和 `SPEC.md`。
3. **配置注入准确性**：打开生成的 `AGENTS.md`，底部 `## 项目` 章节中的技术栈、包管理器及 6 个命令均已按所选预设完整填入，无残留空行或格式错乱[cite: 9, 10]。
4. **一秒切换验证**：在项目终端连续执行两次 `aci switch`，观察终端提示及 `AGENTS.md` 内容，确认能在 `AGENTS.fast.md` 与 `AGENTS.learn.md` 之间准确来回切换。