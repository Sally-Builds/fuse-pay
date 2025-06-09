import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { Wallet } from 'src/wallet/wallet.entity';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { TransactionService } from 'src/transaction/transaction.service';
import { TransactionType } from 'src/common/enums/transaction-type.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
    private transactionService: TransactionService,
  ) {}

  async createWallet(userId: string): Promise<Wallet> {
    try {
      const existingWallet = await this.walletRepository.findOne({
        where: { userId },
      });

      if (existingWallet) {
        throw new ConflictException('Wallet already exists for this user');
      }

      const wallet = this.walletRepository.create({
        userId,
        balance: 0,
        version: 0,
      });

      const savedWallet = await this.walletRepository.save(wallet);

      this.winstonLogger.info('Wallet created successfully', {
        walletId: savedWallet.id,
        userId,
      });
      console.log(savedWallet, 'Wallet created successfully');

      return savedWallet;
    } catch (error) {
      this.winstonLogger.error('Failed to create wallet', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  async getWalletByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    if (!wallet) {
      throw new ConflictException('Wallet not found for this user');
    }

    return wallet;
  }

  async fundWallet(
    fundWalletDto: { amount: number; userId: string },
    queryRunner?: QueryRunner,
  ): Promise<Wallet> {
    const { userId, amount } = fundWalletDto;

    try {
      let wallet = await this.getWalletByUserId(userId);

      if (!wallet) {
        wallet = await this.createWallet(userId);
      }

      // Use query runner for transaction if provided
      const repository = queryRunner
        ? queryRunner.manager.getRepository(Wallet)
        : this.walletRepository;

      // Optimistic locking to prevent race conditions
      const result = await repository
        .createQueryBuilder()
        .update(Wallet)
        .set({
          balance: () => `balance + ${amount}`,
          version: () => 'version + 1',
        })
        .where('id = :id AND version = :version', {
          id: wallet.id,
          version: wallet.version,
        })
        .execute();

      if (result.affected === 0) {
        throw new ConflictException(
          'Wallet was modified by another transaction',
        );
      }

      // Create funding transaction
      await this.transactionService.createTransaction(
        {
          walletId: wallet.id,
          amount,
          type: TransactionType.WALLET_FUNDING,
          reference: `FUND_${uuidv4()}`,
          metadata: { userId },
        },
        queryRunner,
      );

      // Fetch updated wallet
      const updatedWallet = await repository.findOne({
        where: { id: wallet.id },
      });

      if (!updatedWallet) {
        throw new NotFoundException('Wallet not found');
      }
      // Log the successful funding

      this.winstonLogger.info('Wallet funded successfully', {
        walletId: wallet.id,
        userId,
        amount,
        newBalance: updatedWallet.balance,
      });

      return updatedWallet;
    } catch (error) {
      this.winstonLogger.error('Failed to fund wallet', {
        userId,
        amount,
        error: error.message,
      });
      throw error;
    }
  }

  async debitWallet(
    walletId: string,
    amount: number,
    reference: string,
    queryRunner?: QueryRunner,
  ): Promise<Wallet> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(Wallet)
        : this.walletRepository;

      const wallet = await repository.findOne({
        where: { id: walletId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.balance < amount) {
        throw new BadRequestException('Insufficient funds');
      }

      // Optimistic locking
      const result = await repository
        .createQueryBuilder()
        .update(Wallet)
        .set({
          balance: () => `balance - ${amount}`,
          version: () => 'version + 1',
        })
        .where('id = :id AND version = :version AND balance >= :amount', {
          id: wallet.id,
          version: wallet.version,
          amount,
        })
        .execute();

      if (result.affected === 0) {
        throw new ConflictException(
          'Insufficient funds or wallet was modified',
        );
      }

      // Create debit transaction
      // await this.transactionService.createTransaction(
      //   {
      //     walletId: wallet.id,
      //     amount: -amount,
      //     type: TransactionType.BILL_PAYMENT,
      //     reference,
      //   },
      //   queryRunner,
      // );

      const updatedWallet = await repository.findOne({
        where: { id: wallet.id },
      });

      if (!updatedWallet) {
        throw new NotFoundException('Wallet not found');
      }

      this.winstonLogger.info('Wallet debited successfully', {
        walletId,
        amount,
        reference,
        newBalance: updatedWallet.balance,
      });

      return updatedWallet;
    } catch (error) {
      this.winstonLogger.error('Failed to debit wallet', {
        walletId,
        amount,
        reference,
        error: error.message,
      });
      throw error;
    }
  }

  async creditWallet(
    walletId: string,
    amount: number,
    reference: string,
    queryRunner?: QueryRunner,
  ): Promise<Wallet> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(Wallet)
        : this.walletRepository;

      const wallet = await repository.findOne({
        where: { id: walletId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Optimistic locking
      const result = await repository
        .createQueryBuilder()
        .update(Wallet)
        .set({
          balance: () => `balance + ${amount}`,
          version: () => 'version + 1',
        })
        .where('id = :id AND version = :version', {
          id: wallet.id,
          version: wallet.version,
        })
        .execute();

      if (result.affected === 0) {
        throw new ConflictException(
          'Wallet was modified by another transaction',
        );
      }

      // Create credit transaction
      await this.transactionService.createTransaction(
        {
          walletId: wallet.id,
          amount,
          type: TransactionType.REVERSAL,
          reference,
        },
        queryRunner,
      );

      const updatedWallet = await repository.findOne({
        where: { id: wallet.id },
      });

      if (!updatedWallet) {
        throw new NotFoundException('Wallet not found');
      }

      this.winstonLogger.info('Wallet credited successfully', {
        walletId,
        amount,
        reference,
        newBalance: updatedWallet.balance,
      });

      return updatedWallet;
    } catch (error) {
      this.winstonLogger.error('Failed to credit wallet', {
        walletId,
        amount,
        reference,
        error: error.message,
      });
      throw error;
    }
  }
}
