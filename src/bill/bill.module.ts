import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BillService } from './bill.service';
import { BillController } from './bill.controller';
import { ExternalBillApiService } from './services/external-bill-api.service';
import { WalletModule } from '../wallet/wallet.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'bill-processing',
    }),
    WalletModule,
    TransactionModule,
  ],
  providers: [BillService, ExternalBillApiService],
  controllers: [BillController],
  exports: [BillService],
})
export class BillModule {}
