import { Controller, Get, Query } from "@nestjs/common";
import {
  courseDetailQuery,
  courseReviewsQuery,
  type CourseDetailQuery,
  type CourseReviewsQuery,
} from "../../../lib/schemas/public-courses";
import { Public } from "../auth/decorators";
import { ZodPipe } from "../common/zod.pipe";
import { CoursesService } from "./courses.service";

@Controller("courses")
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  // Public by design: course rows are readable by anyone today ("Public view courses"), and the home page of a
  // visitor with no session is the first caller. The handler takes no input.
  @Public()
  @Get("home")
  home() {
    return this.courses.listHome();
  }

  @Public()
  @Get("detail")
  detail(@Query(new ZodPipe(courseDetailQuery)) { slug }: CourseDetailQuery) {
    return this.courses.detail(slug);
  }

  @Public()
  @Get("reviews")
  reviews(
    @Query(new ZodPipe(courseReviewsQuery))
    { courseId, page }: CourseReviewsQuery,
  ) {
    return this.courses.listReviews(courseId, page);
  }
}
