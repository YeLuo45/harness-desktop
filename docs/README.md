# Harness Desktop - 项目文档索引

## 项目概述

类比 Claude Code 的 Windows 本地 AI 编程工具，基于 Harness Engineering 六大核心组件。
技术栈：Electron + React + TypeScript + Zustand。

## 提案归属

| 提案ID | 角色 | 状态 | 说明 |
|--------|------|------|------|
| P-20260417-001 | 主提案 | accepted | MVP骨架已验收（2026-04-17） |
| P-20260417-001-v2 | 增量迭代 | intake | 迭代v2：Sub Agent + Verification Hooks + 更多工具 |

## 迭代历史

| 版本 | 日期 | 提案ID | 类型 | 主要变更 |
|------|------|--------|------|----------|
| v1 | 2026-04-17 | P-20260417-001 | PRD + Tech | MVP骨架：8个核心Tool、多模型Adapter、Tool Call Loop、Context Manager、Verification Hooks、System Prompt Engine、Sandbox Manager |
| v2 | 2026-04-17 | P-20260417-001-v2 | PRD增量 | ①Sub Agent（共享KV Cache与输入上下文）②Verification Hooks后台分类器③更多核心工具（扩展Tool Schema） |

## 文档清单

### PRD

| 版本 | 文件 | 提案ID | 确认状态 |
|------|------|--------|----------|
| v1 | `2026-04-17-harness-engineering-prd.md` | P-20260417-001 | confirmed |

> v2 基于 v1 扩展，未单独新增PRD文件；变更点见上方迭代历史。

### Tech Solution

v1 阶段 Tech Solution 并入 PRD，v2 阶段技术方案待输出。

## 当前状态

- **Current Status**: `in_dev`（v2 迭代开发中）
- **Current PRD**: `docs/2026-04-17-harness-engineering-prd.md`（v1，已确认）
- **待交付**: v2 技术方案（待 boss 确认技术诉求后输出）
