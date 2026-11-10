import { DynamicModule, Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR, DiscoveryModule } from "@nestjs/core";
import { CsrfGuard } from "./auth/csrf.guard";
import { SessionGuard } from "./auth/session.guard";
import { SessionService } from "./auth/session.service";
import { ServerEnv } from "./common/env";
import { BodyInterceptor } from "./common/body.interceptor";
import { TimeoutInterceptor } from "./common/timeout.interceptor";
import { SERVER_ENV } from "./common/tokens";
import { CoursesModule } from "./courses/courses.module";
import { DbService } from "./db/db.service";
import { HealthController } from "./health/health.controller";

@Module({})
export class AppModule {
  static register(
    env: ServerEnv,
    extraModules: DynamicModule[] = [],
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [DiscoveryModule, CoursesModule, ...extraModules],
      controllers: [HealthController],
      providers: [
        { provide: SERVER_ENV, useValue: env },
        DbService,
        SessionService,
        // Guards run in the order they are registered: the CSRF guard first, so a cross-site request is 403 before
        // any session lookup (AC7), then the session guard, which denies every route that is not marked public (AC5).
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: SessionGuard },
        // After the guards, before the pipes: the body is read only for a request that every guard let through.
        { provide: APP_INTERCEPTOR, useClass: BodyInterceptor },
        { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
      ],
      exports: [SERVER_ENV, DbService],
      global: true,
    };
  }
}
