import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Student } from '../../types/student';

const updateSpy = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (row: Record<string, unknown>) => {
        updateSpy(row);
        return { eq: (_c: string, id: string) => ({ select: () => ({ single: () => Promise.resolve({ data: { id, ...row }, error: null }) }) }) };
      },
    })),
    rpc: vi.fn(), channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })), removeChannel: vi.fn(),
  },
}));

function mk(i: number, o: Partial<Student> = {}): Student {
  return {
    id: `s${i}`, firstName: `שם${i}`, lastName: 'כהן', fullName: '', className: 'ג', community: '', hebrewDate: '',
    gregorianDate: '', age: '', passportOrId: `P${i}`, fatherId: '', homePhone: '', fatherPhone: '050', motherPhone: '',
    fatherName: '', motherName: '', city: '', street: '', email: '', tuition: '1000', tuitionRank: 'מזומן',
    tuitionCurrency: 'ILS', siblings: '', tuitionStartDate: '2026-08-20', dueDateNote: '', paymentMethod: '',
    paymentStatusNotes: '', finish241023: '', endOfYear: '', credit: '', bankTransfer: '', fax: '', contactPhone: '',
    contactAddress: '', boarding: '', ...o,
  };
}
let students: Student[] = [];
const updateLocal = vi.fn((s: Student) => { students = students.map((x) => (x.id === s.id ? { ...x, ...s } : x)); });
vi.mock('../../context/StudentsContext', () => ({
  useStudents: () => ({ students, loading: false, error: null, updateLocal, removeLocal: vi.fn() }),
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../context/AlumniContext', () => ({ useAlumni: () => ({ addLocal: vi.fn() }) }));
vi.mock('../../hooks/useStudentTuition', () => ({ useStudentTuition: () => ({ balance: null, loading: false, refresh: vi.fn() }) }));

import MissingStartDateAlert from '../../components/tuition/MissingStartDateAlert';
import { EditForm } from '../../pages/EditPage';
import StudentCardPage from '../../pages/StudentCardPage';

beforeEach(() => { updateSpy.mockClear(); updateLocal.mockClear(); sessionStorage.clear(); });

function inputFor(label: string): HTMLInputElement {
  return screen.getByText(label, { selector: 'label' }).closest('.edit-field')!.querySelector('input')!;
}

describe('MissingStartDateAlert', () => {
  it('nothing when every student has a date', () => {
    students = [mk(1), mk(2)];
    render(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    expect(screen.queryByTestId('missing-start-date-badge')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pops up once per session with the list; badge stays', () => {
    students = [mk(1), mk(2, { tuitionStartDate: null }), mk(3, { tuitionStartDate: null, tuition: '' })];
    const { unmount } = render(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    expect(screen.getByRole('dialog', { name: 'תלמידים ללא תאריך תחילת גבייה' })).toBeInTheDocument();
    expect(screen.getByTestId('missing-list').querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByTestId('missing-start-date-badge').textContent).toContain('2');
    fireEvent.click(screen.getByText('סגור'));
    unmount();
    render(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);           // navigate to another page
    expect(screen.queryByRole('dialog')).toBeNull();                           // not again this session
    expect(screen.getByTestId('missing-start-date-badge')).toBeInTheDocument();
  });

  it('"set default" explains consequences first, then updates ONLY the start date of the missing students', async () => {
    students = [mk(1), mk(2, { tuitionStartDate: null }), mk(3, { tuitionStartDate: null })];
    render(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    fireEvent.click(screen.getByText(/קבע 20\.08\.2026 ל-2 התלמידים/));
    expect(updateSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('consequences').textContent).toContain('21.');
    expect(screen.getByText(/השינוי יחול על 2 תלמידים/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText('הבנתי — שמור')); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(2));
    for (const [row] of updateSpy.mock.calls) expect(row).toEqual({ tuition_start_date: '2026-08-20' });
  });
});

describe('EditPage — start-date change requires confirmation', () => {
  it('single student: dialog first; cancel sends nothing', async () => {
    render(<EditForm section="payment" students={[mk(1)]} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor('תאריך תחילת גבייה'), { target: { value: '2026-09-20' } });
    fireEvent.click(screen.getByText(/שמור/, { selector: 'button' }));
    expect(screen.getByRole('dialog', { name: 'השלכות שינוי תאריך תחילת גבייה' })).toBeInTheDocument();
    expect(screen.getByTestId('consequences').textContent).toContain('לא יבוטלו אוטומטית');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'השלכות שינוי תאריך תחילת גבייה' })).getByText('ביטול'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('single student: confirm saves the new date', async () => {
    render(<EditForm section="payment" students={[mk(1)]} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor('תאריך תחילת גבייה'), { target: { value: '2026-09-20' } });
    fireEvent.click(screen.getByText(/שמור/, { selector: 'button' }));
    await act(async () => { fireEvent.click(screen.getByText('הבנתי — שמור')); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0][0].tuition_start_date).toBe('2026-09-20');
  });

  it('bulk: dialog states how many students are affected', () => {
    render(<EditForm section="payment" students={[mk(1), mk(2), mk(3)]} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor('תאריך תחילת גבייה'), { target: { value: '2026-10-20' } });
    fireEvent.click(screen.getByText(/שמור/, { selector: 'button' }));
    expect(screen.getByText(/השינוי יחול על 3 תלמידים/)).toBeInTheDocument();
  });

  it('changing only tuition (not the date) saves without a dialog', async () => {
    render(<EditForm section="payment" students={[mk(1)]} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor('שכר לימוד'), { target: { value: '1200' } });
    await act(async () => { fireEvent.click(screen.getByText(/שמור/, { selector: 'button' })); });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
  });
});

describe('StudentCardPage — start date', () => {
  function renderCard() {
    students = [mk(1)];
    render(<MemoryRouter initialEntries={['/student/P1']}><Routes><Route path="/student/:studentId" element={<StudentCardPage />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByText('ערוך'));
    return document.querySelector('input[type="date"].profile-edit-input') as HTMLInputElement;
  }
  it('uses a date picker, not free text', () => expect(renderCard()).not.toBeNull());
  it('clearing the date is blocked with an explanation and nothing is sent', () => {
    const input = renderCard();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByText('שמור'));
    expect(screen.getByText('לא ניתן למחוק תאריך תחילת גבייה')).toBeInTheDocument();
    expect(screen.queryByText('הבנתי — שמור')).toBeNull();
    expect(updateSpy).not.toHaveBeenCalled();
  });
  it('changing the date shows consequences, confirm saves only the date', async () => {
    const input = renderCard();
    fireEvent.change(input, { target: { value: '2026-12-20' } });
    fireEvent.click(screen.getByText('שמור'));
    expect(screen.getByTestId('consequences').textContent).toContain('21.12.2026');
    await act(async () => { fireEvent.click(screen.getByText('הבנתי — שמור')); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0][0]).toEqual({ tuition_start_date: '2026-12-20' });
  });
});
