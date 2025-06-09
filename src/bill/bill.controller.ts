import {
  Controller,
  Post,
  Body,
  HttpStatus,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { BillService } from './bill.service';
import { PayBillDto } from './dto/pay-bill.dto';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { User } from 'src/user/user.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwtAuth.guard';

@ApiTags('bills')
@Controller('bills')
export class BillController {
  constructor(private readonly billService: BillService) {}

  @Post('pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay bill' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bill payment initiated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or insufficient funds',
  })
  async payBill(@Body() payBillDto: PayBillDto, @GetUser() user: User) {
    const result = await this.billService.payBill(payBillDto, user.id);
    return {
      success: true,
      message: 'Bill payment initiated successfully',
      data: result,
    };
  }

  @Get('transaction/:transactionId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get transaction status' })
  @ApiParam({ name: 'transactionId', description: 'Transaction ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction status retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Transaction not found',
  })
  async getTransactionStatus(@Param('transactionId') transactionId: string) {
    const status = await this.billService.getTransactionStatus(transactionId);
    return {
      success: true,
      message: 'Transaction status retrieved successfully',
      data: status,
    };
  }
}
