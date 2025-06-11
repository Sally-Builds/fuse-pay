import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, QueryRunner, UpdateResult } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { WalletService } from './wallet.service';
import { Wallet } from './wallet.entity';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionType } from '../common/enums/transaction-type.enum';

// Mock data
const mockWallet = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  userId: 'user-123',
  balance: 1000,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockTransactionService = {
  createTransaction: jest.fn(),
};

// Mock Repository
const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

// Mock QueryBuilder
const mockQueryBuilder = {
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn(),
};

// Mock QueryRunner
const mockQueryRunner = {
  manager: {
    getRepository: jest.fn(),
  },
};

describe('WalletService', () => {
  let service: WalletService;
  let repository: Repository<Wallet>;
  let transactionService: TransactionService;
  let logger: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockRepository,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    repository = module.get<Repository<Wallet>>(getRepositoryToken(Wallet));
    transactionService = module.get<TransactionService>(TransactionService);
    logger = module.get(WINSTON_MODULE_PROVIDER);

    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default mock behaviors
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockQueryRunner.manager.getRepository.mockReturnValue(mockRepository);
  });

  describe('createWallet', () => {
    it('should create a new wallet successfully', async () => {
      const userId = 'user-123';
      const newWallet = { ...mockWallet, userId, balance: 0, version: 0 };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(newWallet);
      mockRepository.save.mockResolvedValue(newWallet);

      const result = await service.createWallet(userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        balance: 0,
        version: 0,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(newWallet);
      expect(logger.info).toHaveBeenCalledWith('Wallet created successfully', {
        walletId: newWallet.id,
        userId,
      });
      expect(result).toEqual(newWallet);
    });

    it('should throw ConflictException if wallet already exists', async () => {
      const userId = 'user-123';
      mockRepository.findOne.mockResolvedValue(mockWallet);

      await expect(service.createWallet(userId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createWallet(userId)).rejects.toThrow(
        'Wallet already exists for this user',
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should log error and rethrow on database failure', async () => {
      const userId = 'user-123';
      const error = new Error('Database error');

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockWallet);
      mockRepository.save.mockRejectedValue(error);

      await expect(service.createWallet(userId)).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith('Failed to create wallet', {
        userId,
        error: error.message,
      });
    });
  });

  describe('getWalletByUserId', () => {
    it('should return wallet when found', async () => {
      const userId = 'user-123';
      mockRepository.findOne.mockResolvedValue(mockWallet);

      const result = await service.getWalletByUserId(userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual(mockWallet);
    });

    it('should throw ConflictException when wallet not found', async () => {
      const userId = 'user-123';
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getWalletByUserId(userId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.getWalletByUserId(userId)).rejects.toThrow(
        'Wallet not found for this user',
      );
    });
  });

  describe('fundWallet', () => {
    const fundWalletDto = { userId: 'user-123', amount: 500 };

    it('should fund existing wallet successfully', async () => {
      const updatedWallet = { ...mockWallet, balance: 1500, version: 2 };
      const updateResult: UpdateResult = {
        affected: 1,
        raw: {},
        generatedMaps: [],
      };

      jest.spyOn(service, 'getWalletByUserId').mockResolvedValue(mockWallet);
      mockQueryBuilder.execute.mockResolvedValue(updateResult);
      mockRepository.findOne.mockResolvedValue(updatedWallet);
      mockTransactionService.createTransaction.mockResolvedValue({});

      const result = await service.fundWallet(fundWalletDto);

      expect(service.getWalletByUserId).toHaveBeenCalledWith(
        fundWalletDto.userId,
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Wallet);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        balance: expect.any(Function),
        version: expect.any(Function),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'id = :id AND version = :version',
        { id: mockWallet.id, version: mockWallet.version },
      );
      expect(mockTransactionService.createTransaction).toHaveBeenCalledWith(
        {
          walletId: mockWallet.id,
          amount: fundWalletDto.amount,
          type: TransactionType.WALLET_FUNDING,
          reference: expect.stringMatching(/^FUND_/),
          metadata: { userId: fundWalletDto.userId },
        },
        undefined,
      );
      expect(logger.info).toHaveBeenCalledWith('Wallet funded successfully', {
        walletId: mockWallet.id,
        userId: fundWalletDto.userId,
        amount: fundWalletDto.amount,
        newBalance: updatedWallet.balance,
      });
      expect(result).toEqual(updatedWallet);
    });

    it('should create wallet and fund if wallet does not exist', async () => {
      const newWallet = { ...mockWallet, balance: 0, version: 0 };
      const updatedWallet = { ...newWallet, balance: 500, version: 1 };
      const updateResult: UpdateResult = {
        affected: 1,
        raw: {},
        generatedMaps: [],
      };

      jest
        .spyOn(service, 'getWalletByUserId')
        .mockRejectedValue(new ConflictException());
      jest.spyOn(service, 'createWallet').mockResolvedValue(newWallet);
      mockQueryBuilder.execute.mockResolvedValue(updateResult);
      mockRepository.findOne.mockResolvedValue(updatedWallet);
      mockTransactionService.createTransaction.mockResolvedValue({});

      const result = await service.fundWallet(fundWalletDto);

      expect(service.createWallet).toHaveBeenCalledWith(fundWalletDto.userId);
      expect(result).toEqual(updatedWallet);
    });

    it('should use query runner when provided', async () => {
      const queryRunner = mockQueryRunner as unknown as QueryRunner;
      const updatedWallet = { ...mockWallet, balance: 1500, version: 2 };
      const updateResult: UpdateResult = {
        affected: 1,
        raw: {},
        generatedMaps: [],
      };

      jest.spyOn(service, 'getWalletByUserId').mockResolvedValue(mockWallet);
      mockQueryBuilder.execute.mockResolvedValue(updateResult);
      mockRepository.findOne.mockResolvedValue(updatedWallet);
      mockTransactionService.createTransaction.mockResolvedValue({});

      const result = await service.fundWallet(fundWalletDto, queryRunner);

      expect(mockQueryRunner.manager.getRepository).toHaveBeenCalledWith(
        Wallet,
      );
      expect(mockTransactionService.createTransaction).toHaveBeenCalledWith(
        expect.any(Object),
        queryRunner,
      );
      expect(result).toEqual(updatedWallet);
    });

    it('should throw ConflictException on optimistic locking failure', async () => {
      const updateResult: UpdateResult = {
        affected: 0,
        raw: {},
        generatedMaps: [],
      };

      jest.spyOn(service, 'getWalletByUserId').mockResolvedValue(mockWallet);
      mockQueryBuilder.execute.mockResolvedValue(updateResult);

      await expect(service.fundWallet(fundWalletDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.fundWallet(fundWalletDto)).rejects.toThrow(
        'Wallet was modified by another transaction',
      );
    });

    it('should throw NotFoundException if updated wallet not found', async () => {
      const updateResult: UpdateResult = {
        affected: 1,
        raw: {},
        generatedMaps: [],
      };

      jest.spyOn(service, 'getWalletByUserId').mockResolvedValue(mockWallet);
      mockQueryBuilder.execute.mockResolvedValue(updateResult);
      mockRepository.findOne.mockResolvedValue(null);
      mockTransactionService.createTransaction.mockResolvedValue({});

      await expect(service.fundWallet(fundWalletDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should log error and rethrow on failure', async () => {
      const error = new Error('Database error');
      jest.spyOn(service, 'getWalletByUserId').mockRejectedValue(error);

      await expect(service.fundWallet(fundWalletDto)).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith('Failed to fund wallet', {
        userId: fundWalletDto.userId,
        amount: fundWalletDto.amount,
        error: error.message,
      });
    });
  });

  describe('debitWallet', () => {
    const walletId = mockWallet.id;
    const amount = 500;
    const reference = 'DEBIT_REF_123';

    it('should debit wallet successfully', async () => {
      const updatedWallet = { ...mockWallet, balance: 500, version: 2 };
      const updateResult: UpdateResult = {
        affected: 1,
        raw: {},
        generatedMaps: [],
      };

      mockRepository.findOne
        .mockResolvedValueOnce(mockWallet) // First call to find wallet
        .mockResolvedValueOnce(updatedWallet); // Second call to get updated wallet
      mockQueryBuilder.execute.mockResolvedValue(updateResult);

      const result = await service.debitWallet(walletId, amount, reference);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: walletId },
      });
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Wallet);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'id = :id AND version = :version AND balance >= :amount',
        { id: mockWallet.id, version: mockWallet.version, amount },
      );
      expect(logger.info).toHaveBeenCalledWith('Wallet debited successfully', {
        walletId,
        amount,
        reference,
        newBalance: updatedWallet.balance,
      });
      expect(result).toEqual(updatedWallet);
    });

    it('should throw NotFoundException if wallet not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.debitWallet(walletId, amount, reference),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.debitWallet(walletId, amount, reference),
      ).rejects.toThrow('Wallet not found');
    });

    it('should throw BadRequestException for insufficient funds', async () => {
      const poorWallet = { ...mockWallet, balance: 100 };
      mockRepository.findOne.mockResolvedValue(poorWallet);

      await expect(
        service.debitWallet(walletId, amount, reference),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.debitWallet(walletId, amount, reference),
      ).rejects.toThrow('Insufficient funds');
    });

    it('should throw ConflictException on optimistic locking failure', async () => {
      const updateResult: UpdateResult = {
        affected: 0,
        raw: {},
        generatedMaps: [],
      };

      mockRepository.findOne.mockResolvedValue(mockWallet);
      mockQueryBuilder.execute.mockResolvedValue(updateResult);

      await expect(
        service.debitWallet(walletId, amount, reference),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.debitWallet(walletId, amount, reference),
      ).rejects.toThrow('Insufficient funds or wallet was modified');
    });

    it('should use query runner when provided', async () => {
      const queryRunner = mockQueryRunner as unknown as QueryRunner;
      const updatedWallet = { ...mockWallet, balance: 500, version: 2 };
      const updateResult: UpdateResult = {
        affected: 1,
        raw: {},
        generatedMaps: [],
      };

      mockRepository.findOne
        .mockResolvedValueOnce(mockWallet)
        .mockResolvedValueOnce(updatedWallet);
      mockQueryBuilder.execute.mockResolvedValue(updateResult);

      const result = await service.debitWallet(
        walletId,
        amount,
        reference,
        queryRunner,
      );

      expect(mockQueryRunner.manager.getRepository).toHaveBeenCalledWith(
        Wallet,
      );
      expect(result).toEqual(updatedWallet);
    });

    it('should log error and rethrow on failure', async () => {
      const error = new Error('Database error');
      mockRepository.findOne.mockRejectedValue(error);

      await expect(
        service.debitWallet(walletId, amount, reference),
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith('Failed to debit wallet', {
        walletId,
        amount,
        reference,
        error: error.message,
      });
    });
  });

  describe('creditWallet', () => {
    const walletId = mockWallet.id;
    const amount = 500;
    const reference = 'CREDIT_REF_123';

    it('should credit wallet successfully', async () => {
      const updatedWallet = { ...mockWallet, balance: 1500, version: 2 };
      const updateResult: UpdateResult = {
        affected: 1,
        raw: {},
        generatedMaps: [],
      };

      mockRepository.findOne
        .mockResolvedValueOnce(mockWallet) // First call to find wallet
        .mockResolvedValueOnce(updatedWallet); // Second call to get updated wallet
      mockQueryBuilder.execute.mockResolvedValue(updateResult);
      mockTransactionService.createTransaction.mockResolvedValue({});

      const result = await service.creditWallet(walletId, amount, reference);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: walletId },
      });
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Wallet);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'id = :id AND version = :version',
        { id: mockWallet.id, version: mockWallet.version },
      );
      expect(mockTransactionService.createTransaction).toHaveBeenCalledWith(
        {
          walletId: mockWallet.id,
          amount,
          type: TransactionType.REVERSAL,
          reference,
        },
        undefined,
      );
      expect(logger.info).toHaveBeenCalledWith('Wallet credited successfully', {
        walletId,
        amount,
        reference,
        newBalance: updatedWallet.balance,
      });
      expect(result).toEqual(updatedWallet);
    });

    it('should throw NotFoundException if wallet not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.creditWallet(walletId, amount, reference),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.creditWallet(walletId, amount, reference),
      ).rejects.toThrow('Wallet not found');
    });

    it('should throw ConflictException on optimistic locking failure', async () => {
      const updateResult: UpdateResult = {
        affected: 0,
        raw: {},
        generatedMaps: [],
      };

      mockRepository.findOne.mockResolvedValue(mockWallet);
      mockQueryBuilder.execute.mockResolvedValue(updateResult);

      await expect(
        service.creditWallet(walletId, amount, reference),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.creditWallet(walletId, amount, reference),
      ).rejects.toThrow('Wallet was modified by another transaction');
    });

    it('should use query runner when provided', async () => {
      const queryRunner = mockQueryRunner as unknown as QueryRunner;
      const updatedWallet = { ...mockWallet, balance: 1500, version: 2 };
      const updateResult: UpdateResult = {
        affected: 1,
        raw: {},
        generatedMaps: [],
      };

      mockRepository.findOne
        .mockResolvedValueOnce(mockWallet)
        .mockResolvedValueOnce(updatedWallet);
      mockQueryBuilder.execute.mockResolvedValue(updateResult);
      mockTransactionService.createTransaction.mockResolvedValue({});

      const result = await service.creditWallet(
        walletId,
        amount,
        reference,
        queryRunner,
      );

      expect(mockQueryRunner.manager.getRepository).toHaveBeenCalledWith(
        Wallet,
      );
      expect(mockTransactionService.createTransaction).toHaveBeenCalledWith(
        expect.any(Object),
        queryRunner,
      );
      expect(result).toEqual(updatedWallet);
    });

    it('should throw NotFoundException if updated wallet not found', async () => {
      const updateResult: UpdateResult = {
        affected: 1,
        raw: {},
        generatedMaps: [],
      };

      mockRepository.findOne
        .mockResolvedValueOnce(mockWallet)
        .mockResolvedValueOnce(null); // Updated wallet not found
      mockQueryBuilder.execute.mockResolvedValue(updateResult);
      mockTransactionService.createTransaction.mockResolvedValue({});

      await expect(
        service.creditWallet(walletId, amount, reference),
      ).rejects.toThrow(NotFoundException);
    });

    it('should log error and rethrow on failure', async () => {
      const error = new Error('Database error');
      mockRepository.findOne.mockRejectedValue(error);

      await expect(
        service.creditWallet(walletId, amount, reference),
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith('Failed to credit wallet', {
        walletId,
        amount,
        reference,
        error: error.message,
      });
    });
  });
});
