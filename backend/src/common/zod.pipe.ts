import { BadRequestException, PipeTransform } from "@nestjs/common";

// The shape of a Zod schema that the pipe needs. Declared here so the API takes no direct dependency on `zod`: the
// schemas of lib/schemas are the contract and are passed in as they are (AC2).
type Schema<T> = {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
};

export const INVALID_BODY_MESSAGE = "Dữ liệu không hợp lệ.";

// A failed parse answers 400 with one generic message: no issue list, path or raw input (AC8). The handler receives
// the parsed value, with the schema's transforms applied, and never the raw body.
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: Schema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(INVALID_BODY_MESSAGE);
    return result.data;
  }
}
