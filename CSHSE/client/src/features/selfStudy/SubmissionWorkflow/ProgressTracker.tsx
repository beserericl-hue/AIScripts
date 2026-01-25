import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ProgressData {
  submissionId: string;
  totalStandards: number;
  completedStandards: number;
  submittedStandards: number;
  validatedStandards: number;
  failedStandards: number;
  progressPercent: number;
  validation: {
    passed: number;
    failed: number;
    pending: number;
  };
  standardsStatus: Record<string, {
    status: string;
    validationStatus?: string;
    submittedAt?: string;
  }>;
}

interface ProgressTrackerProps {
  submissionId: string;
  onStandardClick?: (standardCode: string) => void;
}

/**
 * Progress tracker showing overall completion status and validation results
 */
export function ProgressTracker({
  submissionId,
  onStandardClick,
}: ProgressTrackerProps) {
  const { data: progress, isLoading, refetch } = useQuery<ProgressData>({
    queryKey: ['submission-progress', submissionId],
    queryFn: async () => {
      const response = await axios.get(
        `${API_BASE}/submissions/${submissionId}/progress`
      );
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  // Group standards by part
  const partI = Array.from({ length: 10 }, (_, i) => (i + 1).toString());
  const partII = Array.from({ length: 11 }, (_, i) => (i + 11).toString());

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Submission Progress
          </h2>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Overall Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Overall Completion
            </span>
            <span className="text-sm font-semibold text-teal-600">
              {progress.progressPercent}%
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 transition-all duration-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-4 gap-4">
          <StatusCard
            label="Completed"
            count={progress.completedStandards}
            total={progress.totalStandards}
            color="teal"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatusCard
            label="Submitted"
            count={progress.submittedStandards}
            total={progress.totalStandards}
            color="blue"
            icon={<ArrowRight className="w-5 h-5" />}
          />
          <StatusCard
            label="Validated"
            count={progress.validatedStandards}
            total={progress.totalStandards}
            color="green"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatusCard
            label="Failed"
            count={progress.failedStandards}
            total={progress.totalStandards}
            color="red"
            icon={<AlertCircle className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Validation Summary */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Validation Status
        </h3>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-600">
              {progress.validation.passed} passed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm text-gray-600">
              {progress.validation.failed} failed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="text-sm text-gray-600">
              {progress.validation.pending} pending
            </span>
          </div>
        </div>
      </div>

      {/* Standards Grid */}
      <div className="p-6">
        {/* Part I */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Part I: General Standards (1-10)
          </h3>
          <div className="flex flex-wrap gap-2">
            {partI.map((code) => (
              <StandardBadge
                key={code}
                code={code}
                status={progress.standardsStatus[code]}
                onClick={() => onStandardClick?.(code)}
              />
            ))}
          </div>
        </div>

        {/* Part II */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Part II: Curriculum Standards (11-21)
          </h3>
          <div className="flex flex-wrap gap-2">
            {partII.map((code) => (
              <StandardBadge
                key={code}
                code={code}
                status={progress.standardsStatus[code]}
                onClick={() => onStandardClick?.(code)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 pb-6">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Circle className="w-3 h-3 text-gray-300" /> Not Started
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" /> In Progress
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-500" /> Complete
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" /> Validated
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-red-500" /> Failed
          </span>
        </div>
      </div>
    </div>
  );
}

// Status Card Component
interface StatusCardProps {
  label: string;
  count: number;
  total: number;
  color: 'teal' | 'blue' | 'green' | 'red';
  icon: React.ReactNode;
}

function StatusCard({ label, count, total, color, icon }: StatusCardProps) {
  const colorClasses = {
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">
        {count}
        <span className="text-sm font-normal">/{total}</span>
      </div>
    </div>
  );
}

// Standard Badge Component
interface StandardBadgeProps {
  code: string;
  status?: {
    status: string;
    validationStatus?: string;
  };
  onClick?: () => void;
}

function StandardBadge({ code, status, onClick }: StandardBadgeProps) {
  const getStatusClasses = () => {
    if (!status) {
      return 'bg-gray-100 text-gray-500 border-gray-200';
    }

    if (status.validationStatus === 'fail') {
      return 'bg-red-100 text-red-700 border-red-300';
    }

    switch (status.status) {
      case 'validated':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'submitted':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'complete':
        return 'bg-teal-100 text-teal-700 border-teal-300';
      case 'in_progress':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      default:
        return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    if (!status) {
      return <Circle className="w-3 h-3" />;
    }

    if (status.validationStatus === 'fail') {
      return <AlertCircle className="w-3 h-3" />;
    }

    switch (status.status) {
      case 'validated':
      case 'complete':
      case 'submitted':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'in_progress':
        return <Clock className="w-3 h-3" />;
      default:
        return <Circle className="w-3 h-3" />;
    }
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1 px-3 py-1.5 rounded-lg border
        text-sm font-medium transition-colors hover:opacity-80
        ${getStatusClasses()}
      `}
    >
      {getStatusIcon()}
      <span>{code}</span>
    </button>
  );
}

export default ProgressTracker;
