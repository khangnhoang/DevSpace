import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { CurrentUser, Sensitive, type SessionUser } from "../auth/decorators";
import { RawBody } from "../common/raw-body";
import { uploadFile, type UploadedBytes } from "../common/upload";
import { DbService } from "../db/db.service";
import { profiles } from "../db/schema";
import { ProofOwnerGuard } from "./proof-owner.guard";
import { ProofTimingInterceptor } from "./proof-timing";

// The only durations `slow` accepts: below the 60-second limit with margin (35), just under it (58), and past it (65),
// which must end with the explicit 504 (AC9, plan T4). Any other value is a mistake, not a longer wait.
export const SLOW_SECONDS = [35, 58, 65] as const;

const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const digest = (bytes: Buffer) => ({
  length: bytes.length,
  sha256: sha256(bytes),
});

// Temporary surfaces of TM-U3 (plan 1.2), removed by PR 2. Every route needs a session (the global guards) and then
// the proof owner (ProofOwnerGuard). Responses carry the user id, a length and a hash, or `ok`: never a row, a body or
// a token.
@UseGuards(ProofOwnerGuard)
@UseInterceptors(ProofTimingInterceptor)
@Controller()
export class ProofController {
  constructor(private readonly database: DbService) {}

  @Get("session")
  session(@CurrentUser() user: SessionUser) {
    return { userId: user.id };
  }

  // The same answer, from a route that never trusts the session cache: it asks the Auth server on every call.
  @Sensitive()
  @Get("proof/session-cold")
  sessionCold(@CurrentUser() user: SessionUser) {
    return { userId: user.id };
  }

  // Two reads one after the other on the pooled connection, each of the caller's own row and only the columns the
  // `devspace_api` role may select. It answers `ok` and nothing from the row.
  // @Sensitive: ADR 0008 D11 budgets an uncached request, which pays two session checks, so the M1 budget row must
  // ask Auth on every call instead of using the 30-second session cache after its first sample.
  @Sensitive()
  @Get("proof/read")
  async read(@CurrentUser() user: SessionUser) {
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

  // The hash is over the bytes as they arrived, not over a re-serialized document (plan T1).
  @Post("proof/echo")
  @HttpCode(200)
  @RawBody()
  echo(@Req() request: Request) {
    const body: unknown = request.body;
    return digest(Buffer.isBuffer(body) ? body : Buffer.alloc(0));
  }

  @Post("proof/upload")
  @HttpCode(200)
  @UseInterceptors(uploadFile("file"))
  upload(@UploadedFile() file: UploadedBytes | undefined) {
    return digest(file?.buffer ?? Buffer.alloc(0));
  }

  @Get("proof/slow")
  async slow(@Query("seconds") seconds: string | undefined) {
    const wanted = Number(seconds);
    if (!(SLOW_SECONDS as readonly number[]).includes(wanted)) {
      throw new BadRequestException(
        `seconds must be one of ${SLOW_SECONDS.join(", ")}.`,
      );
    }
    await new Promise<void>((resolve) => {
      // unref: a wait that outlives the request must not keep a stopping process alive.
      setTimeout(resolve, wanted * 1000).unref();
    });
    return { waitedSeconds: wanted };
  }

  // Writes ten chunks half a second apart and ends. The handler writes to the response itself, so the Observable that
  // TimeoutInterceptor watches completes at once: the 60-second limit does not govern this route. What it exercises is
  // that bytes reach the client as they are written, not buffered to the end (plan T4).
  @Get("proof/stream")
  stream(@Res() response: Response) {
    response.status(200);
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("X-Accel-Buffering", "no");
    let sent = 0;
    const timer = setInterval(() => {
      sent += 1;
      response.write(`chunk ${sent}\n`);
      if (sent === 10) {
        clearInterval(timer);
        response.end();
      }
    }, 500);
    response.on("close", () => clearInterval(timer));
  }
}
