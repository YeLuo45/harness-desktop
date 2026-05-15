/**
 * Skill Runner - Handles skill lifecycle and execution with timeout control
 */

import { SkillContext, SkillResult, SkillRunnerOptions } from './types';
import { registry } from './skillRegistry';

export class SkillRunner {
  private defaultTimeout: number;

  constructor(defaultTimeout = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  async run(
    instanceId: string,
    input: unknown,
    options?: SkillRunnerOptions
  ): Promise<SkillResult> {
    const instance = registry.get(instanceId);
    if (!instance) {
      return { success: false, error: 'Skill instance not found' };
    }

    if (!instance.enabled) {
      return { success: false, error: 'Skill is disabled' };
    }

    const timeout = options?.timeout ?? this.defaultTimeout;
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(
        instance,
        { instanceId, input },
        timeout,
        options?.onProgress
      );

      return {
        success: true,
        output: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private async executeWithTimeout(
    instance: import('./types').SkillInstance,
    context: SkillContext,
    timeout: number,
    onProgress?: (progress: number) => void
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Skill execution timed out after ${timeout}ms`));
      }, timeout);

      // Simulate skill execution
      // In real implementation, this would invoke the skill's entry point
      Promise.resolve()
        .then(() => {
          onProgress?.(50);
          return this.invokeSkill(instance, context);
        })
        .then((result) => {
          clearTimeout(timer);
          onProgress?.(100);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async invokeSkill(
    instance: import('./types').SkillInstance,
    context: SkillContext
  ): Promise<unknown> {
    // Dynamic loading of skill entryPoint
    const entryPoint = instance.manifest.entryPoint;

    // For builtin skill, directly call the corresponding export function
    if (entryPoint.startsWith('./builtin/')) {
      const skillName = entryPoint.replace('./builtin/', '');
      // Get skill template from skillManager for rendering
      // Actual execution logic is handled by SkillManager.execute()
      return { skillId: instance.manifest.id, rendered: true };
    }

    // For external skill, dynamically load via import()
    // const module = await import(entryPoint);
    // return module.default(context.input);
    return { skillId: instance.manifest.id, input: context.input };
  }

  async validate(manifest: import('./types').SkillManifest): Promise<boolean> {
    return !!(
      manifest.id &&
      manifest.name &&
      manifest.version &&
      manifest.entryPoint
    );
  }
}

export const runner = new SkillRunner();
