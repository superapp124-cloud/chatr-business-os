
const { certifyManifest, certifyImplementation } = require('./certify-capability.cjs');
const fs = require('fs');
const path = require('path');

describe('CAPABILITY CERTIFICATION SDK', () => {
    describe('Manifest Certification', () => {
        const dummyPath = path.join(__dirname, 'dummy.yaml');
        const invalidPath = path.join(__dirname, 'invalid.yaml');

        it('Certifies a valid capability manifest', () => {
            fs.writeFileSync(dummyPath, `
id: travel.hotel.booking
version: 1.0
intent_types:
  - travel.hotel.booking
verification:
  strategy: email_receipt
  evidence: 
    - receipt
    - provider_confirmation
  timeout: PT24H
  retries: 2
  success: ride.completed
  failure: ride.verification_failed
required_policies:
  - budget
events:
  - execution.started
`);
            expect(() => {
                certifyManifest(dummyPath);
            }).not.toThrow();
            fs.unlinkSync(dummyPath);
        });

        it('Rejects a manifest missing intent_types', () => {
             fs.writeFileSync(invalidPath, `
id: travel.hotel.booking
version: 1.0
verification:
  strategy: email_receipt
  evidence: [receipt]
  success: ride.completed
  failure: ride.verification_failed
`);
            expect(() => {
                certifyManifest(invalidPath);
            }).toThrow('MANIFEST_VIOLATION: Missing required field "intent_types"');
            fs.unlinkSync(invalidPath);
        });
        
        it('Rejects a manifest with missing verification strategy', () => {
            fs.writeFileSync(invalidPath, `
id: travel.hotel.booking
version: 1.0
intent_types:
  - travel.hotel.booking
verification:
  evidence: [receipt]
  success: ride.completed
  failure: ride.verification_failed
`);
            expect(() => {
                certifyManifest(invalidPath);
            }).toThrow('MANIFEST_VIOLATION: Missing required verification field "strategy"');
            fs.unlinkSync(invalidPath);
        });
    });
});
