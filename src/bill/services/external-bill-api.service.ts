import { Injectable, Logger } from '@nestjs/common';
import {
  BillPaymentRequest,
  ExternalBillPaymentResponse,
} from '../../common/interfaces/bill-payment.interface';

@Injectable()
export class ExternalBillApiService {
  private readonly logger = new Logger(ExternalBillApiService.name);

  async processBillPayment(
    request: BillPaymentRequest,
  ): Promise<ExternalBillPaymentResponse> {
    // Mock external API call with random success/failure
    return new Promise((resolve) => {
      setTimeout(
        () => {
          const isSuccess = Math.random() > 0.8; // 80% success rate

          if (isSuccess) {
            resolve({
              success: true,
              transactionId: `EXT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              message: 'Bill payment processed successfully',
              data: {
                billType: request.billType,
                amount: request.amount,
                customerReference: request.customerReference,
                token: Math.random().toString(36).substr(2, 12).toUpperCase(),
              },
            });
          } else {
            resolve({
              success: false,
              transactionId: '',
              message: 'External service temporarily unavailable',
            });
          }
        },
        1000 + Math.random() * 2000,
      ); // 1-3 seconds delay
    });
  }
}
