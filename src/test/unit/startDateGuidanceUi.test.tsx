import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Student } from '../../types/student';

const updateSpy = vi.fn();
const insertSpy = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (row: Record<string, unknown>) => {
        updateSpy(row);
        return { eq: (_c: string, id: string) => ({ select: () => ({ single: () => Promise.resolve({ data: { id, ...row }, error: null }) }) }) };
      },
      insert: (row: Record<string, unknown>) => {
        insertSpy(row);
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'new1', ...row }, error: null }) }) };
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
let currentUser: { id: string } | null = { id: 'u1' };
const updateLocal = vi.fn();
const addLocal = vi.fn();
vi.mock('../../context/StudentsContext', () => ({
  useStudents: () => ({ students, loading: false, error: null, updateLocal, removeLocal: vi.fn(), addLocal }),
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('../../context/AlumniContext', () => ({ useAlumni: () => ({ addLocal: vi.fn() }) }));
vi.mock('../../hooks/useStudentTuition', () => ({ useStudentTuition: () => ({ balance: null, loading: false, refresh: vi.fn() }) }));

import MissingStartDateAlert from '../../components/tuition/MissingStartDateAlert';
import { EditForm } from '../../pages/EditPage';
import StudentCardPage from '../../pages/StudentCardPage';
import DatabasePage from '../../pages/DatabasePage';

beforeEach(() => {
  updateSpy.mockClear(); insertSpy.mockClear(); updateLocal.mockClear(); addLocal.mockClear();
  sessionStorage.clear(); currentUser = { id: 'u1' };
});

const dialog = (name: string) => screen.getByRole('dialog', { name });
function inputFor(label: string): HTMLInputElement {
  return screen.getByText(label, { selector: 'label' }).closest('.edit-field')!.querySelector('input')!;
}
const withMissing = () => [mk(1), mk(2, { tuitionStartDate: null }), mk(3, { tuitionStartDate: null, tuition: '' })];

describe('MissingStartDateAlert', () => {
  it('nothing when every student has a date', () => {
    students = [mk(1), mk(2)];
    render(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    expect(screen.queryByTestId('missing-start-date-badge')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pops up once per session with the list; badge stays', () => {
    students = withMissing();
    const { unmount } = render(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    expect(dialog('תלמידים ללא תאריך תחילת גבייה')).toBeInTheDocument();
    expect(screen.getByTestId('missing-list').querySelectorAll('li')).toHaveLength(2);
    fireEvent.click(screen.getByText('סגור'));
    unmount();
    render(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('missing-start-date-badge').textContent).toContain('2');
  });

  it('offers NO bulk "set a date for everyone" action — each student is reviewed individually', () => {
    students = withMissing();
    render(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    const d = dialog('תלמידים ללא תאריך תחילת גבייה');
    expect(within(d).queryByText(/קבע/)).toBeNull();
    expect(within(d).getAllByRole('link')).toHaveLength(2);       // a link to each student's card
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('works when mounted BEFORE login: nothing while logged out, pops up after login', () => {
    students = withMissing();
    currentUser = null;
    const { rerender } = render(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('missing-start-date-badge')).toBeNull();
    currentUser = { id: 'u1' };
    rerender(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    expect(dialog('תלמידים ללא תאריך תחילת גבייה')).toBeInTheDocument();
  });

  it('a different user logging in on the same tab also gets the popup', () => {
    students = withMissing();
    const { rerender } = render(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    fireEvent.click(screen.getByText('סגור'));
    currentUser = null;
    rerender(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    currentUser = { id: 'u2' };
    rerender(<MemoryRouter><MissingStartDateAlert /></MemoryRouter>);
    expect(dialog('תלמידים ללא תאריך תחילת גבייה')).toBeInTheDocument();
  });
});

describe('EditPage — start-date change requires confirmation', () => {
  it('single student: dialog first; cancel sends nothing', () => {
    render(<EditForm section="payment" students={[mk(1)]} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor('תאריך תחילת גבייה'), { target: { value: '2026-09-20' } });
    fireEvent.click(screen.getByText(/שמור/, { selector: 'button' }));
    const d = dialog('השלכות שינוי תאריך תחילת גבייה');
    expect(within(d).getByTestId('consequences').textContent).toContain('לא יבוטלו אוטומטית');
    fireEvent.click(within(d).getByText('ביטול'));
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

  it('bulk with DIFFERENT current dates: consequences shown for every group, not only the first student', () => {
    const group = [mk(1, { tuitionStartDate: '2026-08-20' }), mk(2, { tuitionStartDate: '2026-08-20' }), mk(3, { tuitionStartDate: '2026-10-20' })];
    render(<EditForm section="payment" students={group} onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(inputFor('תאריך תחילת גבייה'), { target: { value: '2026-09-20' } });
    fireEvent.click(screen.getByText(/שמור/, { selector: 'button' }));
    expect(screen.getByTestId('affected-total').textContent).toContain('3');
    const groups = screen.getAllByTestId('change-group');
    expect(groups).toHaveLength(2);
    expect(groups[0].textContent).toContain('2 תלמידים שהתאריך הנוכחי שלהם 20.08.2026');
    expect(groups[0].textContent).toContain('דחיית');            // later for the Aug group
    expect(groups[1].textContent).toContain('1 תלמידים שהתאריך הנוכחי שלהם 20.10.2026');
    expect(groups[1].textContent).toContain('הקדמת');            // earlier for the Oct group
  });

  it('changing only tuition saves without a dialog', async () => {
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
  it('changing the date shows consequences; confirm saves only the date', async () => {
    const input = renderCard();
    fireEvent.change(input, { target: { value: '2026-12-20' } });
    fireEvent.click(screen.getByText('שמור'));
    expect(screen.getByTestId('consequences').textContent).toContain('21.12.2026');
    await act(async () => { fireEvent.click(screen.getByText('הבנתי — שמור')); });
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0][0]).toEqual({ tuition_start_date: '2026-12-20' });
  });
});

describe('DatabasePage — new student start date is an explicit choice', () => {
  function openAdd() {
    students = [mk(1)];
    render(<MemoryRouter><DatabasePage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/הוסף תלמיד|תלמיד חדש/));
    fireEvent.change(screen.getAllByPlaceholderText('שם משפחה')[0], { target: { value: 'חדש' } });
  }
  it('no date is pre-filled (no fixed 20.08.2026 default)', () => {
    openAdd();
    expect((screen.getByTestId('new-student-start-date') as HTMLInputElement).value).toBe('');
  });
  it('saving without a date requires an explicit acknowledgement', async () => {
    openAdd();
    fireEvent.click(screen.getByText(/^שמור/, { selector: 'button.db-add-btn' }));
    expect(insertSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/סמנו במפורש/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('no-date-ack'));
    await act(async () => { fireEvent.click(screen.getByText(/^שמור/, { selector: 'button.db-add-btn' })); });
    await waitFor(() => expect(insertSpy).toHaveBeenCalledTimes(1));
    expect(insertSpy.mock.calls[0][0]).not.toHaveProperty('tuition_start_date');
  });
  it('the suggestion fills the month of the next charge; saving shows consequences and requires confirmation', async () => {
    openAdd();
    fireEvent.click(screen.getByTestId('suggest-start-date'));
    const v = (screen.getByTestId('new-student-start-date') as HTMLInputElement).value;
    expect(v).toMatch(/^\d{4}-\d{2}-20$/);
    fireEvent.click(screen.getByText(/^שמור/, { selector: 'button.db-add-btn' }));
    expect(insertSpy).not.toHaveBeenCalled();
    expect(dialog('השלכות שינוי תאריך תחילת גבייה')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText('הבנתי — שמור')); });
    await waitFor(() => expect(insertSpy).toHaveBeenCalledTimes(1));
    expect(insertSpy.mock.calls[0][0].tuition_start_date).toBe(v);
  });
});
