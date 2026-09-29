declare const process: any;
declare const Buffer: any;

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://mydrikssmzzudzqeqroe.supabase.co';

export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const supabaseKey = supabaseServiceKey || supabaseAnonKey;

export function sendJson(res: any, status: number, body: unknown) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Supabase-Token');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(body);
}

export async function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve) => {
    let rawData = '';
    req.on('data', (chunk: any) => {
      rawData += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(rawData));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

export async function parseMultipart(req: any): Promise<{ fields: Record<string, string>; files: Array<{ filename: string; buffer: any; mimeType: string }> }> {
  const Busboy = (await import('busboy')).default;
  return new Promise((resolve, reject) => {
    try {
      const contentType = req.headers['content-type'] || req.headers['Content-Type'];
      if (!contentType || !contentType.includes('multipart/form-data')) {
        return resolve({ fields: {}, files: [] });
      }

      const busboy = Busboy({ headers: req.headers });
      const fields: Record<string, string> = {};
      const files: Array<{ filename: string; buffer: any; mimeType: string }> = [];

      busboy.on('file', (name: string, file: any, info: any) => {
        const { filename, mimeType } = info;
        const chunks: any[] = [];
        file.on('data', (data: any) => {
          chunks.push(data);
        });
        file.on('end', () => {
          files.push({
            filename,
            buffer: Buffer.concat(chunks),
            mimeType,
          });
        });
      });

      busboy.on('field', (name: string, val: string) => {
        fields[name] = val;
      });

      busboy.on('finish', () => {
        resolve({ fields, files });
      });

      busboy.on('error', (err: any) => {
        reject(err);
      });

      req.pipe(busboy);
    } catch (err) {
      reject(err);
    }
  });
}

export async function insertSupabase(table: string, payload: Record<string, unknown>) {
  if (!supabaseUrl || !supabaseKey) return { ok: false, status: 0, error: 'Supabase env not configured' };
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json; charset=utf-8', Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : 'Supabase insert failed' };
  }
}

export function emptyDashboard() {
  return {
    profile: { fullName: null, email: null, profilePhotoUrl: null, university: null, yearOfStudy: null, learningGoal: null, joinDate: new Date().toISOString(), userRole: 'student', course: null, verificationStatus: 'Not Submitted', rejectionReason: null, phoneNumber: null, lastLogin: null },
    learningDashboard: { masteryScore: 0, studyStreakDays: 0, flashcardsReviewed: 0, mindMapsGenerated: 0, quizzesAttempted: 0, researchSessions: 0, casesStudied: 0, studyHours: 0, quizAccuracy: 0, recentActivity: null },
    featureUsage: [
      { module: 'LexMentor AI', primaryLabel: 'Questions', primaryValue: 0, secondaryLabel: 'Sessions', secondaryValue: 0 },
      { module: 'Moot Court Suite', primaryLabel: 'Simulations', primaryValue: 0, secondaryLabel: 'Drafts', secondaryValue: 0 },
      { module: 'Smart Study Forge', primaryLabel: 'Study Kits', primaryValue: 0, secondaryLabel: 'Flashcards', secondaryValue: 0 },
    ],
    achievements: { level: 1, xp: 0, badgeCount: 0, levelProgress: 0, unlocked: [], available: [] },
    subscription: { planName: 'Basic', status: 'active', renewalDate: null, usagePercentage: 0, aiCreditsUsed: 0, remainingCredits: 100 },
    creditBalances: [{ moduleKey: 'lexmentor', label: 'LexMentor AI', planKey: 'basic', creditsGranted: 100, creditsUsed: 0, creditsRemaining: 100, resetPeriod: 'monthly', resetAt: null }],
    security: { clerkConnected: true, activeSessionsAvailable: false, activeSessions: null, deviceHistoryAvailable: false, deviceHistory: [], passwordStatus: null, twoFactorStatus: null },
    analyticsEngine: { totalUsage: 0, weeklyUsage: 0, monthlyUsage: 0, featureAdoption: 0, mostUsedFeature: null, leastUsedFeature: null, learningVelocity: 0, engagementScore: 0 },
    notificationPreferences: { emailNotifications: true, studyReminders: true, quizReminders: true, revisionAlerts: true, weeklyReports: true, deliveryEmail: true, deliveryBrowser: true, deliveryMobile: false, deliveryDigest: false, quietStart: '22:00', quietEnd: '07:00', priority: 'All Notifications' },
    exports: [{ key: 'activity', label: 'Activity Logs', formats: ['csv', 'json'] }, { key: 'profile', label: 'Profile Data', formats: ['json'] }],
  };
}

export function localLexMentorReply(message: string, depth = 'Intermediate') {
  const query = message.trim();
  const normalized = query.toLowerCase();

  const greeting = /^(hi|hii|hiii|hello|hey|namaste|good morning|good afternoon|good evening)[!. ]*$/.test(normalized);
  if (greeting) {
    return `Welcome to **LexMentor AI** — your specialized legal intelligence assistant.\n\nI can help you with:\n- **Legal concepts** (e.g., "What is Mens Rea?")\n- **Bare Act sections** (e.g., "Explain Section 300 BNS")\n- **Case analysis** (e.g., "Explain Kesavananda Bharati case")\n- **Legal drafting** (e.g., "Draft a Legal Notice")\n- **Judiciary preparation** (e.g., "Prepare notes on Article 21")\n- **Comparisons** (e.g., "Difference between Murder and Culpable Homicide")\n- **MCQ practice** (e.g., "Ask me MCQs on Contract Law")\n\nWhat legal topic shall we begin with?`;
  }

  const isCaseQuery = /\bcase\s+of\b|\sv\.\s*[A-Z]|\bjudgment\s+of\b|\bcase\s+analysis\b/i.test(query);
  const isDraftingQuery = /\bdraft\b|\bwrite\s+a\s+(legal|notice|affidavit|petition|writ|bail|plaint|complaint)\b/i.test(query);
  const isComparisonQuery = /\bdifference\s+between\b|\bcompare\b|\bdistinguish\b/i.test(query);
  const isQuizQuery = /\bask\s+me\b|\bquiz\b|\bmcq\b|\btest\s+me\b|\bpractice\s+questions?\b/i.test(query);
  const isRevisionQuery = /\brevision\s+notes?\b|\bone.?page\b|\bcheat\s*sheet\b/i.test(query);
  const isSectionQuery = /\bsection\s+\d+|\barticle\s+\d+/i.test(query);

  if (isCaseQuery) {
    return `I can help you analyze that case. For a complete case analysis I would need the full backend AI service running.\n\nA standard case analysis covers:\n1. **Facts** — Key facts of the case\n2. **Issues** — Legal questions framed by the court\n3. **Arguments** — Submissions of both sides\n4. **Applicable Law** — Statutes and constitutional provisions\n5. **Court Reasoning** — How the court analyzed the issues\n6. **Judgment** — Final decision\n7. **Ratio Decidendi** — The binding legal principle\n8. **Obiter Dicta** — Persuasive observations\n9. **Importance** — Impact on Indian law\n10. **Exam Notes** — Key points for students\n\nPlease ensure the backend AI service is connected for a full AI-generated case analysis.`;
  }

  if (isDraftingQuery) {
    return `I can help you draft that legal document. For a properly formatted AI-generated draft I need the backend service running.\n\nFor any legal document, the structure includes:\n- **Purpose** — What the document achieves legally\n- **Legal Requirements** — Mandatory elements under applicable law\n- **Draft** — Complete formatted text\n- **Key Clauses Explained** — Plain English explanation\n- **Applicable Law** — Governing statute and sections\n\nPlease connect the backend service for a full AI-generated draft.`;
  }

  if (isQuizQuery) {
    return `I would love to test you! For AI-generated MCQs on **"${query.replace(/ask\s+me\s+(mcqs?\s+on|about)|quiz\s+me\s+on/i, '').trim()}"** I need the backend service running.\n\nTypically I generate:\n- 5 MCQs with 4 options each\n- Correct answer marked with explanation\n- 3 short-answer questions\n- Key points to remember\n\nPlease connect the backend service for a live quiz session.`;
  }

  if (isRevisionQuery) {
    return `I can prepare one-page revision notes for you. For AI-generated revision notes I need the backend service running.\n\nRevision notes cover:\n- **Key Definition** (one-line)\n- **Governing Law** (Act, year, sections)\n- **Essential Elements** (numbered)\n- **Landmark Cases** (3 cases with ratio)\n- **Exceptions**\n- **Exam Tips**\n- **Memory Trick**\n\nPlease connect the backend service for full revision notes.`;
  }

  if (isSectionQuery) {
    return `I can explain that provision. For a complete AI-powered section analysis with corpus-indexed text I need the backend service running.\n\nA section analysis covers:\n- **Quick Answer** — Core rule in 1-2 sentences\n- **Legal Background** — Legislative intent and origin\n- **Applicable Law** — Exact statutory text\n- **Landmark Cases** — Key judgments interpreting this section\n- **Legal Analysis** — Elements, scope, and interpretation\n- **Exceptions** — Provisos and limitations\n- **Practical Examples** — Real-world scenarios\n- **Exam Notes** — Key points for students\n\nPlease ensure the backend AI service is connected.`;
  }

  return [
    `I can help you research **"${query}"**.`,
    '',
    `For a complete AI-powered legal analysis with indexed corpus sources, the backend service needs to be running.`,
    '',
    `Once connected, I will provide a structured response covering:`,
    `- **Quick Answer** — The core legal rule`,
    `- **Legal Background** — Legislative history`,
    `- **Applicable Law** — Relevant statutes and sections`,
    `- **Landmark Cases** — Key judgments`,
    `- **Legal Analysis** — Deep examination`,
    `- **Exceptions** — Limitations and provisos`,
    `- **Practical Examples** — Real-world scenarios`,
    `- **Exam Notes** — Key points for law students`,
    '',
    `What specific aspect of "${query}" would you like me to focus on?`,
  ].join('\n');
}

export const defaultContractVersion = '1.0.0';

export const defaultContractContent = `By accessing, registering on, subscribing to, clicking "I Agree", creating an account, or otherwise using the LEGATRIXON Platform, the user expressly acknowledges and agrees that they have read, understood, and accepted these Terms and Conditions, Privacy Policy, and all other policies published by LEGATRIXON, and such acceptance shall constitute a valid, legally binding, and enforceable electronic contract having the same legal effect as a written agreement signed physically. The user further agrees not to copy, reproduce, modify, distribute, sell, license, commercialize, scrape, extract, download, reverse engineer, decompile, disassemble, derive, or attempt to access the source code, software architecture, algorithms, databases, AI models, workflows, proprietary information, trade secrets, business methods, designs, functionalities, or any other intellectual or technological components of the Platform, nor create, develop, operate, support, or assist any website, software, application, platform, service, or product that is substantially similar to, derived from, competitive with, or intended to replicate any part of LEGATRIXON. Any unauthorized use, infringement, misuse, circumvention of security measures, or breach of this Agreement shall constitute a material violation entitling LEGATRIXON to immediately suspend or terminate access, seek injunctive relief, recover damages, legal costs, and pursue all civil, criminal, and statutory remedies available under applicable law without prejudice to any other rights or remedies available to it.`;

export function getBearerSubject(req: any) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || '';
  const token = String(authorization).replace(/^Bearer\s+/i, '');
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    return decoded.sub || decoded.user_id || null;
  } catch {
    return null;
  }
}

