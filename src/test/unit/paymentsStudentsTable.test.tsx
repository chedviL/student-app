/**
 * Unit tests for PaymentsStudentsTable
 * Covers: new columns (שיעור, שם האב), search extensions, null handling,
 * existing filters and navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentsStudentsTable from '../../components/payments/PaymentsStudentsTable';
import type { Student } from '../../types/student';
import type { TuitionBalance } from '../../types/tuition';

// ── mock useNavigate ──────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── helpers ───────────────────────────────────────────────────────────────────

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'student-1',
    firstName: 'יוסף',
    lastName: 'כהן',
    fullName: 'כהן יוסף',
    className: 'כיתה א',
    community: '',
    hebrewDate: '',
    gregorianDate: '',
    age: '',
    passportOrId: '123456789',
    fatherId: '',
    homePhone: '',
    fatherPhone: '',
    motherPhone: '',
    fatherName: 'אברהם כהן',
    motherName: '',
    city: '',
    street: '',
    email: '',
    tuition: '700',
    tuitionRank: 'מזומן',
    tuitionCurrency: 'ILS',
    siblings: '',
    tuitionStartDate: '2026-01-01',
    dueDateNote: '',
    paymentMethod: '',
    paymentStatusNotes: '',
    finish241023: '',
    endOfYear: '',
    credit: '',
    bankTransfer: '',
    fax: '',
    contactPhone: '',
    contactAddress: '',
    boarding: '',
    ...overrides,
  };
}

function makeBalance(studentId: string, balance: number, currency: 'ILS' | 'USD' = 'ILS'): TuitionBalance {
  return {
    studentId,
    currency,
    currentBalance: balance,
    status: balance < 0 ? 'debt' : 'ok',
  };
}

function renderTable(students: Student[], balances: TuitionBalance[] = []) {
  return render(
    <MemoryRouter>
      <PaymentsStudentsTable students={students} balances={balances} />
    </MemoryRouter>
  );
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PaymentsStudentsTable — new columns', () => {
  it('renders שיעור column header', () => {
    renderTable([makeStudent()]);
    expect(screen.getByRole('columnheader', { name: 'שיעור' })).toBeTruthy();
  });

  it('renders שם האב column header', () => {
    renderTable([makeStudent()]);
    expect(screen.getByRole('columnheader', { name: 'שם האב' })).toBeTruthy();
  });

  it('displays className value in row', () => {
    renderTable([makeStudent({ className: 'כיתה ג' })]);
    expect(screen.getByText('כיתה ג')).toBeTruthy();
  });

  it('displays fatherName value in row', () => {
    renderTable([makeStudent({ fatherName: 'אברהם כהן' })]);
    expect(screen.getByText('אברהם כהן')).toBeTruthy();
  });

  it('displays — for null className', () => {
    renderTable([makeStudent({ className: '' })]);
    // should render at least one — for empty values
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('displays — for null fatherName', () => {
    renderTable([makeStudent({ fatherName: '' })]);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });
});

describe('PaymentsStudentsTable — search', () => {
  const students = [
    makeStudent({ id: '1', firstName: 'יוסף', lastName: 'כהן', className: 'כיתה א', fatherName: 'אברהם כהן', passportOrId: '111' }),
    makeStudent({ id: '2', firstName: 'דוד', lastName: 'לוי', className: 'כיתה ב', fatherName: 'משה לוי', passportOrId: '222' }),
  ];

  beforeEach(() => { mockNavigate.mockClear(); });

  it('search by student name returns correct row', () => {
    renderTable(students);
    fireEvent.change(screen.getByPlaceholderText(/חיפוש/), { target: { value: 'לוי' } });
    expect(screen.getByText('לוי דוד')).toBeTruthy();
    expect(screen.queryByText('כהן יוסף')).toBeNull();
  });

  it('search by className finds student', () => {
    renderTable(students);
    fireEvent.change(screen.getByPlaceholderText(/חיפוש/), { target: { value: 'כיתה ב' } });
    expect(screen.getByText('לוי דוד')).toBeTruthy();
    expect(screen.queryByText('כהן יוסף')).toBeNull();
  });

  it('search by fatherName finds student', () => {
    renderTable(students);
    fireEvent.change(screen.getByPlaceholderText(/חיפוש/), { target: { value: 'אברהם' } });
    expect(screen.getByText('כהן יוסף')).toBeTruthy();
    expect(screen.queryByText('לוי דוד')).toBeNull();
  });

  it('search by passportOrId still works', () => {
    renderTable(students);
    fireEvent.change(screen.getByPlaceholderText(/חיפוש/), { target: { value: '222' } });
    expect(screen.getByText('לוי דוד')).toBeTruthy();
    expect(screen.queryByText('כהן יוסף')).toBeNull();
  });

  it('empty search shows all students', () => {
    renderTable(students);
    fireEvent.change(screen.getByPlaceholderText(/חיפוש/), { target: { value: '' } });
    expect(screen.getByText('כהן יוסף')).toBeTruthy();
    expect(screen.getByText('לוי דוד')).toBeTruthy();
  });
});

describe('PaymentsStudentsTable — existing filters still work', () => {
  const students = [
    makeStudent({ id: '1', lastName: 'כהן', firstName: 'יוסף', tuitionCurrency: 'ILS' }),
    makeStudent({ id: '2', lastName: 'לוי', firstName: 'דוד', tuitionCurrency: 'USD' }),
  ];
  const balances = [
    makeBalance('1', -700, 'ILS'),
    makeBalance('2', 0, 'USD'),
  ];

  it('filter by currency ILS shows only ILS students', () => {
    renderTable(students, balances);
    const select = screen.getAllByRole('combobox').find(
      (el) => (el as HTMLSelectElement).value === '' && el.textContent?.includes('כל המטבעות')
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'ILS' } });
    expect(screen.getByText('כהן יוסף')).toBeTruthy();
    expect(screen.queryByText('לוי דוד')).toBeNull();
  });

  it('filter by debt shows only debtors', () => {
    renderTable(students, balances);
    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'debt' } });
    expect(screen.getByText('כהן יוסף')).toBeTruthy();
    expect(screen.queryByText('לוי דוד')).toBeNull();
  });
});

describe('PaymentsStudentsTable — navigation', () => {
  beforeEach(() => { mockNavigate.mockClear(); });

  it('clicking row navigates to student tuition page', () => {
    const s = makeStudent({ id: 'abc', passportOrId: '999' });
    renderTable([s]);
    fireEvent.click(screen.getByText('כהן יוסף'));
    expect(mockNavigate).toHaveBeenCalledWith('/student/999/tuition');
  });

  it('uses student id when passportOrId is empty', () => {
    const s = makeStudent({ id: 'abc-uuid', passportOrId: '' });
    renderTable([s]);
    fireEvent.click(screen.getByText('כהן יוסף'));
    expect(mockNavigate).toHaveBeenCalledWith('/student/abc-uuid/tuition');
  });
});
