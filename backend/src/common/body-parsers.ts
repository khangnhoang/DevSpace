import { BadRequestException } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { json, urlencoded } from "express";
import type { NextFunction, Request, Response } from "express";
import { JSON_LIMIT_BYTES } from "./limits";
import { INVALID_BODY_MESSAGE } from "./zod.pipe";

// The body parsers are registered here, in order, rather than left to Nest, so that the error middleware below sits
// directly behind them. Over the limit the parser answers 413. A body shorter than its Content-Length ends the request
// with 400 before any handler runs (AC9). Multipart is limited per file by the upload interceptor.
export function useBodyParsers(app: NestExpressApplication): void {
  app.use(json({ limit: JSON_LIMIT_BYTES }));
  app.use(urlencoded({ limit: JSON_LIMIT_BYTES, extended: true }));
  app.use(refuseUnreadableBody);
}

// The parser's own message quotes the start of the text it could not read (`Unexpected token 'n', "null" is not valid
// JSON`). A body that is not JSON gets the same generic 400 as a body that fails its schema, so nothing the client sent
// comes back (AC8). Every other parser error, the 413 included, goes on to Nest's default handling.
function refuseUnreadableBody(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (
    typeof error === "object" &&
    error !== null &&
    (error as { type?: unknown }).type === "entity.parse.failed"
  ) {
    const refusal = new BadRequestException(INVALID_BODY_MESSAGE);
    response.status(refusal.getStatus()).json(refusal.getResponse());
    return;
  }
  next(error);
}
