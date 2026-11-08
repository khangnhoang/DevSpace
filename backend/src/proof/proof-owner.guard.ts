import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";
import type { SessionUser } from "../auth/decorators";
import { ServerEnv } from "../common/env";
import { SERVER_ENV } from "../common/tokens";

// The last guard of a proof route. Route-level guards run after the global ones, so the order a request meets is:
// CSRF (403), session (401/503), this owner check (404), then the body is read, validated and handled. A session that
// is not API_PROOF_USER_ID, and every session when that variable is unset, gets the same 404 an unknown path gets, so
// the route's existence is not revealed to a signed-in user who is not the proof owner. The proof flag itself is
// decided earlier still: with it off the module is not registered and this guard never runs (AC19).
@Injectable()
export class ProofOwnerGuard implements CanActivate {
  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: SessionUser }>();
    const owner = this.env.proofUserId;
    if (owner === null || request.user?.id.toLowerCase() !== owner) {
      throw new NotFoundException();
    }
    return true;
  }
}
