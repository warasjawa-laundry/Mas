import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',outputDir:'../test-results/report-period-run',testMatch:'report-period.ui.spec.ts',workers:1,retries:0,reporter:'list',use:{browserName:'chromium',screenshot:'only-on-failure'}});
