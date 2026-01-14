import { NextRequest, NextResponse } from 'next/server';

interface GenerateRequest {
  idea: string;
  tone: 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational';
  platform: string;
  additionalContext?: string;
}

const TONE_DESCRIPTIONS = {
  professional: 'formal, polished, and business-appropriate',
  casual: 'friendly, relaxed, and conversational',
  humorous: 'witty, playful, and entertaining',
  inspirational: 'motivating, uplifting, and encouraging',
  educational: 'informative, clear, and instructive',
};

const PLATFORM_LIMITS = {
  twitter: 280,
  instagram: 2200,
  linkedin: 3000,
  facebook: 63206,
  tiktok: 2200,
};

const DEMO_RESPONSES: Record<string, Record<string, string>> = {
  professional: {
    twitter: "Excited to share insights on this topic. The key takeaway? Focus on value delivery and measurable outcomes. What strategies have worked for you? #BusinessGrowth #Leadership",
    instagram: "The secret to success isn't working harder—it's working smarter.\n\nHere's what I've learned after years in the industry:\n\n✅ Set clear, measurable goals\n✅ Build systems, not just habits\n✅ Invest in continuous learning\n✅ Surround yourself with excellence\n\nWhat's your top productivity tip? Drop it below! 👇\n\n#ProfessionalDevelopment #CareerGrowth #Success",
    linkedin: "I've been reflecting on what truly drives professional success, and wanted to share some thoughts.\n\nThe most impactful leaders I've worked with share these traits:\n\n1. They prioritize outcomes over activities\n2. They invest heavily in their teams' growth\n3. They maintain transparency in communication\n4. They adapt quickly to change\n\nWhat qualities do you value most in leadership?\n\n#Leadership #ProfessionalDevelopment #CareerAdvice",
    facebook: "Just finished an incredible strategy session with the team! 🚀\n\nWe mapped out our Q2 objectives and I'm thrilled with the direction we're heading. Key focus areas include streamlining our processes and enhancing our customer experience.\n\nWould love to hear what goals you're working toward this quarter!",
    tiktok: "The one career tip I wish I knew earlier? Your network is your net worth! 💼\n\nStart building genuine connections today. Comment below with your industry and let's connect! 🤝\n\n#CareerTips #Networking #ProfessionalGrowth",
  },
  casual: {
    twitter: "Just tried this and honestly? Game changer 🙌 Highly recommend giving it a shot. Let me know if you've experienced something similar!",
    instagram: "Can we talk about this for a sec? 😍\n\nLike, I literally can't stop thinking about it. Sometimes the simple things in life just hit different, you know?\n\nDrop a 🙌 if you can relate!\n\n#Vibes #Mood #LifeIsGood",
    linkedin: "Real talk: not every day is going to be productive, and that's okay.\n\nSome days you crush it, other days you're just surviving. Both are valid. The key is showing up and doing your best, whatever that looks like.\n\nHow's your week going so far?",
    facebook: "OK so this happened today and I just had to share 😂\n\nYou know those moments that make you stop and appreciate the little things? Yeah, this was one of those. Sometimes life just delivers these perfect little surprises!\n\nAnyone else have a moment like this recently?",
    tiktok: "POV: You discover something that changes everything 👀\n\nNo seriously, where has this been all my life?! Drop a comment if you need to know! 🔥\n\n#GameChanger #MustTry #Obsessed",
  },
  humorous: {
    twitter: "My productivity today: 📉📉📉\nMy coffee consumption: 📈📈📈\n\nCorrelation? Absolutely none. Coincidence? I think not. ☕️",
    instagram: "Things I'm good at:\n❌ Waking up early\n❌ Going to bed on time  \n❌ Eating vegetables\n✅ Making questionable life decisions at 2am\n\nWho else is in this club? 🙋‍♂️\n\nNo? Just me? Cool cool cool.\n\n#RelatableContent #Adulting #SendHelp",
    linkedin: "Unpopular opinion: The 'quick sync' that could have been an email should have been an email.\n\nI said what I said. 📧\n\n#MeetingRecovery #CorporateLife #WorkHumor",
    facebook: "Tried to be productive today. Ended up reorganizing my entire sock drawer and deep-cleaning my phone screen protector.\n\nProcrastination level: EXPERT 🏆\n\nTell me I'm not alone in this 😅",
    tiktok: "When you say 'one more episode' and suddenly it's 3am 👁️👄👁️\n\nWe've all been there, no judgment zone! Drop your guilty pleasure show below 📺\n\n#Relatable #TVAddict #NoRegrets",
  },
  inspirational: {
    twitter: "Your journey is unique. Your pace is valid. Your progress matters. Keep going—every step forward counts 🌟 #Motivation #Growth",
    instagram: "Reminder for today:\n\nYou are exactly where you need to be. 🌿\n\nEvery challenge you've faced has shaped you. Every setback has taught you something valuable. Every moment of doubt has made you stronger.\n\nTrust the process. Trust yourself.\n\nYou've got this. ✨\n\n#DailyInspiration #YouAreEnough #KeepGoing",
    linkedin: "Three years ago, I was questioning everything about my career path.\n\nToday, I'm grateful I didn't give up.\n\nThe road wasn't linear. There were pivots, failures, and moments of serious doubt. But here's what I learned: the detours often lead to the best destinations.\n\nTo anyone feeling stuck right now: your breakthrough might be just around the corner. Keep going.\n\n#CareerJourney #NeverGiveUp #Inspiration",
    facebook: "To whoever needs to hear this today:\n\nYour potential is limitless. Your dreams are valid. Your efforts matter.\n\nDon't let anyone—including yourself—tell you otherwise. 💫\n\nSharing this for anyone who needs a little encouragement today. We're all in this together! ❤️",
    tiktok: "This is your sign to go after that dream 🌟\n\nYes, it's scary. Yes, it's hard. But you're braver than you believe and stronger than you think.\n\nLet's manifest it together! Comment your goal below 👇✨\n\n#Motivation #DreamBig #YouGotThis",
  },
  educational: {
    twitter: "Did you know? 🧠 This concept has transformed how many approach the topic. Here's the key insight you need to understand [thread] 🧵",
    instagram: "Let's break this down 📚\n\nMost people get this wrong, but here's the truth:\n\n1️⃣ Start with the fundamentals\n2️⃣ Build incrementally\n3️⃣ Practice consistently\n4️⃣ Seek feedback\n5️⃣ Iterate and improve\n\nSave this for later! 📌\n\nWhat topic would you like me to explain next?\n\n#LearnWithMe #Education #Knowledge",
    linkedin: "I've spent the last decade studying this topic, and here's what most people miss:\n\nThe fundamentals matter more than the hacks.\n\nWhile everyone chases shortcuts, the real progress comes from:\n\n• Deep understanding of core principles\n• Consistent application over time\n• Learning from failures, not just successes\n• Building on proven foundations\n\nWhat fundamental in your field do you think is undervalued?\n\n#ContinuousLearning #ProfessionalGrowth #Expertise",
    facebook: "Ever wondered why this works the way it does? Let me explain! 🤓\n\nIt all comes down to understanding a few key principles. Once you grasp these concepts, everything else starts to click.\n\nI'll share more detailed breakdowns in the comments. Feel free to ask questions—I love helping people learn!\n\n#EducationalContent #LearningTogether",
    tiktok: "Things I wish I learned sooner 📖\n\nThis one concept changed everything for me. Stay tuned for the full explanation!\n\nFollow for more educational content! 🎓\n\n#LearnOnTikTok #Education #DidYouKnow",
  },
};

