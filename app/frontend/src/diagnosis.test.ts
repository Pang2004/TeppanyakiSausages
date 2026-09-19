import { describe, expect, it } from 'vitest';
import type { ACVResult, DoorResult, RailResult, SHMResult } from './data';
import { buildDiagnosis, describeDoorBoundary, describeDoorQualityFlag, diagnosisPdfFilename } from './diagnosis';

const rail = (prediction: RailResult['prediction']): RailResult => ({
  subsystem: 'rail', model_version: 'rail-pipeline-v3', file_id: 'rail.csv', prediction,
  scores: { Normal: .1, 'Side I': .7, 'Side II': .2 }, side_energy: {}, dominant_frequency: {},
});

describe('technician diagnosis guidance', () => {
  it('distinguishes a rail flag from a defect-free guarantee', () => {
    const alert = buildDiagnosis(rail('Side I'));
    expect(alert.tone).toBe('alert');
    expect(alert.action).toContain('Side I');
    expect(alert.note).toContain('does not locate');
    const normal = buildDiagnosis(rail('Normal'));
    expect(normal.tone).toBe('clear');
    expect(normal.note).toContain('does not prove');
    expect(normal.limitations.join(' ')).toContain('not probabilities');
  });

  it('summarises Door abnormalities and translates data-quality codes', () => {
    const result: DoorResult = {
      subsystem: 'door', model_version: 'door-pipeline-v1', file_id: 'door.csv',
      cycles: [{ start_time: '2023-7-5-0-0-0-0', end_time: '2023-7-5-0-0-3-760', prediction: 'Abnormal resistance', operation: 'Open', confidence: .8, quality_flags: ['terminal_state_not_confirmed'], boundary_reason: 'gap' }],
    };
    const guide = buildDiagnosis(result);
    expect(guide.result).toContain('1 of 1');
    expect(guide.action).toContain('00:00:00.000–00:00:03.760');
    expect(guide.qualityWarnings[0]).toContain('terminal door state');
    expect(describeDoorBoundary('gap')).toContain('timestamp gap');
    expect(describeDoorQualityFlag('new_capture_warning')).toContain('Review this recording-quality flag');
  });

  it('does not treat an empty Door result as Normal', () => {
    const result: DoorResult = { subsystem: 'door', model_version: 'v1', file_id: 'empty.csv', cycles: [] };
    const guide = buildDiagnosis(result);
    expect(guide.tone).toBe('neutral');
    expect(guide.result).toContain('No complete door operations');
    expect(guide.note).toContain('No Normal or abnormal conclusion');
  });

  it('describes ACV as a relative inspection ranking and reports evidence availability', () => {
    const result: ACVResult = {
      subsystem: 'acv', model_version: 'acv-pipeline-v1', file_id: 'cars.xlsx', ranked_cars: ['08', '01'],
      car_scores: { '08': .9, '01': .2 }, schema: 'rich_pressure',
      diagnostics: { '08': { temperature_score: .8, pressure_score: .9, temperature_coverage: .75, cabin_temperature_median: 28 }, '01': {} },
    };
    const guide = buildDiagnosis(result);
    expect(guide.result).toContain('Car 08');
    expect(guide.note).toContain('not a leak probability');
    expect(guide.evidence.join(' ')).toContain('temperature and pressure-circuit');
    expect(guide.qualityWarnings[0]).toContain('75%');
  });

  it('keeps SHM neutral and rejects remaining-life or confidence interpretations', () => {
    const result: SHMResult = {
      subsystem: 'shm', model_version: 'shm-pipeline-v1', file_id: 'stress.csv', prediction: 1.25,
      cycle_count: 10, equivalent_stress_amplitude: 2, maximum_cycle_range: 3,
      estimated_percentage_error: .06709, error_indicator_kind: 'historical_validation_p95_absolute_percentage_error',
    };
    const guide = buildDiagnosis(result);
    expect(guide.tone).toBe('neutral');
    expect(guide.result).toContain('125% of the D = 1 reference');
    expect(guide.note).toContain('not remaining life');
    expect(guide.limitations.join(' ')).toContain('not a file-specific confidence interval');
  });

  it('creates a safe and deterministic report filename', () => {
    expect(diagnosisPdfFilename({ ...rail('Normal'), file_id: 'Train 01 / review.csv' })).toBe('rail-diagnosis-Train-01-review.pdf');
  });
});
