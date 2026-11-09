import { INestApplication, RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { DiscoveryService, Reflector } from "@nestjs/core";
import { IS_PUBLIC } from "./decorators";

export type RouteInfo = { method: string; path: string; public: boolean };

function join(...parts: string[]): string {
  return (
    "/" +
    parts
      .flatMap((part) => part.split("/"))
      .filter((part) => part !== "")
      .join("/")
  );
}

// Every route the application registers, with whether it is public. The default-deny test reads this to show that
// the public set is exactly the named routes (AC5, TM-U4 AC4).
export function listRoutes(app: INestApplication, prefix = "api"): RouteInfo[] {
  const discovery = app.get(DiscoveryService);
  const reflector = app.get(Reflector);
  const routes: RouteInfo[] = [];
  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || !metatype) continue;
    const base = (Reflect.getMetadata(PATH_METADATA, metatype) ?? "") as string;
    const prototype = Object.getPrototypeOf(instance) as Record<
      string,
      unknown
    >;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];
      if (typeof handler !== "function") continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as
        RequestMethod | undefined;
      if (method === undefined) continue;
      const path = (Reflect.getMetadata(PATH_METADATA, handler) ??
        "") as string;
      routes.push({
        method: RequestMethod[method],
        path: join(prefix, base, path),
        public:
          reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
            handler,
            metatype,
          ]) === true,
      });
    }
  }
  return routes.sort((a, b) =>
    `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
  );
}