async function generateWithOpenAI(
  idea: string,
  tone: string,
  platform: string,
  additionalContext: string,
  characterLimit: number
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Generate a ${platform} social media post based on this idea: "${idea}"

Tone: ${TONE_DESCRIPTIONS[tone as keyof typeof TONE_DESCRIPTIONS]}
Character limit: ${characterLimit} characters
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Requirements:
- Match the tone exactly
- Stay within the character limit
- Use appropriate hashtags for ${platform}
- Make it engaging and shareable
- Don't include quotes around the post

Generate only the post content, nothing else.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function generateWithAnthropic(
  idea: string,
  tone: string,
  platform: string,
  additionalContext: string,
  characterLimit: number
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `Generate a ${platform} social media post based on this idea: "${idea}"

Tone: ${TONE_DESCRIPTIONS[tone as keyof typeof TONE_DESCRIPTIONS]}
Character limit: ${characterLimit} characters
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Requirements:
- Match the tone exactly
- Stay within the character limit
- Use appropriate hashtags for ${platform}
- Make it engaging and shareable
- Don't include quotes around the post

Generate only the post content, nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

function getDemoResponse(tone: string, platform: string): string {
  return DEMO_RESPONSES[tone]?.[platform] || DEMO_RESPONSES.casual.twitter;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { idea, tone, platform, additionalContext } = body;

    if (!idea || !tone || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const characterLimit = PLATFORM_LIMITS[platform as keyof typeof PLATFORM_LIMITS] || 280;

    // Try OpenAI first
    let content = await generateWithOpenAI(idea, tone, platform, additionalContext || '', characterLimit);

    // Try Anthropic if OpenAI fails
    if (!content) {
      content = await generateWithAnthropic(idea, tone, platform, additionalContext || '', characterLimit);
    }

    // Fall back to demo response
    if (!content) {
      content = getDemoResponse(tone, platform);
    }

    return NextResponse.json({ content, isDemo: !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY });
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}
