import { Document, Font, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import cabinRegular from '@fontsource/cabin/files/cabin-latin-ext-400-normal.woff?url';
import cabinBold from '@fontsource/cabin/files/cabin-latin-ext-700-normal.woff?url';
import { doorDuration, type DiagnosticResult } from './data';
import { describeDoorBoundary, describeDoorQualityFlag, diagnosticNumber, type DiagnosisGuide } from './diagnosis';

Font.register({
  family: 'CabinReport',
  fonts: [
    { src: cabinRegular, fontWeight: 400 },
    { src: cabinBold, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback(word => word.length > 28 ? (word.match(/.{1,24}/g) ?? [word]) : [word]);

const colours = { ink: '#17243a', muted: '#596b82', line: '#d7e0e9', green: '#08754d', red: '#be123c', blue: '#075d9b', amber: '#8a5a00' };
const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingRight: 42, paddingBottom: 52, paddingLeft: 42, fontFamily: 'CabinReport', fontSize: 9.5, color: colours.ink, lineHeight: 1.45 },
  brand: { fontSize: 8, letterSpacing: 1.3, color: colours.green, fontWeight: 700, marginBottom: 5 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: colours.muted, marginBottom: 16 },
  metadata: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', borderTop: `1 solid ${colours.line}`, borderBottom: `1 solid ${colours.line}`, paddingTop: 8, paddingBottom: 8, marginBottom: 14 },
  metaItem: { width: '50%', marginBottom: 4, paddingRight: 8 },
  metaLabel: { fontSize: 7.5, color: colours.muted, textTransform: 'uppercase', letterSpacing: .5 },
  metaValue: { fontSize: 9, fontWeight: 700, marginTop: 1 },
  notice: { padding: 10, backgroundColor: '#fff7df', borderLeft: `3 solid ${colours.amber}`, marginBottom: 14 },
  noticeTitle: { fontWeight: 700, color: colours.amber, marginBottom: 2 },
  hero: { padding: 12, backgroundColor: '#f5f8fa', border: `1 solid ${colours.line}`, marginBottom: 14 },
  heroLabel: { fontSize: 7.5, color: colours.muted, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 3 },
  heroResult: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
  heroAction: { fontSize: 10.5 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: colours.blue, borderBottom: `1 solid ${colours.line}`, paddingBottom: 4, marginBottom: 7 },
  paragraph: { marginBottom: 5 },
  bulletRow: { display: 'flex', flexDirection: 'row', marginBottom: 4 },
  bullet: { width: 13, color: colours.green, fontWeight: 700 },
  bulletText: { flexGrow: 1 },
  warning: { padding: 8, backgroundColor: '#fff1f2', borderLeft: `3 solid ${colours.red}`, marginBottom: 5 },
  table: { borderTop: `1 solid ${colours.line}`, borderLeft: `1 solid ${colours.line}` },
  row: { display: 'flex', flexDirection: 'row' },
  headerRow: { display: 'flex', flexDirection: 'row', backgroundColor: '#e9eff5' },
  cell: { borderRight: `1 solid ${colours.line}`, borderBottom: `1 solid ${colours.line}`, padding: 5, minHeight: 20 },
  cellHeader: { fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', color: '#3d5068' },
  cellText: { fontSize: 8 },
  footer: { position: 'absolute', left: 42, right: 42, bottom: 24, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', color: colours.muted, fontSize: 7.5, borderTop: `1 solid ${colours.line}`, paddingTop: 5 },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Bullets({ values, ordered = false }: { values: string[]; ordered?: boolean }) {
  return <>{values.map((value, index) => <View style={styles.bulletRow} key={`${index}-${value}`} wrap={false}><Text style={styles.bullet}>{ordered ? `${index + 1}.` : '•'}</Text><Text style={styles.bulletText}>{value}</Text></View>)}</>;
}

type Column = { label: string; width: string };
function Table({ columns, rows }: { columns: Column[]; rows: string[][] }) {
  return <View style={styles.table}>
    <View style={styles.headerRow} fixed>{columns.map(column => <View key={column.label} style={[styles.cell, { width: column.width }]}><Text style={styles.cellHeader}>{column.label}</Text></View>)}</View>
    {rows.map((row, rowIndex) => <View style={styles.row} key={rowIndex} wrap={false}>{columns.map((column, columnIndex) => <View key={column.label} style={[styles.cell, { width: column.width }]}><Text style={styles.cellText}>{row[columnIndex] ?? ''}</Text></View>)}</View>)}
  </View>;
}

function DetailedResults({ result }: { result: DiagnosticResult }) {
  if (result.subsystem === 'rail') {
    return <Table columns={[{ label: 'Rail side', width: '34%' }, { label: 'Model output', width: '66%' }]} rows={[
      ['Side I', result.prediction === 'Side I' ? 'Corrugation pattern flagged' : 'Not flagged by this prediction'],
      ['Side II', result.prediction === 'Side II' ? 'Corrugation pattern flagged' : 'Not flagged by this prediction'],
    ]} />;
  }
  if (result.subsystem === 'door') {
    return <Table columns={[
      { label: '# / movement', width: '14%' }, { label: 'Time / duration', width: '26%' }, { label: 'Prediction', width: '20%' }, { label: 'Boundary / quality', width: '40%' },
    ]} rows={result.cycles.map((cycle, index) => [
      `${index + 1} / ${cycle.operation}`,
      `${cycle.start_time}\n${cycle.end_time}\n${doorDuration(cycle)}`,
      cycle.prediction,
      `${describeDoorBoundary(cycle.boundary_reason)}${cycle.quality_flags.length ? `\n${cycle.quality_flags.map(describeDoorQualityFlag).join(' ')}` : '\nNo recording-quality flags.'}`,
    ])} />;
  }
  if (result.subsystem === 'acv') {
    return <Table columns={[
      { label: 'Rank / car', width: '18%' }, { label: 'Relative score', width: '18%' }, { label: 'Cabin / coverage', width: '25%' }, { label: 'Evidence available', width: '39%' },
    ]} rows={result.ranked_cars.map((car, index) => {
      const diagnostic = result.diagnostics[car] ?? {};
      const sources = [diagnostic.temperature_score != null ? 'Temperature' : '', diagnostic.pressure_score != null ? 'Pressure circuit' : ''].filter(Boolean);
      return [
        `${index + 1} / Car ${car}`,
        diagnosticNumber(result.car_scores[car], 4),
        `${diagnostic.cabin_temperature_median == null ? 'Temperature unavailable' : `${diagnosticNumber(diagnostic.cabin_temperature_median, 1)} °C`}\n${diagnostic.temperature_coverage == null ? 'Coverage unavailable' : `${diagnosticNumber(diagnostic.temperature_coverage * 100, 1)}% coverage`}`,
        sources.length ? sources.join(' and ') : 'Limited diagnostic evidence',
      ];
    })} />;
  }
  return <Table columns={[{ label: 'Diagnostic', width: '55%' }, { label: 'Value', width: '45%' }]} rows={[
    ['Cumulative fatigue damage', `D = ${diagnosticNumber(result.prediction, 6)}`],
    ['Relative to D = 1 reference', `${diagnosticNumber(result.prediction * 100, 2)}%`],
    ['Counted stress cycles', diagnosticNumber(result.cycle_count, 1)],
    ['Equivalent stress amplitude', `${diagnosticNumber(result.equivalent_stress_amplitude, 3)} input stress units`],
    ['Maximum cycle range', `${diagnosticNumber(result.maximum_cycle_range, 3)} input stress units`],
    ['Historical validation error context', `${diagnosticNumber(result.estimated_percentage_error * 100, 2)}% p95 absolute percentage error; not file-specific`],
  ]} />;
}

function DiagnosisDocument({ result, guide, generatedAt }: { result: DiagnosticResult; guide: DiagnosisGuide; generatedAt: Date }) {
  return <Document title={`${result.subsystem.toUpperCase()} diagnosis — ${result.file_id}`} author="Fleet Diagnostic" subject="Technician decision-support diagnosis">
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.brand}>FLEET DIAGNOSTIC · TECHNICIAN REPORT</Text>
      <Text style={styles.title}>{result.subsystem.toUpperCase()} diagnosis guide</Text>
      <Text style={styles.subtitle}>Result-specific interpretation and inspection guidance</Text>
      <View style={styles.metadata}>
        <View style={styles.metaItem}><Text style={styles.metaLabel}>Source recording</Text><Text style={styles.metaValue}>{result.file_id}</Text></View>
        <View style={styles.metaItem}><Text style={styles.metaLabel}>Subsystem</Text><Text style={styles.metaValue}>{result.subsystem.toUpperCase()}</Text></View>
        <View style={styles.metaItem}><Text style={styles.metaLabel}>Model version</Text><Text style={styles.metaValue}>{result.model_version}</Text></View>
        <View style={styles.metaItem}><Text style={styles.metaLabel}>Report generated</Text><Text style={styles.metaValue}>{generatedAt.toISOString()}</Text></View>
      </View>
      <View style={styles.notice}><Text style={styles.noticeTitle}>Decision-support output — not a maintenance certificate</Text><Text>Confirm findings using approved inspection procedures and organisation-specific engineering limits before maintenance or safety decisions.</Text></View>
      <View style={styles.hero}><Text style={styles.heroLabel}>Finding</Text><Text style={styles.heroResult}>{guide.result}</Text><Text style={styles.heroLabel}>Recommended action</Text><Text style={styles.heroAction}>{guide.action}</Text></View>
      <Section title="How to interpret this result"><Text style={styles.paragraph}>{guide.explanation}</Text><Text>{guide.note}</Text></Section>
      <Section title="Supporting evidence"><Bullets values={guide.evidence} /></Section>
      {guide.qualityWarnings.length > 0 && <Section title="Recording-quality warnings">{guide.qualityWarnings.map((warning, index) => <View style={styles.warning} key={index} wrap={false}><Text>{warning}</Text></View>)}</Section>}
      <Section title="Recommended technician steps"><Bullets values={guide.steps} ordered /></Section>
      <Section title="Important limitations"><Bullets values={guide.limitations} /></Section>
      <Section title="Detailed result appendix"><DetailedResults result={result} /></Section>
      <View style={styles.footer} fixed><Text>Fleet Diagnostic · source data is not included in this report</Text><Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} /></View>
    </Page>
  </Document>;
}

export async function createDiagnosisPdf(result: DiagnosticResult, guide: DiagnosisGuide, generatedAt: Date): Promise<Blob> {
  return pdf(<DiagnosisDocument result={result} guide={guide} generatedAt={generatedAt} />).toBlob();
}
