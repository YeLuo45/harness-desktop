import { Rating, RatingSummary } from './marketplaceTypes'
import { marketplace } from './marketplace'

export interface RateOptions {
  workflowId: string
  userId: string
  stars: number
  comment?: string
}

export class RatingService {
  async rate(options: RateOptions): Promise<void> {
    const { workflowId, userId, stars, comment } = options

    if (stars < 1 || stars > 5) {
      throw new Error('Stars must be between 1 and 5')
    }

    await marketplace.rate(workflowId, userId, stars, comment)
  }

  async getRatings(workflowId: string): Promise<Rating[]> {
    return marketplace.getRatings(workflowId)
  }

  async getRatingSummary(workflowId: string): Promise<RatingSummary> {
    return marketplace.getRatingSummary(workflowId)
  }

  async getUserRating(workflowId: string, userId: string): Promise<Rating | undefined> {
    const ratings = await marketplace.getRatings(workflowId)
    return ratings.find(r => r.userId === userId)
  }

  async hasUserRated(workflowId: string, userId: string): Promise<boolean> {
    const userRating = await this.getUserRating(workflowId, userId)
    return userRating !== undefined
  }
}

export const ratingService = new RatingService()
