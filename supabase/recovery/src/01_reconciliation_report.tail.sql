-- ── REPORT: one row per (student, month, currency) ──
SELECT
  category, month, currency, name, class_name, passport_or_id, student_id, person_kind,
  charge_state, credit_state,
  expected_charge, indicative_charge, amount_evidence, historical_rank_evidence,
  existing_auto_charge, existing_auto_credit, manual_charges, manual_payments_and_credits,
  net_existing,
  net_existing
    + CASE WHEN safe_auto_recovery AND charge_missing THEN coalesce(expected_charge, 0) ELSE 0 END
    + CASE WHEN safe_auto_recovery AND credit_missing THEN -coalesce(existing_auto_charge, expected_charge, 0) ELSE 0 END
    AS net_after_recovery,
  suspected_duplicate, charge_missing, credit_missing, safe_auto_recovery, needs_human,
  array_to_string(b_reasons, E'\n') AS b_reasons,
  cur_tuition_raw, cur_currency, cur_rank, start_date, updated_at,
  manual_debit_detail, manual_credit_detail, late_manual_debit_detail, late_manual_credit_detail,
  all_tx_detail
FROM recon_result
ORDER BY category, month, currency, name;
