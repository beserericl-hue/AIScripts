import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCcw, MousePointer2, CheckCircle, ChevronDown, SkipForward } from 'lucide-react';

// Simple selection data - stores the selected HTML directly
export interface SelectionData {
  html: string;
  text: string;
  previewText: string;
}

// Tagged section info for visual marking
export interface TaggedSectionInfo {
  id: string;
  title: string;
  previewText: string;
  endPreviewText?: string; // Last 100 chars to find where extraction ends
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
  taggedSections?: TaggedSectionInfo[];
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
  taggedSections = []
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [currentSelection, setCurrentSelection] = useState<SelectionData | null>(null);
  const [selectionActive, setSelectionActive] = useState(false);
  const [showExtractedList, setShowExtractedList] = useState(false);
  const [markedRanges, setMarkedRanges] = useState<Range[]>([]);

  // Number of tagged sections (from parent component)
  const extractedCount = taggedSections.length;

  // Mark extracted content in the document visually
  // Uses START (previewText) and END (endPreviewText) to find exact boundaries
  // Only marks what was actually extracted - nothing more, nothing less
  useEffect(() => {
    if (!contentRef.current) {
      return;
    }

    // Clear ALL previous marks first
    const existingMarks = contentRef.current.querySelectorAll('.extracted-content-marked');
    existingMarks.forEach(mark => {
      mark.classList.remove('extracted-content-marked');
      mark.removeAttribute('data-extracted-section');
      mark.removeAttribute('title');
    });

    if (taggedSections.length === 0) {
      return;
    }

    // Get leaf-level content elements (smallest text containers)
    const leafElements = Array.from(contentRef.current.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre'
    ));

    // Helper: find element index containing specific text
    const findElementIndex = (searchText: string, startFrom = 0, searchBackward = false): number => {
      if (!searchText || searchText.length < 5) return -1;

      const cleanSearch = searchText.replace(/\s+/g, ' ').trim();
      const variants = [
        cleanSearch.substring(0, Math.min(40, cleanSearch.length)),
        cleanSearch.split(/\s+/).slice(0, 6).join(' '),
        cleanSearch.split(/\s+/).slice(0, 4).join(' ')
      ];

      for (const variant of variants) {
        if (variant.length < 5) continue;

        if (searchBackward) {
          // Search from end backwards
          for (let i = leafElements.length - 1; i >= startFrom; i--) {
            const elText = (leafElements[i].textContent || '').replace(/\s+/g, ' ');
            if (elText.includes(variant)) {
              return i;
            }
          }
        } else {
          // Search forward
          for (let i = startFrom; i < leafElements.length; i++) {
            const elText = (leafElements[i].textContent || '').replace(/\s+/g, ' ');
            if (elText.includes(variant)) {
              return i;
            }
          }
        }
      }
      return -1;
    };

    // Helper: mark an element
    const markElement = (el: Element, sectionId: string, sectionTitle: string) => {
      el.classList.add('extracted-content-marked');
      el.setAttribute('data-extracted-section', sectionId);
      el.setAttribute('title', `Already extracted: ${sectionTitle}`);
    };

    taggedSections.forEach(section => {
      if (!section.previewText || !contentRef.current) return;

      // Find START element using previewText (first ~200 chars)
      const startIndex = findElementIndex(section.previewText, 0, false);
      if (startIndex < 0) return; // Couldn't find start

      // Find END element using endPreviewText (last ~100 chars)
      let endIndex = startIndex; // Default to same element if no end found

      if (section.endPreviewText && section.endPreviewText.length >= 10) {
        // Search for end text starting from the start element
        const foundEnd = findElementIndex(section.endPreviewText, startIndex, false);
        if (foundEnd >= startIndex) {
          endIndex = foundEnd;
        }
      }

      // If start and end are the same but content is larger, estimate end by character count
      if (startIndex === endIndex && section.contentLength > 0) {
        const startElLength = leafElements[startIndex].textContent?.length || 0;
        if (section.contentLength > startElLength * 1.2) {
          // Need to find more elements - use character counting as fallback
          let charsCovered = startElLength;
          for (let i = startIndex + 1; i < leafElements.length && charsCovered < section.contentLength; i++) {
            charsCovered += leafElements[i].textContent?.length || 0;
            endIndex = i;
          }
        }
      }

      // Mark all elements from start to end (inclusive)
      for (let i = startIndex; i <= endIndex && i < leafElements.length; i++) {
        const el = leafElements[i];
        if (!el.classList.contains('extracted-content-marked')) {
          markElement(el, section.id, section.title);
        }
      }
    });
  }, [htmlContent, taggedSections]);

  // Jump to the first non-extracted content (skip past marked content)
  const handleJumpToNext = useCallback(() => {
    if (!contentRef.current || !scrollContainerRef.current) return;

    // Find all marked (extracted) elements
    const markedElements = contentRef.current.querySelectorAll('.extracted-content-marked');

    if (markedElements.length === 0) {
      // No marked content, scroll to top
      scrollContainerRef.current.scrollTop = 0;
      return;
    }

    // Find the last marked element
    const lastMarked = markedElements[markedElements.length - 1];

    // Find the next sibling element that is NOT marked
    let nextElement: Element | null = lastMarked.nextElementSibling;

    // Walk through siblings until we find one that's not marked
    while (nextElement && nextElement.classList.contains('extracted-content-marked')) {
      nextElement = nextElement.nextElementSibling;
    }

    // If no unmarked sibling, look through all elements
    if (!nextElement) {
      const allElements = Array.from(contentRef.current.querySelectorAll('p, h1, h2, h3, h4, h5, h6, table, ul, ol, div'));
      let foundLastMarked = false;

      for (const el of allElements) {
        if (el === lastMarked) {
          foundLastMarked = true;
          continue;
        }
        if (foundLastMarked && !el.classList.contains('extracted-content-marked')) {
          nextElement = el;
          break;
        }
      }
    }

    if (nextElement) {
      // Scroll to the element with some offset from top
      nextElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // If everything is marked, scroll to end of last marked
      lastMarked.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Toggle extracted sections list dropdown
  const handleToggleExtractedList = useCallback(() => {
    setShowExtractedList(prev => !prev);
  }, []);

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
        // Clone the selection contents
        const fragment = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);
        const selectedHtml = tempDiv.innerHTML;
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

  // Capture the current selection
  const handleCaptureSelection = useCallback(() => {
    if (currentSelection) {
      onSelectionCapture(currentSelection);
      // Clear the browser selection
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
              <button
                onClick={handleToggleExtractedList}
                className={`flex items-center gap-1 px-2 py-1 text-sm rounded ${
                  showExtractedList
                    ? 'bg-gray-200 text-gray-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
                title={showExtractedList ? 'Hide extracted sections list' : 'Show extracted sections list'}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showExtractedList ? '' : '-rotate-90'}`} />
                {extractedCount} extracted
              </button>
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

            /* Frontend-marked extracted content - grayed out with strikethrough effect */
            .document-content .extracted-content-marked {
              position: relative;
              background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
              opacity: 0.6;
              border-left: 4px solid #9ca3af;
              padding-left: 8px;
              margin-left: -12px;
              cursor: not-allowed;
              user-select: none;
            }
            .document-content .extracted-content-marked::before {
              content: '✓ Extracted';
              position: absolute;
              top: 0;
              right: 0;
              background: #22c55e;
              color: white;
              font-size: 10px;
              font-family: system-ui, -apple-system, sans-serif;
              padding: 2px 6px;
              border-radius: 0 0 0 4px;
              font-weight: 600;
            }
            .document-content .extracted-content-marked * {
              text-decoration: line-through;
              text-decoration-color: #9ca3af;
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
