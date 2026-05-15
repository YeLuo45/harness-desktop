/**
 * Built-in Skill: File Operations
 * Note: fileOps functionality is provided by fileTool.ts
 */

import type { SkillManifest } from '../types';

export const fileOpsManifest: SkillManifest = {
  id: 'builtin:fileOps',
  name: 'File Operations',
  version: '1.0.0',
  description: 'Read, write, and manage files',
  author: 'Hermes Team',
  tags: ['file', 'io', 'builtin'],
  entryPoint: './fileTool',
};

// Re-export from fileTool for skill compatibility
export { fileToolDefinitions, fileToolExecutors } from '../../tools/builtin/fileTool';
