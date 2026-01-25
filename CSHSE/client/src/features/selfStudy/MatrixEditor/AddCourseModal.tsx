import React, { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';

interface CourseData {
  coursePrefix: string;
  courseNumber: string;
  courseName: string;
  credits: number;
}

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (course: CourseData) => Promise<void>;
  existingPrefixes?: string[];
}

/**
 * Modal for adding a new course column to the curriculum matrix
 */
export function AddCourseModal({
  isOpen,
  onClose,
  onAdd,
  existingPrefixes = [],
}: AddCourseModalProps) {
  const [formData, setFormData] = useState<CourseData>({
    coursePrefix: '',
    courseNumber: '',
    courseName: '',
    credits: 3,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.coursePrefix.trim()) {
      setError('Course prefix is required');
      return;
    }
    if (!formData.courseNumber.trim()) {
      setError('Course number is required');
      return;
    }
    if (!formData.courseName.trim()) {
      setError('Course name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd(formData);
      // Reset form and close
      setFormData({
        coursePrefix: '',
        courseNumber: '',
        courseName: '',
        credits: 3,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof CourseData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  if (!isOpen) return null;

  // Common course prefixes for suggestions
  const prefixSuggestions = [
    'HUS',
    'HSV',
    'PSY',
    'SOC',
    'SWK',
    'COU',
    'EDU',
    'ENG',
    ...existingPrefixes,
  ].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Course Column</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Course Prefix */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course Prefix *
            </label>
            <input
              type="text"
              value={formData.coursePrefix}
              onChange={(e) => handleChange('coursePrefix', e.target.value.toUpperCase())}
              placeholder="e.g., HUS, PSY, SOC"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              list="prefix-suggestions"
              maxLength={4}
            />
            <datalist id="prefix-suggestions">
              {prefixSuggestions.map((prefix) => (
                <option key={prefix} value={prefix} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-gray-500">
              Department/subject abbreviation (e.g., HUS for Human Services)
            </p>
          </div>

          {/* Course Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course Number *
            </label>
            <input
              type="text"
              value={formData.courseNumber}
              onChange={(e) => handleChange('courseNumber', e.target.value)}
              placeholder="e.g., 101, 201, 310"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              maxLength={6}
            />
            <p className="mt-1 text-xs text-gray-500">
              Catalog number for this course
            </p>
          </div>

          {/* Course Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course Name *
            </label>
            <input
              type="text"
              value={formData.courseName}
              onChange={(e) => handleChange('courseName', e.target.value)}
              placeholder="e.g., Introduction to Human Services"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              maxLength={100}
            />
          </div>

          {/* Credits */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Credit Hours
            </label>
            <select
              value={formData.credits}
              onChange={(e) => handleChange('credits', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={num}>
                  {num} credit{num !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddCourseModal;
