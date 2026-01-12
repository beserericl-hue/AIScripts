'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface ImageDropZoneProps {
  imageData: string | undefined;
  onChange: (imageData: string | undefined) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

export default function ImageDropZone({ imageData, onChange }: ImageDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only PNG and JPG images are allowed';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 5MB';
    }
    return null;
  };

  const processFile = useCallback((file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onChange(result);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsDataURL(file);
  }, [onChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFile]);

  const handleRemove = useCallback(() => {
    onChange(undefined);
    setError(null);
  }, [onChange]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (imageData) {
    return (
      <div className="relative">
        <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#262626]">
          <p className="text-xs text-[#737373] mb-2">Image Preview:</p>
          <div className="relative inline-block">
            <img
              src={imageData}
              alt="Uploaded preview"
              className="max-h-48 rounded-lg"
            />
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-[#D4AF37] bg-[#D4AF37]/10'
            : 'border-[#333333] hover:border-[#D4AF37]/50 bg-[#111111]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          {isDragOver ? (
            <Upload className="w-8 h-8 text-[#D4AF37]" />
          ) : (
            <ImageIcon className="w-8 h-8 text-[#525252]" />
          )}
          <p className="text-sm text-[#A3A3A3]">
            {isDragOver ? 'Drop image here' : 'Drop image here or click to upload'}
          </p>
          <p className="text-xs text-[#525252]">PNG or JPG only, max 5MB</p>
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
