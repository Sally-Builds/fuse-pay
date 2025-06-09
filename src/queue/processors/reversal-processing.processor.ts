import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { v4 as uuidv4 } from 'uuid';

import { WalletService } from '../../wallet/wallet.service';
import { TransactionService } from '../../transaction/transaction.service';
import { TransactionStatus } from '../../common/enums/transaction-status.enum';

@Injectable()
@Processor('bill-processing')
export class ReversalProcessingProcessor {
  private readonly logger = new Logger(ReversalProcessingProcessor.name);

  constructor(
    private dataSource: DataSource,
    private walletService: WalletService,
    private transactionService: TransactionService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
  ) {}

  @Process('process-reversal')
  async handleReversal(job: Job) {
    const { transactionId, reason } = job.data;

    this.logger.log(`Processing reversal for transaction: ${transactionId}`);

    let queryRunner: QueryRunner | null = null;

    try {
      // Get the original transaction
      const originalTransaction =
        await this.transactionService.transactionRepository.findOne({
          where: { id: transactionId },
          relations: ['wallet'],
        });

      if (!originalTransaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Credit the wallet back
      const reversalAmount = Math.abs(originalTransaction.amount);
      const reversalReference = `REV_${uuidv4()}`;

      await this.walletService.creditWallet(
        originalTransaction.walletId,
        reversalAmount,
        reversalReference,
        queryRunner,
      );

      // Update original transaction to reversed
      await this.transactionService.updateTransactionStatus(
        transactionId,
        TransactionStatus.REVERSED,
        undefined,
        reason,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      this.winstonLogger.info('Reversal processed successfully', {
        originalTransactionId: transactionId,
        reversalReference,
        amount: reversalAmount,
        reason,
      });
    } catch (error) {
      if (queryRunner) {
        await queryRunner.rollbackTransaction();
      }

      this.winstonLogger.error('Reversal processing failed', {
        transactionId,
        error: error.message,
      });

      throw error;
    } finally {
      if (queryRunner) {
        await queryRunner.release();
      }
    }
  }
}
