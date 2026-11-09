import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import {
  catchError,
  Observable,
  throwError,
  timeout,
  TimeoutError,
} from "rxjs";
import { ServerEnv } from "./env";
import { SERVER_ENV } from "./tokens";

export const TIMEOUT_MESSAGE = "The request took too long and was ended.";

// A handler that is still running at the limit (60 seconds, Owner decision 20) is ended with an explicit 504 instead
// of leaving the client to find out through a proxy timeout.
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.env.requestTimeoutMs),
      catchError((error: unknown) =>
        error instanceof TimeoutError
          ? throwError(() => new GatewayTimeoutException(TIMEOUT_MESSAGE))
          : throwError(() => error),
      ),
    );
  }
}
