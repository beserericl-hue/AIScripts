import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface DocumentViewerProps {
  importId: string;
  htmlContent: string;
  isLoading: boolean;
  error: string | null;
  cursorPosition: number | null;
  startOffset: number | null;
  endOffset: number | null;
  onPositionClick: (offset: number, element: HTMLElement) => void;
  onRefresh: () => void;
}

/**
 * DocumentViewer - Displays HTML document content for manual section tagging
 *
 * Features:
 * - Scrollable HTML content viewer
 * - Click to capture position for section marking
 * - Visual markers for cursor, start, and end positions
 * - Zoom controls
 * - Highlights the current selection range
 */
export function DocumentViewer({
  importId,
  htmlContent,
  isLoading,
  error,
  cursorPosition,
  startOffset,
  endOffset,
  onPositionClick,
  onRefresh
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const cursorMarkerRef = useRef<HTMLSpanElement | null>(null);
  const startMarkerRef = useRef<HTMLSpanElement | null>(null);
  const endMarkerRef = useRef<HTMLSpanElement | null>(null);

  // Calculate text offset from clicked position
  const getTextOffset = useCallback((node: Node, offset: number): number => {
    if (!contentRef.current) return 0;

    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    let totalOffset = 0;
    let currentNode = walker.nextNode();

    while (currentNode) {
      if (currentNode === node) {
        return totalOffset + offset;
      }
      totalOffset += currentNode.textContent?.length || 0;
      currentNode = walker.nextNode();
    }

    return totalOffset;
  }, []);

  // Handle click to capture position
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    // Don't capture clicks on markers or controls
    const target = e.target as HTMLElement;
    if (target.closest('.section-marker') || target.closest('.viewer-controls')) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // No selection, use click position
      // Try to get caret position from click
      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
          const offset = getTextOffset(range.startContainer, range.startOffset);
          onPositionClick(offset, target);
        }
      }
      return;
    }

    const range = selection.getRangeAt(0);
    const offset = getTextOffset(range.startContainer, range.startOffset);
    onPositionClick(offset, range.startContainer.parentElement || target);
  }, [getTextOffset, onPositionClick]);

  // Helper to find node at offset
  const findNodeAtOffset = useCallback((targetOffset: number): { node: Text; offset: number } | null => {
    if (!contentRef.current) return null;

    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let currentNode = walker.nextNode() as Text | null;

    while (currentNode) {
      const nodeLength = currentNode.textContent?.length || 0;
      if (currentOffset + nodeLength >= targetOffset) {
        return { node: currentNode, offset: targetOffset - currentOffset };
      }
      currentOffset += nodeLength;
      currentNode = walker.nextNode() as Text | null;
    }

    return null;
  }, []);

  // Insert visual markers for cursor, start, and end positions
  useEffect(() => {
    if (!contentRef.current) return;

    // Remove existing markers
    if (cursorMarkerRef.current) {
      cursorMarkerRef.current.remove();
      cursorMarkerRef.current = null;
    }
    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.remove();
      endMarkerRef.current = null;
    }

    // Insert cursor marker (blue vertical line) - only if no end marker yet
    if (cursorPosition !== null && !(startOffset !== null && endOffset !== null)) {
      const result = findNodeAtOffset(cursorPosition);
      if (result) {
        const marker = document.createElement('span');
        marker.className = 'section-marker section-cursor-marker';
        marker.innerHTML = '|';
        marker.style.cssText = `
          display: inline;
          color: #3b82f6;
          font-weight: bold;
          font-size: 18px;
          line-height: 1;
          animation: blink 1s infinite;
          vertical-align: middle;
        `;
        marker.title = 'Current cursor position - click Mark Start or Mark End';

        try {
          const range = document.createRange();
          range.setStart(result.node, Math.min(result.offset, result.node.length));
          range.collapse(true);
          range.insertNode(marker);
          cursorMarkerRef.current = marker;
        } catch (err) {
          console.warn('Failed to insert cursor marker:', err);
        }
      }
    }

    // Insert start marker (green circle with arrow)
    if (startOffset !== null) {
      const result = findNodeAtOffset(startOffset);
      if (result) {
        const marker = document.createElement('span');
        marker.className = 'section-marker section-start-marker';
        marker.innerHTML = '▶';
        marker.style.cssText = `
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background-color: #10b981;
          color: white;
          border-radius: 50%;
          font-size: 12px;
          margin: 0 4px;
          vertical-align: middle;
          cursor: default;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        marker.title = 'Section Start';

        try {
          const range = document.createRange();
          range.setStart(result.node, Math.min(result.offset, result.node.length));
          range.collapse(true);
          range.insertNode(marker);
          startMarkerRef.current = marker;
        } catch (err) {
          console.warn('Failed to insert start marker:', err);
        }
      }
    }

    // Insert end marker (red circle with square)
    if (endOffset !== null && startOffset !== null) {
      const result = findNodeAtOffset(endOffset);
      if (result) {
        const marker = document.createElement('span');
        marker.className = 'section-marker section-end-marker';
        marker.innerHTML = '■';
        marker.style.cssText = `
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background-color: #ef4444;
          color: white;
          border-radius: 50%;
          font-size: 12px;
          margin: 0 4px;
          vertical-align: middle;
          cursor: default;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        marker.title = 'Section End';

        try {
          const range = document.createRange();
          range.setStart(result.node, Math.min(result.offset, result.node.length));
          range.collapse(true);
          range.insertNode(marker);
          endMarkerRef.current = marker;
        } catch (err) {
          console.warn('Failed to insert end marker:', err);
        }
      }
    }

    // Cleanup on unmount or content change
    return () => {
      if (cursorMarkerRef.current) {
        cursorMarkerRef.current.remove();
        cursorMarkerRef.current = null;
      }
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
        startMarkerRef.current = null;
      }
      if (endMarkerRef.current) {
        endMarkerRef.current.remove();
        endMarkerRef.current = null;
      }
    };
  }, [cursorPosition, startOffset, endOffset, htmlContent, findNodeAtOffset]);

  // Highlight selection range
  useEffect(() => {
    if (!contentRef.current) return;

    // Remove existing highlight
    const existingHighlight = contentRef.current.querySelector('.selection-highlight');
    if (existingHighlight) {
      existingHighlight.remove();
    }

    // Add highlight if both start and end are set
    if (startOffset !== null && endOffset !== null && startOffset < endOffset) {
      // We'll use CSS background instead of inserting elements
      // This is handled by the markers above
    }
  }, [startOffset, endOffset]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 10, 200));
  const handleZoomOut = () => setZoom(z => Math.max(z - 10, 50));
  const handleZoomReset = () => setZoom(100);

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
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Click in the document to mark section boundaries
          </span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Content Area - Scrollable document viewer */}
      <div
        className="flex-1 min-h-0 overflow-auto cursor-text"
        onClick={handleContentClick}
        style={{
          background: '#f9fafb'
        }}
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
            @keyframes blink {
              0%, 50% { opacity: 1; }
              51%, 100% { opacity: 0; }
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

      {/* Position Indicator */}
      {(cursorPosition !== null || startOffset !== null || endOffset !== null) && (
        <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-4 text-sm">
          {cursorPosition !== null && !(startOffset !== null && endOffset !== null) && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              Cursor: {cursorPosition}
            </span>
          )}
          {startOffset !== null && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              Start: {startOffset}
            </span>
          )}
          {endOffset !== null && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              End: {endOffset}
            </span>
          )}
          {startOffset !== null && endOffset !== null && (
            <span className="text-gray-500">
              Selection: {endOffset - startOffset} characters
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentViewer;
