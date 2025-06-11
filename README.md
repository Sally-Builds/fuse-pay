# FusePay

FusePay is a robust bill payment and wallet management system built with NestJS. It provides secure user authentication, wallet management, and bill payment processing with automatic reversals for failed transactions.

## Architecture

### Core Modules

1. **Auth Module**

   - Handles user registration and authentication
   - JWT-based authentication
   - User management

2. **Wallet Module**

   - Digital wallet management
   - Balance tracking
   - Fund operations (credit/debit)
   - Optimistic locking for concurrent operations

3. **Bill Module**

   - Bill payment processing
   - External payment service integration
   - Transaction status management

4. **Queue Module**

   - Asynchronous bill processing
   - Transaction reversal handling
   - Job retry mechanisms

5. **Transaction Module**
   - Transaction record keeping
   - Status tracking
   - History management

### Technology Stack

- Framework: NestJS
- Database: SQLite with TypeORM
- Queue System: Bull (Redis-based)
- Authentication: JWT
- Logging: Winston
- API Documentation: Swagger/OpenAPI

## Setup Instructions

1. **Clone the Repository**

   ```bash
   git clone <repository-url>
   cd fuse-pay
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a .env file in the root directory:

   ```env
   DB_NAME=bill_vending.db
   JWT_SECRET=your-secret-key
   PORT=3000
   ```

4. **Run the Application**

   ```bash
   # Development
   npm run start:dev

   # Production
   npm run build
   npm run start:prod
   ```

## Security Features

1. **JWT Authentication**

   - Secure token-based authentication
   - Protected routes with Guards

2. **Transaction Safety**

   - Database transactions for atomic operations
   - Optimistic locking for concurrent updates
   - Automatic reversals for failed transactions

3. **Data Validation**
   - DTO-based request validation
   - Strong typing with TypeScript

## Error Handling

The system implements comprehensive error handling:

- Input validation errors
- Insufficient funds errors
- Concurrent transaction conflicts
- External service failures
- Transaction reversals

## Logging

Winston-based logging system with:

- Error tracking
- Transaction monitoring
- Payment processing logs
- Reversal tracking

## System Design: Transaction Safety and Concurrency

### Asynchronous Rollback Process

The system implements a robust asynchronous rollback mechanism using an event-driven architecture:

1. **Event Emission**

   - When a bill payment fails, the `BillService` emits a `bill.payment.failed` event
   - Event includes transaction ID and failure reason

   ```typescript
   this.eventEmitter.emit('bill.payment.failed', {
     transactionId,
     reason: response.message,
   });
   ```

2. **Queue-Based Processing**

   - `BillPaymentListener` catches the failure event and queues a reversal
   - Uses Bull Queue for reliable processing
   - Implements exponential backoff for retry attempts

   ```typescript
   await this.billQueue.add(
     'process-reversal',
     {
       transactionId,
       reason,
     },
     {
       delay: 5000, // 5 second initial delay
       attempts: 5,
       backoff: {
         type: 'exponential',
         delay: 3000,
       },
     },
   );
   ```

3. **Reversal Processing**
   - `ReversalProcessingProcessor` handles the actual reversal
   - Uses database transactions for atomicity
   - Updates transaction status and credits wallet
   - Maintains detailed logs for audit trail

### Race Condition Prevention

The system employs multiple strategies to handle concurrent transactions safely:

1. **Optimistic Locking**

   - Uses version control in the Wallet entity
   - Prevents outdated balance updates

   ```typescript
   @Column({ default: 0 })
   version: number;
   ```

2. **Atomic Updates**

   - SQL-level balance updates with version check

   ```typescript
   await repository
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
   ```

3. **Database Transactions**

   - Ensures all operations within a transaction are atomic
   - Uses TypeORM QueryRunner for transaction management

   ```typescript
   queryRunner = this.dataSource.createQueryRunner();
   await queryRunner.connect();
   await queryRunner.startTransaction();
   ```

4. **Balance Verification**
   - Pre-transaction balance checks
   - Double verification during debit operations
   ```typescript
   if (wallet.balance < amount) {
     throw new BadRequestException('Insufficient funds');
   }
   ```

### System Reliability

1. **Guaranteed Processing**

   - Bull Queue ensures job persistence
   - Automatic retries for failed operations
   - Dead letter queues for failed jobs

2. **Transaction Monitoring**

   - Comprehensive logging at each step
   - Transaction status tracking
   - Audit trail maintenance

3. **Failure Recovery**
   - Automatic rollback of failed transactions
   - Event-driven reversal process
   - Multiple retry attempts with exponential backoff

This design ensures that:

- No funds are lost during failed transactions
- Concurrent operations are handled safely
- System remains consistent even during failures
- Operations are traceable and auditable
