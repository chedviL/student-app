import { describe, it, expect } from 'vitest';
import { describeStartDateChange, nextChargeRun, DEFAULT_TUITION_START_DATE, START_DATE_POLICY } from '../../constants/tuitionPolicy';

const TODAY = new Date(2026, 10, 8, 12, 0); // 08.11.2026 — next run 21.11.2026 (November)
const all = (e: { consequences: string[]; whatToDo: string[] }) => [...e.consequences, ...e.whatToDo].join(' | ');

describe('start-date policy', () => {
  it('default date is the date every student has', () => expect(DEFAULT_TUITION_START_DATE).toBe('2026-08-20'));
  it('policy text covers the key rules', () => {
    const t = START_DATE_POLICY.join(' ');
    expect(t).toContain('20.08.2026');
    expect(t).toContain('לא יוצר ולא מבטל');
    expect(t).toContain('חיוב ידני');
    expect(t).toContain('אין למחוק');
  });
});

describe('nextChargeRun', () => {
  it('before the 21st → this month', () => expect(nextChargeRun(TODAY).date).toBe('21.11.2026'));
  it('after the 21st → next month', () => expect(nextChargeRun(new Date(2026, 10, 25)).date).toBe('21.12.2026'));
  it('December rolls over the year', () => expect(nextChargeRun(new Date(2026, 11, 28)).date).toBe('21.01.2027'));
});

describe('describeStartDateChange', () => {
  it('clearing a date is blocked', () => {
    const e = describeStartDateChange('2026-08-20', '', TODAY);
    expect(e.kind).toBe('blocked');
    expect(all(e)).toContain('לא מחויב');
  });
  it('invalid text is rejected', () => expect(describeStartDateChange('2026-08-20', '20/08', TODAY).kind).toBe('invalid'));

  it('missing → 20.08.2026: included in the next run, past months not charged automatically', () => {
    const e = describeStartDateChange(null, '2026-08-20', TODAY);
    expect(e.kind).toBe('set_new');
    expect(all(e)).toContain('21.11.2026');
    expect(all(e)).toContain('אוגוסט 2026, ספטמבר 2026, אוקטובר 2026');
    expect(all(e)).toContain('חיוב ידני');
  });
  it('missing → future month: first charge on the 21st of that month, nothing to backfill', () => {
    const e = describeStartDateChange(null, '2027-01-20', TODAY);
    expect(e.consequences[0]).toContain('21.01.2027');
    expect(e.whatToDo).toHaveLength(0);
  });
  it('same month → no effect', () => expect(describeStartDateChange('2026-08-20', '2026-08-01', TODAY).kind).toBe('no_effect'));
  it('later (Aug → Sep): existing August charge is NOT cancelled automatically', () => {
    const e = describeStartDateChange('2026-08-20', '2026-09-20', TODAY);
    expect(e.kind).toBe('later');
    expect(all(e)).toContain('אוגוסט 2026');
    expect(all(e)).toContain('לא יבוטלו אוטומטית');
    expect(all(e)).toContain('בטלו');
  });
  it('later into the future: not charged in the coming run', () => {
    const e = describeStartDateChange('2026-08-20', '2027-01-20', TODAY);
    expect(e.consequences[0]).toContain('לא יחויב בחיוב הקרוב (21.11.2026)');
    expect(all(e)).toContain('אוגוסט 2026, ספטמבר 2026, אוקטובר 2026');
  });
  it('earlier (Sep → Aug): August is not charged automatically — manual charge with note', () => {
    const e = describeStartDateChange('2026-09-20', '2026-08-20', TODAY);
    expect(e.kind).toBe('earlier');
    expect(all(e)).toContain('אוגוסט 2026');
    expect(all(e)).toContain('חודש MM/YY');
  });
});
