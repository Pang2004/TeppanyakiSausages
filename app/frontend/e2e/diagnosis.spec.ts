import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('shows a concise diagnosis and downloads a local result-specific PDF', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route('**/api/health', route => route.fulfill({ json: {
    status: 'ready', maximum_file_bytes: 31457280,
    subsystems: { rail: true, door: true, acv: true, shm: true },
  } }));
  let predictionRequests = 0;
  await page.route('**/api/predict/rail', route => {
    predictionRequests += 1;
    return route.fulfill({ json: {
      subsystem: 'rail', model_version: 'rail-pipeline-v3', file_id: 'flagged.csv', prediction: 'Side I',
      scores: { Normal: .1, 'Side I': .7, 'Side II': .2 }, side_energy: {}, dominant_frequency: {},
    } });
  });

  await page.goto('/rail');
  await page.getByLabel('Choose CSV files', { exact: true }).setInputFiles({ name: 'flagged.csv', mimeType: 'text/csv', buffer: Buffer.from('fixture') });
  const summary = page.getByRole('region', { name: 'Diagnosis at a glance' });
  await expect(summary).toBeVisible();
  await expect(summary.getByText('A corrugation pattern was flagged on Side I.')).toBeVisible();
  await expect(summary.getByText(/Prioritise a physical inspection of Side I/)).toBeVisible();
  await expect(summary.getByText(/does not locate an individual defect/)).toBeVisible();

  const pending = page.waitForEvent('download');
  await summary.getByRole('button', { name: 'Download diagnosis PDF' }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('rail-diagnosis-flagged.pdf');
  const contents = await readFile((await download.path())!);
  expect(contents.subarray(0, 5).toString()).toBe('%PDF-');
  expect(contents.length).toBeGreaterThan(5_000);
  expect(predictionRequests).toBe(1);
});

test('creates a detailed multi-operation Door report', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The long-report pagination check runs once.');
  await page.route('**/api/health', route => route.fulfill({ json: {
    status: 'ready', maximum_file_bytes: 31457280,
    subsystems: { rail: true, door: true, acv: true, shm: true },
  } }));
  const cycles = Array.from({ length: 45 }, (_, index) => ({
    start_time: `2023-7-5-0-${Math.floor(index / 2)}-${index % 2 ? 30 : 0}-0`,
    end_time: `2023-7-5-0-${Math.floor(index / 2)}-${index % 2 ? 33 : 3}-760`,
    prediction: index % 6 === 0 ? 'Abnormal resistance' : 'Normal',
    operation: index % 2 ? 'Open' : 'Close', confidence: .8,
    quality_flags: index === 0 ? ['terminal_state_not_confirmed'] : [],
    boundary_reason: index === 0 ? 'gap' : 'terminal_dwell',
  }));
  await page.route('**/api/predict/door', route => route.fulfill({ json: {
    subsystem: 'door', model_version: 'door-pipeline-v1', file_id: 'door-report.csv', cycles,
  } }));
  await page.goto('/door');
  await page.getByLabel('Choose CSV files', { exact: true }).setInputFiles({ name: 'door-report.csv', mimeType: 'text/csv', buffer: Buffer.from('fixture') });
  const summary = page.getByRole('region', { name: 'Diagnosis at a glance' });
  await expect(summary.getByText('8 of 45 detected operations were flagged for abnormal resistance.')).toBeVisible();
  await expect(summary.getByText(/recording-quality warning/)).toBeVisible();
  const pending = page.waitForEvent('download');
  await summary.getByRole('button', { name: 'Download diagnosis PDF' }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('door-diagnosis-door-report.pdf');
  const contents = await readFile((await download.path())!);
  expect(contents.subarray(0, 5).toString()).toBe('%PDF-');
  expect(contents.length).toBeGreaterThan(10_000);
});
