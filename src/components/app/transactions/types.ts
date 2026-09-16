export type TransactionView = {
  id: string;
  dbId: string;
  customer: string;
  customerEmail: string | null;
  product: string;
  amount: number;
  netAmount: number;
  processingFee: number;
  method: string;
  status: string;
  affiliate: string | null;
  date: string;
  paidAt: string | null;
  gatewayId: string | null;
  provider: string | null;
  statusDetail: string | null;
};
