import { Controller, Get, Query } from "@nestjs/common";
import {
  learnLessonQuery,
  learnOutlineQuery,
  type LearnLessonQuery,
  type LearnOutlineQuery,
} from "../../../lib/schemas/learn";
import { CurrentUser, type SessionUser } from "../auth/decorators";
import { ZodPipe } from "../common/zod.pipe";
import { LearnService } from "./learn.service";

// No route here is @Public() (a session is the default) and none is @Sensitive(): a lesson load takes the cached
// session check (30 seconds, ADR 0008 D6), not an Auth call each time. Access is decided inside the service.
@Controller("learn")
export class LearnController {
  constructor(private readonly learn: LearnService) {}

  @Get("outline")
  outline(
    @CurrentUser() user: SessionUser,
    @Query(new ZodPipe(learnOutlineQuery)) { course }: LearnOutlineQuery,
  ) {
    return this.learn.outlineFor(user.id, course);
  }

  @Get("lesson")
  lesson(
    @CurrentUser() user: SessionUser,
    @Query(new ZodPipe(learnLessonQuery)) { course, lesson }: LearnLessonQuery,
  ) {
    return this.learn.lessonFor(user.id, course, lesson);
  }

  @Get("quiz")
  quiz(
    @CurrentUser() user: SessionUser,
    @Query(new ZodPipe(learnLessonQuery)) { course, lesson }: LearnLessonQuery,
  ) {
    return this.learn.quizFor(user.id, course, lesson);
  }
}
