import {
  Controller,
  Get,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwtAuth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { User } from 'src/user/user.entity';
import { TransactionService } from './transaction.service';

@ApiTags('transaction')
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user transactions' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transactions fetch successful',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async getCurrentUserTransactions(@GetUser() user: User) {
    if (!user) {
      throw new UnauthorizedException(
        'Invalid or missing authentication token',
      );
    }
    return this.transactionService.getTransactionsByUserId(user.id);
  }
}
