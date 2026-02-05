import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCcw, MousePointer2, CheckCircle, SkipForward } from 'lucide-react';

// Selection data - stores the selected HTML and the Range for later replacement
export interface SelectionData {
  html: string;
  text: string;
  previewText: string;
  range?: Range; // Store the Range so we can replace it after save
}

// Info for a successfully saved section (used to create placeholder)
export interface SavedSectionInfo {
  id: string;
  title: string;
  sectionType: string;
  contentLength: number;
}

interface DocumentViewerProps {
  importId: string;
  htmlContent: string;
  isLoading: boolean;
  error: string | null;
  onSelectionCapture: (selection: SelectionData | null) => void;
  onRefresh: () => void;
  hasSelection: boolean;
  // Called by parent after successful save - replaces selection with placeholder
  lastSavedSection?: SavedSectionInfo | null;
  onPlaceholderInserted?: (updatedHtml: string) => void; // Called after placeholder is inserted, with updated HTML
}

/**
 * DocumentViewer - Displays HTML document content for manual section tagging
 *
 * Uses native browser text selection for reliability with large documents.
 * User selects text by dragging, then clicks "Capture Selection" to save it.
 */
export function DocumentViewer({
  importId,
  htmlContent,
  isLoading,
  error,
  onSelectionCapture,
  onRefresh,
  hasSelection,
  lastSavedSection,
  onPlaceholderInserted
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [currentSelection, setCurrentSelection] = useState<SelectionData | null>(null);
  const [selectionActive, setSelectionActive] = useState(false);
  const [extractedCount, setExtractedCount] = useState(0);
  // Store the last captured range so we can replace it after save
  const lastCapturedRangeRef = useRef<Range | null>(null);

  // Helper to create placeholder element
  const createPlaceholder = (section: SavedSectionInfo): HTMLDivElement => {
    const placeholder = document.createElement('div');
    placeholder.className = 'extracted-section-placeholder';
    placeholder.setAttribute('data-section-id', section.id);
    placeholder.setAttribute('data-section-type', section.sectionType);

    const typeColors: Record<string, string> = {
      'standard': 'bg-teal-100 border-teal-400 text-teal-800',
      'matrix': 'bg-purple-100 border-purple-400 text-purple-800',
      'appendix': 'bg-amber-100 border-amber-400 text-amber-800',
      'skip': 'bg-gray-100 border-gray-400 text-gray-600'
    };
    const colorClass = typeColors[section.sectionType] || typeColors['standard'];

    placeholder.innerHTML = `
      <div class="flex items-center gap-2 px-3 py-2 ${colorClass} border-l-4 rounded-r my-2">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="font-medium text-sm truncate">
          ✓ Extracted: ${section.title}
        </span>
        <span class="text-xs opacity-75">
          (${section.contentLength.toLocaleString()} chars)
        </span>
      </div>
    `;
    return placeholder;
  };

  // Replace captured selection with placeholder after successful save
  useEffect(() => {
    if (!lastSavedSection || !lastCapturedRangeRef.current || !contentRef.current) {
      return;
    }

    const range = lastCapturedRangeRef.current;

    try {
      const placeholder = createPlaceholder(lastSavedSection);

      // Check if selection is within a table - need to handle row cleanup
      const startTable = findAncestor(range.startContainer, 'TABLE');
      const startRow = findAncestor(range.startContainer, 'TR');

      if (startTable && startRow) {
        // Table selection: insert placeholder before table, then delete content and clean up empty rows
        const table = startTable as HTMLTableElement;

        // Insert placeholder before the table
        table.parentNode?.insertBefore(placeholder, table);

        // Delete the selected content
        range.deleteContents();

        // Clean up any rows that are now empty (only whitespace/empty cells)
        const rows = Array.from(table.rows);
        for (let i = rows.length - 1; i >= 0; i--) {
          const row = rows[i];
          const textContent = row.textContent?.trim() || '';
          // Also check if row only contains placeholder elements we just inserted
          const hasOnlyPlaceholders = row.querySelectorAll('.extracted-section-placeholder').length > 0
            && textContent.length === 0;

          if (textContent.length === 0 || hasOnlyPlaceholders) {
            row.remove();
            console.log(`[DocumentViewer] Removed empty table row ${i}`);
          }
        }

        // If table is now empty, remove it too
        if (table.rows.length === 0) {
          table.remove();
          console.log(`[DocumentViewer] Removed empty table`);
        }
      } else {
        // Non-table content: simple delete and insert
        range.deleteContents();
        range.insertNode(placeholder);
      }

      // Update extracted count
      setExtractedCount(prev => prev + 1);

      // Clear the stored range
      lastCapturedRangeRef.current = null;

      // Get the updated HTML with placeholder and notify parent
      const updatedHtml = contentRef.current.innerHTML;
      onPlaceholderInserted?.(updatedHtml);

      console.log(`[DocumentViewer] Replaced selection with placeholder: "${lastSavedSection.title}"`);
    } catch (err) {
      console.error('[DocumentViewer] Failed to insert placeholder:', err);
    }
  }, [lastSavedSection, onPlaceholderInserted]);

  // Jump to the first content after placeholders (skip past extracted sections)
  const handleJumpToNext = useCallback(() => {
    if (!contentRef.current || !scrollContainerRef.current) return;

    // Find all placeholder elements
    const placeholders = contentRef.current.querySelectorAll('.extracted-section-placeholder');

    if (placeholders.length === 0) {
      // No placeholders, scroll to top
      scrollContainerRef.current.scrollTop = 0;
      return;
    }

    // Find the last placeholder
    const lastPlaceholder = placeholders[placeholders.length - 1];

    // Find the next sibling element that is NOT a placeholder
    let nextElement: Element | null = lastPlaceholder.nextElementSibling;

    while (nextElement && nextElement.classList.contains('extracted-section-placeholder')) {
      nextElement = nextElement.nextElementSibling;
    }

    if (nextElement) {
      nextElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // If everything after is extracted, scroll to end
      lastPlaceholder.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Helper: Find the closest ancestor of a specific type
  const findAncestor = (node: Node | null, tagName: string): Element | null => {
    let current: Node | null = node;
    while (current && current !== contentRef.current) {
      if (current.nodeType === Node.ELEMENT_NODE && (current as Element).tagName === tagName) {
        return current as Element;
      }
      current = current.parentNode;
    }
    return null;
  };

  // Helper: Extract HTML - uses range.cloneContents() to get exactly what's visually selected
  const extractSelectionHtml = (range: Range): string => {
    // Use cloneContents() - this gives exactly what's visually highlighted
    const fragment = range.cloneContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);

    // Check if we have orphaned table cells (td/th without table wrapper)
    const orphanedCells = tempDiv.querySelectorAll('td, th');
    const hasOrphanedCells = orphanedCells.length > 0 && !tempDiv.querySelector('table');

    if (hasOrphanedCells) {
      // Wrap orphaned cells in a proper table structure
      const wrapperTable = document.createElement('table');
      wrapperTable.style.cssText = 'border-collapse: collapse; width: 100%;';
      const tbody = document.createElement('tbody');

      // Group cells into rows (assume consecutive cells belong to same row if no tr)
      let currentRow = document.createElement('tr');
      const childNodes = Array.from(tempDiv.childNodes);

      for (const node of childNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (el.tagName === 'TD' || el.tagName === 'TH') {
            currentRow.appendChild(el.cloneNode(true));
          } else if (el.tagName === 'TR') {
            if (currentRow.children.length > 0) {
              tbody.appendChild(currentRow);
              currentRow = document.createElement('tr');
            }
            tbody.appendChild(el.cloneNode(true));
          } else {
            // Non-table element - add current row if it has cells, then add element
            if (currentRow.children.length > 0) {
              tbody.appendChild(currentRow);
              currentRow = document.createElement('tr');
            }
            // Keep non-table content outside the table
          }
        }
      }

      if (currentRow.children.length > 0) {
        tbody.appendChild(currentRow);
      }

      if (tbody.children.length > 0) {
        wrapperTable.appendChild(tbody);
        console.log(`[Selection] Wrapped ${orphanedCells.length} orphaned cells in table structure`);
        return wrapperTable.outerHTML;
      }
    }

    return tempDiv.innerHTML;
  };

  // Check for text selection when mouse is released
  const handleMouseUp = useCallback(() => {
    // Small delay to let browser finalize selection
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !contentRef.current) {
        setCurrentSelection(null);
        setSelectionActive(false);
        return;
      }

      // Check if selection is within our content
      const range = selection.getRangeAt(0);
      if (!contentRef.current.contains(range.commonAncestorContainer)) {
        return;
      }

      try {
        // Extract HTML with proper table structure preservation
        const selectedHtml = extractSelectionHtml(range);

        // Get plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = selectedHtml;
        const selectedText = tempDiv.textContent || '';

        if (selectedText.trim().length > 0) {
          setCurrentSelection({
            html: selectedHtml,
            text: selectedText,
            previewText: selectedText.substring(0, 200) + (selectedText.length > 200 ? '...' : '')
          });
          setSelectionActive(true);
        } else {
          setCurrentSelection(null);
          setSelectionActive(false);
        }
      } catch (err) {
        console.warn('Failed to capture selection:', err);
        setCurrentSelection(null);
        setSelectionActive(false);
      }
    }, 10);
  }, []);

  // Capture the current selection and store the Range for later replacement
  const handleCaptureSelection = useCallback(() => {
    if (currentSelection) {
      // Store the current browser selection Range BEFORE clearing
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        // Clone the range so it persists after selection is cleared
        lastCapturedRangeRef.current = selection.getRangeAt(0).cloneRange();
        console.log('[DocumentViewer] Stored Range for later replacement');
      }

      onSelectionCapture(currentSelection);
      // Clear the browser selection (but Range is stored in ref)
      window.getSelection()?.removeAllRanges();
      setCurrentSelection(null);
      setSelectionActive(false);
    }
  }, [currentSelection, onSelectionCapture]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setCurrentSelection(null);
    setSelectionActive(false);
    lastCapturedRangeRef.current = null; // Clear stored range
    onSelectionCapture(null);
  }, [onSelectionCapture]);

  // Add global mouseup listener
  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 10, 200));
  const handleZoomOut = () => setZoom(z => Math.max(z - 10, 50));
  const handleZoomReset = () => setZoom(100);

  // Format file size for display
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const documentSize = htmlContent.length;
  const isLargeDocument = documentSize > 10 * 1024 * 1024; // > 10MB

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading document content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-red-50">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-semibold text-red-700 mb-1">Error Loading Document</h3>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!htmlContent) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">No document content available</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="viewer-controls flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            <MousePointer2 className="w-4 h-4 inline mr-1" />
            Select text by dragging, then click "Capture Selection"
          </span>
          {isLargeDocument && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
              Large doc: {formatSize(documentSize)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Navigation controls for extracted content */}
          {extractedCount > 0 && (
            <>
              <button
                onClick={handleJumpToNext}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-teal-100 text-teal-700 rounded hover:bg-teal-200 font-medium"
                title="Jump to next unextracted content"
              >
                <SkipForward className="w-4 h-4" />
                Jump to Next
              </button>
              <span className="text-sm text-gray-600">
                {extractedCount} extracted
              </span>
              <div className="w-px h-5 bg-gray-300" />
            </>
          )}
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-gray-200 rounded"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 w-12 text-center">{zoom}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-gray-200 rounded"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomReset}
            className="p-1.5 hover:bg-gray-200 rounded"
            title="Reset zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selection Action Bar - Shows when text is selected */}
      {(selectionActive || hasSelection) && (
        <div className="flex-shrink-0 px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectionActive && currentSelection && (
              <>
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  Selected: {currentSelection.text.length.toLocaleString()} characters
                </span>
              </>
            )}
            {hasSelection && !selectionActive && (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">
                  Selection captured - fill in details and save
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectionActive && currentSelection && (
              <button
                onClick={handleCaptureSelection}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium"
              >
                Capture Selection
              </button>
            )}
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Content Area - Scrollable document viewer */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-auto"
        style={{ background: '#f9fafb' }}
      >
        <style>
          {`
            .document-content {
              font-family: 'Georgia', 'Times New Roman', serif;
              font-size: 14px;
              line-height: 1.7;
              color: #1f2937;
            }
            .document-content h1 {
              font-size: 1.75rem;
              font-weight: 700;
              color: #111827;
              margin: 1.5rem 0 1rem;
              padding-bottom: 0.5rem;
              border-bottom: 2px solid #e5e7eb;
            }
            .document-content h2 {
              font-size: 1.5rem;
              font-weight: 600;
              color: #1f2937;
              margin: 1.25rem 0 0.75rem;
            }
            .document-content h3 {
              font-size: 1.25rem;
              font-weight: 600;
              color: #374151;
              margin: 1rem 0 0.5rem;
            }
            .document-content h4 {
              font-size: 1.1rem;
              font-weight: 600;
              color: #4b5563;
              margin: 0.75rem 0 0.5rem;
            }
            .document-content p {
              margin: 0.75rem 0;
              text-align: justify;
            }
            .document-content ul, .document-content ol {
              margin: 0.75rem 0;
              padding-left: 1.5rem;
            }
            .document-content li {
              margin: 0.25rem 0;
            }
            .document-content table {
              width: 100%;
              border-collapse: collapse;
              margin: 1rem 0;
              font-size: 13px;
            }
            .document-content th, .document-content td {
              border: 1px solid #d1d5db;
              padding: 0.5rem;
              text-align: left;
            }
            .document-content th {
              background-color: #f3f4f6;
              font-weight: 600;
            }
            .document-content img {
              max-width: 100%;
              height: auto;
              margin: 1rem 0;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
            }
            .document-content strong, .document-content b {
              font-weight: 600;
            }
            .document-content em, .document-content i {
              font-style: italic;
            }
            .document-content blockquote {
              border-left: 4px solid #d1d5db;
              padding-left: 1rem;
              margin: 1rem 0;
              color: #6b7280;
            }
            .document-content hr {
              border: none;
              border-top: 1px solid #e5e7eb;
              margin: 1.5rem 0;
            }
            .document-content ::selection {
              background-color: #bfdbfe;
            }

            /* Placeholder for extracted sections - replaces the original content */
            .document-content .extracted-section-placeholder {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0.5rem 0;
            }
            .document-content .extracted-section-placeholder > div {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.5rem 0.75rem;
              border-radius: 0 0.25rem 0.25rem 0;
              font-size: 0.875rem;
            }
          `}
        </style>
        <div
          ref={contentRef}
          className="document-content bg-white shadow-sm border border-gray-200 rounded-lg m-4 p-8"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            minHeight: 'calc(100% - 2rem)',
            maxWidth: '900px'
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>

      {/* Instructions Footer */}
      {!selectionActive && !hasSelection && (
        <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Click and drag to select the text you want to tag as a section
          </p>
        </div>
      )}
    </div>
  );
}

export default DocumentViewer;
