import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

import { AuthProvider, useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
const mockSignInWithPassword = vi.mocked(supabase.auth.signInWithPassword);

function TestConsumer() {
  const { user, session, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.email ?? 'null'}</span>
      <span data-testid="session">{session ? 'has-session' : 'no-session'}</span>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('starts in loading state', () => {
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as any);
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    expect(screen.getByTestId('loading').textContent).toBe('true');
  });

  it('sets loading=false after auth state resolves with no session', async () => {
    let callback: (event: string, session: null) => void = () => {};
    mockOnAuthStateChange.mockImplementation((cb: any) => {
      callback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as any;
    });
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await act(async () => { callback('SIGNED_OUT', null); });
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('session').textContent).toBe('no-session');
  });

  it('sets session when auth state resolves with session', async () => {
    const fakeSession = { user: { email: 'test@test.com' } };
    let callback: (event: string, session: any) => void = () => {};
    mockOnAuthStateChange.mockImplementation((cb: any) => {
      callback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as any;
    });
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await act(async () => { callback('SIGNED_IN', fakeSession); });
    expect(screen.getByTestId('session').textContent).toBe('has-session');
    expect(screen.getByTestId('user').textContent).toBe('test@test.com');
  });

  it('signIn calls supabase.auth.signInWithPassword', async () => {
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as any);
    mockSignInWithPassword.mockResolvedValue({ error: null } as any);
    let signIn!: (e: string, p: string) => Promise<string | null>;
    function Capture() { const auth = useAuth(); signIn = auth.signIn; return null; }
    render(<AuthProvider><Capture /></AuthProvider>);
    await act(async () => { await signIn('a@b.com', 'pass'); });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' });
  });

  it('signIn returns error message on failure', async () => {
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as any);
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } } as any);
    let signIn!: (e: string, p: string) => Promise<string | null>;
    function Capture() { const auth = useAuth(); signIn = auth.signIn; return null; }
    render(<AuthProvider><Capture /></AuthProvider>);
    let result!: string | null;
    await act(async () => { result = await signIn('a@b.com', 'wrong'); });
    expect(result).toBe('Invalid credentials');
  });

  it('signIn returns null on success', async () => {
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as any);
    mockSignInWithPassword.mockResolvedValue({ error: null } as any);
    let signIn!: (e: string, p: string) => Promise<string | null>;
    function Capture() { const auth = useAuth(); signIn = auth.signIn; return null; }
    render(<AuthProvider><Capture /></AuthProvider>);
    let result!: string | null;
    await act(async () => { result = await signIn('a@b.com', 'pass'); });
    expect(result).toBeNull();
  });

  it('throws if useAuth used outside AuthProvider', () => {
    function Bad() { useAuth(); return null; }
    expect(() => render(<Bad />)).toThrow('useAuth must be used inside <AuthProvider>');
  });
});
