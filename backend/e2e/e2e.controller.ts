import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import {
  CurrentUser,
  Sensitive,
  type SessionUser,
} from "../src/auth/decorators";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { extractToken } from "../src/auth/token";
import { DbService } from "../src/db/db.service";
import { profiles } from "../src/db/schema";
import { uploadFile, type UploadedBytes } from "../src/common/upload";
import { ZodPipe } from "../src/common/zod.pipe";
import { createUserSchema } from "../../lib/schemas/user";

// Test-only routes (AC20): they exist in the e2e build and nowhere else. `private` carries no marker on purpose, to
// prove that an unmarked route is denied by default.
@Controller("e2e")
export class E2eController {
  // Counts the handlers that ran, so a test can show that a refused request never reached one.
  private handled = 0;

  constructor(private readonly database: DbService) {}

  @Get("private")
  privateRoute() {
    return { ok: true };
  }

  @Get("whoami")
  whoami(@CurrentUser() user: SessionUser) {
    return { userId: user.id };
  }

  // A digest of the session token this request carried, so a test can tell the token the API received through the Next
  // rewrite from the one the browser held before the refresh. It is never the token.
  @Get("token")
  token(@Req() request: Request) {
    const token = extractToken(request.headers) ?? "";
    return { tokenSha256: createHash("sha256").update(token).digest("hex") };
  }

  @Sensitive()
  @Get("sensitive")
  sensitive(@CurrentUser() user: SessionUser) {
    return { userId: user.id };
  }

  // The permanent check of AC13 (`db-verification.test.ts`) needs a route that is the first caller of the pool: it reads
  // the caller's own `profiles.id, role`, the only columns `devspace_api` may select, twice in a row, and answers `ok`
  // with nothing from the row.
  @Sensitive()
  @Get("db-read")
  async dbRead(@CurrentUser() user: SessionUser) {
    const db = await this.database.connection();
    for (let round = 0; round < 2; round += 1) {
      const rows = await db
        .select({ id: profiles.id, role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);
      if (rows.length !== 1) return { ok: false };
    }
    return { ok: true };
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
