import React, { useEffect, useMemo, useState } from 'react';

const PEOPLE = [
  { name: 'Nicole', initial: 'N', birthday: '1995-02-02', color: '#ffb7d5' },
  { name: '稼晖', initial: 'H', birthday: '1989-09-25', color: '#9bdcff' },
];

const RELATIONSHIP_START = '2026-05-01';

function startOfDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(from, to) {
  return Math.max(0, Math.floor((startOfDay(to) - startOfDay(from)) / 86400000));
}

function nextAnnualDate(month, day, today) {
  let next = new Date(today.getFullYear(), month - 1, day);
  if (startOfDay(next) < startOfDay(today)) next = new Date(today.getFullYear() + 1, month - 1, day);
  return next;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(date);
}

export default function AnniversaryOrbit() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const milestones = useMemo(() => {
    const start = parseLocalDate(RELATIONSHIP_START);
    const anniversary = nextAnnualDate(5, 1, now);
    return {
      togetherDays: daysBetween(start, now) + 1,
      anniversary,
      anniversaryDays: daysBetween(now, anniversary),
      birthdays: PEOPLE.map((person) => {
        const birthday = parseLocalDate(person.birthday);
        const next = nextAnnualDate(birthday.getMonth() + 1, birthday.getDate(), now);
        return { ...person, next, days: daysBetween(now, next) };
      }),
    };
  }, [now]);

  return (
    <main className="anniversary-page">
      <div className="anniversary-stars" aria-hidden="true" />
      <section className="anniversary-hero">
        <p className="anniversary-eyebrow">N &amp; H · OUR MEMORY UNIVERSE</p>
        <h1>我们的时间，正在宇宙里发光</h1>
        <p className="anniversary-since">SINCE · 01 MAY 2026</p>

        <div className="orbit-stage" aria-label="N and H anniversary orbit">
          <div className="orbit-ring orbit-ring-one" />
          <div className="orbit-ring orbit-ring-two" />
          <div className="orbit-heart">♥</div>
          <div className="orbit-person orbit-person-n">N</div>
          <div className="orbit-person orbit-person-h">H</div>
        </div>

        <div className="together-count">
          <strong>{milestones.togetherDays}</strong>
          <span>我们在一起的第 {milestones.togetherDays} 天</span>
        </div>
      </section>

      <section className="milestone-grid">
        <article className="milestone-card milestone-anniversary">
          <span className="milestone-icon">∞</span>
          <p>下一个恋爱纪念日</p>
          <h2>{milestones.anniversaryDays === 0 ? '就是今天' : `${milestones.anniversaryDays} 天`}</h2>
          <small>{formatDate(milestones.anniversary)}</small>
        </article>

        {milestones.birthdays.map((person) => (
          <article className="milestone-card" key={person.name} style={{ '--person-color': person.color }}>
            <span className="milestone-avatar">{person.initial}</span>
            <p>距离 {person.name} 的生日</p>
            <h2>{person.days === 0 ? '生日快乐' : `${person.days} 天`}</h2>
            <small>{formatDate(person.next)}</small>
          </article>
        ))}
      </section>

      <p className="anniversary-note">每一次相遇，都是我们的星里程碑。</p>
    </main>
  );
}
