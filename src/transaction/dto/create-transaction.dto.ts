import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { TransactionType } from '../../common/enums/transaction-type.enum';

export class CreateTransactionDto {
  @IsString()
  walletId: string;

  @IsNumber()
  amount: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsString()
  reference: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
