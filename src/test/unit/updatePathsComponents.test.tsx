/**
 * Every UI path that updates a student, exercised through the REAL component,
 * asserting the exact payload sent to Supabase. None may contain
 * tuition_start_date unless the user actually changed it.
 *
 * Paths: EditPage bulk (every section), EditPage single (every section),
 * StudentCardPage edit, PaymentsStudentsTable (see studentsApiPartialUpdate.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const updateSpy = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (row: Record<string, unknown>) => {
        updateSpy(row);
        return {
          eq: (_c: string, id: string) => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id, tuition_start_date: '2026-08-20', ...row }, error: null }),
            }),
          }),
        };
      },
    })),
    rpc: vi.fn(),
  },
}));

import type { Student } from '../../types/student';

function makeStudent(i: number, overrides: Partial<Student> = {}): Student {
  return {
    id: `stu-${i}`, firstName: `שם${i}`, lastName: 'כהן', fullName: `כהן שם${i}`,
    className: 'ג', community: 'ק', hebrewDate: '', gregorianDate: '', age: '8',
    passportOrId: `P${i}`, fatherId: '', homePhone: '02', fatherPhone: '050', motherPhone: '052',
    fatherName: 'אב', motherName: 'אם', city: 'עיר', street: 'רחוב', email: 'a@b.c',
    tuition: '1400', tuitionRank: 'אשראי', tuitionCurrency: 'ILS', siblings: '',
    tuitionStartDate: '2026-08-20', dueDateNote: '', paymentMethod: '', paymentStatusNotes: '',
    finish241023: '', endOfYear: '', credit: '', bankTransfer: '', fax: '', contactPhone: '',
    contactAddress: '', boarding: '', education: '', educationType: '',
    ...overrides,
  };
}

const students66 = Array.from({ length: 66 }, (_, i) => makeStudent(i));
const updateLocal = vi.fn();
vi.mock('../../context/StudentsContext', () => ({
  useStudents: () => ({ students: students66, loading: false, error: null, updateLocal, removeLocal: vi.fn() }),
}));
vi.mock('../../context/AlumniContext', () => ({ useAlumni: () => ({ addLocal: vi.fn() }) }));
vi.mock('../../hooks/useStudentTuition', () => ({
  useStudentTuition: () => ({ balance: null, loading: false, refresh: vi.fn() }),
}));

import { EditForm } from '../../pages/EditPage';
import StudentCardPage from '../../pages/StudentCardPage';

function inputFor(label: string): HTMLInputElement {
  const lbl = screen.getByText(label, { selector: 'label' });
  return lbl.closest('.edit-field')!.querySelector('input')!;
}

beforeEach(() => { updateSpy.mockClear(); updateLocal.mockClear(); });

const SECTION_FIELD: Array<[string, string, string]> = [
  ['class',   'שיעור',       'ד'],
  ['address', 'עיר',         'בני ברק'],
  ['notes',   'פנימייה',     'כן'],
  ['payment', 'שכר לימוד',   '1500'],
];

describe('EditPage — BULK edit (the 15.10 path)', () => {
  it.each(SECTION_FIELD)('section %s: 66 students, payload never touches tuition_start_date', async (section, label, value) => {
    render(<EditForm section={section as never} students={students66} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor(label), { target: { value } });
    await act(async () => { fireEvent.click(screen.getByText(/שמור/, { selector: 'button' })); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(66));
    for (const [row] of updateSpy.mock.calls) {
      expect(row).not.toHaveProperty('tuition_start_date');
      expect(Object.values(row)).not.toContain(null);
    }
  });

  it('bulk payment section with an explicit new date sends that date only', async () => {
    render(<EditForm section="payment" students={students66.slice(0, 3)} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor('תאריך תחילת גבייה'), { target: { value: '2026-09-20' } });
    await act(async () => { fireEvent.click(screen.getByText(/שמור/, { selector: 'button' })); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(3));
    for (const [row] of updateSpy.mock.calls) expect(row).toEqual({ tuition_start_date: '2026-09-20' });
  });
});

describe('EditPage — SINGLE edit', () => {
  it.each(SECTION_FIELD.filter(([s]) => s !== 'payment'))('section %s: payload never touches tuition_start_date', async (section, label, value) => {
    render(<EditForm section={section as never} students={[makeStudent(1)]} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor(label), { target: { value } });
    await act(async () => { fireEvent.click(screen.getByText(/שמור/, { selector: 'button' })); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty('tuition_start_date');
  });

  it('payment section, change tuition only: existing date is re-sent unchanged (never NULL)', async () => {
    render(<EditForm section="payment" students={[makeStudent(1)]} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor('שכר לימוד'), { target: { value: '1500' } });
    await act(async () => { fireEvent.click(screen.getByText(/שמור/, { selector: 'button' })); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    const row = updateSpy.mock.calls[0][0];
    expect(row.tuition).toBe('1500');
    expect(row.tuition_start_date).toBe('2026-08-20');
  });

  it('payment section, clearing the date field does NOT send NULL (empty = do not touch)', async () => {
    render(<EditForm section="payment" students={[makeStudent(1)]} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor('תאריך תחילת גבייה'), { target: { value: '' } });
    fireEvent.change(inputFor('שכר לימוד'), { target: { value: '1500' } });
    await act(async () => { fireEvent.click(screen.getByText(/שמור/, { selector: 'button' })); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty('tuition_start_date');
  });

  it('student with no date (wiped) editing another section stays without a NULL write', async () => {
    render(<EditForm section="class" students={[makeStudent(1, { tuitionStartDate: null })]} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor('שיעור'), { target: { value: 'ד' } });
    await act(async () => { fireEvent.click(screen.getByText(/שמור/, { selector: 'button' })); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    const row = updateSpy.mock.calls[0][0];
    expect(row.class_name).toBe('ד');
    expect(row).not.toHaveProperty('tuition_start_date');
    expect(Object.values(row)).not.toContain(null);
  });
});

describe('StudentCardPage — edit sends only changed fields', () => {
  it('changing one field sends just that field', async () => {
    render(
      <MemoryRouter initialEntries={['/student/P1']}>
        <Routes><Route path="/student/:studentId" element={<StudentCardPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('ערוך'));
    const inputs = Array.from(document.querySelectorAll('input.profile-edit-input')) as HTMLInputElement[];
    const phone = inputs.find((i) => i.value === '050')!;
    fireEvent.change(phone, { target: { value: '050-9' } });
    await act(async () => { fireEvent.click(screen.getByText('שמור')); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0][0]).toEqual({ father_phone: '050-9' });
  });

  it('saving without changes sends nothing', async () => {
    render(
      <MemoryRouter initialEntries={['/student/P1']}>
        <Routes><Route path="/student/:studentId" element={<StudentCardPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('ערוך'));
    await act(async () => { fireEvent.click(screen.getByText('שמור')); });
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
