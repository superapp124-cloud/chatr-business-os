import fs from 'fs/promises';
import path from 'path';

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
  lifecycleState: 'DISCOVERED' | 'SUPPORTED' | 'AUTO_ONBOARD' | 'MANUAL_REVIEW' | 'CERTIFIED' | 'ACTIVE';
  hasOpenAPI: boolean;
  hasOAuth: boolean;
}

export class ReportGenerator {
  async generateReport(catalogPath: string, statePath: string): Promise<void> {
    let catalog: CatalogEntry[] = [];
    let stateMap: Record<string, StateEntry> = {};

    try {
      catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
    } catch (e) {
      console.error('Failed to read catalog.json');
    }

    try {
      stateMap = JSON.parse(await fs.readFile(statePath, 'utf8'));
    } catch (e) {
      // It's ok if state is empty initially
    }

    const total = catalog.length;
    let portalsFound = 0;
    let docsFound = 0;
    let openAPI = 0;
    let oauth = 0;
    
    let autoOnboardReady = 0;
    let manualReview = 0;
    let certified = 0;
    let active = 0;

    for (const provider of catalog) {
      if (provider.developerPortal) portalsFound++;
      if (provider.documentation) docsFound++;

      const state = stateMap[provider.id];
      if (state) {
        if (state.hasOpenAPI) openAPI++;
        if (state.hasOAuth) oauth++;

        switch(state.lifecycleState) {
          case 'AUTO_ONBOARD': autoOnboardReady++; break;
          case 'MANUAL_REVIEW': manualReview++; break;
          case 'CERTIFIED': certified++; break;
          case 'ACTIVE': active++; break;
        }
      }
    }

    console.log(`\n======================================================`);
    console.log(`                READINESS REPORT`);
    console.log(`======================================================`);
    console.log(`Providers:             ${total}`);
    console.log(`Discovered:            ${total}`);
    console.log(`Developer Portal Found:${portalsFound}`);
    console.log(`Documentation Found:   ${docsFound}`);
    console.log(`Supports OpenAPI:      ${openAPI}`);
    console.log(`Supports OAuth:        ${oauth}`);
    console.log(`------------------------------------------------------`);
    console.log(`Auto Onboard Ready:    ${autoOnboardReady}`);
    console.log(`Manual Review:         ${manualReview}`);
    console.log(`Certified:             ${certified}`);
    console.log(`Production Ready:      ${active}`);
    console.log(`======================================================\n`);
  }
}
