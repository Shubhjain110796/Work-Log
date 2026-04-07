import { useState, useEffect } from 'react';
import './Card.css';

function Card() {
  const targetDate = new Date('2026-03-08T12:35:00'); // 8/3/2026 12:35 PM

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="card-container">
      <div className="invitation-card">
        <div className="card-header">
          <h1>You're Invited!</h1>
          <p className="greeting">Dear ssj & ksj</p>
        </div>
        <div className="card-body">
          <div className="event-details">
            <div className="detail-item">
              <span className="icon">📅</span>
              <span className="label">Date:</span>
              <span className="value">8/3/2026</span>
            </div>
            <div className="detail-item">
              <span className="icon">🕒</span>
              <span className="label">Time:</span>
              <span className="value">12:35 PM</span>
            </div>
            <div className="detail-item">
              <span className="icon">📍</span>
              <span className="label">Location:</span>
              <span className="value">ITI Signal, Nashik</span>
            </div>
          </div>
          <div className="countdown">
            <h2>Countdown to Event</h2>
            <div className="timer">
              <div className="time-unit">
                <span className="number">{timeLeft.days}</span>
                <span className="label">Days</span>
              </div>
              <div className="time-unit">
                <span className="number">{timeLeft.hours}</span>
                <span className="label">Hours</span>
              </div>
              <div className="time-unit">
                <span className="number">{timeLeft.minutes}</span>
                <span className="label">Minutes</span>
              </div>
              <div className="time-unit">
                <span className="number">{timeLeft.seconds}</span>
                <span className="label">Seconds</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card-footer">
          <p>Join us for an unforgettable live event!</p>
          <div className="decorative-elements">
            <span>🎉</span>
            <span>✨</span>
            <span>🎊</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Card;