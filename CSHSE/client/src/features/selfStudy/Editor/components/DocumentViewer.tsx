import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCcw, MousePointer2, CheckCircle, SkipForward } from 'lucide-react';

// Selection data - stores the selected HTML and the Range for later replacement (v2)
export interface SelectionData {
  html: string;
  text: string;
  previewText: string;
  range?: Range; // Store the Range so we can replace it after save
  // Text offsets relative to the ORIGINAL document text (for placeholder persistence on resume)
  textStartOffset?: number;
  textLength?: number;
}

// Info for a successfully saved section (used to create placeholder)
export interface SavedSectionInfo {
  id: string;
  title: string;
  sectionType: string;
  contentLength: number;
}

// Minimal tagged section data needed for placeholder re-insertion on resume
export interface TaggedSectionPlaceholder {
  id: string;
  sectionType: string;
  title: string;
  previewText?: string;
  endPreviewText?: string;
  contentLength?: number;
  // Stored text offsets from original extraction (most reliable method)
  textStartOffset?: number | null;
  textLength?: number | null;
}

interface DocumentViewerProps {
  importId: string;
  htmlContent: string;
  isLoading: boolean;
  error: string | null;
  onSelectionCapture: (selection: SelectionData | null) => void;
  onRefresh: () => void;
  onRepairDocument?: () => void;
  isRepairing?: boolean;
  hasSelection: boolean;
  // Called by parent after successful save - replaces selection with placeholder
  lastSavedSection?: SavedSectionInfo | null;
  onPlaceholderInserted?: (updatedHtml: string) => void; // Called after placeholder is inserted, with updated HTML
  // Tagged sections (kept for reference, markers are now embedded in HTML for resume)
  taggedSections?: TaggedSectionPlaceholder[];
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
  onRepairDocument,
  isRepairing,
  hasSelection,
  lastSavedSection,
  onPlaceholderInserted,
  taggedSections
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

