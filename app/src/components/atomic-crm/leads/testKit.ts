import { replyTime } from "./rules";

/** Outside-in check kit: how to contact a business the way a customer would, and log only facts. */
export const TEST_GROUND_RULES = [
  "Use a separate personal email for tests, never your work email, and your own first name.",
  "Ask what a real customer of this kind of business would ask. Keep it short and ordinary.",
  "Never book a visit, appointment or tour. If they reply, answer within a day: “Thanks, we’re not going ahead for now.”",
  "Write down exact times. Record what happened, not what you think it means.",
  "Calls are never recorded.",
];

interface ChannelGuide {
  label: string;
  steps: string[];
  example: string;
  /** How the report describes this channel to the owner. */
  reportPhrase: string;
}

export const CHANNEL_GUIDES: Record<string, ChannelGuide> = {
  web_form: {
    label: "Website form",
    steps: [
      "Pick the moment: during their business hours, or after 6pm their time to test evenings. Their local time is shown above.",
      "Fill in the quote or contact form on their website with a short, realistic request.",
      "Note the exact time you pressed send.",
      "Watch your test inbox and phone for 48 hours. Log the first reply time and how it came (email, call, text).",
    ],
    example:
      "Quote request via website form: “Hi, looking for a quote for a new 16ft garage door in the next 2 weeks. Email is best.”",
    reportPhrase: "we asked for a quote through your website form",
  },
  phone: {
    label: "Phone call",
    steps: [
      "Call their business line after 6pm their time, or on a Sunday.",
      "Let it ring up to 8 times. Do not pitch anything.",
      "Log exactly what happened: a person answered, an answering service, voicemail (did it say when they would call back?), it rang out, or the number did not work.",
      "Leave a voicemail only if you can take a callback on that number, then log when (or if) they called back.",
      "Do not record the call.",
    ],
    example:
      "Called the business line at 8:10pm their time, let it ring 8 times.",
    reportPhrase: "we called your business line",
  },
  email: {
    label: "Email",
    steps: [
      "Email the address published on their website with one simple question.",
      "Note the exact send time.",
      "Watch for 48 hours and log the first reply time.",
    ],
    example:
      "Emailed the address on their contact page asking if they cover [area] next week.",
    reportPhrase: "we emailed the address on your website",
  },
  chat: {
    label: "Website chat",
    steps: [
      "Open the chat on their website after 6pm their time.",
      "Ask one simple question a customer would ask.",
      "Log what happened: a person replied (how fast), a bot replied, or it only asked for your details.",
      "Log whether you got a real answer or only “we’ll get back to you”.",
    ],
    example: "Asked in website chat: “Do you do same-week installs?”",
    reportPhrase: "we asked a question in your website chat",
  },
  marketplace: {
    label: "Angi / Thumbtack / Houzz",
    steps: [
      "Send a request to this business specifically on the marketplace where they are listed.",
      "These sites may share your request with other businesses too, so only send one you are fine getting replies to.",
      "Note the send time and log the first reply time.",
    ],
    example: "Sent a request on Thumbtack for a turf quote, 400 sq ft.",
    reportPhrase: "we sent you a request on your marketplace listing",
  },
  whatsapp: {
    label: "WhatsApp",
    steps: [
      "Only if they publish a WhatsApp number. Message it after 6pm their time with one simple question.",
      "Note the send time and log the first reply time.",
    ],
    example: "WhatsApp message: “Hi, do you have availability this week?”",
    reportPhrase: "we sent you a WhatsApp message",
  },
  other: {
    label: "Other",
    steps: [
      "Describe exactly what you did and when, so the test can be repeated.",
    ],
    example: "Describe what was sent or done.",
    reportPhrase: "we contacted you",
  },
};

export const CHANNELS = Object.keys(CHANNEL_GUIDES);

export interface ReportTest {
  channel: string;
  what_sent: string;
  sent_at: string;
  replied_at?: string | null;
  observed?: string | null;
}

const when = (iso: string, timezone?: string | null): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  };
  try {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: timezone ?? undefined,
    }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", options).format(new Date(iso));
  }
};

/** Facts-only summary to send the owner. Never says what the facts mean. */
export function buildOwnerReport(
  company: { name: string; city?: string | null; timezone?: string | null },
  tests: ReportTest[],
  now = Date.now(),
): string {
  const place = company.city ? `${company.city} time` : "local time";
  const lines = [...tests]
    .sort((a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at))
    .map((test) => {
      const phrase =
        CHANNEL_GUIDES[test.channel]?.reportPhrase ?? "we contacted you";
      const reply = replyTime(test.sent_at, test.replied_at, now);
      const outcome = test.replied_at
        ? `First reply after ${reply}.`
        : `${reply}.`;
      const observed = test.observed?.trim() ? ` ${test.observed.trim()}` : "";
      return `• ${when(test.sent_at, company.timezone)} (${place}): ${phrase}. ${outcome}${observed}`;
    });
  return [
    `What we saw when we contacted ${company.name} the way a customer would:`,
    ...lines,
  ].join("\n");
}
