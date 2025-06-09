// src/bill/dto/pay-bill.dto.ts
import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsObject,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BillType } from 'src/common/enums/bill-type.enum';

export class PayBillDto {
  //   @ApiProperty({ description: 'User ID', example: 'uuid-string' })
  //   @IsString()
  //   userId: string;

  @ApiProperty({ description: 'Bill type', example: BillType.ELECTRICITY })
  //   @IsString()
  @IsEnum(BillType)
  billType: string;

  @ApiProperty({ description: 'Amount to pay', example: 50.0 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Customer reference', example: 'METER123456' })
  @IsString()
  customerReference: string;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
