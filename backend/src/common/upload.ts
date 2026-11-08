import { FileInterceptor } from "@nestjs/platform-express";
import { UPLOAD_LIMIT_BYTES } from "./limits";

// The shape of the file the interceptor leaves on the request (multer's memory storage).
export type UploadedBytes = { buffer: Buffer; size: number; mimetype: string };

// One file of at most 2 MiB (Owner decision 20). multer stops reading at the limit and Nest answers 413, so a larger
// file never reaches a handler. A text field is held in memory too, and multer's default of 1 MiB each would let 20
// fields add about 20 MiB to the file: 64 KiB each caps the fields at about 1.3 MiB.
export function uploadFile(field: string) {
  return FileInterceptor(field, {
    limits: {
      fileSize: UPLOAD_LIMIT_BYTES,
      fieldSize: 64 * 1024,
      files: 1,
      fields: 20,
      parts: 21,
    },
  });
}
