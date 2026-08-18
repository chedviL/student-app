import { vi, describe, it, expect, beforeEach } from 'vitest';

// vi.mock must be at top level with no references to outer variables
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

import { graduateStudent } from '../../api/alumniApi';
import { supabase } from '../../lib/supabaseClient';

const mockFrom = vi.mocked(supabase.from);

const fakeStudent = {
  id: 'student-uuid-123',
  first_name: 'ישראל', last_name: 'כהן', full_name: 'כהן ישראל',
  class_name: 'א', community: 'ירושלים', hebrew_date: 'א תשרי',
  gregorian_date: '01.01.2000', age: '20', passport_or_id: '123456789',
  father_id: null, home_phone: '02-1234567', father_phone: '050-1234567',
  mother_phone: '052-1234567', contact_phone: null, father_name: 'אברהם',
  mother_name: 'שרה', city: 'ירושלים', street: 'הרצל 1', contact_address: null,
  email: 'test@test.com', fax: null, tuition: '700', tuition_rank: 'מזומן',
  tuition_currency: 'ILS',   // exists in students, NOT in alumni
  religion: 'דתי',            // exists in students, NOT in alumni
  religion_studies: 'ישיבה', // exists in students, NOT in alumni
  tuition_start_date: '2026-01-01', siblings: null, due_date_note: null,
  payment_method: null, payment_status_notes: null, finish_241023: null,
  end_of_year: null, credit: null, bank_transfer: null, boarding: null,
  education: null, education_type: null,
};

describe('graduateStudent — schema regression', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function setupMocks(insertedRowRef: { value: Record<string, unknown> }, insertError = null) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'students') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: fakeStudent, error: null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        } as any;
      }
      if (table === 'alumni') {
        return {
          insert: (row: Record<string, unknown>) => {
            insertedRowRef.value = row;
            return {
              select: () => ({
                single: () => Promise.resolve(
                  insertError
                    ? { data: null, error: insertError }
                    : { data: { ...row, graduated_at: new Date().toISOString() }, error: null }
                ),
              }),
            };
          },
        } as any;
      }
    });
  }

  it('does not include tuition_currency in alumni insert', async () => {
    const ref = { value: {} as Record<string, unknown> };
    setupMocks(ref);
    await graduateStudent('student-uuid-123', '2026-08-01');
    expect(ref.value).not.toHaveProperty('tuition_currency');
  });

  it('does not include religion in alumni insert', async () => {
    const ref = { value: {} as Record<string, unknown> };
    setupMocks(ref);
    await graduateStudent('student-uuid-123', '2026-08-01');
    expect(ref.value).not.toHaveProperty('religion');
    expect(ref.value).not.toHaveProperty('religion_studies');
  });

  it('preserves the same UUID in alumni', async () => {
    const ref = { value: {} as Record<string, unknown> };
    setupMocks(ref);
    await graduateStudent('student-uuid-123', '2026-08-01');
    expect(ref.value.id).toBe('student-uuid-123');
  });

  it('does NOT delete student if alumni insert fails', async () => {
    const deleteSpy = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'students') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: fakeStudent, error: null }) }) }),
          delete: () => ({ eq: deleteSpy }),
        } as any;
      }
      if (table === 'alumni') {
        return {
          insert: () => ({
            select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'insert failed' } }) }),
          }),
        } as any;
      }
    });
    await expect(graduateStudent('student-uuid-123')).rejects.toThrow();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('throws if student not found', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'students') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'not found' } }) }) }),
        } as any;
      }
    });
    await expect(graduateStudent('nonexistent')).rejects.toThrow('תלמיד לא נמצא');
  });
});
