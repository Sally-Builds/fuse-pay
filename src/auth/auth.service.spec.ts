import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { JwtService } from '@nestjs/jwt';
import { WalletService } from '../wallet/wallet.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let walletService: any;
  let jwtService: any;
  let winstonLogger: any;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockWalletService = {
    createWallet: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockWinstonLogger = {
    info: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockWinstonLogger,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    walletService = module.get(WalletService);
    jwtService = module.get(JwtService);
    winstonLogger = module.get(WINSTON_MODULE_PROVIDER);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockUser = {
      id: 1,
      ...registerDto,
      password: 'hashedPassword',
    };

    it('should successfully register a new user', async () => {
      // Mock implementations
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('mockToken');

      const result = await service.register(registerDto);

      // Verify user doesn't exist check
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });

      // Verify user creation
      expect(userRepository.create).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();

      // Verify wallet creation
      expect(walletService.createWallet).toHaveBeenCalledWith(mockUser.id);

      // Verify logger
      expect(winstonLogger.info).toHaveBeenCalledWith(
        'User registered successfully',
        expect.any(Object),
      );

      // Verify JWT token generation
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: mockUser.email,
        sub: mockUser.id,
      });

      // Verify returned data structure
      expect(result).toEqual({
        access_token: 'mockToken',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
        },
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1 });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );

      expect(userRepository.create).not.toHaveBeenCalled();
      expect(walletService.createWallet).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 1,
      email: 'test@example.com',
      password: 'hashedPassword',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should successfully login a user', async () => {
      // Mock implementations
      userRepository.findOne.mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));
      jwtService.sign.mockReturnValue('mockToken');

      const result = await service.login(loginDto);

      // Verify user lookup
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });

      // Verify password comparison
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );

      // Verify JWT token generation
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: mockUser.email,
        sub: mockUser.id,
      });

      // Verify returned data structure
      expect(result).toEqual({
        access_token: 'mockToken',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
        },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
