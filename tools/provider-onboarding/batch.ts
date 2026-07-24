import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { ProviderDiscovery } from './discovery/ProviderDiscovery.js';
import { onboardProvider } from './onboard.js';
import { ReportGenerator } from './reports/ReportGenerator.js';

interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  priority: string;
  developerPortal: string | null;
  documentation: string | null;
  signup: string | null;
}

interface StateEntry {
  lifecycleState: string;
  hasOpenAPI: boolean;
  hasOAuth: boolean;
}

async function runBatch() {
  const catalogPath = path.join(process.cwd(), 'tools/provider-onboarding/providers/catalog.json');
  const statePath = path.join(process.cwd(), 'tools/provider-onboarding/providers/state.json');

  let catalog: CatalogEntry[] = [];
  let stateMap: Record<string, StateEntry> = {};

  try {
    catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  } catch (error) {
    console.error(`Failed to load catalog at ${catalogPath}.`);
    process.exit(1);
  }

  try {
    stateMap = JSON.parse(await fs.readFile(statePath, 'utf8'));
  } catch (error) {
    // Missing state file is fine, we will create it
  }

  const discovery = new ProviderDiscovery(process.env.GEMINI_API_KEY);

  console.log(`Loaded ${catalog.length} providers from catalog.`);

  for (let i = 0; i < catalog.length; i++) {
    const p = catalog[i];
    console.log(`\n======================================================`);
    console.log(`[Batch ${i + 1}/${catalog.length}] Starting V2 Pipeline for: ${p.name} (${p.priority})`);
    console.log(`======================================================\n`);
    
    // 1. Discovery Phase
    if (!p.developerPortal || !p.signup) {
      const discovered = await discovery.discover(p.name);
      p.developerPortal = discovered.developerPortal || null;
      p.signup = discovered.signup || null;
      p.documentation = discovered.documentation || null;
      
      // Save catalog updates
      await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));

      // Initial state
      stateMap[p.id] = {
        lifecycleState: 'DISCOVERED',
        hasOpenAPI: !!discovered.openApiUrl,
        hasOAuth: !!discovered.oauthDocsUrl
      };
      await fs.writeFile(statePath, JSON.stringify(stateMap, null, 2));
    }

    if (!p.signup) {
      console.log(`[Batch] Discovery failed to find signup URL for ${p.name}. Skipping onboarding.`);
      continue;
    }

    // 2. Onboarding Phase
    try {
      // onboardProvider will need to return or throw states, but for batch integration:
      await onboardProvider(p.name, p.signup);
      
      // Assuming it reached active
      stateMap[p.id].lifecycleState = 'ACTIVE';
    } catch (e: any) {
      if (e.message && e.message.includes('[MANUAL_REVIEW]')) {
        console.warn(`[Batch] ${p.name} requires Manual Review (KYC/Agreements). Pausing automation.`);
        stateMap[p.id].lifecycleState = 'MANUAL_REVIEW';
      } else {
        console.error(`[Batch] Failed to onboard ${p.name}:`, e);
      }
    }

    // Save state updates
    await fs.writeFile(statePath, JSON.stringify(stateMap, null, 2));
  }

  // 3. Generate Dashboard Report
  const reporter = new ReportGenerator();
  await reporter.generateReport(catalogPath, statePath);
}

runBatch().catch(console.error);
