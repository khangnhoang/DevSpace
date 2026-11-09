import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC, IS_SENSITIVE, type SessionUser } from "./decorators";
import { SessionService } from "./session.service";
import { extractToken } from "./token";

// Default deny: a route without @Public() needs a live session. The guard answers 401 with the framework's generic
// body (no token, no user data) and 503 when the Auth server could not be asked.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: SessionUser }>();
    const token = extractToken(request.headers);
    if (!token) throw new UnauthorizedException();
    const sensitive =
      this.reflector.getAllAndOverride<boolean>(IS_SENSITIVE, targets) === true;
    const result = await this.sessions.verify(token, { sensitive });
    if (result.kind === "unavailable") throw new ServiceUnavailableException();
    if (result.kind !== "ok") throw new UnauthorizedException();
    request.user = result.user;
    return true;
  }
}
