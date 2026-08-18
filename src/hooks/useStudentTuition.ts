import { useState, useEffect, useCallback } from 'react';
import {
  getStudentBalance,
  getStudentMonthlyHistory,
  getMonthTransactions,
  addManualTransaction,
  updateManualTransaction,
  cancelTransaction,
} from '../api/tuitionApi';
import type {
  TuitionBalance,
  TuitionMonthSummary,
  TuitionTransaction,
  NewManualTransaction,
} from '../types/tuition';

export function useStudentTuition(studentId: string) {
  const [balance, setBalance] = useState<TuitionBalance | null>(null);
  const [history, setHistory] = useState<TuitionMonthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError('');
    try {
      const [bal, hist] = await Promise.all([
        getStudentBalance(studentId),
        getStudentMonthlyHistory(studentId),
      ]);
      setBalance(bal);
      setHistory(hist);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתוני שכ"ל');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const addTransaction = useCallback(async (tx: NewManualTransaction) => {
    await addManualTransaction(tx);
    await load();
  }, [load]);

  const editTransaction = useCallback(async (
    id: string,
    fields: Partial<Pick<NewManualTransaction, 'amount' | 'transactionDate' | 'billingMonth' | 'transactionType' | 'note'>>
  ) => {
    await updateManualTransaction(id, fields);
    await load();
  }, [load]);

  const cancelTx = useCallback(async (id: string, reason: string) => {
    await cancelTransaction(id, reason);
    await load();
  }, [load]);

  return { balance, history, loading, error, refresh: load, addTransaction, editTransaction, cancelTx };
}

export function useMonthTransactions(studentId: string, billingMonth: string | null) {
  const [transactions, setTransactions] = useState<TuitionTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!billingMonth) { setTransactions([]); return; }
    setLoading(true);
    setError('');
    getMonthTransactions(studentId, billingMonth)
      .then(setTransactions)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'))
      .finally(() => setLoading(false));
  }, [studentId, billingMonth]);

  return { transactions, loading, error };
}
