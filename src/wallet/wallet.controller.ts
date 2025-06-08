import {
  Controller,
  Get,
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

@ApiTags('wallet')
@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user wallet' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWallet(@GetUser() user: User) {
    if (!user) {
      throw new UnauthorizedException(
        'Invalid or missing authentication token',
      );
    }
    return this.walletService.getWalletByUserId(user.id);
  }
}
