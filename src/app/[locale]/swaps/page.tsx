"use client";

import { Suspense } from "react";
import { ArrowRightLeft, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { useSession } from "next-auth/react";

function SwapRequestsContent() {
  const { data: session } = useSession();

  // Platzhalter - würde normalerweise Daten von API laden
  const stats = {
    pending: 2,
    approved: 5,
    rejected: 1,
    total: 8,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Schicht-Tausch
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Verwalte deine Tauschanfragen und Antworten
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Aktualisieren</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ausstehend</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Genehmigt</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.approved}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Abgelehnt</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.rejected}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gesamt</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex items-start space-x-3">
          <ArrowRightLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-200">
              Schicht-Tausch Modul
            </h3>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              Diese Seite ist bereit für die Integration mit ShiftSwapRequestsOverview.
              Die volle Funktionalität wird über den Kalender oder Mein Dienstplan aufgerufen.
            </p>
            <div className="mt-3 space-x-3">
              <a
                href="/de/calendar"
                className="inline-flex items-center space-x-1 text-sm font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300"
              >
                <span>Zum Kalender</span>
                <ArrowRightLeft className="h-3 w-3" />
              </a>
              <a
                href="/de/my-schedule"
                className="inline-flex items-center space-x-1 text-sm font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300"
              >
                <span>Zu meinem Dienstplan</span>
                <ArrowRightLeft className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder for future SwapRequestsOverview integration */}
      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
          <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-700">
            <ArrowRightLeft className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Tauschanfragen-Übersicht
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Die vollständige Übersicht wird über den Kalender oder deinen persönlichen
              Dienstplan aufgerufen. Hier entsteht in Zukunft ein Dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SwapsPage() {
  return (
    <div className="p-6">
      <Suspense fallback={
        <div className="flex h-96 items-center justify-center">
          <div className="flex items-center space-x-2 text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Lade...</span>
          </div>
        </div>
      }>
        <SwapRequestsContent />
      </Suspense>
    </div>
  );
}
