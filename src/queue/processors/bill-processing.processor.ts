import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { BillService } from '../../bill/bill.service';

@Injectable()
@Processor('bill-processing')
export class BillProcessingProcessor {
  private readonly logger = new Logger(BillProcessingProcessor.name);

  constructor(private billService: BillService) {}

  @Process('process-bill-payment')
  async handleBillPayment(job: Job) {
    const { transactionId, billPaymentRequest } = job.data;

    this.logger.log(
      `Processing bill payment job for transaction: ${transactionId}`,
    );

    try {
      await this.billService.processBillPayment(
        transactionId,
        billPaymentRequest,
      );
      this.logger.log(
        `Bill payment job completed for transaction: ${transactionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Bill payment job failed for transaction: ${transactionId}`,
        error.stack,
      );
      throw error; // This will mark the job as failed and trigger retries
    }
  }
}
