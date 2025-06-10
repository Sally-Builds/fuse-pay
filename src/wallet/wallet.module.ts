import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { Wallet } from './wallet.entity';
import { WalletController } from './wallet.controller';
import { TransactionModule } from 'src/transaction/transaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet]),
    forwardRef(() => TransactionModule),
  ],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [TypeOrmModule, WalletService],
})
export class WalletModule {}
