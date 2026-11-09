import { SetMetadata } from "@nestjs/common";

export const IS_RAW_BODY = "devspace:raw-body";

// Marks a route whose body is read as the exact bytes received (a hash or a signature over them), not as parsed JSON.
// BodyInterceptor still reads it after every guard, under the same 4 MiB limit and the same refusals, and keeps it
// only on the request: nothing stores or logs it.
export const RawBody = () => SetMetadata(IS_RAW_BODY, true);
