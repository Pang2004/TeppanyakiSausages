import { useMemo, useState } from 'react';
import type { DiagnosticResult } from './data';
import { buildDiagnosis, diagnosisPdfFilename } from './diagnosis';

export function DiagnosisSummary({ result }: { result: DiagnosticResult }) {
  const guide = useMemo(() => buildDiagnosis(result), [result]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setError('');
    try {
      const { createDiagnosisPdf } = await import('./diagnosticPdf');
      const blob = await createDiagnosisPdf(result, guide, new Date());
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = diagnosisPdfFilename(result);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('The diagnosis PDF could not be created. Retry the download.');
    } finally {
      setDownloading(false);
    }
  };

  return <section className={`diagnosis-summary tone-${guide.tone}`} aria-labelledby={`diagnosis-${result.subsystem}`}>
    <div className="diagnosis-summary-heading">
      <div><span className="eyebrow">TECHNICIAN DECISION SUPPORT</span><h2 id={`diagnosis-${result.subsystem}`}>Diagnosis at a glance</h2></div>
      <span className="diagnosis-model" title="Model version">{result.model_version}</span>
    </div>
    <dl className="diagnosis-lines">
      <div><dt>Result</dt><dd>{guide.result}</dd></div>
      <div><dt>Recommended action</dt><dd>{guide.action}</dd></div>
      <div><dt>Important note</dt><dd>{guide.note}</dd></div>
    </dl>
    <div className="diagnosis-actions">
      <p>Download the detailed interpretation, evidence, inspection steps and limitations for this recording.</p>
      <button type="button" className="primary-button diagnosis-download" onClick={() => void download()} disabled={downloading}>
        <span aria-hidden="true">↓</span>{downloading ? 'Preparing PDF…' : 'Download diagnosis PDF'}
      </button>
    </div>
    {error && <p className="pdf-error" role="alert">{error}</p>}
  </section>;
}
