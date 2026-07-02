const axios = require('axios');
const logger = require('../utils/logger');

const TONE_GUIDANCE = {
  'Professional': 'formal, respectful business tone, no slang',
  'Friendly & Casual': 'warm, conversational, like talking to a friend',
  'Consultative': 'expert advisor tone, lead with data/insight, low-pressure',
  'Urgent / Problem-Focused': 'direct, highlights cost of inaction, creates urgency without being pushy',
};

const TYPE_GUIDANCE = {
  'Cold Email': 'a cold outreach email with subject line, 80-120 words, one clear CTA',
  'WhatsApp Message': 'a short WhatsApp message, under 60 words, casual punctuation, no formal subject line',
  'LinkedIn DM': 'a LinkedIn direct message, under 70 words, professional but personable',
  'Follow-up Email': 'a brief follow-up email referencing a previous message, under 70 words',
  'Phone Script': 'a short phone call opening script with a hook and one question, under 80 words',
};

/**
 * Generates a personalized outreach pitch using OpenAI.
 * Falls back to template-based generation if no API key is configured.
 */
async function generatePitch({ businessName, city, industry, gaps, service, tone, pitchType, senderName, agencyName }) {
  if (!process.env.OPENAI_API_KEY) {
    return templateFallback({ businessName, gaps, service, tone, pitchType, senderName, agencyName });
  }

  const prompt = `You are a sales copywriter for a digital marketing agency called "${agencyName || 'our agency'}".
Write ${TYPE_GUIDANCE[pitchType] || TYPE_GUIDANCE['Cold Email']} to a prospect.

Business: ${businessName}${city ? ` (${city})` : ''}${industry ? `, industry: ${industry}` : ''}
Detected gaps in their online presence: ${gaps?.join(', ') || 'general digital marketing gaps'}
Service being pitched: ${service}
Tone: ${TONE_GUIDANCE[tone] || TONE_GUIDANCE['Professional']}
Sender name: ${senderName || 'Arjun'}

Rules:
- Reference at least one specific, real-sounding gap naturally (don't just list them)
- Do NOT be generic or salesy/spammy
- Include a clear, low-friction call to action (e.g. "worth a 10-min call?")
- ${pitchType === 'Cold Email' ? 'Include a subject line on the first line prefixed with "Subject: "' : 'No subject line needed'}
- Sign off with the sender name only (no agency boilerplate/address)
- Output ONLY the message text, nothing else`;

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 400,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const text = data.choices[0].message.content.trim();
    let subject = null, body = text;

    if (text.startsWith('Subject:')) {
      const lines = text.split('\n');
      subject = lines[0].replace('Subject:', '').trim();
      body = lines.slice(1).join('\n').trim();
    }

    return { subject, body };
  } catch (err) {
    logger.warn('OpenAI pitch generation failed, using fallback:', err.message);
    return templateFallback({ businessName, gaps, service, tone, pitchType, senderName, agencyName });
  }
}

function templateFallback({ businessName, gaps, service, tone, pitchType, senderName = 'Arjun', agencyName = 'our agency' }) {
  const gapText = gaps?.[0] || 'your online presence';
  const templates = {
    'Professional': {
      subject: `Helping ${businessName} grow online`,
      body: `Hi,\n\nI came across ${businessName} and noticed an opportunity to improve ${gapText.toLowerCase()}.\n\nWe specialize in ${service} for businesses like yours at ${agencyName}, and I'd love to share a few quick wins — no obligation.\n\nWould you be open to a 15-minute call this week?\n\nBest regards,\n${senderName}`,
    },
    'Friendly & Casual': {
      subject: `Quick idea for ${businessName}`,
      body: `Hey there!\n\nI was checking out ${businessName} and noticed ${gapText.toLowerCase()} could use some love. We've helped similar businesses fix this with ${service}.\n\nMind if I share what I found? Takes 5 minutes!\n\nCheers,\n${senderName}`,
    },
    'Consultative': {
      subject: `A few findings about ${businessName}'s online presence`,
      body: `Hi,\n\nI did a quick audit of ${businessName} and noticed ${gapText.toLowerCase()} is holding back your growth.\n\nWould you be open to a short consultation to walk through what I found and how ${service} could help?\n\n${senderName}`,
    },
    'Urgent / Problem-Focused': {
      subject: `${businessName} may be losing customers to this`,
      body: `Hi,\n\nQuick heads-up — I noticed ${gapText.toLowerCase()} on ${businessName}'s online presence, which may be costing you customers right now.\n\nWe fix this with ${service}, often within 30 days. Can we talk this week?\n\n${senderName}`,
    },
  };

  const t = templates[tone] || templates['Professional'];

  if (pitchType === 'WhatsApp Message') {
    return { subject: null, body: `Hi! I noticed ${gapText.toLowerCase()} on ${businessName}'s online presence. We help businesses like yours fix this with ${service}. Worth a quick chat? – ${senderName}` };
  }
  if (pitchType === 'LinkedIn DM') {
    return { subject: null, body: `Hi! I help businesses like ${businessName} grow through ${service}. Noticed ${gapText.toLowerCase()} — happy to share some quick ideas if useful. Open to connecting?` };
  }
  if (pitchType === 'Phone Script') {
    return { subject: null, body: `Hi, this is ${senderName} from ${agencyName}. I was looking at ${businessName} online and noticed ${gapText.toLowerCase()}. We've helped similar businesses fix exactly this. Do you have 2 minutes to hear how?` };
  }

  return { subject: t.subject, body: t.body };
}

module.exports = { generatePitch };
