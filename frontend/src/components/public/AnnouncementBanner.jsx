import { useState, useEffect } from 'react';

export default function AnnouncementBanner({ announcements }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const announced = (announcements || [])
    .filter((a) => a.status === 'announced')
    .slice(0, 3);

  useEffect(() => {
    if (announced.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announced.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [announced.length]);

  if (announced.length === 0) return null;

  const current = announced[currentIndex % announced.length];

  return (
    <div className="announcement-banner">
      <div className="announcement-banner-text" key={current.id}>
        {current.polished_text || current.raw_text}
      </div>
    </div>
  );
}
