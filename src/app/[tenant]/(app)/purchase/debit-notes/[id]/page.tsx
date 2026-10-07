'use client';
import { useParams } from 'next/navigation';
import { NoteView } from '@/components/notes/NoteView';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <NoteView kind="debit" id={id} />;
}
