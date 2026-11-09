import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NestMiddleware,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { Observable, tap } from "rxjs";

const STARTED = Symbol("proof-timing-started");
type Stamped = Request & { [STARTED]?: bigint };

// Plan M1: the time spent at the API, as a `Server-Timing` value on the temporary routes. The span starts here, in
// middleware, which runs before every guard, so it includes the session guard (its Auth call) and the proof owner check;
// it ends when the handler has finished, after its last query. It lives beside the proof routes and goes with them in
// PR 2: no permanent guard, pipe or interceptor reads it.
@Injectable()
export class ProofTimingMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction) {
    (request as Stamped)[STARTED] = process.hrtime.bigint();
    next();
  }
}

// Sets the header only on an answer from a handler, which a request reaches only after the proof owner check: a
// refusal (the 404 a signed-in non-owner gets) carries no extra header, so it stays the answer an unknown path gets.
@Injectable()
export class ProofTimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Stamped>();
    const response = http.getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        const started = request[STARTED];
        if (started === undefined || response.headersSent) return;
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        response.setHeader("Server-Timing", `api;dur=${ms.toFixed(1)}`);
      }),
    );
  }
}
