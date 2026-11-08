import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import {
  CurrentUser,
  Sensitive,
  type SessionUser,
} from "../src/auth/decorators";
import { uploadFile, type UploadedBytes } from "../src/common/upload";
import { ZodPipe } from "../src/common/zod.pipe";
import { createUserSchema } from "../../lib/schemas/user";

// Test-only routes (AC20): they exist in the e2e build and nowhere else. `private` carries no marker on purpose, to
// prove that an unmarked route is denied by default.
@Controller("e2e")
export class E2eController {
  // Counts the handlers that ran, so a test can show that a refused request never reached one.
  private handled = 0;

  @Get("private")
  privateRoute() {
    return { ok: true };
  }

  @Get("whoami")
  whoami(@CurrentUser() user: SessionUser) {
    return { userId: user.id };
  }

  @Sensitive()
  @Get("sensitive")
  sensitive(@CurrentUser() user: SessionUser) {
    return { userId: user.id };
  }

  @Get("handled")
  handledCount() {
    return { handled: this.handled };
  }

  @Post("mutate")
  mutate() {
    this.handled += 1;
    return { handled: this.handled };
  }

  @Post("validate")
  validate(@Body(new ZodPipe(createUserSchema)) body: ParsedUser) {
    this.handled += 1;
    // Never echoes the password: only the fields whose transforms a test observes.
    return {
      role: body.role,
      email: body.email,
      fullName: body.fullName,
      avatarUrl: body.avatarUrl,
    };
  }

  @Post("json")
  json(@Body() body: unknown) {
    this.handled += 1;
    return { ok: true, type: typeof body };
  }

  @Post("upload")
  @UseInterceptors(uploadFile("file"))
  upload(@UploadedFile() file: UploadedBytes | undefined) {
    this.handled += 1;
    return { size: file?.size ?? 0 };
  }

  @Get("slow")
  async slow(@Query("ms") ms: string) {
    const wait = Math.min(Number(ms) || 0, 10_000);
    await new Promise((resolve) => setTimeout(resolve, wait));
    return { waited: wait };
  }
}

type ParsedUser = ReturnType<typeof createUserSchema.parse>;
