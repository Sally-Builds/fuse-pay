export interface BillPaymentRequest {
  billType: string;
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
