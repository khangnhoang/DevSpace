import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { courses } from "../db/schema";

// Keys are the ones the home page already reads (HomeCourseData in lib/supabase.ts); the JSON types match what
// PostgREST sent: bigint ids are numbers, price is an integer.
export type HomeCourse = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  firstLessonSlug: string | null;
};

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly db: DbService) {}

  // A named column list, and a subquery for the first lesson slug, so no lesson row and no column beyond the migration's
  // grants is ever selected (G1, G2). The first lesson is the lowest lessons.id, as the page always picked it (AC2).
  async listHome(): Promise<HomeCourse[]> {
    const db = await this.db.connection();
    try {
      return await db
        .select({
          id: courses.id,
          name: courses.name,
          slug: courses.slug,
          description: courses.description,
          image_url: courses.imageUrl,
          price: courses.price,
          // Written with explicit names: Drizzle drops the table name of a column in a single-table select, so
          // `${courses.id}` would print as a bare "id" and bind to the lessons row inside the subquery.
          firstLessonSlug: sql<
            string | null
          >`(select l.slug from lessons l where l.course_id = courses.id order by l.id limit 1)`,
        })
        .from(courses)
        .orderBy(courses.id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // The answer carries no detail (AC3); the code tells a refused grant from a lost connection in the log.
      this.logger.error(
        `home course read failed (${(error as { code?: string }).code ?? "no code"})`,
      );
      throw new ServiceUnavailableException();
    }
  }
}
