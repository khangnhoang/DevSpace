import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { ServerEnv } from "../common/env";
import { SERVER_ENV } from "../common/tokens";
import { csrfRefusal } from "./csrf";

// Registered before the session guard, so a cross-site request is 403 whether its cookie is valid, invalid or the
// Auth server is down (AC7). It runs on public routes too.
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (csrfRefusal(request.method, request.headers, this.env.allowedOrigins)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
