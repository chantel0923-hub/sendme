// FAQScreen.js — Add this to your src/ folder
// Then register it in App.js like all other screens

import React, { useState } from 'react';
import { FEATURED_VIDEOS, SENDME_CHANNEL_URL } from './sendmeVideos';
import YouTubeEmbed from './YouTubeEmbed';
import { notifyAdmin, sendNotification } from './notifications';

const faqs = [
  {
    category: "About SendMe",
    icon: "✦",
    questions: [
      {
        q: "What is SendMe and why does it exist?",
        a: `Brother, SendMe was born out of a simple burden — there are Message-believing missionaries answering Isaiah 6:8, saying "Here am I, send me," but they're going without sufficient support. Churches want to give, donors want to help, but there was no trusted place where it could all come together.\n\nSendMe is that place. It's a crowdfunding platform built specifically for Message-believing missionaries and churches — so that no called man or woman has to go to the field unprepared or unsupported.`
      },
      {
        q: "Is SendMe connected to a denomination or organisation?",
        a: `SendMe is not owned by any single church, board, or organisation. It is a ministry platform built on the foundation of the Message of the Hour — William Branham's ministry — and is open to any missionary or church that stands on that same foundation.\n\nNo one controls who gets funded except the Body of Christ itself, through prayer, endorsement, and giving.`
      },
      {
        q: "Who is behind SendMe?",
        a: `SendMe was founded by Br Donald Van Wyk, a Message-believing brother from South Africa, who felt led to build this platform to connect the global Body of Christ around the Great Commission (Mark 16:15). It is a faith project, built in prayer, and offered to the Body as a tool for Kingdom work.`
      },
    ]
  },
  {
    category: "For Missionaries",
    icon: "✈",
    questions: [
      {
        q: "Who can apply as a missionary on SendMe?",
        a: `Any Message-believing brother or sister who has a genuine call to the mission field and a church that will endorse them. You don't need to be famous, experienced, or fully funded — you just need a call, a willing heart, and a local church standing behind you.\n\nIf you've heard Isaiah 6:8 in your spirit, this platform is for you.`
      },
      {
        q: "What does the application process look like?",
        a: `The application walks you through 5 steps — your personal details, your mission field and calling, your budget breakdown, your church endorsement, and your supporting documents.\n\nOnce submitted, our team reviews your application. When approved, your mission goes live on the map and donors from around the world can begin supporting you.`
      },
      {
        q: "How do I receive the funds raised for my mission?",
        a: `Funds are held in a milestone-based escrow system. Your mission is broken into up to 3 milestones, and funds are released as each milestone is reached and verified. This protects both you and your donors — everyone can see exactly where the mission stands.\n\nYou'll receive field reports prompts to keep your donors updated, and the platform handles the transparency so you can focus on the work.`
      },
      {
        q: "What if I'm working in a restricted or dangerous region?",
        a: `SendMe has a Shadow Mode for missionaries in sensitive regions. Your exact location won't be publicly shown on the map — only a general region — and you can control how much detail is visible to the public versus your verified donors.\n\nYour safety comes first. The work can still be supported without putting you at risk.`
      },
    ]
  },
  {
    category: "For Churches",
    icon: "⛪",
    questions: [
      {
        q: "How can our church get involved with SendMe?",
        a: `There are three ways your church can be part of this:\n\n1. Endorse a missionary — if one of your members feels called, stand behind them with a church endorsement on their application.\n2. Register your church — get listed in the Message Church Directory so believers travelling or relocating can find you.\n3. Give — your congregation can donate directly to any mission on the platform, and track exactly how that giving is being used.`
      },
      {
        q: "What does it mean to endorse a missionary?",
        a: `Endorsement means your church is saying: "We know this person, we've prayed with them, and we believe their calling is genuine." It's not a legal guarantee — it's a spiritual one. It carries weight with donors because it shows accountability within the Body.\n\nNo missionary goes live on SendMe without a church endorsement. That's one of our core trust principles.`
      },
      {
        q: "Can our church use SendMe to coordinate sending a worker to another church?",
        a: `Yes — that's exactly what the Send a Worker feature is built for. If your church needs a teacher, song leader, or helper for a specific season, you can post that need and another church can respond. It's Kingdom coordination made simple.`
      },
      {
        q: "What should we include when posting a Send a Worker request?",
        a: `The clearer your request, the faster you'll find the right person. Include the role you need, roughly when, how long, and what the work involves — the same way you'd describe it to a trusted friend, not just "we need help."`
      },
      {
        q: "What kinds of needs can we post through Send a Worker?",
        a: `Teachers, song leaders, evangelists, translators, short-term outreach helpers, or anyone your church needs for a season of ministry. If it's Kingdom work and you need hands, post it.`
      },
      {
        q: "Once a worker responds, who's responsible for what?",
        a: `As the hosting church, you carry the venue, local logistics, and hospitality. The one who comes carries the calling and character they represented in their profile. SendMe makes the connection — the outworking is between the churches, the same trust that runs through the whole platform.`
      },
    ]
  },
  {
    category: "For Donors",
    icon: "🤲",
    questions: [
      {
        q: "How do I know my donation actually reaches the missionary?",
        a: `That's a fair and important question, brother. Here's how we protect your giving:\n\nEvery mission has a full budget breakdown visible to you before you give. Funds are released in milestones — not all at once — and the missionary must submit field reports to unlock each stage. The Transparency Ledger shows every transaction against every mission.\n\nYou gave in faith — you deserve to see the fruit.`
      },
      {
        q: "Can I support a specific missionary every month?",
        a: `Yes. The Adopt a Mission feature lets you commit to a missionary with monthly recurring support. You'll receive their updates directly and become a named part of their mission journey. Many of the greatest works in mission history were sustained by a small group of faithful monthly givers.`
      },
      {
        q: "What if a mission doesn't reach its goal?",
        a: `If a mission closes without reaching its funding goal, donors are notified and funds are either refunded or redirected to another mission of your choice. No money disappears — every rand and dollar is accounted for.`
      },
      {
        q: "Do I need to be Message-believing to donate?",
        a: `You don't need to be Message-believing to give — the Great Commission belongs to the whole Body of Christ. However, SendMe is a platform built on Message-believing values, and the missionaries you're supporting are standing on that foundation. We believe you deserve to know that before you give.`
      },
    ]
  },
  {
    category: "Trust & Safety",
    icon: "🛡",
    questions: [
      {
        q: "How does SendMe prevent fraud or misuse of funds?",
        a: `Several layers protect against misuse:\n\n• Every missionary must have a verified church endorsement\n• Funds release in milestones, not lump sums\n• Missionaries submit field reports with each milestone\n• The Transparency Ledger is publicly visible\n• Trust Score badges (Verified / Transparent / Trusted Partner) are earned over time, not given automatically\n\nWe take seriously that these are offerings given to God's work. We guard that trust carefully.`
      },
      {
        q: "What happens if a missionary abandons their mission?",
        a: `If a missionary goes silent or abandons their mission, their funding is frozen and their endorsing church is contacted. Remaining funds are held until resolution — either the mission resumes, is handed to another worker, or donors are refunded. We don't let giving disappear without accountability.`
      },
    ]
  },
];

