import 'dotenv/config';
import { PlaywrightProvider } from './browser/PlaywrightProvider.js';
import { FormIntelligence } from './intelligence/FormIntelligence.js';
import { ProviderVault, CompanyProfile, ProviderCredentials } from './vault/ProviderVault.js';
import { ProviderGenerator } from './generators/ProviderGenerator.js';
import { CertificationRunner } from './tests/CertificationRunner.js';
import { WorkflowBridge } from './WorkflowBridge.js';
import { DocumentationIntelligence } from './docs/DocumentationIntelligence.js';
import { ManifestManager } from './manifests/ManifestManager.js';
import { KnowledgeStore, ProviderKnowledge } from './knowledge/KnowledgeStore.js';
import fs from 'fs/promises';

export async function onboardProvider(providerName: string, portalUrl: string) {
  console.log(`Starting V1 onboarding for: ${providerName}`);

  const vault = new ProviderVault();
  await vault.init();

  const knowledgeStore = new KnowledgeStore();
  await knowledgeStore.init();

  const manifestManager = new ManifestManager();
  const docsIntelligence = new DocumentationIntelligence(process.env.GEMINI_API_KEY);

  let profile = await vault.getCompanyProfile();
  if (!profile) {
    console.log('No CHATR Company Profile found. Creating default...');
    profile = {
      companyName: 'CHATR AI',
      legalName: 'CHATR AI Inc.',
      address: '123 AI Street, Silicon Valley, CA',
      supportEmail: 'support@chatr.ai',
      developerEmail: 'dev@chatr.ai',
      website: 'https://chatr.ai',
      privacyPolicy: 'https://chatr.ai/privacy',
      terms: 'https://chatr.ai/terms',
      supportPhone: '+1-800-555-CHAT'
    };
    await vault.saveCompanyProfile(profile);
  }

  // Lifecycle state: DISCOVERED
  let currentState = 'DISCOVERED';
  console.log(`[Lifecycle] State: ${currentState}`);

  // Step 1: Documentation Intelligence
  const docsInfo = await docsIntelligence.discover(portalUrl);
  console.log(`[Docs] Found OpenAPI: ${docsInfo.hasOpenApi}, SDKs: ${docsInfo.sdkLanguages.join(', ')}`);
  
  // Save to Knowledge Base
  const knowledge: ProviderKnowledge = {
    providerName,
    authenticationMethod: docsInfo.hasOpenApi ? 'api_key' : 'oauth2',
    oauthFlow: docsInfo.oauthDocsUrl ? 'authorization_code' : undefined,
    sandboxUrl: docsInfo.baseUrls.sandbox,
    productionUrl: docsInfo.baseUrls.production,
    lastVerifiedDate: new Date().toISOString()
  };
  await knowledgeStore.saveKnowledge(knowledge);

  const browser = new PlaywrightProvider(process.env.GEMINI_API_KEY);
  const intelligence = new FormIntelligence(process.env.GEMINI_API_KEY);
  const workflow = new WorkflowBridge();

  try {
    // Lifecycle state: REGISTERED (Attempting)
    currentState = 'REGISTERED';
    console.log(`[Lifecycle] Transitioning to: ${currentState}`);
    
    await browser.open(portalUrl);
    await new Promise(r => setTimeout(r, 2000));
    
    const fields = await browser.detectForm();
    const formData = await intelligence.matchFields(fields, profile);
    await browser.fill(formData);

    const otp = await workflow.requestOtpFromChatr(providerName, 'OTP verification required.');
    await browser.fill({ 'otp': otp });
    
    // Lifecycle state: ONBOARDED
    currentState = 'ONBOARDED';
    console.log(`[Lifecycle] Transitioning to: ${currentState}`);

    const mockExtractedKeys = {
      sandboxKeys: {
        apiKey: `sk_test_${Math.random().toString(36).substring(7)}`,
        apiSecret: `secret_test_${Math.random().toString(36).substring(7)}`
      },
      productionKeys: {}
    };

    const creds: ProviderCredentials = {
      providerName,
      lifecycleState: 'ONBOARDED',
      sandboxKeys: mockExtractedKeys.sandboxKeys,
      productionKeys: mockExtractedKeys.productionKeys,
      status: 'active'
    };
    
    // Secret Scanner will validate this inside saveProviderCredentials
    await vault.saveProviderCredentials(creds);

    // Lifecycle state: GENERATED
    currentState = 'GENERATED';
    console.log(`[Lifecycle] Transitioning to: ${currentState}`);
    
    const generator = new ProviderGenerator();
    const providerDir = await generator.generate(creds);
    
    // Generate YAML Manifest
    const manifestYaml = await manifestManager.generateManifest(providerName.toLowerCase(), {
      capabilities: ['discover', 'execute']
    });
    await manifestManager.saveManifest(providerName.toLowerCase(), manifestYaml, providerDir);

    // Lifecycle state: CERTIFIED
    currentState = 'CERTIFIED';
    console.log(`[Lifecycle] Transitioning to: ${currentState}`);
    
    const certRunner = new CertificationRunner();
    const certResult = await certRunner.runCertification(creds);
    
    if (certResult.passed) {
      // Lifecycle state: ACTIVE
      currentState = 'ACTIVE';
      console.log(`[Lifecycle] Transitioning to: ${currentState}`);
      console.log(`✅ Provider ${providerName} is Active and ready for production!`);
      
      // Update Vault with final state
      creds.lifecycleState = 'ACTIVE';
      await vault.saveProviderCredentials(creds);
    } else {
      console.log(`❌ Provider ${providerName} Certification Failed.`);
      console.error(certResult.errors);
    }

  } catch (error: any) {
    console.error('Onboarding failed:', error);
    if (error?.message?.includes('[MANUAL_REVIEW]')) {
      throw error;
    }
  } finally {
    await browser.close();
  }
}

import { fileURLToPath } from 'url';

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const provider = process.argv[2] || 'Cashfree';
  const url = process.argv[3] || 'https://example.com/developer/signup';
  
  onboardProvider(provider, url).catch(console.error);
}
