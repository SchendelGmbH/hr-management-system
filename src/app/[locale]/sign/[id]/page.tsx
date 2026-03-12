import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { SignatureClient } from './SignatureClient';

interface SignPageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

export async function generateMetadata({ params }: SignPageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'de' ? 'Dokument signieren' : 'Sign Document',
  };
}

export default async function SignPage({ params }: SignPageProps) {
  const session = await auth();
  const { id: requestId } = await params;

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h1 className="text-xl font-semibold mb-4">Anmeldung erforderlich</h1>
          <p className="text-gray-600">Bitte melden Sie sich an, um Dokumente zu signieren.</p>
        </div>
      </div>
    );
  }

  // Lade Signatur-Anfrage
  const request = await prisma.documentSignatureRequest.findUnique({
    where: { id: requestId },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          fileName: true,
          filePath: true,
          mimeType: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          username: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
      signatures: {
        include: {
          signer: {
            select: {
              id: true,
              username: true,
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!request) {
    notFound();
  }

  // Prüfe, ob User berechtigt ist
  const isCreator = request.createdById === session.user.id;
  const isParticipant = request.participants.some(p => p.userId === session.user.id);

  if (!isCreator && !isParticipant && session.user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h1 className="text-xl font-semibold mb-4">Zugriff verweigert</h1>
          <p className="text-gray-600">Sie haben keine Berechtigung, dieses Dokument zu signieren.</p>
        </div>
      </div>
    );
  }

  return <SignatureClient request={request} />;
}
