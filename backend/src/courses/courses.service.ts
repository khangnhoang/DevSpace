import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  LAST_REVIEW_PAGE,
  REVIEWS_PER_PAGE,
} from "../../../lib/schemas/public-courses";
import { DbService } from "../db/db.service";
import {
  chapters,
  courses,
  instructors,
  lessons,
  profileCards,
  reviews,
} from "../db/schema";

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

const courseFields = {
  id: courses.id,
  name: courses.name,
  slug: courses.slug,
  description: courses.description,
  image_url: courses.imageUrl,
  price: courses.price,
};

const publicProfile = {
  id: profileCards.id,
  full_name: profileCards.fullName,
  avatar_url: profileCards.avatarUrl,
};

function profileCard(
  profile: {
    id: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null,
) {
  return profile?.id
    ? { full_name: profile.full_name, avatar_url: profile.avatar_url }
    : null;
}

type Outline = {
  id: number;
  title: string;
  lessons: {
    id: number;
    title: string;
    slug: string;
    type: "video" | "reading";
    duration_display: string;
  }[];
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
          ...courseFields,
          // Written with explicit names: Drizzle drops the table name of a column in a single-table select, so
          // `${courses.id}` would print as a bare "id" and bind to the lessons row inside the subquery.
          firstLessonSlug: sql<
            string | null
          >`(select l.slug from lessons l where l.course_id = courses.id order by l.id limit 1)`,
        })
        .from(courses)
        .orderBy(courses.id);
    } catch (error) {
      this.unavailable("home course", error);
    }
  }

  async detail(slug: string) {
    const db = await this.db.connection();
    try {
      const matches = await db
        .select({
          ...courseFields,
          instructor: {
            id: instructors.id,
            bio: instructors.bio,
            job_title: instructors.jobTitle,
          },
          profile: publicProfile,
        })
        .from(courses)
        .leftJoin(instructors, eq(courses.instructorId, instructors.id))
        .leftJoin(profileCards, eq(instructors.userId, profileCards.id))
        .where(eq(courses.slug, slug))
        .limit(2);

      // Legacy slugs are not unique. Selecting the first match could link to a different course.
      if (matches.length !== 1) throw new NotFoundException();
      const { instructor, profile, ...course } = matches[0];
      const rows = await db
        .select({
          chapterId: chapters.id,
          chapterTitle: chapters.title,
          lesson: {
            id: lessons.id,
            title: lessons.title,
            slug: lessons.slug,
            hasVideo: lessons.hasVideo,
            wordCount: lessons.wordCount,
          },
        })
        .from(chapters)
        .leftJoin(
          lessons,
          and(
            eq(lessons.chapterId, chapters.id),
            eq(lessons.courseId, chapters.courseId),
          ),
        )
        .where(eq(chapters.courseId, course.id))
        .orderBy(chapters.orderIndex, chapters.id, lessons.id);

      const outline = new Map<number, Outline>();
      let lessonCount = 0;
      let totalSeconds = 0;
      for (const { chapterId, chapterTitle, lesson } of rows) {
        let chapter = outline.get(chapterId);
        if (!chapter) {
          chapter = { id: chapterId, title: chapterTitle, lessons: [] };
          outline.set(chapterId, chapter);
        }
        if (!lesson) continue;
        const seconds = lesson.hasVideo
          ? 600
          : Math.max(60, Math.ceil(((lesson.wordCount ?? 0) / 200) * 60));
        lessonCount++;
        totalSeconds += seconds;
        chapter.lessons.push({
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          type: lesson.hasVideo ? "video" : "reading",
          duration_display: `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
        });
      }

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return {
        ...course,
        description: course.description ?? "",
        image_url: course.image_url ?? "",
        price_text:
          course.price === 0
            ? "Miễn phí"
            : new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
              }).format(course.price ?? 0),
        stats: {
          lesson_count: lessonCount,
          duration:
            hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`,
        },
        chapters: [...outline.values()],
        instructors: instructor
          ? { ...instructor, profiles: profileCard(profile) }
          : null,
      };
    } catch (error) {
      this.unavailable("course detail", error);
    }
  }

  async listReviews(courseId: number, page: number) {
    const db = await this.db.connection();
    try {
      const rows = await db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          content: reviews.content,
          created_at: reviews.createdAt,
          profiles: publicProfile,
        })
        .from(reviews)
        .leftJoin(profileCards, eq(reviews.userId, profileCards.id))
        .where(eq(reviews.courseId, courseId))
        .orderBy(sql`${reviews.createdAt} desc nulls first`, desc(reviews.id))
        .limit(REVIEWS_PER_PAGE + 1)
        .offset(page * REVIEWS_PER_PAGE);
      return {
        reviews: rows
          .slice(0, REVIEWS_PER_PAGE)
          .map(({ profiles, ...review }) => ({
            ...review,
            profiles: profileCard(profiles),
          })),
        hasMore: page < LAST_REVIEW_PAGE && rows.length > REVIEWS_PER_PAGE,
      };
    } catch (error) {
      this.unavailable("course reviews", error);
    }
  }

  private unavailable(read: string, error: unknown): never {
    if (error instanceof HttpException) throw error;
    this.logger.error(
      `${read} read failed (${(error as { code?: string }).code ?? "no code"})`,
    );
    throw new ServiceUnavailableException();
  }
}
