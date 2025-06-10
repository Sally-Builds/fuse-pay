import { DataSource } from 'typeorm';
import { User } from './src/user/user.entity';
import { Wallet } from './src/wallet/wallet.entity';
import { Transaction } from 'src/transaction/transaction.entity';

export default new DataSource({
  type: 'sqlite',
  database: 'db.sqlite',
  entities: [User, Wallet, Transaction],
  synchronize: true,
});
