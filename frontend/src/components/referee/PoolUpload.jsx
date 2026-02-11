import { useState, useRef } from 'react';
import { api } from '../../api/client';

export default function PoolUpload({ pool, onComplete, onCancel }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadPoolPhoto(pool.id, file);
      setSuccess(result?.submission?.status === 'ocr_failed' ? 'ocr_failed' : true);
      setTimeout(() => onComplete(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-page">
      <header className="app-header">
        <div className="app-header-left">
          <h1>Upload Score Sheet</h1>
        </div>
        <button className="back-home-btn" onClick={onCancel}>Back to Pools</button>
      </header>

      <div className="upload-content">
        <div className="upload-pool-info">
          <h3>Pool {pool.pool_number} — {pool.event}</h3>
          <p>Strip {pool.strip_number} — {pool.fencer_count} fencers</p>
        </div>

        {success ? (
          <div className="upload-success">
            <div className="success-icon">&#10003;</div>
            <p>Score sheet uploaded successfully!</p>
            <p className="success-sub">
              {success === 'ocr_failed'
                ? 'OCR could not read the sheet — committee will enter scores manually.'
                : 'OCR processing complete. Awaiting committee review.'}
            </p>
          </div>
        ) : (
          <>
            <div className="upload-area" onClick={() => inputRef.current?.click()}>
              {preview ? (
                <img src={preview} alt="Score sheet preview" className="upload-preview" />
              ) : (
                <div className="upload-placeholder">
                  <div className="camera-icon">&#128247;</div>
                  <p>Tap to take photo or select image</p>
                  <p className="upload-hint">USFA pool score sheet</p>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {error && <div className="upload-error">{error}</div>}

            <div className="upload-actions">
              {file && !uploading && (
                <button className="upload-btn primary" onClick={handleUpload}>
                  Upload & Process
                </button>
              )}
              {uploading && (
                <div className="upload-progress">
                  <div className="spinner"></div>
                  <span>Processing with OCR...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
