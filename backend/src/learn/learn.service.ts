import {
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/db.service";
import { DbService } from "../db/db.service";
import {
  chapters,
  courses,
  enrollments,
  lessons,
  profiles,
} from "../db/schema";

export type LearnAccess = {
  user: { id: string };
  course: { id: number; slug: string };
  isAdmin: boolean;
};

export type OutlineLesson = {
  id: number;
  title: string;
  slug: string;
  has_video: boolean;
  has_exercise: boolean;
};

export type OutlineChapter = {
  id: number;
  title: string;
  order_index: number | null;
  lessons: OutlineLesson[];
};

@Injectable()
export class LearnService {
  private readonly logger = new Logger(LearnService.name);

  constructor(private readonly db: DbService) {}

  // The access verdict, in the order the pages always decided it: the course (404), then the caller's role and
  // enrollment (403). The user id is the session's, the course comes from the path and is looked up (G1). The caller
  // reads the lesson or the outline only after this returned, and a refusal carries no body of its own (G2).
  private async access(
    db: Db,
    userId: string,
    courseSlug: string,
  ): Promise<LearnAccess> {
    // Slugs are not unique in legacy data: more than one match is no course, as the public detail route treats it.
    const matches = await db
      .select({ id: courses.id, slug: courses.slug })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(2);
    if (matches.length !== 1) throw new NotFoundException();
    const course = matches[0];
    const [profile, enrollment] = await Promise.all([
      db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1),
      db
        .select({ courseId: enrollments.courseId })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.userId, userId),
            eq(enrollments.courseId, course.id),
          ),
        )
        .limit(1),
    ]);
    const isAdmin = profile[0]?.role === "admin";
    if (!isAdmin && enrollment.length === 0) throw new ForbiddenException();
    return { user: { id: userId }, course, isAdmin };
  }

  // Chapters and their lessons in the order of the page: chapter order, then lesson order with nulls last, then
  // creation. Lessons nest by chapter_id as before, but the exercise marker needs the lesson's own course_id to be
  // the authorized course (G8): the exercises policy authorizes on that column, and this role bypasses RLS.
  private async outline(db: Db, courseId: number): Promise<OutlineChapter[]> {
    const rows = await db
      .select({
        chapterId: chapters.id,
        chapterTitle: chapters.title,
        chapterOrder: chapters.orderIndex,
        lesson: {
          id: lessons.id,
          title: lessons.title,
          slug: lessons.slug,
          hasVideo: lessons.hasVideo,
        },
        // Written with explicit table names: Drizzle prints a bare column name inside a subquery otherwise.
        hasExercise: sql<
          boolean | null
        >`(lessons.course_id = ${courseId} and exists (select 1 from exercises x where x.lesson_id = lessons.id))`,
      })
      .from(chapters)
      .leftJoin(lessons, eq(lessons.chapterId, chapters.id))
      .where(eq(chapters.courseId, courseId))
      .orderBy(
        asc(chapters.orderIndex),
        asc(chapters.id),
        asc(lessons.orderIndex),
        asc(lessons.createdAt),
        asc(lessons.id),
      );
    const result = new Map<number, OutlineChapter>();
    for (const row of rows) {
      let chapter = result.get(row.chapterId);
      if (!chapter) {
        chapter = {
          id: row.chapterId,
          title: row.chapterTitle,
          order_index: row.chapterOrder,
          lessons: [],
        };
        result.set(row.chapterId, chapter);
      }
      if (!row.lesson) continue;
      chapter.lessons.push({
        id: row.lesson.id,
        title: row.lesson.title,
        slug: row.lesson.slug,
        has_video: row.lesson.hasVideo === true,
        has_exercise: row.hasExercise === true,
      });
    }
    return [...result.values()];
  }

  async outlineFor(userId: string, courseSlug: string) {
    return this.guarded("learn outline", async (db) => {
      const access = await this.access(db, userId, courseSlug);
      return { ...access, chapters: await this.outline(db, access.course.id) };
    });
  }

  async lessonFor(userId: string, courseSlug: string, lessonSlug: string) {
    return this.guarded("learn lesson", async (db) => {
      const access = await this.access(db, userId, courseSlug);
      // Selected here and only here, after the verdict, and bound to the authorized course on the lesson's own
      // course_id (G2, G8). Legacy duplicates of a slug inside one course are no lesson.
      const found = await db
        .select({
          id: lessons.id,
          title: lessons.title,
          slug: lessons.slug,
          course_id: lessons.courseId,
          chapter_id: lessons.chapterId,
          order_index: lessons.orderIndex,
          created_at: lessons.createdAt,
          has_video: lessons.hasVideo,
          content: lessons.content,
          video_url: lessons.videoUrl,
        })
        .from(lessons)
        .where(
          and(
            eq(lessons.slug, lessonSlug),
            eq(lessons.courseId, access.course.id),
          ),
        )
        .limit(2);
      if (found.length !== 1) throw new NotFoundException();
      const { content, video_url, ...lesson } = found[0];
      return {
        ...access,
        lesson: { ...lesson, has_video: lesson.has_video === true },
        content,
        video_url,
        chapters: await this.outline(db, access.course.id),
      };
    });
  }

  async quizFor(userId: string, courseSlug: string, lessonSlug: string) {
    return this.guarded("learn quiz", async (db) => {
      const access = await this.access(db, userId, courseSlug);
      const found = await db
        .select({ id: lessons.id, title: lessons.title, slug: lessons.slug })
        .from(lessons)
        .where(
          and(
            eq(lessons.slug, lessonSlug),
            eq(lessons.courseId, access.course.id),
          ),
        )
        .limit(2);
      if (found.length !== 1) throw new NotFoundException();
      return {
        ...access,
        lesson: found[0],
        chapters: await this.outline(db, access.course.id),
      };
    });
  }

  // A refusal is an HttpException and passes through; anything else is a database failure, logged by its code alone
  // (never a row, a query or a lesson column) and answered as 503 with no detail.
  private async guarded<T>(
    read: string,
    run: (db: Db) => Promise<T>,
  ): Promise<T> {
    const db = await this.db.connection();
    try {
      return await run(db);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `${read} read failed (${(error as { code?: string }).code ?? "no code"})`,
      );
      throw new ServiceUnavailableException();
    }
  }
}
