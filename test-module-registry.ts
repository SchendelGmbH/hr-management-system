// Test für ModuleRegistry
import { moduleRegistry, ModuleStatus } from './src/lib/modules/ModuleRegistry';

console.log('=== ModuleRegistry Test ===\n');

// Simulierte Module
const testModules = [
  {
    id: 'hr-core',
    name: 'HR Core',
    version: '1.0.0',
    tier: 'hr' as const,
    dependencies: [],
    navigation: []
  },
  {
    id: 'chat',
    name: 'Chat',
    version: '1.0.0',
    tier: 'chat' as const,
    dependencies: ['hr-core'],
    navigation: []
  }
];

console.log('1. Registriere Module...');

for (const mod of testModules) {
  moduleRegistry.register(mod);
  console.log(`   ✅ ${mod.name} registriert`);
}

console.log('\n2. Modul-Liste:');
const allModules = moduleRegistry.getAll();
console.log(`   Anzahl: ${allModules.length}`);

console.log('\n3. Aktiviere Module...');
for (const mod of testModules) {
  try {
    moduleRegistry.activate(mod.id);
    console.log(`   ✅ ${mod.id} aktiviert`);
  } catch (error) {
    console.log(`   ❌ ${mod.id} Fehler:`, (error as Error).message);
  }
}

console.log('\n4. Aktive Module:');
const activeModules = moduleRegistry.getActiveModules();
console.log(`   Anzahl: ${activeModules.length}`);
activeModules.forEach(m => {
  console.log(`   - ${m.id}: ${m.status}`);
});

console.log('\n5. Prüfe Dependency:');
const chatModule = moduleRegistry.get('chat');
if (chatModule) {
  console.log(`   Chat Abhängigkeiten: ${chatModule.dependencies?.join(', ') || 'keine'}`);
  
  // Prüfe ob hr-core geladen
  const hrCore = moduleRegistry.get('hr-core');
  console.log(`   HR-Core Status: ${hrCore?.status || 'nicht gefunden'}`);
}

console.log('\n6. Deaktiviere Module...');
for (const mod of testModules) {
  try {
    moduleRegistry.deactivate(mod.id);
    console.log(`   ✅ ${mod.id} deaktiviert`);
  } catch (error) {
    console.log(`   ❌ ${mod.id} Fehler:`, (error as Error).message);
  }
}

console.log('\n=== Test abgeschlossen ===');

// Ergebnis
const success = activeModules.length >= 1;
process.exit(success ? 0 : 1);
