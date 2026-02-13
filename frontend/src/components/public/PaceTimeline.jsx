import { useMemo } from 'react';

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function PaceTimeline({ announcements, pools }) {
  const milestones = useMemo(() => {
    const items = [];

    // From announcements: event_started, all_pools_complete, event_stopped
    for (const a of announcements || []) {
      const trigger = a.trigger;
      if (trigger === 'event_started') {
        // Extract event name from raw_text or context
        const match = a.raw_text?.match(/The (.+?) event/);
        const eventName = match ? match[1] : 'Event';
        items.push({
          type: 'started',
          event: eventName,
          text: `${eventName} started`,
          time: a.created_at,
        });
      } else if (trigger === 'all_pools_complete') {
        const match = a.raw_text?.match(/for (.+?) are/);
        const eventName = match ? match[1] : 'Event';
        items.push({
          type: 'complete',
          event: eventName,
          text: `All pools complete for ${eventName}`,
          time: a.created_at,
        });
      } else if (trigger === 'event_stopped') {
        const match = a.raw_text?.match(/The (.+?) event/);
        const eventName = match ? match[1] : 'Event';
        items.push({
          type: 'stopped',
          event: eventName,
          text: `${eventName} concluded`,
          time: a.created_at,
        });
      }
    }

    // From approved pools
    for (const pool of pools || []) {
      if (pool.submission?.status === 'approved' && pool.submission?.reviewed_at) {
        items.push({
          type: 'approved',
          event: pool.event,
          text: `Pool ${pool.pool_number} approved`,
          time: pool.submission.reviewed_at,
        });
      }
    }

    // Sort chronologically
    items.sort((a, b) => new Date(a.time) - new Date(b.time));

    // Group by event
    const grouped = {};
    for (const item of items) {
      if (!grouped[item.event]) grouped[item.event] = [];
      grouped[item.event].push(item);
    }

    return grouped;
  }, [announcements, pools]);

  const eventNames = Object.keys(milestones);

  if (eventNames.length === 0) {
    return (
      <div className="no-data-message">
        No timeline events yet. The timeline will populate as events start and pools are approved.
      </div>
    );
  }

  return (
    <div className="pace-timeline">
      {eventNames.map((eventName) => (
        <div key={eventName} className="timeline-event-group">
          <div className="timeline-event-label">{eventName}</div>
          {milestones[eventName].map((item, i) => (
            <div key={i} className="timeline-item">
              <div className={`timeline-dot dot-${item.type}`} />
              {i < milestones[eventName].length - 1 && (
                <div className="timeline-connector" />
              )}
              <div className="timeline-text">{item.text}</div>
              <div className="timeline-time">{formatTime(item.time)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
