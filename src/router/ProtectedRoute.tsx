import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';
import { Splash } from '../components/common/Loading';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  // ממתין לבדיקת session לפני החלטה
  if (loading) return <Splash />;

  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
