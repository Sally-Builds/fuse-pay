import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from 'src/auth/guards/jwtAuth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { User } from 'src/user/user.entity';
import { FundWalletDto } from './dto/fund-wallet.dto';

@ApiTags('wallet')
@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user wallet' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User profile retrieved' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async getWallet(@GetUser() user: User) {
    if (!user) {
      throw new UnauthorizedException(
        'Invalid or missing authentication token',
      );
    }
    return this.walletService.getWalletByUserId(user.id);
  }

  @Post('fund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fund user wallet' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallet funded successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async fundWallet(@Body() { amount }: FundWalletDto, @GetUser() user: User) {
    if (!user) {
      throw new UnauthorizedException(
        'Invalid or missing authentication token',
      );
    }
    const wallet = await this.walletService.fundWallet({
      amount,
      userId: user.id,
    });
    return {
      success: true,
      message: 'Wallet funded successfully',
      data: {
        walletId: wallet.id,
        balance: wallet.balance,
      },
    };
  }
}
