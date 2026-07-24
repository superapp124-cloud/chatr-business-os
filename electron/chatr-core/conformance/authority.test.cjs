
const AuthorityManager = require('../kernel/authority-manager.cjs');

describe('AUTHORITY_SPEC_v1 Conformance', () => {
    describe('Policy Modification', () => {
        it('Allows User to modify Policy', () => {
            expect(() => {
                AuthorityManager.verifyAction('Policy', 'Modify', 'User');
            }).not.toThrow();
        });

        it('Forbids Kernel from modifying Policy (Privilege Escalation)', () => {
            expect(() => {
                AuthorityManager.verifyAction('Policy', 'Modify', 'Kernel');
            }).toThrow('AUTHORITY_VIOLATION: Kernel cannot perform Modify on Policy');
        });

        it('Forbids Learning Runtime from modifying Policy', () => {
            expect(() => {
                AuthorityManager.verifyAction('Policy', 'Modify', 'LearningRuntime');
            }).toThrow('AUTHORITY_VIOLATION: LearningRuntime cannot perform Modify on Policy');
        });
    });

    describe('Execution Authorization', () => {
        it('Allows Kernel to trigger Execution', () => {
            expect(() => {
                AuthorityManager.verifyAction('Execution', 'Trigger', 'Kernel');
            }).not.toThrow();
        });
    });
});
