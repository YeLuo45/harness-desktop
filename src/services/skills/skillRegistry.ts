/**
 * Skill Registry - Manages skill registration, retrieval, and state
 */

import { SkillManifest, SkillInstance } from './types';

export class SkillRegistry {
  private skills: Map<string, SkillInstance> = new Map();

  register(manifest: SkillManifest, config?: Record<string, unknown>): string {
    const instanceId = `${manifest.id}@${Date.now()}`;
    const instance: SkillInstance = {
      manifest,
      enabled: true,
      instanceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: config ?? {},
    };
    this.skills.set(instanceId, instance);
    return instanceId;
  }

  get(instanceId: string): SkillInstance | undefined {
    return this.skills.get(instanceId);
  }

  list(): SkillInstance[] {
    return Array.from(this.skills.values());
  }

  listEnabled(): SkillInstance[] {
    return this.list().filter((s) => s.enabled);
  }

  enable(instanceId: string): boolean {
    const skill = this.skills.get(instanceId);
    if (!skill) return false;
    skill.enabled = true;
    skill.updatedAt = Date.now();
    return true;
  }

  disable(instanceId: string): boolean {
    const skill = this.skills.get(instanceId);
    if (!skill) return false;
    skill.enabled = false;
    skill.updatedAt = Date.now();
    return true;
  }

  remove(instanceId: string): boolean {
    return this.skills.delete(instanceId);
  }

  search(query: string): SkillInstance[] {
    const q = query.toLowerCase();
    return this.list().filter(
      (s) =>
        s.manifest.name.toLowerCase().includes(q) ||
        s.manifest.description.toLowerCase().includes(q) ||
        s.manifest.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }

  findById(skillId: string): SkillInstance | undefined {
    return this.list().find((s) => s.manifest.id === skillId);
  }

  updateConfig(instanceId: string, config: Record<string, unknown>): boolean {
    const skill = this.skills.get(instanceId);
    if (!skill) return false;
    skill.config = { ...skill.config, ...config };
    skill.updatedAt = Date.now();
    return true;
  }

  clear(): void {
    this.skills.clear();
  }

  count(): number {
    return this.skills.size;
  }
}

export const registry = new SkillRegistry();
