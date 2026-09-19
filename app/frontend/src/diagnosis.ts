import { doorClock, doorDuration, type DiagnosticResult, type DoorCycle } from './data';

export type DiagnosisTone = 'alert' | 'clear' | 'neutral';
export type DiagnosisGuide = {
  tone: DiagnosisTone;
  result: string;
  action: string;
  note: string;
  explanation: string;
  evidence: string[];
  steps: string[];
  limitations: string[];
  qualityWarnings: string[];
};

export function diagnosticNumber(value: number | null | undefined, digits = 3): string {
  return value == null || !Number.isFinite(value)
    ? 'Not available'
    : value.toLocaleString('en', { maximumFractionDigits: digits });
}

const qualityDescriptions: Record<string, string> = {
  unexpected_position_direction: 'Door position moved opposite to the inferred operation direction. Verify sensor mapping and recording integrity.',
  terminal_state_not_confirmed: 'A stable terminal door state was not confirmed. Treat this operation boundary with caution.',
  maximum_duration_reached: 'The detector reached its 10-second operation limit. Check for an incomplete or stalled movement.',
};

const boundaryDescriptions: Record<string, string> = {
  operation_change: 'A change from opening to closing, or closing to opening, ended the operation.',
  inactive_state: 'The command and activity signals became inactive.',
  terminal_dwell: 'A stable terminal position was observed for the required dwell time.',
  maximum_duration: 'The detector stopped at the maximum operation duration.',
  gap: 'A timestamp gap ended the recorded operation.',
  end_of_stream: 'The recording ended while this was the active operation.',
};

function readableCode(code: string): string {
  return code.replaceAll('_', ' ').replace(/^./, first => first.toUpperCase());
}

export function describeDoorQualityFlag(flag: string): string {
  return qualityDescriptions[flag] ?? `${readableCode(flag)}. Review this recording-quality flag before acting on the prediction.`;
}

export function describeDoorBoundary(reason: string): string {
  return boundaryDescriptions[reason] ?? `${readableCode(reason)} was reported as the operation boundary.`;
}

