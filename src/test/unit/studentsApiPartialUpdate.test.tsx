/**
 * Regression tests for the tuition_start_date wipe bug.
 *
 * Root cause: mapToRow() used `tuition_start_date: student.tuitionStartDate ?? null`,
 * so every PARTIAL update (field not in the patch → undefined) sent NULL and erased
 * the student's billing start date. process_monthly_tuition skips students with a
 * NULL start date → they silently stopped being charged.
 *
 * These tests reproduce the exact payloads every UI update path sends.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const updateSpy = vi.fn();
const eqSpy = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (row: Record<string, unknown>) => {
        updateSpy(row);
        return {
          eq: (col: string, val: string) => {
            eqSpy(col, val);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: val, tuition_start_date: '2026-08-20', ...row },
                    error: null,
                  }),
              }),
            };
          },
        };
      },
    })),
    rpc: vi.fn(),
  },
}));

vi.mock('../../context/StudentsContext', () => ({
  useStudents: () => ({ updateLocal: vi.fn() }),
}));

import { mapToRow, updateStudent } from '../../api/studentsApi';
import { diffStudent } from '../../utils/studentHelpers';
import PaymentsStudentsTable from '../../components/payments/PaymentsStudentsTable';
import type { Student } from '../../types/student';

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'stu-1', firstName: 'יוסף', lastName: 'כהן', fullName: 'כהן יוסף',
    className: 'כיתה ג', community: '', hebrewDate: '', gregorianDate: '', age: '8',
    passportOrId: '123', fatherId: '', homePhone: '', fatherPhone: '', motherPhone: '',
    fatherName: 'אברהם', motherName: '', city: '', street: '', email: '',
    tuition: '1400', tuitionRank: 'אשראי', tuitionCurrency: 'ILS', siblings: '',
    tuitionStartDate: '2026-08-20', dueDateNote: '', paymentMethod: '',
    paymentStatusNotes: '', finish241023: '', endOfYear: '', credit: '',
    bankTransfer: '', fax: '', contactPhone: '', contactAddress: '', boarding: '',
    ...overrides,
  };
}

beforeEach(() => {
  updateSpy.mockClear();
  eqSpy.mockClear();
});

describe('mapToRow — partial update never nulls omitted fields', () => {
  it('omits tuition_start_date when not provided (THE bug)', () => {
    const row = mapToRow({ tuition: '1500', tuitionRank: 'בנקאי' });
    expect(row).not.toHaveProperty('tuition_start_date');
    expect(row).toEqual({ tuition: '1500', tuition_rank: 'בנקאי' });
  });

  it('omits every undefined field (no key is sent as undefined/null)', () => {
    const row = mapToRow({ className: 'כיתה ד' });
    expect(Object.keys(row)).toEqual(['class_name']);
  });

  it('keeps an explicit start date', () => {
    expect(mapToRow({ tuitionStartDate: '2026-09-20' })).toEqual({ tuition_start_date: '2026-09-20' });
  });

  it('explicit null stays null (deliberate clear — blocked by DB trigger for app users)', () => {
    expect(mapToRow({ tuitionStartDate: null })).toEqual({ tuition_start_date: null });
  });

  it('empty string from a date input becomes null, not an invalid date', () => {
    expect(mapToRow({ tuitionStartDate: '' })).toEqual({ tuition_start_date: null });
  });

  it('full student (create path) still maps all columns including start date', () => {
    const { id: _id, ...rest } = makeStudent();
    void _id;
    const row = mapToRow(rest);
    expect(row.tuition_start_date).toBe('2026-08-20');
    expect(row.first_name).toBe('יוסף');
  });
});

describe('updateStudent — payloads of every UI update path', () => {
  it('PaymentsStudentsTable / TuitionModal: {tuition, tuitionRank}', async () => {
    await updateStudent('stu-1', { tuition: '1400', tuitionRank: 'אשראי' });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][0]).toEqual({ tuition: '1400', tuition_rank: 'אשראי' });
  });

  it('EditPage bulk edit (e.g. 66 students, class change) — start date untouched for each', async () => {
    const ids = Array.from({ length: 66 }, (_, i) => `stu-${i}`);
    for (const id of ids) await updateStudent(id, { className: 'כיתה ג' });
    expect(updateSpy).toHaveBeenCalledTimes(66);
    for (const call of updateSpy.mock.calls) {
      expect(call[0]).not.toHaveProperty('tuition_start_date');
      expect(call[0]).toEqual({ class_name: 'כיתה ג' });
    }
  });

  it('EditPage single edit of a non-tuition section — start date untouched', async () => {
    await updateStudent('stu-1', { fatherPhone: '050', motherPhone: '052', homePhone: '02' });
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty('tuition_start_date');
  });

  it('EditPage tuition section with a new date — date is sent', async () => {
    await updateStudent('stu-1', { tuition: '1500', tuitionStartDate: '2026-09-20' });
    expect(updateSpy.mock.calls[0][0]).toEqual({ tuition: '1500', tuition_start_date: '2026-09-20' });
  });

  it('empty patch is rejected client-side (never sends an empty UPDATE)', async () => {
    await expect(updateStudent('stu-1', {})).rejects.toThrow();
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

describe('diffStudent — full-copy forms (StudentCard, DatabasePage row edit)', () => {
  it('sends only changed fields', () => {
    const original = makeStudent();
    const draft = { ...original, fatherPhone: '050-1' };
    expect(diffStudent(original, draft)).toEqual({ fatherPhone: '050-1' });
  });

  it('a stale draft with an untouched start date does not resend it', () => {
    const original = makeStudent({ tuitionStartDate: '2026-08-20' });
    const draft = { ...original, className: 'כיתה ד' };
    const patch = diffStudent(original, draft);
    expect(patch).not.toHaveProperty('tuitionStartDate');
    expect(mapToRow(patch)).toEqual({ class_name: 'כיתה ד' });
  });

  it('null vs empty string are treated as equal (no spurious change)', () => {
    const original = makeStudent({ tuitionCurrency: null });
    expect(diffStudent(original, { ...original, tuitionCurrency: '' as unknown as null })).toEqual({});
  });

  it('never includes id', () => {
    const original = makeStudent();
    expect(diffStudent(original, { ...original, id: 'other' })).toEqual({});
  });
});

describe('PaymentsStudentsTable — real component edit flow', () => {
  it('editing tuition sends {tuition, tuition_rank} only — never tuition_start_date', async () => {
    const st = makeStudent({ tuitionRank: 'מזומן' });
    render(
      <MemoryRouter>
        <PaymentsStudentsTable students={[st]} balances={[]} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle(/עריכ|ערוך/));
    const tuitionInput = screen.getByDisplayValue('1400') as HTMLInputElement;
    fireEvent.change(tuitionInput, { target: { value: '1500' } });
    fireEvent.click(screen.getByTitle(/שמור|שמירה/));
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0][0]).toEqual({ tuition: '1500', tuition_rank: 'מזומן' });
  });
});
