import React, { useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  FileText,
} from 'lucide-react';

interface SpecificationProgress {
  specCode: string;
  specTitle: string;
  status: 'not_started' | 'in_progress' | 'complete' | 'submitted' | 'validated';
  validationStatus?: 'pending' | 'pass' | 'fail';
}

interface StandardProgress {
  standardCode: string;
  standardTitle: string;
  status: 'not_started' | 'in_progress' | 'complete' | 'submitted' | 'validated';
  specifications: SpecificationProgress[];
}

interface StandardsNavigationProps {
  standards: StandardProgress[];
  selectedStandard: string;
  selectedSpec: string | null;
  onSelectStandard: (standardCode: string) => void;
  onSelectSpec: (standardCode: string, specCode: string) => void;
}

/**
 * Left sidebar navigation showing standards and specifications with progress indicators
 */
export function StandardsNavigation({
  standards,
  selectedStandard,
  selectedSpec,
  onSelectStandard,
  onSelectSpec,
}: StandardsNavigationProps) {
  // Group standards by part
  const groupedStandards = useMemo(() => {
    const partI = standards.filter((s) => parseInt(s.standardCode) <= 10);
    const partII = standards.filter((s) => parseInt(s.standardCode) > 10);
    return { partI, partII };
  }, [standards]);

  return (
    <nav className="standards-nav h-full bg-white border-r border-gray-200 overflow-y-auto">
      {/* Part I: General Standards */}
      <div className="p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Part I: General Standards
        </h3>
        <div className="space-y-1">
          {groupedStandards.partI.map((standard) => (
            <StandardItem
              key={standard.standardCode}
              standard={standard}
              isSelected={selectedStandard === standard.standardCode}
              selectedSpec={
                selectedStandard === standard.standardCode ? selectedSpec : null
              }
              onSelectStandard={onSelectStandard}
              onSelectSpec={onSelectSpec}
            />
          ))}
        </div>
      </div>

      {/* Part II: Curriculum Standards */}
      <div className="p-4 border-t border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Part II: Curriculum Standards
        </h3>
        <div className="space-y-1">
          {groupedStandards.partII.map((standard) => (
            <StandardItem
              key={standard.standardCode}
              standard={standard}
              isSelected={selectedStandard === standard.standardCode}
              selectedSpec={
                selectedStandard === standard.standardCode ? selectedSpec : null
              }
              onSelectStandard={onSelectStandard}
              onSelectSpec={onSelectSpec}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

// Individual Standard Item with expandable specs
interface StandardItemProps {
  standard: StandardProgress;
  isSelected: boolean;
  selectedSpec: string | null;
  onSelectStandard: (standardCode: string) => void;
  onSelectSpec: (standardCode: string, specCode: string) => void;
}

function StandardItem({
  standard,
  isSelected,
  selectedSpec,
  onSelectStandard,
  onSelectSpec,
}: StandardItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(isSelected);

  // Expand when selected
  React.useEffect(() => {
    if (isSelected) {
      setIsExpanded(true);
    }
  }, [isSelected]);

  const completedSpecs = standard.specifications.filter(
    (s) => s.status === 'complete' || s.status === 'submitted' || s.status === 'validated'
  ).length;
  const totalSpecs = standard.specifications.length;
  const progressPercent = totalSpecs > 0 ? Math.round((completedSpecs / totalSpecs) * 100) : 0;

  return (
    <div className="standard-item">
      {/* Standard Header */}
      <button
        onClick={() => {
          onSelectStandard(standard.standardCode);
          setIsExpanded(!isExpanded);
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
          isSelected
            ? 'bg-teal-50 text-teal-800 border border-teal-200'
            : 'hover:bg-gray-100 text-gray-700'
        }`}
      >
        {/* Expand/Collapse Icon */}
        {standard.specifications.length > 0 ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )
        ) : (
          <FileText className="w-4 h-4 flex-shrink-0 text-gray-400" />
        )}

        {/* Status Icon */}
        <StatusIcon status={standard.status} />

        {/* Standard Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              Standard {standard.standardCode}
            </span>
            {totalSpecs > 0 && (
              <span className="text-xs text-gray-500">
                {completedSpecs}/{totalSpecs}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{standard.standardTitle}</p>
        </div>
      </button>

      {/* Progress Bar */}
      {totalSpecs > 0 && isExpanded && (
        <div className="mx-3 mt-1 mb-2">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Specifications List */}
      {isExpanded && standard.specifications.length > 0 && (
        <div className="ml-4 pl-4 border-l-2 border-gray-200 space-y-1 pb-2">
          {standard.specifications.map((spec) => (
            <SpecificationItem
              key={spec.specCode}
              spec={spec}
              standardCode={standard.standardCode}
              isSelected={selectedSpec === spec.specCode}
              onClick={() => onSelectSpec(standard.standardCode, spec.specCode)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Specification Item
interface SpecificationItemProps {
  spec: SpecificationProgress;
  standardCode: string;
  isSelected: boolean;
  onClick: () => void;
}

function SpecificationItem({
  spec,
  standardCode,
  isSelected,
  onClick,
}: SpecificationItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-left text-sm transition-colors ${
        isSelected
          ? 'bg-teal-100 text-teal-800'
          : 'hover:bg-gray-50 text-gray-600'
      }`}
    >
      {/* Status Icon */}
      <StatusIcon status={spec.status} size="sm" validationStatus={spec.validationStatus} />

      {/* Spec Label */}
      <span className="flex-1 truncate">
        {standardCode}.{spec.specCode} - {spec.specTitle}
      </span>
    </button>
  );
}

// Status Icon Component
interface StatusIconProps {
  status: 'not_started' | 'in_progress' | 'complete' | 'submitted' | 'validated';
  validationStatus?: 'pending' | 'pass' | 'fail';
  size?: 'sm' | 'md';
}

function StatusIcon({ status, validationStatus, size = 'md' }: StatusIconProps) {
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  // Check validation status first
  if (validationStatus === 'fail') {
    return <AlertCircle className={`${iconSize} text-red-500 flex-shrink-0`} />;
  }

  if (validationStatus === 'pass' || status === 'validated') {
    return <CheckCircle2 className={`${iconSize} text-green-500 flex-shrink-0`} />;
  }

  switch (status) {
    case 'complete':
    case 'submitted':
      return <CheckCircle2 className={`${iconSize} text-teal-500 flex-shrink-0`} />;
    case 'in_progress':
      return <Clock className={`${iconSize} text-amber-500 flex-shrink-0`} />;
    case 'not_started':
    default:
      return <Circle className={`${iconSize} text-gray-300 flex-shrink-0`} />;
  }
}

export default StandardsNavigation;