export default function FAQScreen({ onBack }) {
  const [openIndex, setOpenIndex] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactError, setContactError] = useState('');

  const toggle = (key) => {
    setOpenIndex(openIndex === key ? null : key);
  };

  const submitContact = async () => {
    if (!contactForm.email.trim() || !contactForm.message.trim()) {
      setContactError('Please fill in your email and your question before sending.');
      return;
    }
    setContactSubmitting(true);
    setContactError('');
    try {
      // WhatsApp ping to admin — fire-and-forget
      notifyAdmin('support_contact', {
        name: contactForm.name.trim() || 'Anonymous',
        email: contactForm.email.trim(),
        message: contactForm.message.trim(),
      });
      // Full message captured via email so nothing is lost
      const emailResult = await sendNotification('contact_form', 'sendmemissionfund@gmail.com', {
        name: contactForm.name.trim() || 'Anonymous',
        email: contactForm.email.trim(),
        message: contactForm.message.trim(),
      });
      if (!emailResult?.sent) {
        console.warn('Contact form email did not send:', emailResult?.error);
      }
      setContactSubmitted(true);
    } catch (e) {
      setContactError('Could not send your message. Please try again, or email us directly at sendmemissionfund@gmail.com.');
    }
    setContactSubmitting(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#060c18',
      color: '#f0e6d0',
      fontFamily: 'Georgia, serif',
      paddingBottom: '60px',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, #0a1628 0%, #060c18 100%)',
        borderBottom: '1px solid rgba(232,179,75,0.2)',
        padding: '20px 20px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#e8b34b',
              fontSize: '22px',
              cursor: 'pointer',
              padding: '0',
              lineHeight: 1,
            }}
          >
            ←
          </button>
          <span style={{ color: '#e8b34b', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>
            SendMe
          </span>
        </div>
        <h1 style={{
          margin: 0,
          fontSize: '26px',
          fontWeight: 'normal',
          color: '#fff',
          lineHeight: 1.2,
        }}>
          Frequently Asked Questions
        </h1>
        <p style={{
          margin: '8px 0 0',
          fontSize: '14px',
          color: 'rgba(240,230,208,0.6)',
          lineHeight: 1.5,
        }}>
          Got a question? We want to answer it honestly, brother.
        </p>
      </div>

      {/* Scripture banner */}
      <div style={{
        margin: '20px 16px',
        padding: '16px 18px',
        background: 'rgba(232,179,75,0.07)',
        border: '1px solid rgba(232,179,75,0.25)',
        borderLeft: '3px solid #e8b34b',
        borderRadius: '6px',
      }}>
        <p style={{
          margin: 0,
          fontSize: '14px',
          fontStyle: 'italic',
          color: '#e8b34b',
          lineHeight: 1.6,
        }}>
          "Also I heard the voice of the Lord, saying, Whom shall I send, and who will go for us? Then said I, Here am I; send me."
        </p>
        <p style={{
          margin: '6px 0 0',
          fontSize: '12px',
          color: 'rgba(232,179,75,0.6)',
          letterSpacing: '1px',
        }}>
          — Isaiah 6:8
        </p>
      </div>

      {/* Video Tutorials */}
      {(FEATURED_VIDEOS.missionaryHowTo || FEATURED_VIDEOS.churchHowTo || FEATURED_VIDEOS.donorHowTo) && (
        <div style={{ margin: '0 16px 20px' }}>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: '13px',
            fontFamily: 'Georgia, serif',
            fontWeight: 'normal',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#e8b34b',
          }}>
            ▶ Video Tutorials
          </h2>
          {FEATURED_VIDEOS.missionaryHowTo && (
            <YouTubeEmbed videoId={FEATURED_VIDEOS.missionaryHowTo} title="How to Apply as a Missionary" caption="For Missionaries — How to Apply" />
          )}
          {FEATURED_VIDEOS.churchHowTo && (
            <YouTubeEmbed videoId={FEATURED_VIDEOS.churchHowTo} title="How Your Church Can Partner with SendMe" caption="For Churches — How to Partner" />
          )}
          {FEATURED_VIDEOS.donorHowTo && (
            <YouTubeEmbed videoId={FEATURED_VIDEOS.donorHowTo} title="How to Give and Pray on SendMe" caption="For Donors — How to Give & Pray" />
          )}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <a href={SENDME_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#e8b34b', textDecoration: 'underline', fontFamily: 'Georgia, serif' }}>
              Visit our YouTube channel for more
            </a>
          </div>
        </div>
      )}

      {/* FAQ Categories */}
      <div style={{ padding: '0 16px' }}>
        {faqs.map((section, sIdx) => (
          <div key={sIdx} style={{ marginBottom: '28px' }}>
            {/* Category heading */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(232,179,75,0.15)',
            }}>
              <span style={{ fontSize: '18px' }}>{section.icon}</span>
              <h2 style={{
                margin: 0,
                fontSize: '13px',
                fontFamily: 'Georgia, serif',
                fontWeight: 'normal',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: '#e8b34b',
              }}>
                {section.category}
              </h2>
            </div>

            {/* Questions */}
            {section.questions.map((item, qIdx) => {
              const key = `${sIdx}-${qIdx}`;
              const isOpen = openIndex === key;
              return (
                <div
                  key={qIdx}
                  style={{
                    marginBottom: '8px',
                    background: isOpen ? 'rgba(232,179,75,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isOpen ? 'rgba(232,179,75,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Question row */}
                  <button
                    onClick={() => toggle(key)}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      gap: '12px',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      fontSize: '14px',
                      color: isOpen ? '#e8b34b' : '#f0e6d0',
                      lineHeight: 1.4,
                      fontFamily: 'Georgia, serif',
                      flex: 1,
                    }}>
                      {item.q}
                    </span>
                    <span style={{
                      color: '#e8b34b',
                      fontSize: '18px',
                      lineHeight: 1,
                      flexShrink: 0,
                      marginTop: '1px',
                      transform: isOpen ? 'rotate(45deg)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}>
                      +
                    </span>
                  </button>

                  {/* Answer */}
                  {isOpen && (
                    <div style={{
                      padding: '0 16px 16px',
                      borderTop: '1px solid rgba(232,179,75,0.1)',
                    }}>
                      {item.a.split('\n\n').map((para, pIdx) => (
                        <p key={pIdx} style={{
                          margin: pIdx === 0 ? '14px 0 0' : '10px 0 0',
                          fontSize: '13px',
                          color: 'rgba(240,230,208,0.8)',
                          lineHeight: 1.7,
                          whiteSpace: 'pre-line',
                        }}>
                          {para}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div style={{
        margin: '8px 16px 0',
        padding: '20px',
        background: 'rgba(232,179,75,0.07)',
        border: '1px solid rgba(232,179,75,0.2)',
        borderRadius: '10px',
        textAlign: 'center',
      }}>
        {contactSubmitted ? (
          <>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🙏</div>
            <p style={{ margin: '0 0 4px', fontSize: '15px', color: '#fff', fontFamily: 'Georgia, serif' }}>
              Message received
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(240,230,208,0.6)', lineHeight: 1.5 }}>
              We'll get back to you personally as soon as we can, brother.
            </p>
          </>
        ) : showContactForm ? (
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: '0 0 14px', fontSize: '15px', color: '#fff', fontFamily: 'Georgia, serif', textAlign: 'center' }}>
              Send us your question
            </p>
            {contactError && (
              <div style={{ background: 'rgba(232,91,91,0.1)', border: '1px solid rgba(232,91,91,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#e85b5b' }}>
                {contactError}
              </div>
            )}
            <input
              placeholder="Your name (optional)"
              value={contactForm.name}
              onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0e6d0', fontSize: 13, fontFamily: 'Georgia, serif', outline: 'none', marginBottom: 10 }}
            />
            <input
              placeholder="Your email *"
              type="email"
              value={contactForm.email}
              onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0e6d0', fontSize: 13, fontFamily: 'Georgia, serif', outline: 'none', marginBottom: 10 }}
            />
            <textarea
              placeholder="Your question *"
              value={contactForm.message}
              onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0e6d0', fontSize: 13, fontFamily: 'Georgia, serif', outline: 'none', resize: 'vertical', minHeight: 80, marginBottom: 12 }}
            />
            <button
              onClick={submitContact}
              disabled={contactSubmitting}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
                background: contactSubmitting ? 'rgba(232,179,75,0.4)' : '#e8b34b',
                color: '#060c18', fontSize: 13, fontFamily: 'Georgia, serif', fontWeight: 'bold',
                letterSpacing: '0.5px', cursor: contactSubmitting ? 'default' : 'pointer',
              }}
            >
              {contactSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        ) : (
          <>
            <p style={{
              margin: '0 0 6px',
              fontSize: '15px',
              color: '#fff',
              fontFamily: 'Georgia, serif',
            }}>
              Still have a question?
            </p>
            <p style={{
              margin: '0 0 14px',
              fontSize: '13px',
              color: 'rgba(240,230,208,0.6)',
              lineHeight: 1.5,
            }}>
              We're real people, brother. Reach out and we'll answer you personally.
            </p>
            <button
              onClick={() => setShowContactForm(true)}
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                background: '#e8b34b',
                border: 'none',
                color: '#060c18',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: 'Georgia, serif',
                fontWeight: 'bold',
                letterSpacing: '0.5px',
                cursor: 'pointer',
              }}
            >
              Contact Us
            </button>
          </>
        )}
      </div>
    </div>
  );
}
