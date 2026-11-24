import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import {
  advanceOrderStatus,
  getAuthorizedInvoice,
  getAuthorizedOrder,
  listOrders,
  rejectOrder,
} from '../services/orderOperations.js';
import { resubmitOrderPrescription } from '../services/prescriptions.js';
import { parseOrderId, parsePrescriptionId } from '../utils/ids.js';
import { AuthenticatedRequest, Roles } from '../security/auth.guards.js';
import { parseInput } from '../common/validation.js';

const statusSchema = z.object({
  status: z.enum(['confirmed', 'out_for_delivery', 'delivered']),
});
const rejectSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
const prescriptionSchema = z.object({
  prescriptionId: z.string().regex(/^RX-\d+$/i),
});

@Roles('customer', 'seller', 'admin')
@Controller('orders')
export class OrdersController {
  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return { orders: listOrders(request.auth!) };
  }

  @Patch(':id/status')
  @Roles('seller', 'admin')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseInput(statusSchema, body);
    return { order: advanceOrderStatus(parseOrderId(id), input.status, request.auth!) };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('seller', 'admin')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseInput(rejectSchema, body);
    return { order: rejectOrder(parseOrderId(id), input.reason, request.auth!) };
  }

  @Post(':id/prescription')
  @HttpCode(200)
  @Roles('customer')
  resubmitPrescription(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseInput(prescriptionSchema, body);
    return {
      order: resubmitOrderPrescription(
        parseOrderId(id),
        parsePrescriptionId(input.prescriptionId),
        request.auth!.id,
      ),
    };
  }

  @Get(':id/invoice')
  invoice(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return getAuthorizedInvoice(parseOrderId(id), request.auth!);
  }

  @Get(':id')
  detail(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return getAuthorizedOrder(parseOrderId(id), request.auth!);
  }
}
