import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import type { Request } from "express";

export const IS_PUBLIC = "devspace:public";
export const IS_SENSITIVE = "devspace:sensitive";

// Every route needs a session unless it carries this marker (AC5). The public set is named by a test: the two health routes and the home course list.
export const Public = () => SetMetadata(IS_PUBLIC, true);

// Marks an operation of the payment or admin class: the session guard asks the Auth server on every call instead of
// trusting a cached answer (ADR 0008 D6).
export const Sensitive = () => SetMetadata(IS_SENSITIVE, true);

export type SessionUser = { id: string };

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser => {
    return context.switchToHttp().getRequest<Request & { user: SessionUser }>()
      .user;
  },
);
