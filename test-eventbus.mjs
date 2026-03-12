// Simples Test-Skript für EventBus
import { eventBus } from './dist/lib/events/EventBus.js';

console.log('=== EventBus Test ===\n');

// Count für empfangene Events
let receivedCount = 0;

// Subscriber registrieren
const unsubscribe = eventBus.subscribe(
  'test.employee.created', 
  (event) => {
    receivedCount++;
    console.log('✅ Event empfangen!');
    console.log('   Typ:', event.type);
    console.log('   Payload:', JSON.stringify(event.payload, null, 2));
    console.log('   Zeit:', new Date(event.timestamp).toLocaleTimeString());
    console.log();
  }
);

console.log('1. ✅ Subscriber registriert');
console.log('   Lauscht auf: "test.employee.created"\n');

// Event senden
console.log('2. 📤 Sende Event...');
eventBus.emit('test.employee.created', {
  employeeId: 'EMP-001',
  name: 'Max Mustermann',
  department: 'Produktion'
});

console.log('3. 📨 Event gesendet\n');

// Kurze Pause für Async-Handling
setTimeout(() => {
  console.log('4. 📊 Ergebnis:');
  console.log('   Empfangene Events:', receivedCount);
  console.log('   History Größe:', eventBus.getHistory().length);
  
  // Aufräumen
  unsubscribe();
  console.log('\n5. ✅ Subscriber entfernt');
  console.log('\n=== Test abgeschlossen ===');
}, 100);
