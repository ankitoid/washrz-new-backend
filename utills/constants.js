export const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PROCESSING: 'processing',
  INTRANSIT: 'intransit',
  READY_FOR_DELIVERY: 'ready for delivery',
  DELIVERY_RIDER_ASSIGNED: 'delivery rider assigned',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

export const PAYMENT_MODE = {
  CASH: 'cash',
  UPI_QR: 'upi_qr',
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  NETBANKING: 'netbanking',
  UPI: 'upi',
  WALLET: 'wallet'
};

export const QR_STATUS = {
  GENERATED: 'generated',
  ACTIVE: 'active',
  SCANNED: 'scanned',
  PAID: 'paid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
};