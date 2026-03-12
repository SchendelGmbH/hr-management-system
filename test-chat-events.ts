/**
 * Test-Skript für Chat EventBus Integration
 * 
 * Run: npx tsx test-chat-events.ts
 */

import { eventBus } from './src/lib/events/EventBus';
import { initializeChatEventHandlers } from './src/lib/events/handlers/chatEvents';

console.log('🧪 Teste Chat EventBus Integration...\n');

// Initialize handlers
initializeChatEventHandlers();

// Test event
const testEmployee = {
  employeeId: 'test-emp-001',
  employeeNumber: 'EMP-99999',
  firstName: 'Max',
  lastName: 'Mustermann',
  email: 'max.mustermann@example.com',
  departmentId: null,
  createdBy: 'admin-user-id',
};

console.log('📤 Emitting hr.employee.created event...');
eventBus.emit('hr.employee.created', testEmployee);

// Wait a bit then check
setTimeout(() => {
  console.log('\n📜 Event History:');
  const history = eventBus.getHistory('hr.employee.created');
  console.log(JSON.stringify(history, null, 2));
  
  console.log('\n✅ Test complete!');
  process.exit(0);
}, 2000);