import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirect to German locale (default)
  redirect('/de');
}
