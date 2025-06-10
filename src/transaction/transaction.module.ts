import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionService } from './transaction.service';
import { Transaction } from './transaction.entity';
import { WalletModule } from 'src/wallet/wallet.module';
import { TransactionController } from './transaction.controller';

@Module({
  imports: [
    forwardRef(() => WalletModule),
    TypeOrmModule.forFeature([Transaction]),
  ],
  providers: [TransactionService],
  controllers: [TransactionController],
  exports: [TypeOrmModule, TransactionService],
})
export class TransactionModule {}
