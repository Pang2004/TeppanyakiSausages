import { type ACVResult, type SHMResult } from './data';
import type { Batch } from './useBatch';
import acvCar from './assets/acv-car.svg';
import shmCar from './assets/shm-car.svg';
import { DiagnosisSummary } from './DiagnosisSummary';

const number = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? 'Not available' : value.toLocaleString('en', { maximumFractionDigits: digits });
function FileHeading({ name, caption }: { name?: string; caption: string }) {
  return <div className="telemetry-panel"><span className="file-icon" aria-hidden="true">▤</span><div className="file-label"><span className="eyebrow">{caption}</span><strong title={name}>{name ?? 'Awaiting file input…'}</strong></div></div>;
}
function Empty({ error }: { error?: string }) {
  return <p className="module-empty" role="status">{error ?? 'Upload a recording to see its diagnosis. No prediction yet.'}</p>;
}

export { DoorView } from './DoorView';

function CarCard({ result, car, index }: { result: ACVResult; car: string; index: number }) {
  const d = result.diagnostics[car] ?? {};
  return <article className={`acv-car-card rank-${index}`} aria-label={`Rank ${index + 1}: ${car}`}>
    <div className="car-card-heading"><span className="rank-number">#{index + 1}</span><div><h2>Car {car}</h2><span className="car-score">Relative diagnostic score: {number(result.car_scores[car], 4)}</span></div><span className="rank-status">{index === 0 ? 'HIGHEST PRIORITY' : `RANK ${index + 1}`}</span></div>
    <div className="acv-car-stage"><span>{index === 0 ? 'PRIORITISE HVAC INSPECTION' : 'ACV / CAR TELEMETRY'}</span><img src={acvCar} alt={`Car ${car} ventilation illustration`} /></div>
    <dl className="car-metrics"><div><dt>Cabin temperature</dt><dd>{number(d.cabin_temperature_median, 1)}{d.cabin_temperature_median == null ? '' : ' °C'}</dd></div><div><dt>Temperature coverage</dt><dd>{d.temperature_coverage == null ? 'Not available' : `${number(d.temperature_coverage * 100, 1)}%`}</dd></div></dl>
  </article>;
}
export function ACVView({ batch }: { batch: Batch }) {
  const selected = batch.records.find(r => r.id === batch.selected);
  const result = selected?.result?.subsystem === 'acv' ? selected.result : undefined;
  return <section className="visual-column acv-view" aria-label="ACV car rankings"><FileHeading name={selected?.name} caption="ACV / RANKED CAR INSPECTION" />{result && <DiagnosisSummary result={result} />}<div className="module-note">Cars are ordered by relative diagnostic score. Rankings indicate inspection priority, not a confirmed leak or a leak probability.</div>{result ? <><div className="ranking-summary"><strong>{result.ranked_cars.length} cars ranked</strong><span>Highest priority first</span></div><div className="car-rankings">{result.ranked_cars.map((car, index) => <CarCard key={car} result={result} car={car} index={index} />)}</div></> : <><div className="acv-car-stage empty-car"><img src={acvCar} alt="Ventilation carriage awaiting analysis" /></div><Empty error={selected?.error} /></>}</section>;
}
function DamageMeter({ result }: { result?: SHMResult }) {
  const d = result?.prediction;
  const damagePercent = d == null ? 0 : Math.max(0, d * 100);
  const fillPercent = Math.min(100, damagePercent);
  const label = d == null ? 'NO DATA' : damagePercent > 0 && damagePercent < 0.01 ? '<0.01%' : `${number(damagePercent, 2)}%`;
  const band = d == null ? 'idle' : damagePercent < 50 ? 'low' : damagePercent < 80 ? 'moderate' : 'high';
  const bandLabel = d == null ? 'IDLE' : damagePercent >= 100 ? 'REFERENCE REACHED' : `${band === 'low' ? 'LOW' : band === 'moderate' ? 'MODERATE' : 'HIGH'} DISPLAY BAND`;
  const ariaText = d == null
    ? 'Awaiting prediction'
    : `${label} of the D equals 1 reference. ${bandLabel}.${damagePercent > 100 ? ' The visual meter is capped at 100%.' : ''}`;
  return <div className="damage-gauge">
    <div className="damage-meter-heading eyebrow">CUMULATIVE FATIGUE DAMAGE</div>
    <div className="shm-train"><img src={shmCar} alt="Structural fatigue carriage illustration" /><div className={`damage-meter band-${band}`} role="meter" aria-label="Cumulative fatigue damage relative to D equals 1" aria-valuemin={0} aria-valuemax={100} aria-valuenow={d == null ? undefined : fillPercent} aria-valuetext={ariaText}>
      <div className="damage-meter-readout"><strong data-testid="damage-value">{label}</strong><span>{d == null ? 'AWAITING PREDICTION' : 'OF D = 1 REFERENCE'}</span></div>
      <div className="damage-meter-track" aria-hidden="true"><div className="damage-meter-fill" style={{ width: `${fillPercent}%` }} /></div>
      <small data-testid="damage-band">{bandLabel}</small>
    </div></div>
    <div className="damage-scale-labels" aria-hidden="true"><span>0%</span><span>50%</span><span>80%</span><span>100% · D = 1</span></div>
    <div className="damage-band-legend" aria-label="Damage display bands"><span className="legend-low"><i />Low &lt;50%</span><span className="legend-moderate"><i />Moderate 50–&lt;80%</span><span className="legend-high"><i />High ≥80%</span></div>
    <p className="module-note">Fill shows accumulated damage relative to D = 1. Colours are visual display bands, not validated maintenance or safety limits.</p>
  </div>;
}

export function SHMView({ batch }: { batch: Batch }) {
  const selected = batch.records.find(r => r.id === batch.selected);
  const result = selected?.result?.subsystem === 'shm' ? selected.result : undefined;
  const diagnostics = result ? [
    ['RAINFLOW', 'Counted stress cycles', number(result.cycle_count, 1), 'Cycle count from this recording'],
    ['STRESS', 'Equivalent stress amplitude', number(result.equivalent_stress_amplitude, 3), 'In the input stress units'],
    ['RANGE', 'Maximum cycle range', number(result.maximum_cycle_range, 3), 'In the input stress units'],
  ] : [];
  return <section className="visual-column shm-view" aria-label="Structural fatigue diagnosis"><FileHeading name={selected?.name} caption="SHM / STRUCTURAL CONDITION" />{result && <DiagnosisSummary result={result} />}<div className="shm-panel"><div className="shm-title"><h2>Structural Car<br />Fatigue Gauge</h2><span>{result ? `D = ${number(result.prediction, 6)}` : 'AWAITING DATA'}</span></div><DamageMeter result={result} />{!result && <Empty error={selected?.error} />}<div className="influencing-panel"><h2>Recording diagnostics</h2><p>Measured summaries of the stress history.</p>{diagnostics.map(([tag, title, value, note]) => <div className="diagnostic-feature" key={tag}><span className="feature-tag">{tag}</span><div><h3>{title}</h3><p>{note}</p></div><strong>{value}</strong></div>)}</div></div></section>;
}
