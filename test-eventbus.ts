// Test für EventBus
import { eventBus } from './src/lib/events/EventBus';

console.log('=== EventBus Test ===\n');

let receivedCount = 0;
let testPassed = true;

// Subscriber registrieren
const unsubscribe = eventBus.subscribe(
  'test.employee.created',
  (event) => {
    receivedCount++;
    console.log('✅ Event empfangen!');
    console.log('   Typ:', event.type);
    console.log('   Payload:', JSON.stringify(event.payload, null, 2));
    console.log('   Zeit:', new Date(event.timestamp).toLocaleTimeString());
  }
);

console.log('1. ✅ Subscriber registriert\n');

// Event senden
eventBus.emit('test.employee.created', {
  employeeId: 'EMP-001',
  name: 'Max Mustermann',
  department: 'Produktion'
});

console.log('2. 📤 Event gesendet\n');

// Kurze Pause für Async
setTimeout(() => {
  console.log('3. 📊 Ergebnis:');
  console.log('   Empfangene Events:', receivedCount);
  console.log('   History Größe:', eventBus.getHistory().length);
  
  // Test validieren
  if (receivedCount === 1) {
    console.log('   ✅ TEST BESTANDEN: Event wurde empfangen');
  } else {
    console.log('   ❌ TEST FEHLGESCHLAGEN: Event wurde nicht empfangen');
    testPassed = false;
  }
  
  // Aufräumen
  unsubscribe();
  console.log('\n4. ✅ Subscriber entfernt');
  console.log('\n=== Test abgeschlossen ===');
  
  process.exit(testPassed ? 0 : 1);
}, 100);
