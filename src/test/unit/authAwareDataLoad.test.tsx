/**
 * Students/alumni are loaded per logged-in user.
 * Before: loaded once at mount — on the login page that ran anonymously and only
 * worked because `students` was readable without login. With RLS enabled it
 * would return nothing and the list stayed empty after logging in.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

let currentUser: { id: string } | null = null;
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));

const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { channel: vi.fn(() => channel), removeChannel: vi.fn(), from: vi.fn(), rpc: vi.fn() },
}));

const getStudents = vi.fn();
const getAlumni = vi.fn();
vi.mock('../../api/studentsApi', () => ({ getStudents: () => getStudents() }));
vi.mock('../../api/alumniApi', () => ({ getAlumni: () => getAlumni() }));

import { StudentsProvider, useStudents } from '../../context/StudentsContext';
import { AlumniProvider, useAlumni } from '../../context/AlumniContext';

function StudentsProbe() {
  const { students } = useStudents();
  return <div data-testid="students">{students.length}</div>;
}
function AlumniProbe() {
  const { alumni } = useAlumni();
  return <div data-testid="alumni">{alumni.length}</div>;
}
function Tree() {
  return (
    <StudentsProvider>
      <AlumniProvider>
        <StudentsProbe />
        <AlumniProbe />
      </AlumniProvider>
    </StudentsProvider>
  );
}

beforeEach(() => {
  currentUser = null;
  getStudents.mockReset().mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
  getAlumni.mockReset().mockResolvedValue([{ id: 'a1' }]);
});

describe('auth-aware data loading', () => {
  it('does not query students/alumni before login (login page)', () => {
    render(<Tree />);
    expect(getStudents).not.toHaveBeenCalled();
    expect(getAlumni).not.toHaveBeenCalled();
    expect(screen.getByTestId('students').textContent).toBe('0');
  });

  it('loads once the user logs in — the list is not empty after a fresh login', async () => {
    const { rerender } = render(<Tree />);
    currentUser = { id: 'u1' };
    rerender(<Tree />);
    await waitFor(() => expect(screen.getByTestId('students').textContent).toBe('2'));
    expect(screen.getByTestId('alumni').textContent).toBe('1');
    expect(getStudents).toHaveBeenCalledTimes(1);
    expect(getAlumni).toHaveBeenCalledTimes(1);
  });

  it('a restored session (already logged in) loads on first render', async () => {
    currentUser = { id: 'u1' };
    render(<Tree />);
    await waitFor(() => expect(screen.getByTestId('students').textContent).toBe('2'));
    expect(getStudents).toHaveBeenCalledTimes(1);
  });

  it('re-renders with the same user do not refetch', async () => {
    currentUser = { id: 'u1' };
    const { rerender } = render(<Tree />);
    await waitFor(() => expect(getStudents).toHaveBeenCalledTimes(1));
    rerender(<Tree />);
    rerender(<Tree />);
    expect(getStudents).toHaveBeenCalledTimes(1);
  });

  it('logout clears the data; logging in as another user reloads', async () => {
    currentUser = { id: 'u1' };
    const { rerender } = render(<Tree />);
    await waitFor(() => expect(screen.getByTestId('students').textContent).toBe('2'));
    currentUser = null;
    await act(async () => { rerender(<Tree />); });
    expect(screen.getByTestId('students').textContent).toBe('0');
    expect(screen.getByTestId('alumni').textContent).toBe('0');
    getStudents.mockResolvedValue([{ id: 's9' }]);
    currentUser = { id: 'u2' };
    rerender(<Tree />);
    await waitFor(() => expect(screen.getByTestId('students').textContent).toBe('1'));
    expect(getStudents).toHaveBeenCalledTimes(2);
  });
});

// ── Race conditions: a slow response must never repopulate another session ──
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('race conditions — stale responses are discarded', () => {
  it('request started as u1, resolves after logout → list stays empty', async () => {
    const slowS = deferred<unknown[]>(); const slowA = deferred<unknown[]>();
    getStudents.mockReturnValueOnce(slowS.promise);
    getAlumni.mockReturnValueOnce(slowA.promise);
    currentUser = { id: 'u1' };
    const { rerender } = render(<Tree />);
    expect(getStudents).toHaveBeenCalledTimes(1);
    currentUser = null;                                   // logout while in flight
    await act(async () => { rerender(<Tree />); });
    await act(async () => { slowS.resolve([{ id: 'u1-secret' }]); slowA.resolve([{ id: 'u1-alumnus' }]); });
    expect(screen.getByTestId('students').textContent).toBe('0');
    expect(screen.getByTestId('alumni').textContent).toBe('0');
  });

  it('request for u1 resolves AFTER u2 already loaded → u2 data is kept', async () => {
    const slowU1 = deferred<unknown[]>();
    getStudents.mockReturnValueOnce(slowU1.promise);                       // u1: slow
    currentUser = { id: 'u1' };
    const { rerender } = render(<Tree />);
    currentUser = null;
    await act(async () => { rerender(<Tree />); });
    getStudents.mockResolvedValueOnce([{ id: 'u2-a' }, { id: 'u2-b' }, { id: 'u2-c' }]); // u2: fast
    currentUser = { id: 'u2' };
    await act(async () => { rerender(<Tree />); });
    await waitFor(() => expect(screen.getByTestId('students').textContent).toBe('3'));
    await act(async () => { slowU1.resolve([{ id: 'u1-secret' }]); });   // stale u1 lands late
    expect(screen.getByTestId('students').textContent).toBe('3');
  });

  it('a stale ERROR from u1 does not show an error to u2', async () => {
    const slowU1 = deferred<unknown[]>();
    getStudents.mockReturnValueOnce(slowU1.promise);
    currentUser = { id: 'u1' };
    function ErrProbe() { const { error } = useStudents(); return <div data-testid="err">{error}</div>; }
    const T2 = () => (<StudentsProvider><AlumniProvider><StudentsProbe /><ErrProbe /></AlumniProvider></StudentsProvider>);
    const { rerender } = render(<T2 />);
    currentUser = { id: 'u2' };
    await act(async () => { rerender(<T2 />); });
    await act(async () => { slowU1.reject(new Error('permission denied')); });
    expect(screen.getByTestId('err').textContent).toBe('');
  });
});

describe('realtime — no subscription without a logged-in user', () => {
  it('does not subscribe before login; subscribes per user; unsubscribes on logout', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.channel as ReturnType<typeof vi.fn>).mockClear();
    (supabase.removeChannel as ReturnType<typeof vi.fn>).mockClear();
    const { rerender } = render(<Tree />);
    expect(supabase.channel).not.toHaveBeenCalled();                 // login page: nothing
    currentUser = { id: 'u1' };
    await act(async () => { rerender(<Tree />); });
    expect((supabase.channel as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2); // students + alumni
    currentUser = null;
    await act(async () => { rerender(<Tree />); });
    expect((supabase.removeChannel as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it('a realtime event arriving after logout does not add rows', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    const handlers: Array<(p: unknown) => void> = [];
    channel.on.mockImplementation((_e: string, _f: unknown, h: (p: unknown) => void) => { handlers.push(h); return channel; });
    currentUser = { id: 'u1' };
    const { rerender } = render(<Tree />);
    await waitFor(() => expect(screen.getByTestId('students').textContent).toBe('2'));
    currentUser = null;
    await act(async () => { rerender(<Tree />); });
    await act(async () => {
      handlers.forEach((h) => h({ eventType: 'INSERT', new: { id: 'late', last_name: 'x' }, old: {} }));
    });
    expect(screen.getByTestId('students').textContent).toBe('0');
    expect(screen.getByTestId('alumni').textContent).toBe('0');
    void supabase;
  });
});

describe('StrictMode (effects run twice in development)', () => {
  it('loads once per user and leaves no extra live channel', async () => {
    const { StrictMode } = await import('react');
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.channel as ReturnType<typeof vi.fn>).mockClear();
    (supabase.removeChannel as ReturnType<typeof vi.fn>).mockClear();
    currentUser = { id: 'u1' };
    render(<StrictMode><Tree /></StrictMode>);
    await waitFor(() => expect(screen.getByTestId('students').textContent).toBe('2'));
    expect(getStudents).toHaveBeenCalledTimes(1);
    expect(getAlumni).toHaveBeenCalledTimes(1);
    const opened = (supabase.channel as ReturnType<typeof vi.fn>).mock.calls.length;
    const closed = (supabase.removeChannel as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(opened - closed).toBe(2);   // exactly one live channel per provider
  });
});
