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
