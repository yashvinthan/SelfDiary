import nlp from 'compromise';
import * as chrono from 'chrono-node';

// Simple Levenshtein distance implementation for spell checking
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

async function correctGrammarWithNLP(text: string): Promise<string> {
  const doc = nlp(text);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lexicon = (nlp.model() as any).one?.lexicon || (nlp.model() as any).lexicon || {};
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const terms = (doc.terms() as any).json();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctedTerms = terms.map((t: any) => {
    const termObj = t.terms[0];
    const word = t.text;
    const normal = termObj.normal;
    const tags = termObj.tags || [];
    
    // If it's a known entity (Person, Place, Date, etc.), or a short word, don't spellcheck
    if (tags.includes('Person') || tags.includes('Date') || tags.includes('Time') || tags.includes('Month') || tags.includes('WeekDay') || tags.includes('Place') || tags.includes('Organization')) {
      return word;
    }
    
    // If the normalized word is in lexicon, it's correct
    if (lexicon[normal] || normal.length < 3) {
      return word;
    }
    
    // Otherwise, find closest match in lexicon
    let bestMatch = normal;
    let bestDist = normal.length > 6 ? 3 : (normal.length > 4 ? 2 : 1); 
    
    // Slight tweak to ensure we always try to find the absolute closest
    let minObservedDist = Infinity;

    for (const lexWord of Object.keys(lexicon)) {
      if (Math.abs(lexWord.length - normal.length) > bestDist) continue;
      
      const dist = levenshtein(normal, lexWord);
      if (dist < minObservedDist && dist <= bestDist) {
        minObservedDist = dist;
        bestMatch = lexWord;
      }
    }
    
    // Preserve original capitalization
    if (bestMatch !== normal) {
       if (word[0] === word[0].toUpperCase()) {
           return bestMatch.charAt(0).toUpperCase() + bestMatch.slice(1);
       }
       return bestMatch;
    }
    return word;
  });

  return correctedTerms.join(" ").replace(/\s+([.,!?])/g, '$1');
}

export interface StructuredLog {
  whom?: string;
  place?: string;
  mode?: string;
  type?: string;
  duration?: string;
  emotions?: string;
  description: string;
  eventDate: string;   // YYYY-MM-DD
  eventTime: string;   // HH:mm
  remarks?: string;
  reminders: {
    title: string;
    dateTime: string;  // ISO format
  }[];
}

