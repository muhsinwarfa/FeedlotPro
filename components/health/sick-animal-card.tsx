'use client';

// ─── Sick Animal Card — P6 Health Page ───────────────────────────────────────
// Displays a sick animal's health summary and provides inline action forms.

import { useState } from 'react';
import Link from 'next/link';
import type { WorkerRole } from '@/lib/worker-session';
import { checkPermission, ACTION } from '@/lib/rbac';
import { TreatmentForm } from './treatment-form';
import { HealthOutcomeForm } from './health-outcome-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

type SeverityBadge = 'MILD' | 'MODERATE' | 'SEVERE' | null;

interface SickAnimalCardProps {
  animalId: string;
  organizationId: string;
  memberId: string | null;
  role: WorkerRole;
  tagId: string;
  breed: string;
  penName: string;
  primarySymptom: string | null;
  severity: SeverityBadge;
  sickSince: string | null;
  latestMedication: string | null;
}

function severityConfig(severity: SeverityBadge) {
  switch (severity) {
    case 'SEVERE':
      return { label: 'Severe', className: 'bg-red-100 text-red-700 border-red-200' };
    case 'MODERATE':
      return { label: 'Moderate', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'MILD':
      return { label: 'Mild', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    default:
      return { label: 'Unknown', className: 'bg-slate-100 text-slate-500 border-slate-200' };
  }
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function SickAnimalCard({
  animalId,
  organizationId,
  memberId,
  role,
  tagId,
  breed,
  penName,
  primarySymptom,
  severity,
  sickSince,
  latestMedication,
}: SickAnimalCardProps) {
  const [showTreatment, setShowTreatment] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);

  const sc = severityConfig(severity);
  const days = daysSince(sickSince);
  const canTreat = checkPermission(role, ACTION.VET_TREATMENT);
  const canResolve = checkPermission(role, ACTION.HEALTH_OUTCOME);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-emerald-900">{tagId}</span>
            <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
          </div>
          <p className="text-sm text-slate-600">{breed} · {penName}</p>
        </div>
        <Link
          href={`/inventory/${animalId}`}
          className="flex items-center gap-1 text-xs text-emerald-700 hover:underline shrink-0"
        >
          View <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Details */}
      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
        {primarySymptom && (
          <span>
            <span className="font-medium">Symptom:</span> {primarySymptom}
          </span>
        )}
        {days !== null && (
          <span>
            <span className="font-medium">Sick for:</span>{' '}
            <span className={days >= 5 ? 'text-red-600 font-semibold' : ''}>{days}d</span>
          </span>
        )}
        {latestMedication && (
          <span>
            <span className="font-medium">Last Rx:</span> {latestMedication}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {canTreat && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] text-blue-700 border-blue-200 hover:bg-blue-50"
            onClick={() => { setShowTreatment((v) => !v); setShowOutcome(false); }}
          >
            {showTreatment ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            Record Treatment
          </Button>
        )}
        {canResolve && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            onClick={() => { setShowOutcome((v) => !v); setShowTreatment(false); }}
          >
            {showOutcome ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            Resolve
          </Button>
        )}
      </div>

      {/* Inline forms */}
      {showTreatment && (
        <TreatmentForm
          animalId={animalId}
          organizationId={organizationId}
          memberId={memberId}
          role={role}
          onSuccess={() => setShowTreatment(false)}
        />
      )}
      {showOutcome && (
        <HealthOutcomeForm
          animalId={animalId}
          organizationId={organizationId}
          memberId={memberId}
          role={role}
          onSuccess={() => setShowOutcome(false)}
        />
      )}
    </div>
  );
}
