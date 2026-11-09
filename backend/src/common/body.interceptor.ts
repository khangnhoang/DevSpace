import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { json, urlencoded } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { from, Observable, switchMap } from "rxjs";
import { JSON_LIMIT_BYTES } from "./limits";
import { INVALID_BODY_MESSAGE } from "./zod.pipe";

const parsers: RequestHandler[] = [
  json({ limit: JSON_LIMIT_BYTES }),
  urlencoded({ limit: JSON_LIMIT_BYTES, extended: true }),
];

function run(
  parser: RequestHandler,
  request: Request,
  response: Response,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const done: NextFunction = (error?: unknown) =>
      error ? reject(error) : resolve();
    parser(request, response, done);
  });
}

// What the parser threw, as the refusal the client sees. The JSON parser's own message quotes the start of the text it
// could not read (`Unexpected token 'n', "null" is not valid JSON`), so a body that is not JSON gets the same generic
// 400 as a body that fails its schema (AC8). Over the limit the parser answers 413, and a body shorter than its
// Content-Length ends the request with 400 (AC9); both messages name no input.
function refusal(error: unknown): unknown {
  const { type, status } = (error ?? {}) as {
    type?: unknown;
    status?: unknown;
  };
  if (type === "entity.parse.failed") {
    return new BadRequestException(INVALID_BODY_MESSAGE);
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    return new HttpException((error as Error).message, status);
  }
  return error;
}

// The body is read here and nowhere earlier. Nest runs every guard before any interceptor, so a request that the CSRF
// guard, the session guard or a route's own guard refuses is answered without its body being read or parsed: a
// cross-site request is 403 whatever it sends, and a caller with no session cannot make the API buffer 4 MiB (AC7).
// An Express middleware would run before the guards and read the body of every request, whatever its path.
// Multipart bodies are not touched here: the upload interceptor of the route reads them, and it also runs after the
// guards.
@Injectable()
export class BodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    return from(
      (async () => {
        try {
          for (const parser of parsers) {
            await run(parser, request, response);
          }
        } catch (error) {
          throw refusal(error);
        }
      })(),
    ).pipe(switchMap(() => next.handle()));
  }
}
