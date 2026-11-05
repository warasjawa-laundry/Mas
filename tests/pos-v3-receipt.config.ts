import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'pos-v3-receipt.ui.spec.ts',workers:1,retries:0,reporter:'list',use:{browserName:'chromium',screenshot:'only-on-failure'}});
