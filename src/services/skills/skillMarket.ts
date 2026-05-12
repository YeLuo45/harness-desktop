/**
 * Skill Market - Discover, install, and uninstall skills from marketplace
 */

import { MarketListing, InstallResult, SkillManifest } from './types';
import { registry } from './skillRegistry';

export class SkillMarket {
  private listings: Map<string, MarketListing> = new Map();

  async discover(query?: string): Promise<MarketListing[]> {
    const results: MarketListing[] = [];
    for (const listing of this.listings.values()) {
      if (!query) {
        results.push(listing);
        continue;
      }
      const q = query.toLowerCase();
      if (
        listing.manifest.name.toLowerCase().includes(q) ||
        listing.manifest.description.toLowerCase().includes(q) ||
        listing.manifest.tags?.some((t) => t.toLowerCase().includes(q))
      ) {
        results.push(listing);
      }
    }
    return results;
  }

  async install(manifest: SkillManifest): Promise<InstallResult> {
    try {
      const instanceId = registry.register(manifest);
      return { success: true, instanceId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async uninstall(instanceId: string): Promise<boolean> {
    return registry.remove(instanceId);
  }

  async getListing(skillId: string): Promise<MarketListing | undefined> {
    return this.listings.get(skillId);
  }

  addListing(listing: MarketListing): void {
    this.listings.set(listing.manifest.id, listing);
  }

  removeListing(skillId: string): boolean {
    return this.listings.delete(skillId);
  }
}

export const market = new SkillMarket();