export function doorOperationSummary(cycle: DoorCycle, index: number): string {
  return `Operation ${index + 1}: ${cycle.operation}, ${doorClock(cycle.start_time)}–${doorClock(cycle.end_time)}, ${doorDuration(cycle)}, ${cycle.prediction}.`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildDiagnosis(result: DiagnosticResult): DiagnosisGuide {
  if (result.subsystem === 'rail') {
    const flagged = result.prediction !== 'Normal' ? result.prediction : null;
    return {
      tone: flagged ? 'alert' : 'clear',
      result: flagged
        ? `A corrugation pattern was flagged on ${flagged}.`
        : 'No corrugation pattern was flagged on Side I or Side II.',
      action: flagged
        ? `Prioritise a physical inspection of ${flagged} and confirm the condition using the approved rail inspection method.`
        : 'Continue the scheduled inspection programme and review other evidence if corrugation is still suspected.',
      note: flagged
        ? 'This is a whole-recording classification; it does not locate an individual defect along the rail.'
        : '“Not flagged” does not prove that both rails are defect-free.',
      explanation: flagged
        ? `The recording most closely matches the model pattern for ${flagged} corrugation. The opposite side was not independently certified as healthy.`
        : 'The recording was classified as Normal by the whole-recording model. This is decision support, not a replacement for scheduled inspection.',
      evidence: [
        `Whole-recording classification: ${result.prediction}`,
        `Side I: ${result.prediction === 'Side I' ? 'flagged' : 'not flagged by this prediction'}`,
        `Side II: ${result.prediction === 'Side II' ? 'flagged' : 'not flagged by this prediction'}`,
      ],
      steps: flagged
        ? [`Confirm that the recording belongs to the intended track section and run.`, `Inspect ${flagged} first using the approved physical or measurement procedure.`, 'Record the confirmed location and severity in the maintenance system; the model cannot supply either value.']
        : ['Confirm the recording belongs to the intended track section and run.', 'Continue routine inspection intervals.', 'Escalate for physical inspection if noise, vibration, or other operational evidence conflicts with this result.'],
      limitations: [
        'The class scores are uncalibrated model scores and are not probabilities or guarantees.',
        'The prediction applies to the complete recording and does not identify a defect location.',
      ],
      qualityWarnings: [],
    };
  }

  if (result.subsystem === 'door') {
    const abnormalCycles = result.cycles.filter(cycle => cycle.prediction !== 'Normal');
    const flags = unique(result.cycles.flatMap(cycle => cycle.quality_flags));
    const qualityWarnings = flags.map(describeDoorQualityFlag);
    if (!result.cycles.length) {
      return {
        tone: 'neutral',
        result: 'No complete door operations were available for classification.',
        action: 'Verify that the CSV contains a complete actuator-current stream, then capture or upload the recording again.',
        note: 'No Normal or abnormal conclusion can be made when no operation is detected.',
        explanation: 'The detector must first identify an opening or closing movement before the resistance classifier can produce a result.',
        evidence: ['Detected operations: 0'],
        steps: ['Confirm the correct file and time range were exported.', 'Check that command, position, and actuator signals cover a full movement.', 'Capture a new recording and rerun the diagnosis.'],
        limitations: ['The stream does not provide a physical train, car, or door identifier.'],
        qualityWarnings: [],
      };
    }
    const firstAbnormal = abnormalCycles[0];
    const flaggedWindow = firstAbnormal ? `${doorClock(firstAbnormal.start_time)}–${doorClock(firstAbnormal.end_time)}` : '';
    return {
      tone: abnormalCycles.length ? 'alert' : 'clear',
      result: abnormalCycles.length
        ? `${abnormalCycles.length} of ${result.cycles.length} detected operations were flagged for abnormal resistance.`
        : `No abnormal resistance was flagged across ${result.cycles.length} detected operations.`,
      action: abnormalCycles.length
        ? `Inspect the actuator and mechanical movement associated with the flagged ${firstAbnormal.operation.toLowerCase()} operation at ${flaggedWindow}.`
        : 'Continue scheduled door checks and compare these timestamps with any reported intermittent symptoms.',
      note: qualityWarnings.length
        ? `${qualityWarnings.length} recording-quality warning${qualityWarnings.length === 1 ? '' : 's'} should be reviewed before maintenance action.`
        : 'Use the source-file context to associate these operations with the correct installed door; the model cannot identify it.',
      explanation: 'Each result represents one detected opening or closing movement. Timing and classification should be matched with operational records before physical work begins.',
      evidence: [
        `Detected operations: ${result.cycles.length}`,
        `Abnormal resistance: ${abnormalCycles.length}`,
        ...abnormalCycles.slice(0, 5).map((cycle, index) => doorOperationSummary(cycle, result.cycles.indexOf(cycle))),
      ],
      steps: abnormalCycles.length
        ? ['Use the source filename and operational record to identify the physical door.', 'Review every flagged timestamp and recording-quality warning.', 'Inspect for actuator loading, obstruction, alignment, or mechanical resistance, then confirm with the approved door test.']
        : ['Confirm the source recording is associated with the intended door.', 'Review operation timings for unusual behaviour not covered by the classifier.', 'Continue routine inspection and investigate separately if symptoms persist.'],
      limitations: [
        'The supplied stream has no physical train, car, or door identifier.',
        'The model classification does not identify the mechanical cause of resistance.',
      ],
      qualityWarnings,
    };
  }

  if (result.subsystem === 'acv') {
    const topCar = result.ranked_cars[0];
    const top = result.diagnostics[topCar] ?? {};
    const hasTemperature = top.temperature_score != null && Number.isFinite(top.temperature_score);
    const hasPressure = top.pressure_score != null && Number.isFinite(top.pressure_score);
    const sources = [hasTemperature ? 'temperature' : '', hasPressure ? 'pressure-circuit' : ''].filter(Boolean);
    const coverage = top.temperature_coverage == null ? 'Not available' : `${diagnosticNumber(top.temperature_coverage * 100, 1)}%`;
    return {
      tone: 'neutral',
      result: `Car ${topCar} is the highest inspection priority among ${result.ranked_cars.length} ranked cars.`,
      action: `Inspect Car ${topCar}’s HVAC and refrigeration system first, then continue in the displayed rank order.`,
      note: 'This is a within-workbook priority ranking, not a leak probability or a confirmed refrigerant leak.',
      explanation: 'Cars are compared with other cars in the same workbook. A higher relative diagnostic score moves a car earlier in the inspection order.',
      evidence: [
        `Highest-priority car: ${topCar}`,
        `Evidence available for Car ${topCar}: ${sources.length ? sources.join(' and ') : 'limited diagnostic evidence'}`,
        `Cabin-temperature coverage for Car ${topCar}: ${coverage}`,
        `Cabin-temperature median for Car ${topCar}: ${top.cabin_temperature_median == null ? 'Not available' : `${diagnosticNumber(top.cabin_temperature_median, 1)} °C`}`,
      ],
      steps: ['Confirm workbook identity, date, and car numbering.', `Inspect Car ${topCar} first, including available temperature sensors and refrigeration circuits.`, 'Continue through the remaining cars in rank order and record physical findings independently of the model score.'],
      limitations: [
        'Scores are relative within this workbook and are not probabilities or universal severity values.',
        'Missing cabin or pressure measurements can remove evidence needed to rank a car reliably.',
      ],
      qualityWarnings: top.temperature_coverage != null && top.temperature_coverage < 0.8
        ? [`Car ${topCar} has ${coverage} cabin-temperature coverage; verify missing or invalid sensor readings.`]
        : [],
    };
  }

  const percent = result.prediction * 100;
  const historical = result.estimated_percentage_error * 100;
  return {
    tone: 'neutral',
    result: `Estimated cumulative fatigue damage is D = ${diagnosticNumber(result.prediction, 6)} (${diagnosticNumber(percent, 2)}% of the D = 1 reference).`,
    action: 'Record and trend this value, then compare it with approved engineering limits for the specific structure and operating context.',
    note: 'This result is not remaining life, percent life consumed, or a structural-safety verdict.',
    explanation: 'The model estimates cumulative Miner-style fatigue damage from the complete stress history. D = 1 is a calculation reference, not an automatic maintenance threshold in this app.',
    evidence: [
      `Cumulative damage estimate: D = ${diagnosticNumber(result.prediction, 6)}`,
      `Counted stress cycles: ${diagnosticNumber(result.cycle_count, 1)}`,
      `Equivalent stress amplitude: ${diagnosticNumber(result.equivalent_stress_amplitude, 3)} input stress units`,
      `Maximum cycle range: ${diagnosticNumber(result.maximum_cycle_range, 3)} input stress units`,
      `Historical validation context: 95% of held-out absolute percentage errors were at or below ${diagnosticNumber(historical, 2)}%.`,
    ],
    steps: ['Confirm the stress units, structure, and recording period are appropriate for the calibrated model.', 'Log D with the vehicle and recording context so changes can be trended.', 'Apply only approved engineering limits; refer to structural engineering when limits or operating context are unavailable.'],
    limitations: [
      'D = 1 is not automatically a safe/unsafe boundary or proof of remaining structural life.',
      `The ${diagnosticNumber(historical, 2)}% historical error indicator is identical for every file and is not a file-specific confidence interval or coverage guarantee.`,
      'Transfer to a different line, vehicle, material, stress unit, or loading regime has not been established.',
    ],
    qualityWarnings: [],
  };
}

export function diagnosisPdfFilename(result: DiagnosticResult): string {
  const stem = result.file_id.replace(/\.[^.]+$/, '').normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'recording';
  return `${result.subsystem}-diagnosis-${stem}.pdf`;
}