export async function selectSupabase(table: string, query = 'select=*') {
  if (!supabaseUrl || !supabaseKey) return { ok: false, status: 0, data: null, error: 'Supabase env not configured' };
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error instanceof Error ? error.message : 'Supabase select failed' };
  }
}

export async function updateSupabase(table: string, query: string, payload: Record<string, unknown>) {
  if (!supabaseUrl || !supabaseKey) return { ok: false, status: 0, data: null, error: 'Supabase env not configured' };
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json; charset=utf-8',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error instanceof Error ? error.message : 'Supabase update failed' };
  }
}

export async function getDashboardData(clerkUserId: string) {
  // 1. Fetch user profile
  const userRes = await selectSupabase('users', `clerk_user_id=eq.${clerkUserId}`);
  if (!userRes.ok || !userRes.data || !Array.isArray(userRes.data) || userRes.data.length === 0) {
    return emptyDashboard();
  }

  const user = userRes.data[0];

  // 2. Fetch logs and logins
  const [logsRes, loginsRes] = await Promise.all([
    selectSupabase('user_activity_logs', `user_id=eq.${clerkUserId}&order=created_at.desc&limit=1000`),
    selectSupabase('user_login_logs', `clerk_user_id=eq.${clerkUserId}&order=login_time.desc&limit=1000`)
  ]);

  const dbLogs = logsRes.ok && Array.isArray(logsRes.data) ? logsRes.data : [];
  const dbLogins = loginsRes.ok && Array.isArray(loginsRes.data) ? loginsRes.data : [];

  // Streak logic
  const days = new Set(dbLogs.map((log: any) => (log.created_at || '').slice(0, 10)).filter(Boolean));
  let streak = 0;
  const cursor = new Date();
  const dateKey = (d: Date) => d.toISOString().slice(0, 10);
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Study hours
  let totalDurationMin = 0;
  dbLogins.forEach((login: any) => {
    const inTime = new Date(login.login_time).getTime();
    const outTime = login.logout_time ? new Date(login.logout_time).getTime() : (inTime + 30 * 60 * 1000);
    totalDurationMin += (outTime - inTime) / (60 * 1000);
  });
  const studyHours = Number((totalDurationMin / 60).toFixed(1));

  // Cases studied
  const casesByUser = dbLogs.filter((log: any) => 
    ['Opened Judgment', 'Analyzed Judgment', 'Retrieved Case'].includes(log.action_type || log.action || '')
  ).length;

  // Flashcards reviewed
  const flashcardsByUser = dbLogs.filter((log: any) => 
    ['Reviewed Flashcard', 'Attempted Flashcard'].includes(log.action_type || log.action || '')
  ).length;

  // Research sessions
  const researchSessions = dbLogs.filter((log: any) => 
    (log.module_name || log.module) === 'Legal Research Command Center'
  ).length;

  // Default quiz accuracy
  const quizAccuracy = 0;

  // Mastery score
  const quizPerformance = quizAccuracy;
  const flashcardAccuracy = 0;
  const studyCompletion = dbLogs.length ? Math.min(100, Math.round((dbLogs.filter((l: any) => (l.action || '').toLowerCase().includes('complete')).length / dbLogs.length) * 100)) : 0;
  const mootCourtScores = dbLogs.some((l: any) => (l.action || '') === 'Completed Simulation') ? 85 : 0;
  const researchCompletion = researchSessions ? 100 : 0;

  const weights = {
    quizPerformance: 0.28,
    flashcardAccuracy: 0.18,
    studyCompletion: 0.2,
    mootCourtScores: 0.14,
    researchCompletion: 0.2,
  };
  const score = quizPerformance * weights.quizPerformance +
                flashcardAccuracy * weights.flashcardAccuracy +
                studyCompletion * weights.studyCompletion +
                mootCourtScores * weights.mootCourtScores +
                researchCompletion * weights.researchCompletion;
  const masteryScore = Math.max(0, Math.min(100, Math.round(score)));

  // Recent activity
  const recentActivity = dbLogs[0]
    ? {
        label: dbLogs[0].action_type || dbLogs[0].action,
        detail: dbLogs[0].module_name || dbLogs[0].module,
        at: dbLogs[0].created_at || dbLogs[0].createdAt,
      }
    : null;

  // Map user role
  const userRole = user.role === 'admin' || user.email === 'admin@legatrixon.com' || user.email === 'legatrixon2026@gmail.com'
    ? 'Administrator'
    : 'Law Student User';

  return {
    profile: {
      fullName: user.full_name || null,
      email: user.email || null,
      profilePhotoUrl: user.avatar_url || null,
      university: user.university_name || null,
      yearOfStudy: user.semester_year || null,
      learningGoal: null,
      joinDate: user.joined_date || user.created_at || new Date().toISOString(),
      userRole,
      course: 'Law Student',
      verificationStatus: user.verification_status || 'unsubmitted',
      rejectionReason: null,
      phoneNumber: user.phone_number || null,
      lastLogin: user.last_login || null,
    },
    learningDashboard: {
      masteryScore,
      studyStreakDays: streak,
      studyHours,
      casesStudied: casesByUser,
      researchSessions,
      flashcardsReviewed: flashcardsByUser,
      quizAccuracy,
      recentActivity,
    },
    featureUsage: [
      { module: 'LexMentor AI', primaryLabel: 'Questions', primaryValue: dbLogs.filter((l: any) => (l.module || '') === 'LexMentor AI').length, secondaryLabel: 'Sessions', secondaryValue: 0 },
      { module: 'Moot Court Suite', primaryLabel: 'Simulations', primaryValue: dbLogs.filter((l: any) => (l.module || '') === 'Moot Court Suite').length, secondaryLabel: 'Drafts', secondaryValue: 0 },
      { module: 'Smart Study Forge', primaryLabel: 'Study Kits', primaryValue: dbLogs.filter((l: any) => (l.module || '') === 'Smart Study Forge').length, secondaryLabel: 'Flashcards', secondaryValue: 0 },
    ],
    achievements: { level: Math.floor(dbLogs.length / 5) + 1, xp: dbLogs.length * 10, badgeCount: 0, levelProgress: (dbLogs.length % 5) * 20, unlocked: [], available: [] },
    subscription: { planName: 'Scholar', status: 'active', renewalDate: null, usagePercentage: 0, aiCreditsUsed: 0, remainingCredits: 1000 },
    creditBalances: [{ moduleKey: 'lexmentor', label: 'LexMentor AI', planKey: 'scholar', creditsGranted: 1000, creditsUsed: 0, creditsRemaining: 1000, resetPeriod: 'monthly', resetAt: null }],
    security: { clerkConnected: true, activeSessionsAvailable: false, activeSessions: null, deviceHistoryAvailable: false, deviceHistory: [], passwordStatus: null, twoFactorStatus: null },
    analyticsEngine: { totalUsage: dbLogs.length, weeklyUsage: dbLogs.length, monthlyUsage: dbLogs.length, featureAdoption: 0, mostUsedFeature: null, leastUsedFeature: null, learningVelocity: 0, engagementScore: dbLogs.length * 10 },
    notificationPreferences: { emailNotifications: true, studyReminders: true, quizReminders: true, revisionAlerts: true, weeklyReports: true, deliveryEmail: true, deliveryBrowser: true, deliveryMobile: false, deliveryDigest: false, quietStart: '22:00', quietEnd: '07:00', priority: 'All Notifications' },
    exports: [{ key: 'activity', label: 'Activity Logs', formats: ['csv', 'json'] }, { key: 'profile', label: 'Profile Data', formats: ['json'] }],
  };
}

