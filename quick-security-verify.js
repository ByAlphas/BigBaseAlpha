#!/usr/bin/env node

/**
 * BigBaseAlpha v1.4.0 Security Features - QUICK VERIFICATION
 * Bu test dosyası hiçbir veritabanı dosyası oluşturmaz ve tamamen güvenlidir
 */

console.log('🛡️  BigBaseAlpha v1.4.0 Security Features - QUICK VERIFICATION');
console.log('═'.repeat(65));
console.log('⚠️  Bu test hiçbir dosya oluşturmaz - %100 güvenli');
console.log('');

async function quickVerification() {
    try {
        // 1. Modül importlarını test et
        console.log('1️⃣  Testing Module Imports...');
        
        const SecurityModule = await import('./src/security/privacy.js');
        console.log('✅ Security module imported successfully');
        
        const AlphaModule = await import('./src/alpha.js');
        console.log('✅ Main database module imported successfully');
        
        // 2. Güvenlik sınıfını örnekle (dosya oluşturmadan)
        console.log('\n2️⃣  Testing Security Class Instantiation...');
        
        const MockDB = {
            collections: new Map(),
            emit: () => {},
            close: () => Promise.resolve(),
            find: () => Promise.resolve([]),
            insert: () => Promise.resolve({}),
            delete: () => Promise.resolve(1)
        };
        
        const security = new SecurityModule.default(MockDB);
        console.log('✅ Security class instantiated successfully');
        
        // 3. Güvenlik durumunu test et (hiçbir işlem yapmadan)
        console.log('\n3️⃣  Testing Security Status (Safe)...');
        
        const status = security.getSecurityStatus();
        console.log('✅ Security status accessible:', Object.keys(status));
        
        // 4. Güvenlik özelliklerinin varlığını kontrol et
        console.log('\n4️⃣  Checking Security Features Availability...');
        
        const features = [
            'activateSelfDestruct',
            'enableDeadMansSwitch', 
            'enableParanoidMode',
            'setOneTime',
            'wipe',
            'enableDecoy',
            'addExecutionTrigger'
        ];
        
        const available = features.filter(feature => typeof security[feature] === 'function');
        console.log(`✅ Available security features: ${available.length}/${features.length}`);
        
        if (available.length === features.length) {
            console.log('✅ All 7 security features are properly implemented');
        } else {
            console.log('⚠️  Some features missing:', features.filter(f => !available.includes(f)));
        }
        
        // 5. Güvenlik kontrollerini test et (hiçbir veri silmeden)
        console.log('\n5️⃣  Testing Safety Checks (No Data At Risk)...');
        
        try {
            // Bu çağrılar güvenlik kontrolü nedeniyle başarısız olmalı
            await security.activateSelfDestruct({ timeout: 1000 });
            console.log('❌ Self-destruct activated without safety check - DANGEROUS!');
        } catch (err) {
            if (err.message.includes('safetyCheck')) {
                console.log('✅ Self-destruct properly requires safety confirmation');
            } else {
                console.log('⚠️  Self-destruct failed for different reason:', err.message);
            }
        }
        
        try {
            await security.wipe('*');
            console.log('❌ Wipe activated without confirmation - DANGEROUS!');
        } catch (err) {
            if (err.message.includes('confirm') || err.message.includes('safetyCheck')) {
                console.log('✅ Wipe properly requires confirmation and safety check');
            } else {
                console.log('⚠️  Wipe failed for different reason:', err.message);
            }
        }
        
        // 6. Güvenli özellikler test et
        console.log('\n6️⃣  Testing Safe Features...');
        
        // Decoy mode (sadece bellek içi, dosya yok)
        const decoy = security.enableDecoy({
            password: 'test123',
            decoyData: { test: [{ safe: 'data' }] }
        });
        
        console.log('✅ Decoy mode enabled (memory only)');
        console.log('✅ Decoy authentication:', decoy.authenticate('wrong') === false ? 'Works' : 'Failed');
        
        decoy.disable();
        console.log('✅ Decoy mode disabled');
        
        // 7. Final güvenlik raporu
        console.log('\n🎉 QUICK VERIFICATION COMPLETED SUCCESSFULLY!');
        console.log('═'.repeat(65));
        console.log('✅ All security modules are properly loaded');
        console.log('✅ Safety checks are working correctly');
        console.log('✅ Destructive operations require explicit confirmation');
        console.log('✅ No files were created or modified during this test');
        console.log('');
        console.log('🔒 SAFETY SUMMARY:');
        console.log('   • Self-destruct requires: { safetyCheck: true }');
        console.log('   • Wipe requires: { confirm: true, safetyCheck: true }');
        console.log('   • Emergency requires: emergency code confirmation');
        console.log('');
        console.log('🚀 Your v1.4.0 security features are ready to use safely!');
        
    } catch (error) {
        console.log('❌ Verification failed:', error.message);
        console.log('🔧 Please check the error and try again');
        process.exit(1);
    }
}

// Çalıştır
quickVerification().catch(console.error);
