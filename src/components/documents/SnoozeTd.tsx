'use client';

import SnoozeDropdown from './SnoozeDropdown';

export default function SnoozeTd({ docId, isSnoozed }: { docId: string; isSnoozed?: boolean }) {
  return (
    <td
      className="whitespace-nowrap px-4 py-4 text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <SnoozeDropdown docId={docId} isSnoozed={isSnoozed} />
    </td>
  );
}
