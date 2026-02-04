import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// Serializable range position - stores path to node + offset
export interface RangePosition {
  path: number[]; // Path from content root to the container node
  offset: number; // Offset within that node
  rect?: { top: number; left: number }; // Visual position for markers
}

interface DocumentViewerProps {
  importId: string;
  htmlContent: string;
  isLoading: boolean;
  error: string | null;
  cursorPosition: RangePosition | null;
  startPosition: RangePosition | null;
  endPosition: RangePosition | null;
  onPositionClick: (position: RangePosition) => void;
  onRefresh: () => void;
}

/**
 * DocumentViewer - Displays HTML document content for manual section tagging
 *
 * Uses Range API for accurate positioning in complex HTML content.
 * Markers are rendered as overlays, not inserted into the DOM.
 */
export function DocumentViewer({
  importId,
  htmlContent,
  isLoading,
  error,
  cursorPosition,
  startPosition,
  endPosition,
  onPositionClick,
  onRefresh
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [markerPositions, setMarkerPositions] = useState<{
    cursor?: { top: number; left: number };
    start?: { top: number; left: number };
    end?: { top: number; left: number };
  }>({});

  // Get the path from content root to a node (for serialization)
  const getNodePath = useCallback((node: Node): number[] => {
    const path: number[] = [];
    let current: Node | null = node;

    while (current && current !== contentRef.current && current.parentNode) {
      const parent = current.parentNode;
      const children = Array.from(parent.childNodes);
      const index = children.indexOf(current as ChildNode);
      path.unshift(index);
      current = parent;
    }

    return path;
  }, []);

  // Find a node given a path from content root
  const getNodeFromPath = useCallback((path: number[]): Node | null => {
    if (!contentRef.current) return null;

    let current: Node = contentRef.current;

    for (const index of path) {
      if (current.childNodes.length <= index) {
        return null;
      }
      current = current.childNodes[index];
    }

    return current;
  }, []);

  // Get visual position of a range position
  const getVisualPosition = useCallback((position: RangePosition): { top: number; left: number } | null => {
    if (!contentRef.current || !scrollContainerRef.current) return null;

    try {
      const node = getNodeFromPath(position.path);
      if (!node) return null;

      const range = document.createRange();

      // Handle text nodes vs element nodes
      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        range.setStart(node, Math.min(position.offset, textLength));
        range.setEnd(node, Math.min(position.offset, textLength));
      } else {
        // For element nodes, use the start of the element
        range.selectNodeContents(node);
        range.collapse(true);
      }

      const rect = range.getBoundingClientRect();
      const containerRect = contentRef.current.getBoundingClientRect();
      const scrollRect = scrollContainerRef.current.getBoundingClientRect();

      // Calculate position relative to the scroll container
      return {
        top: rect.top - scrollRect.top + scrollContainerRef.current.scrollTop,
        left: rect.left - scrollRect.left + scrollContainerRef.current.scrollLeft
      };
    } catch (err) {
      console.warn('Failed to get visual position:', err);
      return null;
    }
  }, [getNodeFromPath]);

  // Update marker positions when positions change or on scroll
  const updateMarkerPositions = useCallback(() => {
    const newPositions: typeof markerPositions = {};

    if (cursorPosition && !(startPosition && endPosition)) {
      const pos = getVisualPosition(cursorPosition);
      if (pos) newPositions.cursor = pos;
    }

    if (startPosition) {
      const pos = getVisualPosition(startPosition);
      if (pos) newPositions.start = pos;
    }

    if (endPosition) {
      const pos = getVisualPosition(endPosition);
      if (pos) newPositions.end = pos;
    }

    setMarkerPositions(newPositions);
  }, [cursorPosition, startPosition, endPosition, getVisualPosition]);

  // Update markers on position changes
  useEffect(() => {
    updateMarkerPositions();
  }, [updateMarkerPositions]);

  // Update markers on scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      updateMarkerPositions();
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [updateMarkerPositions]);

  // Handle click to capture position
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Don't capture clicks on overlays
    if (target.closest('.marker-overlay')) {
      return;
    }

    // Use caretRangeFromPoint for accurate click position
    let range: Range | null = null;

    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(e.clientX, e.clientY);
    }

    if (!range) {
      // Fallback: try to get selection
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      }
    }

    if (range && contentRef.current) {
      // Make sure the range is within our content
      if (!contentRef.current.contains(range.startContainer)) {
        return;
      }

      const path = getNodePath(range.startContainer);
      const rect = range.getBoundingClientRect();
      const scrollRect = scrollContainerRef.current?.getBoundingClientRect();

      const position: RangePosition = {
        path,
        offset: range.startOffset,
        rect: scrollRect ? {
          top: rect.top - scrollRect.top + (scrollContainerRef.current?.scrollTop || 0),
          left: rect.left - scrollRect.left + (scrollContainerRef.current?.scrollLeft || 0)
        } : undefined
      };

      onPositionClick(position);
    }
  }, [getNodePath, onPositionClick]);

  // Extract HTML content between two positions
  const extractHtmlBetweenPositions = useCallback((start: RangePosition, end: RangePosition): string => {
    if (!contentRef.current) return '';

    try {
      const startNode = getNodeFromPath(start.path);
      const endNode = getNodeFromPath(end.path);

      if (!startNode || !endNode) return '';

      const range = document.createRange();

      // Set start position
      if (startNode.nodeType === Node.TEXT_NODE) {
        range.setStart(startNode, Math.min(start.offset, startNode.textContent?.length || 0));
      } else {
        range.setStartBefore(startNode);
      }

      // Set end position
      if (endNode.nodeType === Node.TEXT_NODE) {
        range.setEnd(endNode, Math.min(end.offset, endNode.textContent?.length || 0));
      } else {
        range.setEndAfter(endNode);
      }

      // Clone the contents
      const fragment = range.cloneContents();
      const div = document.createElement('div');
      div.appendChild(fragment);

      return div.innerHTML;
    } catch (err) {
      console.error('Failed to extract content:', err);
      return '';
    }
  }, [getNodeFromPath]);

  // Expose extraction function via ref (for parent component)
  useEffect(() => {
    if (contentRef.current) {
      (contentRef.current as any).extractHtmlBetweenPositions = extractHtmlBetweenPositions;
    }
  }, [extractHtmlBetweenPositions]);

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
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-auto cursor-text relative"
        onClick={handleContentClick}
        style={{
          background: '#f9fafb'
        }}
      >
        {/* Marker Overlays - Rendered on top of content */}
        {markerPositions.cursor && (
          <div
            className="marker-overlay absolute pointer-events-none z-10"
            style={{
              top: markerPositions.cursor.top,
              left: markerPositions.cursor.left - 2,
              width: 4,
              height: 24,
              backgroundColor: '#3b82f6',
              animation: 'blink 1s infinite'
            }}
            title="Cursor position"
          />
        )}
        {markerPositions.start && (
          <div
            className="marker-overlay absolute z-10 flex items-center justify-center pointer-events-none"
            style={{
              top: markerPositions.start.top - 12,
              left: markerPositions.start.left - 12,
              width: 24,
              height: 24,
              backgroundColor: '#10b981',
              borderRadius: '50%',
              color: 'white',
              fontSize: 12,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
            title="Section Start"
          >
            ▶
          </div>
        )}
        {markerPositions.end && (
          <div
            className="marker-overlay absolute z-10 flex items-center justify-center pointer-events-none"
            style={{
              top: markerPositions.end.top - 12,
              left: markerPositions.end.left - 12,
              width: 24,
              height: 24,
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              color: 'white',
              fontSize: 12,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
            title="Section End"
          >
            ■
          </div>
        )}

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
      {(startPosition || endPosition) && (
        <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-4 text-sm">
          {startPosition && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              Start marked
            </span>
          )}
          {endPosition && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              End marked
            </span>
          )}
          {startPosition && endPosition && (
            <span className="text-green-600 font-medium">
              ✓ Selection complete - ready to save
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentViewer;
