import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BillProcessingProcessor } from './processors/bill-processing.processor';
import { ReversalProcessingProcessor } from './processors/reversal-processing.processor';
import { BillPaymentListener } from './listeners/bill-payment.listener';
import { BillModule } from '../bill/bill.module';
import { WalletModule } from '../wallet/wallet.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'bill-processing',
    }),
    BillModule,
    WalletModule,
    TransactionModule,
  ],
  providers: [
    BillProcessingProcessor,
    ReversalProcessingProcessor,
    BillPaymentListener,
  ],
})
export class QueueModule {}
