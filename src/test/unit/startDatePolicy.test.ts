import { describe, it, expect } from 'vitest';
import {
  describeStartDateChange, describeBulkStartDateChange, nextChargeRun, suggestStartDate, START_DATE_POLICY,
} from '../../constants/tuitionPolicy';

// 08.11.2026 12:00 UTC — next run 21.11.2026 02:00 UTC (04:00 Israel, winter time)
const TODAY = new Date(Date.UTC(2026, 10, 8, 12, 0));
const all = (e: { consequences: string[]; whatToDo: string[] }) => [...e.consequences, ...e.whatToDo].join(' | ');

describe('policy text (client wording)', () => {
  const t = START_DATE_POLICY.join(' ');
  it('date must reflect the real start of charging', () => expect(t).toContain('חייב לשקף את תחילת החיוב האמיתית'));
  it('changing a date does not fix history', () => expect(t).toContain('אינו מתקן תנועות היסטוריות אוטומטית'));
  it('backfill only after duplicate check + manager approval, documented manual charge or controlled recovery', () => {
    expect(t).toContain('בדיקת כפילויות ואישור המנהלת');
    expect(t).toContain('חיוב ידני מתועד או שחזור מבוקר');
  });
  it('no deleting transactions — cancellation with reason', () => expect(t).toContain('אין למחוק תנועות כספיות קיימות'));
  it('no fixed default date for everyone', () => expect(t).not.toMatch(/ברירת המחדל היא 20\.08\.2026/));
});

describe('nextChargeRun — matches pg_cron "0 2 21 * *" with cron.timezone=GMT', () => {
  it('before the 21st → this month, 04:00 Israel in winter', () => {
    const r = nextChargeRun(TODAY);
    expect(r.date).toBe('21.11.2026');
    expect(r.israelTime).toBe('04:00');
    expect(r.runAt.toISOString()).toBe('2026-11-21T02:00:00.000Z');
  });
  it('21st at 01:59 UTC → still this month', () =>
    expect(nextChargeRun(new Date(Date.UTC(2026, 10, 21, 1, 59))).date).toBe('21.11.2026'));
  it('21st at 02:00 UTC → next month', () =>
    expect(nextChargeRun(new Date(Date.UTC(2026, 10, 21, 2, 0))).date).toBe('21.12.2026'));
  it('Israel 21.11 03:30 (= 01:30 UTC) → still this month (browser time zone irrelevant)', () =>
    expect(nextChargeRun(new Date('2026-11-21T03:30:00+02:00')).date).toBe('21.11.2026'));
  it('summer run is 05:00 Israel', () =>
    expect(nextChargeRun(new Date(Date.UTC(2027, 5, 1))).israelTime).toBe('05:00'));
  it('December rolls over the year', () =>
    expect(nextChargeRun(new Date(Date.UTC(2026, 11, 28))).date).toBe('21.01.2027'));
});

describe('suggestStartDate (new student — suggestion only)', () => {
  it('20th of the month the next run charges', () => expect(suggestStartDate(TODAY)).toBe('2026-11-20'));
  it('after this month\'s run → next month', () => expect(suggestStartDate(new Date(Date.UTC(2026, 10, 25)))).toBe('2026-12-20'));
});

describe('describeStartDateChange', () => {
  it('clearing is blocked', () => expect(describeStartDateChange('2026-08-20', '', TODAY).kind).toBe('blocked'));
  it('invalid text is rejected', () => expect(describeStartDateChange('2026-08-20', '20/08', TODAY).kind).toBe('invalid'));
  it('missing → 20.08.2026: next run incl. Israel time; past months not charged automatically', () => {
    const e = describeStartDateChange(null, '2026-08-20', TODAY);
    expect(e.kind).toBe('set_new');
    expect(all(e)).toContain('21.11.2026 בשעה 04:00');
    expect(all(e)).toContain('אוגוסט 2026, ספטמבר 2026, אוקטובר 2026');
  });
  it('missing → future month', () => expect(describeStartDateChange(null, '2027-01-20', TODAY).consequences[0]).toContain('21.01.2027'));
  it('same month → no effect', () => expect(describeStartDateChange('2026-08-20', '2026-08-01', TODAY).kind).toBe('no_effect'));
  it('later: existing charges not cancelled automatically', () => {
    const e = describeStartDateChange('2026-08-20', '2026-09-20', TODAY);
    expect(e.kind).toBe('later');
    expect(all(e)).toContain('לא יבוטלו אוטומטית');
  });
  it('earlier: past months not charged automatically', () => {
    const e = describeStartDateChange('2026-09-20', '2026-08-20', TODAY);
    expect(e.kind).toBe('earlier');
    expect(all(e)).toContain('אוגוסט 2026');
  });
});

describe('describeBulkStartDateChange — consequences for every group, not just the first student', () => {
  it('groups by current date with counts', () => {
    const g = describeBulkStartDateChange(['2026-08-20', null, '2026-08-20', '2026-10-20'], '2026-09-20', TODAY);
    expect(g.map((x) => [x.oldDate, x.count, x.explanation.kind])).toEqual([
      [null, 1, 'set_new'],
      ['2026-08-20', 2, 'later'],
      ['2026-10-20', 1, 'earlier'],
    ]);
  });
  it('a single student → one group', () => expect(describeBulkStartDateChange(['2026-08-20'], '2026-09-20', TODAY)).toHaveLength(1));
});