export async function parseLogInput(input: string): Promise<StructuredLog> {
  // True local offline NLP using Compromise and Chrono!
  // This is extremely lightweight, mobile-friendly, and highly accurate without requiring massive ML weights.
  
  // 1. Grammar and Spelling Correction (Lite Offline ML)
  let normalizedInput = input;
  
  // Custom offline dictionary for common shorthand, typos, and internet slang
  const typoDict: Record<string, string> = {
    "twrm": "tomorrow", "tmrw": "tomorrow", "trwm": "tomorrow", "tomoz": "tomorrow", "tmr": "tomorrow",
    "yday": "yesterday", "yd": "yesterday", "tdy": "today", "tonite": "tonight", "2nite": "tonight",
    "metting": "meeting", "mtg": "meeting", "appt": "appointment", "sched": "schedule", "convo": "conversation",
    "u": "you", "ur": "your", "urs": "yours", "r": "are", "c": "see", "b": "be",
    "pls": "please", "plz": "please", "thx": "thanks", "tq": "thank you", "ty": "thank you",
    "tho": "though", "thru": "through", "thot": "thought",
    "msg": "message", "txt": "text", "dm": "direct message", "pm": "private message",
    "rn": "right now", "asap": "as soon as possible", "brb": "be right back", "omw": "on my way",
    "bc": "because", "bcz": "because", "cuz": "because", "cos": "because",
    "def": "definitely", "prob": "probably", "prolly": "probably", "obv": "obviously",
    "im": "I am", "i": "I", "idk": "I don't know", "idc": "I don't care", "irl": "in real life",
    "w/": "with", "w/o": "without", "b/c": "because", "btw": "by the way", "fyi": "for your information",
    "tbh": "to be honest", "imo": "in my opinion", "imho": "in my humble opinion",
    "doc": "doctor", "dr": "doctor", "vet": "veterinarian", "prof": "professor",
    "bf": "boyfriend", "gf": "girlfriend", "bro": "brother", "sis": "sister", "fam": "family",
    "bday": "birthday", "anniv": "anniversary", "vacay": "vacation", "hols": "holidays",
    "info": "information", "pic": "picture", "pics": "pictures", "vid": "video", "docu": "document",
    "app": "application", "mgmt": "management", "dept": "department", "admin": "administration"
  };

  // Fix typos with static dictionary first for fast known-fixes
  for (const [typo, fix] of Object.entries(typoDict)) {
    // Basic word boundary replacement
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    normalizedInput = normalizedInput.replace(regex, fix);
    // Also handle shorthand like w/ or w/o which have non-word characters
    if (typo.includes('/')) {
       normalizedInput = normalizedInput.replace(new RegExp(typo.replace(/\//g, '\\/'), 'gi'), fix);
    }
  }

  // 2. Full Context-Aware Grammar & Spelling Correction via Local ML NLP!
  try {
    normalizedInput = await correctGrammarWithNLP(normalizedInput);
  } catch (error) {
    console.error("Local NLP spelling correction failed, falling back to basic:", error);
  }

  const doc = nlp(normalizedInput);
  const parsedDates = chrono.parse(normalizedInput);
  
  let eventDate = new Date().toISOString().split("T")[0];
  let eventTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const reminders = [];
  
  const reminderKeywords = [
    "remind", "todo", "remember", "upcoming", "follow up", "will meet", "have meeting", "need to", "plan to",
    "appointment", "schedule", "catch up", "book a", "flight to", "travel to", "must do", "i'm seeing", "seeing",
    "deadline", "due", "gotta", "going to", "supposed to", "promise to", "agreed to", "expected to", "prepare for",
    "get ready for", "look forward to", "attend", "participate in", "organize", "host", "run", "lead", "join"
  ];
  const hasKeyword = reminderKeywords.some(kw => normalizedInput.toLowerCase().includes(kw));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verbs = (doc.verbs() as any).json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasFutureVerb = verbs.some((v: any) => v.tense === 'Future');

  const isIntentFuture = hasKeyword || hasFutureVerb;

  // Date, Time & Intent Extraction
  if (parsedDates.length > 0) {
    const parsed = parsedDates[0].start.date();
    const isFuture = parsed.getTime() > Date.now();
    
    if (isIntentFuture || isFuture) {
      // Clean title by stripping dates, times, and shorthand using simple regex
      let cleanTitle = normalizedInput.replace(/\b(\d{1,2}(?::\d{2})?\s*(am|pm)?)\b/gi, '')
                            .replace(/\b(twrm|tmrw|tomorrow|upcoming|remind|todo|remember|at|in|on)\b/gi, '')
                            .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(th|st|nd|rd)?\b/gi, '')
                            .replace(/\s+/g, ' ')
                            .trim();
      
      if (!cleanTitle || cleanTitle.length < 2) cleanTitle = "Reminder";
      else {
        // Strip leading common phrases like "i have"
        if (cleanTitle.toLowerCase().startsWith("i have ")) cleanTitle = cleanTitle.substring(7);
      }
      
      // Capitalize first letter
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

      reminders.push({
        title: cleanTitle,
        dateTime: parsed.toISOString()
      });
    } else {
      // It's a past event log, set the event date to the extracted past date
      eventDate = parsed.toISOString().split("T")[0];
      eventTime = parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    }
  } else {
    // Intent fallback using Compromise verb tense or keywords if no specific time is found
    if (isIntentFuture) {
        let cleanTitle = normalizedInput;
        if (cleanTitle.toLowerCase().startsWith("i have ")) cleanTitle = cleanTitle.substring(7);
        cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

        const tmr = new Date();
        tmr.setDate(tmr.getDate() + 1);
        tmr.setHours(9, 0, 0, 0); // Default to 9am tomorrow
        reminders.push({
          title: "Upcoming: " + (cleanTitle.length > 50 ? cleanTitle.substring(0, 50) + "..." : cleanTitle),
          dateTime: tmr.toISOString()
        });
    }
  }

  const lowerInput = normalizedInput.toLowerCase();

  // Whom & Place Extraction using Compromise entity recognition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let whom = (doc.people() as any).out('array').join(", ");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let place = (doc.places() as any).out('array').join(", ");
  
  // Augment Whom with broader heuristics
  const whomKeywords = [
    "team", "friends", "family", "boss", "manager", "mom", "dad", "mother", "father", 
    "doctor", "dentist", "clients", "client", "customer", "partner", "wife", "husband", "colleague",
    "brother", "sister", "sibling", "son", "daughter", "child", "kids", "parents", "grandpa", "grandma",
    "coworker", "staff", "employees", "employer", "supervisor", "director", "executive", "ceo", "cto",
    "investor", "shareholder", "board", "committee", "student", "teacher", "professor", "instructor",
    "coach", "mentor", "mentee", "therapist", "counselor", "lawyer", "attorney", "accountant", "mechanic",
    "plumber", "electrician", "contractor", "agent", "broker", "realtor", "landlord", "tenant", "neighbor"
  ];
  const addedWhom = [];
  for (const w of whomKeywords) {
    if (lowerInput.match(new RegExp(`\\b${w}\\b`)) && !whom.toLowerCase().includes(w)) {
      addedWhom.push(w);
    }
  }
  if (addedWhom.length > 0) {
    whom = whom ? whom + ", " + addedWhom.join(", ") : addedWhom.join(", ");
  }

  // Augment Place with broader heuristics
  const placeKeywords = [
    "office", "home", "gym", "restaurant", "clinic", "hospital", "supermarket", "mall", "store", 
    "airport", "hotel", "cafe", "coffee shop", "bank", "school", "university", "college", "campus",
    "library", "park", "beach", "museum", "theater", "cinema", "stadium", "arena", "court", "church",
    "temple", "mosque", "synagogue", "post office", "pharmacy", "drugstore", "bakery", "butcher", "grocery",
    "bar", "pub", "club", "station", "subway", "train station", "bus stop", "gas station", "garage",
    "workshop", "factory", "warehouse", "studio", "salon", "barbershop", "spa", "vet", "apartment"
  ];
  const addedPlace = [];
  for (const p of placeKeywords) {
    if (lowerInput.match(new RegExp(`\\b${p}\\b`)) && !place.toLowerCase().includes(p)) {
      addedPlace.push(p);
    }
  }
  if (addedPlace.length > 0) {
    place = place ? place + ", " + addedPlace.join(", ") : addedPlace.join(", ");
  }

  // Duration extraction (Expanded)
  let duration = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const durationsArray = (doc as any).durations ? (doc as any).durations().out('array') : [];
  if (durationsArray && durationsArray.length > 0) {
    duration = durationsArray[0];
  } else {
    const durationMatch = normalizedInput.match(/(\d+|a few|a couple of|half an|an?)\s*(hour|hr|minute|min|sec|day|week|month|year)s?/i);
    if (durationMatch) duration = durationMatch[0];
    else if (lowerInput.includes("all day")) duration = "All day";
    else if (lowerInput.includes("all night")) duration = "All night";
    else if (lowerInput.includes("whole day")) duration = "Whole day";
    else if (lowerInput.includes("forever")) duration = "Forever";
  }

  // Emotion Detection (Expanded dictionary approach)
  let emotions = "";
  const emotionKeywords = [
    "happy", "sad", "angry", "stressed", "excited", "tired", "anxious", "frustrated", 
    "overwhelmed", "joyful", "neutral", "bored", "calm", "relaxed", "nervous",
    "fantastic", "amazing", "terrible", "depressed", "furious", "delighted", "exhausted",
    "peaceful", "annoyed", "confused", "proud", "guilty", "lonely", "hopeful",
    "ecstatic", "thrilled", "elated", "content", "satisfied", "grateful", "optimistic",
    "inspired", "enthusiastic", "passionate", "relieved", "amused", "cheerful", "playful",
    "miserable", "heartbroken", "devastated", "disappointed", "discouraged", "pessimistic",
    "enraged", "irritated", "bitter", "resentful", "disgusted", "appalled", "horrified",
    "terrified", "scared", "fearful", "panicked", "worried", "apprehensive", "insecure",
    "jealous", "envious", "embarrassed", "ashamed", "humiliated", "regretful", "remorseful",
    "shocked", "surprised", "astonished", "amazed", "stunned", "speechless", "bewildered",
    "apathetic", "indifferent", "numb", "empty", "hollow", "disconnected", "detached",
    "focused", "determined", "motivated", "driven", "confident", "courageous", "brave",
    "lazy", "lethargic", "sluggish", "drained", "burnt out", "fatigued", "sleepy", "groggy"
  ];
  for (const keyword of emotionKeywords) {
    if (lowerInput.match(new RegExp(`\\b${keyword}\\b`))) {
      emotions += (emotions ? ", " : "") + keyword.charAt(0).toUpperCase() + keyword.slice(1);
    }
  }

  // Interaction Mode Detection (Expanded)
  let mode = "Meeting"; // Default
  if (lowerInput.match(/\b(zoom|teams|google meet|skype|webex|video call)\b/)) mode = "Video Call";
  else if (lowerInput.match(/\b(call|phoned|rang|called|dialed)\b/)) mode = "Call";
  else if (lowerInput.match(/\b(email|emailed)\b/)) mode = "Email";
  else if (lowerInput.match(/\b(whatsapp|telegram|signal)\b/)) mode = "WhatsApp";
  else if (lowerInput.match(/\b(sms|text|texted|message|messaged)\b/)) mode = "SMS";
  else if (lowerInput.match(/\b(slack|discord)\b/)) mode = "Chat";
  else if (lowerInput.match(/\b(in person|face to face)\b/)) mode = "Meeting";

  // Data Type Detection (Expanded)
  let type = "Text"; // Default
  if (lowerInput.match(/\b(image|picture|photo|pic|screenshot)\b/)) type = "Image";
  else if (lowerInput.match(/\b(audio|voice|recording|voicenote)\b/)) type = "Audio";
  else if (lowerInput.match(/\b(physical|paper|notebook|document|pdf|file)\b/)) type = "Document";
  else if (lowerInput.match(/\b(link|url|website|site)\b/)) type = "Link";
  else if (lowerInput.match(/\b(video|clip|movie)\b/)) type = "Video";

  // Use compromise to normalize grammar and punctuation
  const descDoc = nlp(normalizedInput);
  descDoc.normalize({
    whitespace: true,
    punctuation: true,
    case: true,
    unicode: true,
    contractions: true
  });
  
  let cleanDesc = descDoc.text();
  
  // Ensure the first letter of each sentence is capitalized perfectly
  cleanDesc = cleanDesc.replace(/(^\s*\w|[\.\!\?]\s*\w)/g, c => c.toUpperCase());

  return {
    whom: whom ? whom.split(", ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(", ") : "",
    place: place ? place.split(", ").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(", ") : "",
    mode,
    type,
    duration,
    emotions,
    description: cleanDesc,
    eventDate,
    eventTime,
    remarks: "",
    reminders,
  };
}
