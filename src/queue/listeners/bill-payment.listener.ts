import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class BillPaymentListener {
  private readonly logger = new Logger(BillPaymentListener.name);

  constructor(@InjectQueue('bill-processing') private billQueue: Queue) {}

  @OnEvent('bill.payment.failed')
  async handleBillPaymentFailed(payload: {
    transactionId: string;
    reason: string;
  }) {
    this.logger.log(
      `Bill payment failed event received for transaction: ${payload.transactionId}`,
    );

    // Queue reversal processing
    await this.billQueue.add(
      'process-reversal',
      {
        transactionId: payload.transactionId,
        reason: payload.reason,
      },
      {
        delay: 5000, // 5 second delay before processing reversal
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    );

    this.logger.log(
      `Reversal queued for transaction: ${payload.transactionId}`,
    );
  }

  @OnEvent('bill.payment.success')
  async handleBillPaymentSuccess(payload: {
    transactionId: string;
    externalTransactionId: string;
    data: any;
  }) {
    this.logger.log(
      `Bill payment success event received for transaction: ${payload.transactionId}`,
    );
  }
}
