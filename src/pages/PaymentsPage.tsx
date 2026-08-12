import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useStudents } from '../context/StudentsContext';
import { getAllBalances } from '../api/tuitionApi';
import type { TuitionBalance } from '../types/tuition';
import PaymentsOverview from '../components/payments/PaymentsOverview';
import PaymentsStudentsTable from '../components/payments/PaymentsStudentsTable';
import PaymentsTransactions from '../components/payments/PaymentsTransactions';
import PaymentsMonths from '../components/payments/PaymentsMonths';

type Tab = 'overview' | 'students' | 'transactions' | 'months';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'סקירה' },
  { key: 'students', label: 'תלמידים' },
  { key: 'transactions', label: 'תנועות' },
  { key: 'months', label: 'חודשים' },
];

export default function PaymentsPage() {
  const navigate = useNavigate();
  const { students } = useStudents();
  const [tab, setTab] = useState<Tab>('overview');
  const [balances, setBalances] = useState<TuitionBalance[]>([]);

  const loadBalances = useCallback(async () => {
    try {
      const bals = await getAllBalances();
      setBalances(bals);
    } catch {
      // silently ignore — overview will show its own error
    }
  }, []);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  return (
    <motion.div
      className="search-page with-navbar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ direction: 'rtl' }}
    >
      <div className="search-shell" style={{ maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8b6544', fontWeight: 700, fontSize: 14, padding: 0,
            }}
          >
            <ArrowRight size={16} />
            דף הבית
          </button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#4c2415' }}>
            ניהול תשלומים ושכר לימוד
          </h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid rgba(231,212,175,0.8)', paddingBottom: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 22px',
                border: 'none',
                borderBottom: tab === t.key ? '3px solid #c8863f' : '3px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: tab === t.key ? 900 : 600,
                color: tab === t.key ? '#4c2415' : '#8b6544',
                fontFamily: 'inherit',
                transition: 'color 0.15s',
                marginBottom: -2,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{
          background: 'rgba(255,253,248,0.95)',
          border: '1px solid rgba(200,134,63,0.3)',
          borderRadius: 20,
          padding: '22px 24px',
          boxShadow: '0 4px 20px rgba(92,53,23,0.07)',
        }}>
          {tab === 'overview' && (
            <PaymentsOverview students={students} onRefreshNeeded={loadBalances} />
          )}
          {tab === 'students' && (
            <PaymentsStudentsTable students={students} balances={balances} onRefreshNeeded={loadBalances} />
          )}
          {tab === 'transactions' && (
            <PaymentsTransactions students={students} />
          )}
          {tab === 'months' && (
            <PaymentsMonths />
          )}
        </div>

      </div>
    </motion.div>
  );
}
