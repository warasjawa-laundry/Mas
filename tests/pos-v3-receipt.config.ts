import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',outputDir:'../test-results/pos-v31-thermal-run',testMatch:'pos-v3-receipt.ui.spec.ts',workers:1,retries:0,reporter:'list',use:{browserName:'chromium',screenshot:'only-on-failure'}});
