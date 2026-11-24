import { BadRequestException } from '@nestjs/common';
export function parseInput(schema, input) {
    const result = schema.safeParse(input);
    if (!result.success) {
        throw new BadRequestException({
            error: 'Request validation failed.',
            details: result.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
            })),
        });
    }
    return result.data;
}
