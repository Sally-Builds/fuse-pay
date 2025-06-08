import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FundWalletDto {
  @ApiProperty({ description: 'Amount to fund', example: 100.5 })
  @IsNumber()
  @IsPositive()
  amount: number;
}
