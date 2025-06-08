import { DataSource } from 'typeorm';
import { User } from './src/user/user.entity';
import { Wallet } from './src/wallet/wallet.entity';

export default new DataSource({
  type: 'sqlite',
  database: 'db.sqlite',
  entities: [User, Wallet],
  synchronize: true,
});
