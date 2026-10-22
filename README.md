# 🤖 AI Context Initializer (`aci`)

> **你的个人 AI 工程上下文一键装配器与“双模学习”遥控器。**
> 告别每次新建项目手动复制粘贴 `.md` 规则文件、手动修改底层命令、手动搬运 `SKILLS` 的繁琐操作。

---

## ✨ 核心功能

1. **📦 一键空投规则 (`aci`)**：在任意新项目目录下，通过交互式终端菜单，5 秒内拉取本地母版库（默认 `D:\Necessary_md`）中的规则文件，自动生成 `AGENTS.fast.md`、`AGENTS.learn.md`、`AGENTS.md` 与 `PROGRESS.md`。
2. **⚡ 动态注入技术栈**：根据所选预设（Next.js 全栈 / Python 工具 / Node.js CLI / 自定义），自动将包管理器及 `install`、`dev`、`lint`、`typecheck`、`test`、`build` 命令精准注入到 `AGENTS` 文件的 `## 项目` 章节中。
3. **🧠 一秒切换模式 (`aci switch`)**：在 **🚀 Fast（极致效率外包模式）** 与 **🧠 Learn（苏格拉底结对教练模式）** 之间一键无缝切换，无需手动重命名或覆盖文件。
4. **🔗 按需挂载 Skills**：自动探测母版库下的 `SKILLS` 目录（若无则优雅跳过），支持通过 **Windows Junction 软链接**（一处更新、全局同步，免管理员权限）或物理复制的方式将技能包挂载至 `.opencode/skills/`。

---

## 🛠️ 安装与全局挂载

在 `ai-cli` 项目根目录下执行以下命令，即可将 `aci` 注册为系统全局命令：

```bash
# 1. 安装依赖
npm install

# 2. 运行单元测试与类型检查
npm run typecheck
npm test

# 3. 编译打包并挂载到全局环境
npm run build
npm link
```

---

## 🚀 快速使用指南

### 1. 初始化新项目上下文 (`aci` 或 `aci init`)
在 VS Code 中打开任意新建的项目文件夹，在终端输入：

```bash
aci
```

按照终端弹出的交互式菜单依次选择：
1. **技术栈预设**：自动填充对应的质量检查与测试命令。
2. **初始激活模式**：选择以 `Fast` 还是 `Learn` 模式开局。
3. **挂载 Skills**（若母版库存在 `SKILLS` 子目录）：空格勾选需要的技能包，选择软链接或拷贝。

执行完毕后，当前目录将自动生成：
```text
your-project/
├── AGENTS.md          # 当前激活的规则文件（顶部含 <!-- ACTIVE_MODE: fast|learn --> 标记）
├── AGENTS.fast.md     # 注入了当前项目命令的【效率模式】备份
├── AGENTS.learn.md    # 注入了当前项目命令的【学习模式】备份
├── PROGRESS.md        # 跨会话进度看板与记忆锚点
└── .opencode/skills/  # 按需挂载的模块化技能包（如有选择）
```

### 2. 一秒切换 Fast / Learn 模式 (`aci switch`)
在项目开发过程中，随时在终端输入：

```bash
aci switch
```

* 若当前为 `Fast` 模式 👉 自动切换为 **`Learn` 模式**（开启 80/20 留白手写 `TODO(human)`、TDD 测试先行与费曼微拷问）。
* 若当前为 `Learn` 模式 👉 自动切换为 **`Fast` 模式**（恢复全自动高效代码生成与交付）。

---

## 💡 推荐工作流：三明治开发法 (Fast ➔ Learn ➔ Fast)

配合本工具与 `opencode` 终端 Agent，推荐在项目中采用以下节奏：

| 阶段 | 项目进度 | 激活模式 | 核心动作 |
| :--- | :--- | :--- | :--- |
| **1. 基建期** | `0% ~ 30%` | 🚀 **Fast** | 运行 `aci` 选择 Fast 模式启动，让 AI 快速搭建目录骨架、安装依赖、配置 UI 与路由空壳。 |
| **2. 攻坚期** | `30% ~ 80%` | 🧠 **Learn** | 运行 `aci switch` 切入学习模式。让 AI 先写单元测试并留出 `// TODO(human)`，亲手敲出最核心的 20% 算法/数据结构逻辑。 |
| **3. 收尾期** | `80% ~ 100%` | 🚀 **Fast** | 再次运行 `aci switch` 切回效率模式，将边角料 Bug 修复、样式微调与文档编写交给 AI 快速收尾。 |

### 终端快捷指令（Learn 模式下可用）
在 `opencode` 对话中可随时输入以下标签动态控制节奏：
* `@todo`：强制将接下来的功能写成带 `// TODO(human)` 的留白骨架。
* `@quiz`：针对刚写完的代码随机考我 2 道边界条件或原理题。
* `@explain`：用 ASCII 流程图拆解当前模块的数据流转。
* `@fast`：当前子任务临时解除学习限制，直接帮我写出完整实现。

---

## ⚙️ 环境变量与路径配置

* **默认母版源目录**：`D:\Necessary_md`
* **自定义母版源目录**：若未来迁移了母版文件夹位置，可通过设置系统环境变量 `AI_TEMPLATE_DIR` 覆盖默认路径：
  ```powershell
  # PowerShell 示例
  $env:AI_TEMPLATE_DIR="E:\MyTemplates\Necessary_md"
  ```
* **母版目录标准结构**：
  ```text
  D:\Necessary_md/
  ├── AGENTS.fast.md   # 必需：效率模式母版
  ├── AGENTS.learn.md  # 必需：学习模式母版
  ├── DESIGN.md        # 可选：通用视觉设计规范
  └── SKILLS/          # 可选：存放各独立技能文件夹（如 plans, frontend-design 等）
  ```