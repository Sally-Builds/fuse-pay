import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from 'src/wallet/wallet.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
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

      //   this.winstonLogger.info('Wallet created successfully', {
      //     walletId: savedWallet.id,
      //     userId,
      //   });
      console.log(savedWallet, 'Wallet created successfully');

      return savedWallet;
    } catch (error) {
      //   this.winstonLogger.error('Failed to create wallet', {
      //     userId,
      //     error: error.message,
      //   });
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
}