  // Replace captured selection with placeholder after successful save.
  // Replace captured selection with placeholder after successful save
  useEffect(() => {
    if (!lastSavedSection || !lastCapturedRangeRef.current || !contentRef.current) {
      return;
    }

    const range = lastCapturedRangeRef.current;

    try {
      const placeholder = createPlaceholder(lastSavedSection);

      // Check if selection is within a table - need table-aware row removal
      const startTable = findAncestor(range.startContainer, 'TABLE');
      const endTable = findAncestor(range.endContainer, 'TABLE');

      if (startTable) {
        // Table selection: NEVER use range.deleteContents() — it splits DOM nodes
        // at range boundaries, corrupting table structure (orphaned cells, broken rows).
        // Instead, remove specific <tr> elements that overlap the selection.
        const table = startTable as HTMLTableElement;
        const allRows = Array.from(table.rows);

        // Collect rows that overlap the selection BEFORE any DOM mutations
        // (DOM changes invalidate Range objects)
        const rowsToRemove: HTMLTableRowElement[] = [];
        for (const row of allRows) {
          // Use compareBoundaryPoints for strict overlap (intersectsNode returns true for boundary touches)
          const rowRange = document.createRange();
          rowRange.selectNodeContents(row);
          const startsBeforeRowEnd = range.compareBoundaryPoints(Range.START_TO_END, rowRange) > 0;
          const endsAfterRowStart = range.compareBoundaryPoints(Range.END_TO_START, rowRange) < 0;
          if (startsBeforeRowEnd && endsAfterRowStart) {
            rowsToRemove.push(row);
          }
        }

        console.log(`[DocumentViewer] Table placeholder: ${allRows.length} total rows, ${rowsToRemove.length} rows overlap selection`);

        // If the selection also extends beyond the table (endTable !== startTable),
        // handle the non-table portion after the table
        if (endTable && endTable !== startTable) {
          console.warn(`[DocumentViewer] Selection spans multiple tables or table+non-table — removing overlapping rows from start table only`);
        }

        // Insert placeholder before the table
        table.parentNode?.insertBefore(placeholder, table);

        // Remove overlapping rows directly (no deleteContents!)
        for (const row of rowsToRemove) {
          console.log(`[DocumentViewer] Removing table row: "${row.textContent?.substring(0, 80).trim()}..."`);
          row.remove();
        }

        // If table is now empty, remove it too
        if (table.rows.length === 0) {
          table.remove();
          console.log(`[DocumentViewer] Removed empty table (all rows extracted)`);
        } else {
          console.log(`[DocumentViewer] Table still has ${table.rows.length} rows remaining`);
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

  // Convert HTML comment markers to visible placeholder divs on resume.
  // The server-side insert-marker endpoint embeds comments like:
  //   <!-- EXTRACTED:sectionId:sectionType:title:contentLength -->
  // This approach is reliable for any document size — no DOM offset traversal needed.
  useEffect(() => {
    if (!contentRef.current || !htmlContent) return;

    // Delay to ensure the DOM has fully rendered the HTML content
    const delay = htmlContent.length > 10_000_000 ? 1000 : 200;
    const timer = setTimeout(() => {
      if (!contentRef.current) return;

      const root = contentRef.current;

      // Skip if placeholders already exist in the DOM (current session, not resume)
      const existingPlaceholders = root.querySelectorAll('.extracted-section-placeholder');
      if (existingPlaceholders.length > 0) {
        console.log(`[DocumentViewer] Skipping marker conversion: ${existingPlaceholders.length} placeholder(s) already in DOM`);
        return;
      }

      // Find all HTML comment markers in the rendered DOM
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
      const markerComments: Array<{ node: Comment; id: string; type: string; title: string; length: number }> = [];

      let commentNode;
      while (commentNode = walker.nextNode()) {
        const text = (commentNode as Comment).textContent?.trim() || '';
        // Match: EXTRACTED:sectionId:sectionType:title:contentLength
        const match = text.match(/^EXTRACTED:([^:]+):([^:]+):(.+):(\d+)$/);
        if (match) {
          markerComments.push({
            node: commentNode as Comment,
            id: match[1],
            type: match[2],
            title: match[3],
            length: parseInt(match[4], 10)
          });
        }
      }

      if (markerComments.length === 0) {
        // Fallback for old sessions: if there are tagged sections but no markers,
        // the extractions happened before the marker system was deployed.
        // Show a count banner at the top so the user knows sections were extracted.
        if (taggedSections && taggedSections.length > 0) {
          console.log(`[DocumentViewer] No EXTRACTED markers found, but ${taggedSections.length} tagged section(s) exist (pre-marker extraction). ` +
            `Showing info banner. Future extractions will embed markers.`);
          const banner = document.createElement('div');
          banner.className = 'extracted-section-placeholder';
          banner.innerHTML = `
            <div class="flex items-center gap-2 px-3 py-2 bg-amber-100 border-l-4 border-amber-400 text-amber-800 rounded-r my-2">
              <span class="font-medium text-sm">
                ${taggedSections.length} section(s) previously extracted — markers will be embedded on new extractions
              </span>
            </div>
          `;
          root.insertBefore(banner, root.firstChild);
          setExtractedCount(taggedSections.length);
        } else {
          console.log('[DocumentViewer] No EXTRACTED markers found in HTML (no tagged sections either)');
        }
        return;
      }

      // Build set of active tagged section IDs
      const activeSectionIds = new Set(
        (taggedSections || []).map(s => s.id)
      );

      console.log(`[DocumentViewer] Found ${markerComments.length} EXTRACTED marker(s), converting to placeholders`);

      let insertedCount = 0;

      // Process ALL markers — they're already in document order (top to bottom).
      // Markers for deleted sections (restoreMarker failed) get a warning placeholder
      // so the user knows content is missing. If restoreMarker succeeded, the marker
      // wouldn't be in the HTML at all.
      for (const marker of markerComments) {
        try {
          const isActive = activeSectionIds.has(marker.id);

          if (isActive) {
            // Normal placeholder for active tagged sections
            const placeholder = createPlaceholder({
              id: marker.id,
              title: marker.title,
              sectionType: marker.type,
              contentLength: marker.length
            });
            marker.node.parentNode?.replaceChild(placeholder, marker.node);
          } else {
            // Marker for a deleted section — restoreMarker must have failed.
            // Show a warning placeholder so user knows content is missing here.
            console.warn(`[DocumentViewer] Marker for deleted section "${marker.title}" (${marker.id}) — content restoration may have failed`);
            const warningPlaceholder = document.createElement('div');
            warningPlaceholder.className = 'extracted-section-placeholder';
            warningPlaceholder.setAttribute('data-section-id', marker.id);
            warningPlaceholder.innerHTML = `
              <div class="flex items-center gap-2 px-3 py-2 bg-red-100 border-red-400 text-red-800 border-l-4 rounded-r my-2">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <span class="font-medium text-sm truncate">
                  Content not restored: ${marker.title}
                </span>
                <span class="text-xs opacity-75">
                  (${marker.length.toLocaleString()} chars — reload page to retry)
                </span>
              </div>
            `;
            marker.node.parentNode?.replaceChild(warningPlaceholder, marker.node);
          }

          insertedCount++;
        } catch (err) {
          console.error(`[DocumentViewer] Failed to convert marker for "${marker.title}":`, err);
        }
      }

      if (insertedCount > 0) {
        setExtractedCount(insertedCount);
        console.log(`[DocumentViewer] Converted ${insertedCount} marker(s) to visible placeholders`);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [htmlContent, taggedSections]); // Markers are in HTML; taggedSections used for fallback banner

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

  // Helper: Calculate text offset of a Range's start position relative to root element.
  // Skips text inside .extracted-section-placeholder elements so offsets match
  // the server-side HTML where extracted sections are replaced with zero-length comment markers.
  const calculateTextOffset = useCallback((range: Range): number => {
    if (!contentRef.current) return -1;
    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip text nodes inside placeholder elements
        let parent: Node | null = node.parentNode;
        while (parent && parent !== contentRef.current) {
          if ((parent as HTMLElement).classList?.contains('extracted-section-placeholder')) {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let offset = 0;
    let node;
    while (node = walker.nextNode()) {
      if (node === range.startContainer) {
        return offset + range.startOffset;
      }
      offset += (node as Text).textContent?.length || 0;
    }
    return -1;
  }, []);

  // Capture the current selection and store the Range for later replacement
  const handleCaptureSelection = useCallback(() => {
    if (currentSelection) {
      // Store the current browser selection Range BEFORE clearing
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Clone the range so it persists after selection is cleared
        lastCapturedRangeRef.current = range.cloneRange();

        // Calculate text offset relative to the document root for persistence
        // This allows us to re-create the exact placeholder position on resume
        const textStartOffset = calculateTextOffset(range);
        const textLength = currentSelection.text.length;
        console.log(`[DocumentViewer] Stored Range for replacement (textOffset=${textStartOffset}, textLength=${textLength})`);

        // Enrich the selection data with offset info
        onSelectionCapture({
          ...currentSelection,
          textStartOffset: textStartOffset >= 0 ? textStartOffset : undefined,
          textLength: textLength > 0 ? textLength : undefined
        });
      } else {
        onSelectionCapture(currentSelection);
      }

      // Clear the browser selection (but Range is stored in ref)
      window.getSelection()?.removeAllRanges();
      setCurrentSelection(null);
      setSelectionActive(false);
    }
  }, [currentSelection, onSelectionCapture, calculateTextOffset]);

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
    const isContentMissing = error.toLowerCase().includes('not found');
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
          <div className="flex flex-col gap-2 items-center">
            {isContentMissing && onRepairDocument && (
              <button
                onClick={onRepairDocument}
                disabled={isRepairing}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isRepairing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Repairing...
                  </>
                ) : (
                  'Repair Document'
                )}
              </button>
            )}
            <button
              onClick={onRefresh}
              className={`px-4 py-2 rounded-lg ${isContentMissing ? 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 text-sm' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              Try Again
            </button>
          </div>
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
