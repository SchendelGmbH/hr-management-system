import { Metadata } from 'next';
import { ChatView } from './ChatView';

export const metadata: Metadata = {
  title: 'Chat | HR Management',
  description: 'Interner Chat für Team-Kommunikation',
};

export default function ChatPage() {
  return <ChatView />;
}
