import {
  Injectable,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { v4 as uuidv4 } from 'uuid';

import { PayBillDto } from './dto/pay-bill.dto';
import { WalletService } from '../wallet/wallet.service';
import { TransactionService } from '../transaction/transaction.service';
import { ExternalBillApiService } from './services/external-bill-api.service';
import { TransactionStatus } from '../common/enums/transaction-status.enum';
import { TransactionType } from '../common/enums/transaction-type.enum';

@Injectable()
export class BillService {
  private readonly logger = new Logger(BillService.name);

  constructor(
    private dataSource: DataSource,
    private walletService: WalletService,
    private transactionService: TransactionService,
    private externalBillApiService: ExternalBillApiService,
    @InjectQueue('bill-processing') private billQueue: Queue,
    private eventEmitter: EventEmitter2,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
  ) {}

  async payBill(payBillDto: PayBillDto, userId: string) {
    const { billType, amount, customerReference, metadata } = payBillDto;
    const reference = `BILL_${uuidv4()}`;

    let queryRunner: QueryRunner | null = null;

    try {
      // Get wallet first to validate user and sufficient funds
      const wallet = await this.walletService.getWalletByUserId(userId);

      if (wallet.balance < amount) {
        throw new BadRequestException('Insufficient funds');
      }

      queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Debit wallet
      await this.walletService.debitWallet(
        wallet.id,
        amount,
        reference,
        queryRunner,
      );

      // Create bill payment transaction
      const transaction = await this.transactionService.createTransaction(
        {
          walletId: wallet.id,
          amount: -amount,
          type: TransactionType.BILL_PAYMENT,
          reference,
          metadata: {
            userId,
            billType,
            customerReference,
            ...metadata,
          },
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();

      this.winstonLogger.info('Bill payment initiated', {
        transactionId: transaction.id,
        reference,
        userId,
        amount,
        billType,
      });

      // Queue bill processing job
      await this.billQueue.add(
        'process-bill-payment',
        {
          transactionId: transaction.id,
          billPaymentRequest: {
            billType,
            amount,
            customerReference,
            metadata,
          },
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      return {
        transactionId: transaction.id,
        reference,
        status: TransactionStatus.PROCESSING,
        message: 'Bill payment is being processed',
      };
    } catch (error) {
      if (queryRunner) {
        await queryRunner.rollbackTransaction();
      }

      this.winstonLogger.error('Bill payment failed', {
        userId,
        amount,
        billType,
        error: error.message,
      });

      throw error;
    } finally {
      if (queryRunner) {
        await queryRunner.release();
      }
    }
  }

  async processBillPayment(transactionId: string, billPaymentRequest: any) {
    try {
      this.winstonLogger.info('Processing bill payment', {
        transactionId,
        billPaymentRequest,
      });

      // Update transaction status to processing
      await this.transactionService.updateTransactionStatus(
        transactionId,
        TransactionStatus.PROCESSING,
      );

      // Call external API
      const response =
        await this.externalBillApiService.processBillPayment(
          billPaymentRequest,
        );

      if (response.success) {
        // Success - update transaction
        await this.transactionService.updateTransactionStatus(
          transactionId,
          TransactionStatus.COMPLETED,
          response.transactionId,
        );

        this.winstonLogger.info('Bill payment completed successfully', {
          transactionId,
          externalTransactionId: response.transactionId,
        });

        // Emit success event
        this.eventEmitter.emit('bill.payment.success', {
          transactionId,
          externalTransactionId: response.transactionId,
          data: response.data,
        });
      } else {
        // Failure - update transaction and trigger reversal
        await this.transactionService.updateTransactionStatus(
          transactionId,
          TransactionStatus.FAILED,
          response.transactionId,
          response.message,
        );

        this.winstonLogger.warn('Bill payment failed, triggering reversal', {
          transactionId,
          reason: response.message,
        });

        // Emit failure event to trigger reversal
        this.eventEmitter.emit('bill.payment.failed', {
          transactionId,
          reason: response.message,
        });
      }

      return response;
    } catch (error) {
      this.winstonLogger.error('Error processing bill payment', {
        transactionId,
        error: error.message,
      });

      // Update transaction status to failed
      await this.transactionService.updateTransactionStatus(
        transactionId,
        TransactionStatus.FAILED,
        undefined,
        error.message,
      );

      // Emit failure event
      this.eventEmitter.emit('bill.payment.failed', {
        transactionId,
        reason: error.message,
      });

      throw error;
    }
  }

  async getTransactionStatus(transactionId: string) {
    const transaction =
      await this.transactionService.transactionRepository.findOne({
        where: { id: transactionId },
        relations: ['wallet'],
      });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    return {
      transactionId: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
      amount: Math.abs(transaction.amount),
      type: transaction.type,
      createdAt: transaction.createdAt,
      externalReference: transaction.externalReference,
      failureReason: transaction.failureReason,
      metadata: transaction.metadata ? JSON.parse(transaction.metadata) : null,
    };
  }
}
