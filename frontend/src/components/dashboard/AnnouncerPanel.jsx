import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';

const TRIGGER_BADGES = {
  event_started: { label: 'Event Started', color: '#22c55e' },
  event_stopped: { label: 'Event Stopped', color: '#6b7280' },
  pool_approved: { label: 'Pool Approved', color: '#3b82f6' },
  all_pools_complete: { label: 'All Pools Done', color: '#a855f7' },
  custom: { label: 'Custom', color: '#f59e0b' },
};

export default function AnnouncerPanel({ addNotification }) {
  const [announcements, setAnnouncements] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Custom announcement state
  const [customText, setCustomText] = useState('');
  const [polishedPreview, setPolishedPreview] = useState(null);
  const [polishing, setPolishing] = useState(false);

  // Voice state
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
        // Default to first English voice
        const english = available.find((v) => v.lang.startsWith('en'));
        if (english) setSelectedVoiceURI(english.voiceURI);
        else if (available[0]) setSelectedVoiceURI(available[0].voiceURI);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const data = await api.getAnnouncements(50, 0);
      setAnnouncements(data.announcements || []);
      setTotal(data.total || 0);
    } catch (err) {
      // Silently fail on fetch — panel may not be critical
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAnnouncements().finally(() => setLoading(false));
  }, [fetchAnnouncements]);

  // Expose refresh for WebSocket handler
  useEffect(() => {
    window._announcerPanelRefresh = fetchAnnouncements;
    return () => { delete window._announcerPanelRefresh; };
  }, [fetchAnnouncements]);

  const getSelectedVoice = () => {
    if (!selectedVoiceURI) return null;
    return voices.find((v) => v.voiceURI === selectedVoiceURI) || null;
  };

  const handleSpeak = async (announcement) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(announcement.polished_text);
    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.onend = async () => {
      try {
        await api.markAnnounced(announcement.id);
        fetchAnnouncements();
      } catch (err) {
        addNotification('error', 'Mark Failed', err.message);
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  const handleDismiss = async (id) => {
    try {
      await api.dismissAnnouncement(id);
      fetchAnnouncements();
    } catch (err) {
      addNotification('error', 'Dismiss Failed', err.message);
    }
  };

  const handlePolish = async () => {
    if (!customText.trim()) return;
    setPolishing(true);
    try {
      const data = await api.polishAnnouncement(customText.trim());
      setPolishedPreview(data.announcement);
    } catch (err) {
      addNotification('error', 'Polish Failed', err.message);
    }
    setPolishing(false);
  };

  const handleSpeakCustom = () => {
    if (!polishedPreview) return;
    handleSpeak(polishedPreview);
    setCustomText('');
    setPolishedPreview(null);
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading announcements...</div>;
  }

  return (
    <div>
      {/* Voice selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
          Voice
        </label>
        <select
          value={selectedVoiceURI}
          onChange={(e) => setSelectedVoiceURI(e.target.value)}
          style={{
            width: '100%', padding: '5px 8px', fontSize: 12,
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box',
          }}
        >
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      {/* Custom announcement area */}
      <div style={{
        padding: 12, background: 'var(--surface)', borderRadius: 8,
        border: '1px solid var(--border)', marginBottom: 16,
      }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
          Custom Announcement
        </label>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Type your announcement here..."
          rows={2}
          style={{
            width: '100%', padding: '6px 8px', fontSize: 13,
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--bg)', color: 'var(--text)', resize: 'vertical',
            boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handlePolish}
          disabled={polishing || !customText.trim()}
          style={{
            marginTop: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600,
            background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6,
            cursor: polishing || !customText.trim() ? 'not-allowed' : 'pointer',
            opacity: polishing || !customText.trim() ? 0.5 : 1,
          }}
        >
          {polishing ? 'Polishing...' : 'Polish & Preview'}
        </button>

        {polishedPreview && (
          <div style={{
            marginTop: 10, padding: 10, background: 'var(--bg)',
            borderRadius: 6, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
              Polished Preview
            </div>
            <textarea
              value={polishedPreview.polished_text}
              onChange={(e) => setPolishedPreview({ ...polishedPreview, polished_text: e.target.value })}
              rows={2}
              style={{
                width: '100%', padding: '6px 8px', fontSize: 13,
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'var(--surface)', color: 'var(--text)', resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleSpeakCustom}
              style={{
                marginTop: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600,
                background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Speak
            </button>
          </div>
        )}
      </div>

      {/* Suggestion feed */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
        Suggestions ({total})
      </div>

      {announcements.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20, fontSize: 13 }}>
          No announcements yet. Start an event or approve a pool to see suggestions.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {announcements.map((a) => {
            const badge = TRIGGER_BADGES[a.trigger] || { label: a.trigger, color: '#6b7280' };
            const ts = a.created_at ? new Date(a.created_at).toLocaleTimeString() : '';
            const isPending = a.status === 'pending';

            return (
              <div key={a.id} style={{
                padding: '8px 10px', background: 'var(--surface)', borderRadius: 6,
                border: '1px solid var(--border)', fontSize: 13,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 6px', borderRadius: 4,
                    background: badge.color + '20', color: badge.color,
                    fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap',
                  }}>
                    {badge.label}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{ts}</span>
                  {!isPending && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                      color: a.status === 'announced' ? '#22c55e' : '#6b7280',
                    }}>
                      {a.status === 'announced' ? 'Announced' : 'Dismissed'}
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--text)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {a.polished_text}
                </div>
                {isPending && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      onClick={() => handleSpeak(a)}
                      style={{
                        padding: '3px 10px', fontSize: 11, fontWeight: 600,
                        background: '#22c55e', color: '#fff', border: 'none',
                        borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      Speak
                    </button>
                    <button
                      onClick={() => handleDismiss(a.id)}
                      style={{
                        padding: '3px 10px', fontSize: 11, fontWeight: 600,
                        background: 'var(--bg-hover)', color: 'var(--text-muted)', border: 'none',
                        borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
