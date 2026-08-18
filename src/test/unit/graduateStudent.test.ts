import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock supabase ────────────────────────────────────────────────────────────
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockDelete = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { graduateStudent } from '../../api/alumniApi';

// ─── REGRESSION: graduateStudent must not send fields absent from alumni ──────

describe('graduateStudent — schema regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fakeStudent = {
    id: 'student-uuid-123',
    first_name: 'ישראל',
    last_name: 'כהן',
    full_name: 'כהן ישראל',
    class_name: 'א',
    community: 'ירושלים',
    hebrew_date: 'א תשרי',
    gregorian_date: '01.01.2000',
    age: '20',
    passport_or_id: '123456789',
    father_id: null,
    home_phone: '02-1234567',
    father_phone: '050-1234567',
    mother_phone: '052-1234567',
    contact_phone: null,
    father_name: 'אברהם',
    mother_name: 'שרה',
    city: 'ירושלים',
    street: 'הרצל 1',
    contact_address: null,
    email: 'test@test.com',
    fax: null,
    tuition: '700',
    tuition_rank: 'מזומן',
    tuition_currency: 'ILS',   // ← exists in students, NOT in alumni
    religion: 'דתי',            // ← exists in students, NOT in alumni
    religion_studies: 'ישיבה', // ← exists in students, NOT in alumni
    tuition_start_date: '2026-01-01',
    siblings: null,
    due_date_note: null,
    payment_method: null,
    payment_status_notes: null,
    finish_241023: null,
    end_of_year: null,
    credit: null,
    bank_transfer: null,
    boarding: null,
    education: null,
    education_type: null,
  };

  it('does not include tuition_currency in alumni insert', async () => {
    let insertedRow: Record<string, unknown> = {};

    mockFrom.mockImplementation((table: string) => {
      if (table === 'students') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: fakeStudent, error: null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'alumni') {
        return {
          insert: (row: Record<string, unknown>) => {
            insertedRow = row;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { ...row, graduated_at: new Date().toISOString() }, error: null }),
              }),
            };
          },
        };
      }
    });

    await graduateStudent('student-uuid-123', '2026-08-01');

    expect(insertedRow).not.toHaveProperty('tuition_currency');
  });

  it('does not include religion in alumni insert', async () => {
    let insertedRow: Record<string, unknown> = {};

    mockFrom.mockImplementation((table: string) => {
      if (table === 'students') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: fakeStudent, error: null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'alumni') {
        return {
          insert: (row: Record<string, unknown>) => {
            insertedRow = row;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { ...row, graduated_at: new Date().toISOString() }, error: null }),
              }),
            };
          },
        };
      }
    });

    await graduateStudent('student-uuid-123', '2026-08-01');

    expect(insertedRow).not.toHaveProperty('religion');
    expect(insertedRow).not.toHaveProperty('religion_studies');
  });

  it('preserves the same UUID in alumni', async () => {
    let insertedRow: Record<string, unknown> = {};

    mockFrom.mockImplementation((table: string) => {
      if (table === 'students') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: fakeStudent, error: null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'alumni') {
        return {
          insert: (row: Record<string, unknown>) => {
            insertedRow = row;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { ...row, graduated_at: new Date().toISOString() }, error: null }),
              }),
            };
          },
        };
      }
    });

    await graduateStudent('student-uuid-123', '2026-08-01');

    expect(insertedRow.id).toBe('student-uuid-123');
  });

  it('does NOT delete student if alumni insert fails', async () => {
    const deleteSpy = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'students') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: fakeStudent, error: null }) }) }),
          delete: () => ({ eq: deleteSpy }),
        };
      }
      if (table === 'alumni') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: 'insert failed' } }),
            }),
          }),
        };
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
        };
      }
    });

    await expect(graduateStudent('nonexistent')).rejects.toThrow('תלמיד לא נמצא');
  });
});
