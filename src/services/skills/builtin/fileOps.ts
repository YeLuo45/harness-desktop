/**
 * Built-in Skill: File Operations
 */

import { SkillManifest } from '../types';

export const fileOpsManifest: SkillManifest = {
  id: 'builtin:fileOps',
  name: 'File Operations',
  version: '1.0.0',
  description: 'Read, write, and manage files',
  author: 'Hermes Team',
  tags: ['file', 'io', 'builtin'],
  entryPoint: './builtin/fileOps',
};

export async function readFile(path: string): Promise<string> {
  const { read_file } = await import('../../../tools/fileOps');
  return read_file({ path });
}

export async function writeFile(path: string, content: string): Promise<void> {
  const { write_file } = await import('../../../tools/fileOps');
  return write_file({ path, content });
}
