import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

import { Transaction } from './transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionStatus } from '../common/enums/transaction-status.enum';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    public transactionRepository: Repository<Transaction>,
    private eventEmitter: EventEmitter2,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
  ) {}

  async createTransaction(
    createTransactionDto: CreateTransactionDto,
    queryRunner?: QueryRunner,
  ): Promise<Transaction> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(Transaction)
        : this.transactionRepository;
      const transaction = repository.create({
        ...createTransactionDto,
        metadata: createTransactionDto.metadata
          ? JSON.stringify(createTransactionDto.metadata)
          : undefined,
        status: TransactionStatus.PENDING,
      });
      const savedTransaction = await repository.save(transaction);
      this.winstonLogger.info('Transaction created', {
        transactionId: savedTransaction.id,
        reference: savedTransaction.reference,
        amount: savedTransaction.amount,
        type: savedTransaction.type,
      });
      return savedTransaction;
    } catch (error) {
      this.winstonLogger.error('Failed to create transaction', {
        reference: createTransactionDto.reference,
        error: error.message,
      });
      throw error;
    }
  }

  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    externalReference?: string,
    failureReason?: string,
    queryRunner?: QueryRunner,
  ): Promise<Transaction> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(Transaction)
        : this.transactionRepository;
      await repository.update(transactionId, {
        status,
        externalReference,
        failureReason,
      });
      const updatedTransaction = await repository.findOne({
        where: { id: transactionId },
      });
      this.winstonLogger.info('Transaction status updated', {
        transactionId,
        status,
        externalReference,
      });
      // Emit event for failed transactions
      if (status === TransactionStatus.FAILED) {
        this.eventEmitter.emit('transaction.failed', {
          transactionId,
          transaction: updatedTransaction,
        });
      }
      if (!updatedTransaction) {
        throw new Error('Transaction not found');
      }
      return updatedTransaction;
    } catch (error) {
      this.winstonLogger.error('Failed to update transaction status', {
        transactionId,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  async getTransactionsByWalletId(walletId: string): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { walletId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    const wallet = await this.walletService.getWalletByUserId(userId);

    return this.transactionRepository.find({
      where: { walletId: wallet.id, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  async getTransactionByReference(reference: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { reference, isDeleted: false },
    });
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    return transaction;
  }
}
