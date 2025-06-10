import { BillType } from '../enums/bill-type.enum';

export interface BillPaymentRequest {
  billType: BillType;
  amount: number;
  customerReference: string;
  metadata?: Record<string, any>;
}

export interface ExternalBillPaymentResponse {
  success: boolean;
  transactionId: string;
  message: string;
  data?: any;
}
