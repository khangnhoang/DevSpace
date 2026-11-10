import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/decorators";
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
}
