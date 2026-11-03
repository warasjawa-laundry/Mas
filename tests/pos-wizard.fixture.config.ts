import {defineConfig} from '@playwright/test';

// This component fixture has no Next server, credentials, or external requests.
export default defineConfig({
 testDir:'.',testMatch:['pos-wizard.ui.spec.ts','pos-command-recovery.ui.spec.ts','recoverable-form.ui.spec.ts'],workers:1,retries:0,
 reporter:'list',use:{browserName:'chromium',trace:'retain-on-failure',screenshot:'only-on-failure'},
});
