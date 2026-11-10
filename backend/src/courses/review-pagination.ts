import {
  LAST_REVIEW_PAGE,
  REVIEWS_PER_PAGE,
} from "../../../lib/schemas/public-courses";

export function hasNextReviewPage(page: number, fetchedRows: number): boolean {
  return page < LAST_REVIEW_PAGE && fetchedRows > REVIEWS_PER_PAGE;
}
