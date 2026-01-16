import { useState } from 'react';
import { X, Check, AlertTriangle, AlertCircle, Copy, Save, Trash2 } from 'lucide-react';

const WebhookDebugPopup = ({ data, onConfirm, onDiscard, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const { type, payload, validation, timestamp, jobId } = data;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatTimestamp = (ts) => {
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="webhook-debug-overlay">
      <div className="webhook-debug-popup">
        <div className="popup-header">
          <h2>
            {validation?.isValid ? (
              <span className="status-valid">
                <Check size={20} />
                Webhook Data Received
              </span>
            ) : (
              <span className="status-invalid">
                <AlertCircle size={20} />
                Validation Errors
              </span>
            )}
          </h2>
          <button onClick={onClose} className="btn-close" title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="popup-content">
          {/* Test Mode Banner */}
          <div className="test-mode-banner">
            <AlertTriangle size={18} />
            <span>Test Mode: Data has NOT been saved to the database</span>
          </div>

          {/* Metadata */}
          <div className="debug-section">
            <h3>Request Info</h3>
            <div className="debug-meta">
              <div className="meta-item">
                <span className="label">Type:</span>
                <span className="value">{type === 'evaluation' ? 'Evaluation Webhook' : 'Proposal Result Webhook'}</span>
              </div>
              <div className="meta-item">
                <span className="label">Job ID:</span>
                <span className="value code">{jobId}</span>
              </div>
              <div className="meta-item">
                <span className="label">Received:</span>
                <span className="value">{formatTimestamp(timestamp)}</span>
              </div>
            </div>
          </div>

          {/* Validation Results */}
          {validation && (
            <div className="debug-section">
              <h3>Validation</h3>

              {validation.errors?.length > 0 && (
                <div className="validation-errors">
                  <h4><AlertCircle size={16} /> Errors</h4>
                  <ul>
                    {validation.errors.map((err, idx) => (
                      <li key={idx} className="error">{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.warnings?.length > 0 && (
                <div className="validation-warnings">
                  <h4><AlertTriangle size={16} /> Warnings</h4>
                  <ul>
                    {validation.warnings.map((warn, idx) => (
                      <li key={idx} className="warning">{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.errors?.length === 0 && validation.warnings?.length === 0 && (
                <div className="validation-success">
                  <Check size={16} />
                  <span>All validation checks passed</span>
                </div>
              )}

              <div className="fields-info">
                <div className="fields-received">
                  <strong>Received fields:</strong>
                  <span className="field-list">
                    {validation.receivedFields?.join(', ') || 'None'}
                  </span>
                </div>
                <div className="fields-expected">
                  <strong>Expected fields:</strong>
                  <span className="field-list">
                    {validation.expectedFields?.join(', ') || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* JSON Payload */}
          <div className="debug-section">
            <div className="section-header">
              <h3>JSON Payload</h3>
              <button onClick={copyToClipboard} className="btn-icon" title="Copy JSON">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <pre className="json-viewer">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>

        <div className="popup-footer">
          <button onClick={onDiscard} className="btn-secondary danger">
            <Trash2 size={18} />
            <span>Discard</span>
          </button>
          <button onClick={onConfirm} className="btn-primary" disabled={!validation?.isValid}>
            <Save size={18} />
            <span>Continue & Save to Database</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WebhookDebugPopup;
