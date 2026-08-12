export type TuitionCurrency = 'ILS' | 'USD';

export type TransactionType =
  | 'monthly_charge'
  | 'automatic_payment'
  | 'manual_payment'
  | 'manual_charge'
  | 'adjustment';

export type TransactionSource = 'automatic' | 'manual';

export type TuitionStatus = 'debt' | 'ok' | 'no_currency';

export interface TuitionTransaction {
  id: string;
  studentId: string;
  billingMonth: string;
  transactionDate: string;
  amount: number;
  currency: TuitionCurrency;
  transactionType: TransactionType;
  source: TransactionSource;
  note: string | null;
  createdAt: string;
}

export interface TuitionBalance {
  studentId: string;
  currency: TuitionCurrency | null;
  currentBalance: number;
  status: TuitionStatus;
}

export interface TuitionMonthSummary {
  studentId: string;
  billingMonth: string;
  charges: number | null;
  credits: number | null;
  monthlyTotal: number;
  balanceAfterMonth: number;
  currency: TuitionCurrency;
}

export interface NewManualTransaction {
  studentId: string;
  billingMonth: string;
  transactionDate: string;
  amount: number;
  currency: TuitionCurrency;
  transactionType: TransactionType;
  note?: string;
}

export interface AllBalancesSummary {
  debtors: number;
  ok: number;
  noCurrency: number;
  debtILS: number;   // sum of negative ILS balances (negative number)
  debtUSD: number;   // sum of negative USD balances (negative number)
}

export interface MonthAggregate {
  billingMonth: string;
  countStudents: number;
  chargesILS: number;
  chargesUSD: number;
  creditsILS: number;
  creditsUSD: number;
  countAutomatic: number;
  countManual: number;
}
