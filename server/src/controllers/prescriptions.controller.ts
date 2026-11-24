import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { config } from '../../config/index.js';
import {
  getPrescriptionFile,
  listCustomerPrescriptions,
  listReviewQueue,
  reviewOrderPrescription,
  savePrescription,
} from '../services/prescriptions.js';
import { parseOrderId, parsePrescriptionId } from '../utils/ids.js';
import { AuthenticatedRequest, Roles } from '../security/auth.guards.js';
import { parseInput } from '../common/validation.js';

const queueSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});
const reviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(500).optional(),
});

@Roles('customer', 'seller', 'admin')
@Controller('prescriptions')
export class PrescriptionsController {
  @Post()
  @Roles('customer')
  @UseInterceptors(FileInterceptor('file', {
    // One extra byte lets the service report an oversized file with a clear message.
    limits: { fileSize: config.maxPrescriptionBytes + 1, files: 1 },
  }))
  upload(@Req() request: AuthenticatedRequest, @UploadedFile() file: { buffer: Buffer; originalname: string }) {
    return { prescription: savePrescription(request.auth!.id, file) };
  }

  @Get()
  @Roles('customer')
  list(@Req() request: AuthenticatedRequest) {
    return { prescriptions: listCustomerPrescriptions(request.auth!.id) };
  }

  @Get('reviews')
  @Roles('seller', 'admin')
  queue(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const input = parseInput(queueSchema, query);
    return listReviewQueue(request.auth!, input.status);
  }

  @Patch('reviews/:orderId')
  @Roles('seller', 'admin')
  review(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() body: unknown,
  ) {
    const input = parseInput(reviewSchema, body);
    return { order: reviewOrderPrescription(parseOrderId(orderId), input.decision, input.reason, request.auth!) };
  }

  @Get(':id/file')
  file(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const file = getPrescriptionFile(parsePrescriptionId(id), request.auth!);
    response.setHeader('Content-Type', file.fileType);
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.sendFile(file.filePath);
  }
}