export async function getLearningProgressData(userId: string) {
  const empty = buildLearningProgressEmpty(userId);
  if (!userId) return empty;

  try {
    const [materialsRes, mindMapsRes, nodesRes, bareActsRes, bareProgressRes, trackerRes, revisionsRes, weakAreasRes, readinessRes] = await Promise.all([
      selectSupabase('study_materials', `user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=20`),
      selectSupabase('mind_maps', `user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=10`),
      selectSupabase('mind_map_nodes', `user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=200`),
      selectSupabase('bare_acts', 'select=*&order=name.asc&limit=50'),
      selectSupabase('user_bare_act_progress', `user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=500`),
      selectSupabase('judiciary_tracker', `user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=1`),
      selectSupabase('revision_queue', `user_id=eq.${encodeURIComponent(userId)}&order=due_at.asc&limit=20`),
      selectSupabase('weak_areas', `user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=20`),
      selectSupabase('readiness_metrics', `user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=1`),
    ]);

    const materials = Array.isArray(materialsRes.data) ? materialsRes.data : [];
    const mindMaps = Array.isArray(mindMapsRes.data) ? mindMapsRes.data : [];
    const nodes = Array.isArray(nodesRes.data) ? nodesRes.data : [];
    const bareActs = Array.isArray(bareActsRes.data) ? bareActsRes.data : [];
    const bareProgress = Array.isArray(bareProgressRes.data) ? bareProgressRes.data : [];
    const tracker = Array.isArray(trackerRes.data) && trackerRes.data[0] ? trackerRes.data[0] : null;
    const revisions = Array.isArray(revisionsRes.data) ? revisionsRes.data : [];
    const weakAreas = Array.isArray(weakAreasRes.data) ? weakAreasRes.data : [];
    const readiness = Array.isArray(readinessRes.data) && readinessRes.data[0] ? readinessRes.data[0] : null;

    const bareActCoverage = bareActs.map((act: any) => {
      const actProgress = bareProgress.filter((item: any) => item.bare_act_id === act.id);
      const covered = actProgress.filter((item: any) => ['read', 'revised', 'memorized'].includes(String(item.status || '').toLowerCase())).length;
      return {
        id: act.id,
        name: act.name,
        totalSections: Number(act.total_sections || act.total_articles || 0),
        coveredSections: covered,
        remainingSections: Math.max(0, Number(act.total_sections || act.total_articles || 0) - covered),
        lastRevisedAt: actProgress.find((item: any) => item.last_revised_at)?.last_revised_at || null,
        priorityAreas: actProgress.filter((item: any) => ['difficult', 'important'].includes(String(item.status || '').toLowerCase())).map((item: any) => item.section_label || item.section_number).filter(Boolean),
      };
    });

    const mindMapList = mindMaps.map((map: any) => ({
      id: map.id,
      title: map.title || map.name || 'Untitled mind map',
      sourceMaterialId: map.material_id || map.study_material_id || null,
      nodes: nodes.filter((node: any) => node.mind_map_id === map.id).map((node: any) => ({
        id: node.id,
        parentId: node.parent_id || null,
        label: node.label || node.title || 'Node',
        kind: node.kind || node.node_type || 'topic',
      })),
    }));

    const hasData = materials.length > 0 || mindMapList.length > 0 || bareProgress.length > 0 || Boolean(tracker) || revisions.length > 0 || weakAreas.length > 0 || Boolean(readiness);

    return {
      userId,
      hasData,
      materials,
      mindMaps: mindMapList,
      bareActCoverage,
      judiciary: tracker,
      todaysTasks: revisions.filter((item: any) => !item.completed_at).map((item: any) => ({ id: item.id, title: item.title || item.topic || 'Revision task', dueAt: item.due_at || null })),
      revisionQueue: revisions.map((item: any) => ({ id: item.id, title: item.title || item.topic || 'Revision', dueAt: item.due_at || null, status: item.status || 'pending' })),
      weakAreas: weakAreas.map((item: any) => ({ id: item.id, topic: item.topic || item.name || 'Weak area', reason: item.reason || item.source || '' })),
      readiness,
    };
  } catch {
    return empty;
  }
}

export function buildLearningProgressEmpty(userId: string) {
  return {
    userId,
    hasData: false,
    materials: [],
    mindMaps: [],
    bareActCoverage: [],
    judiciary: null,
    todaysTasks: [],
    revisionQueue: [],
    weakAreas: [],
    readiness: null,
  };
}
