import { kbGenerator } from '../services/kb-generator.service.js';
import { closeDb } from '../config/database.js';

async function runKBGenerate() {
    console.log('📝 Generating Markdown Knowledge Base from local Database...\n');

    try {
        const stats = await kbGenerator.generateAll();
        console.log(`\n🎉 Success! ${stats.leaguesCount} league families processed, ${stats.filesCount} markdown files created.`);
    } catch (error: any) {
        console.error('❌ KB Generation failed:', error);
    } finally {
        closeDb();
    }
}

runKBGenerate();
