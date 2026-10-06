"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const axios_1 = require("axios");
const typeorm_2 = require("typeorm");
const crypto = require("crypto");
const exam_entities_1 = require("../exam/exam.entities");
const notebook_entity_1 = require("../notebook/notebook.entity");
const research_entities_1 = require("../research/research.entities");
const clerk_account_service_1 = require("./clerk-account.service");
const notification_service_1 = require("../exam/notification.service");
const supabase_service_1 = require("./supabase.service");
const student_verification_entities_1 = require("../student-verification/student-verification.entities");
const credit_service_1 = require("./credit.service");
const subscription_plans_1 = require("./subscription-plans");
const settings_entities_1 = require("./settings.entities");
const MODULES = [
    'LexMentor AI',
    'LexNotebook AI',
    'Legal Research Command Center',
    'Moot Court Suite',
    'Judgment Mastery Engine',
    'Academic Navigator',
    'AI Learning & Assessment Studio',
    'Settings & Profile',
];
const BADGE_RULES = [
    { key: 'research_expert', title: 'Research Expert', description: '100 research sessions completed.', metric: 'researchSessions', target: 100 },
    { key: 'case_explorer', title: 'Case Explorer', description: '300 cases studied.', metric: 'casesStudied', target: 300 },
    { key: 'moot_performer', title: 'Moot Performer', description: '50 moot simulations completed.', metric: 'mootSimulations', target: 50 },
    { key: 'constitution_master', title: 'Constitution Master', description: 'Constitution study path completed.', metric: 'constitutionPathComplete', target: 1 },
];
let SettingsService = SettingsService_1 = class SettingsService {
    constructor(activityRepo, profileRepo, subscriptionRepo, notificationRepo, achievementRepo, deletionRepo, examRepo, mockRepo, calendarRepo, readinessRepo, notebookRepo, researchUserRepo, researchQueryRepo, researchReportRepo, researchSourceRepo, researchNoteRepo, savedReportRepo, researchAssetRepo, researchDocumentRepo, feedbackRepo, clerkAccounts, notificationService, supabaseService, creditService, dataSource) {
        this.activityRepo = activityRepo;
        this.profileRepo = profileRepo;
        this.subscriptionRepo = subscriptionRepo;
        this.notificationRepo = notificationRepo;
        this.achievementRepo = achievementRepo;
        this.deletionRepo = deletionRepo;
        this.examRepo = examRepo;
        this.mockRepo = mockRepo;
        this.calendarRepo = calendarRepo;
        this.readinessRepo = readinessRepo;
        this.notebookRepo = notebookRepo;
        this.researchUserRepo = researchUserRepo;
        this.researchQueryRepo = researchQueryRepo;
        this.researchReportRepo = researchReportRepo;
        this.researchSourceRepo = researchSourceRepo;
        this.researchNoteRepo = researchNoteRepo;
        this.savedReportRepo = savedReportRepo;
        this.researchAssetRepo = researchAssetRepo;
        this.researchDocumentRepo = researchDocumentRepo;
        this.feedbackRepo = feedbackRepo;
        this.clerkAccounts = clerkAccounts;
        this.notificationService = notificationService;
        this.supabaseService = supabaseService;
        this.creditService = creditService;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(SettingsService_1.name);
        this.dashboardCache = new Map();
    }
    async log(input) {
        if (!input.userId || !input.module || !input.action)
            return null;
        await this.supabaseService.logActivity(input.userId, input.module, input.action, input.metadata?.sessionId || input.metadata?.session_id || undefined);
        const activity = this.activityRepo.create({
            userId: input.userId,
            module: input.module,
            action: input.action,
            metadata: input.metadata || {},
        });
        const savedLog = await this.activityRepo.save(activity);
        const aiActions = [
            'Asked Question',
            'Generated Flashcards',
            'Generated Research Report',
            'Started Moot Simulation',
            'AI Judge Session',
            'Completed Simulation',
            'Generated Summary',
            'Generated Mock Test',
            'Generated Mind Map',
            'Reviewed Contract',
            'Generated Risk Report',
            'Created Study Plan',
        ];
        if (aiActions.includes(input.action)) {
            try {
                const sub = await this.resolveSubscription(input.userId);
                sub.aiCreditsUsed = Number(sub.aiCreditsUsed || 0) + 1;
                await this.subscriptionRepo.save(sub);
            }
            catch (err) {
                console.warn('Failed to auto-increment AI credits used:', err);
            }
        }
        if (savedLog) {
            this.dashboardCache.delete(input.userId);
        }
        return savedLog;
    }
    async getDashboard(authUser) {
        const userId = authUser.id;
        const cached = this.dashboardCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
        const [dbLogs, dbCalendarEvents, dbResearchHistory, dbFlashcards, dbQuizResults, dbLogins, dbExamsResponse, dbReadinessResponse, profile, subscription, notificationPreferences, verification, supabaseProfile, dbNotebooksCount, dbMockTestsCount,] = await Promise.all([
            this.supabaseService.getUserActivityLogs(userId),
            this.supabaseService.getCalendarEvents(userId),
            this.supabaseService.getResearchHistory(userId),
            this.supabaseService.getFlashcards(userId),
            this.supabaseService.getQuizResults(userId),
            this.supabaseService.getUserLogins(userId),
            axios_1.default.get(`${this.supabaseService.supabaseUrl}/rest/v1/exams?user_id=eq.${userId}`, { headers: this.supabaseService.getHeaders() }).catch(() => ({ data: [] })),
            axios_1.default.get(`${this.supabaseService.supabaseUrl}/rest/v1/readiness_snapshots`, { headers: this.supabaseService.getHeaders() }).catch(() => ({ data: [] })),
            this.resolveProfile(authUser),
            this.resolveSubscription(userId),
            this.getNotificationPreferences(userId),
            this.dataSource.getRepository(student_verification_entities_1.VerificationRequest).findOne({ where: { userId } }),
            this.supabaseService.getProfile(userId),
            this.notebookRepo.count({ where: { userId } }).catch(() => 0),
            this.mockRepo.count({ where: { exam: { userId } } }).catch(() => 0),
        ]);
        const creditBalances = [];
        const dbExams = dbExamsResponse.data || [];
        const dbReadiness = dbReadinessResponse.data || [];
        const days = new Set(dbLogs.map((log) => (log.created_at || '').slice(0, 10)).filter(Boolean));
        let streak = 0;
        const cursor = new Date();
        const dateKey = (d) => d.toISOString().slice(0, 10);
        if (!days.has(dateKey(cursor)))
            cursor.setDate(cursor.getDate() - 1);
        while (days.has(dateKey(cursor))) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }
        let totalDurationMin = 0;
        dbLogins.forEach((login) => {
            const inTime = new Date(login.login_time).getTime();
            const outTime = login.logout_time ? new Date(login.logout_time).getTime() : (inTime + 30 * 60 * 1000);
            totalDurationMin += (outTime - inTime) / (60 * 1000);
        });
        const studyHours = Number((totalDurationMin / 60).toFixed(1));
        const casesStudied = dbLogs.filter((log) => ['Opened Judgment', 'Analyzed Judgment', 'Retrieved Case'].includes(log.action_type || log.action || '')).length;
        const researchSessions = dbResearchHistory.length;
        const flashcardsReviewed = dbLogs.filter((log) => ['Reviewed Flashcard', 'Attempted Flashcard'].includes(log.action_type || log.action || '')).length || dbFlashcards.length;
        const quizScores = dbQuizResults.map((q) => Number(q.score || 0));
        const quizAccuracy = quizScores.length ? Math.round(quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length) : 0;
        const quizPerformance = quizAccuracy;
        const cardMasteries = dbFlashcards.map((c) => Number(c.mastery_level || 0));
        const flashcardAccuracy = cardMasteries.length ? Math.round(cardMasteries.reduce((sum, val) => sum + val, 0) / cardMasteries.length) : 0;
        const totalLogs = dbLogs.length;
        const completedLogs = dbLogs.filter((log) => (log.action_type || log.action || '').toLowerCase().includes('complete') ||
            (log.action_type || log.action || '').toLowerCase().includes('generate')).length;
        const studyCompletion = totalLogs ? Math.round((completedLogs / totalLogs) * 100) : 0;
        const mootLogs = dbLogs.filter((log) => (log.module_name || log.module) === 'Moot Court Suite' &&
            (log.action_type || log.action) === 'Completed Simulation');
        const mootCourtScores = mootLogs.length ? 85 : 0;
        const researchCompletion = dbResearchHistory.length ? 100 : 0;
        const masteryScore = this.calculateMasteryScore({
            quizPerformance,
            flashcardAccuracy,
            studyCompletion,
            mootCourtScores,
            researchCompletion,
        });
        const getModuleStats = (moduleNames, getGeneratedCount) => {
            const moduleLogs = dbLogs.filter((log) => moduleNames.some(name => name.toLowerCase() === (log.module_name || log.module || '').toLowerCase()));
            const timesUsed = moduleLogs.length;
            const lastAccess = moduleLogs.length > 0 ? moduleLogs[0].created_at : null;
            const sessions = new Set(moduleLogs.map((log) => {
                const d = new Date(log.created_at || log.createdAt);
                return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
            }));
            const totalSessions = sessions.size;
            const generatedContentCount = getGeneratedCount();
            return {
                timesUsed,
                lastAccess,
                totalSessions,
                generatedContentCount,
            };
        };
        const featureUsage = [
            {
                module: 'LexMentor AI',
                ...getModuleStats(['LexMentor AI', 'Smart Study Forge', 'Exam Command Center', 'Citation Navigator', 'Case Impact Visualizer', 'Memorial Architect AI'], () => {
                    const mentorQuestions = dbLogs.filter((log) => (log.module_name || log.module) === 'LexMentor AI' && (log.action_type || log.action) === 'Asked Question').length;
                    return mentorQuestions + dbFlashcards.length + dbExams.length + dbLogs.filter((log) => ['Citation Navigator', 'Case Impact Visualizer', 'Memorial Architect AI'].includes(log.module_name || log.module || '')).length;
                }),
            },
            {
                module: 'LexNotebook AI',
                ...getModuleStats(['LexNotebook AI', 'Notebook'], () => dbNotebooksCount),
            },
            {
                module: 'Legal Research Command Center',
                ...getModuleStats(['Research Command Center', 'Legal Research Command Center'], () => dbResearchHistory.length),
            },
            {
                module: 'Moot Court Suite',
                ...getModuleStats(['Moot Court Suite'], () => {
                    return dbLogs.filter((log) => (log.module_name || log.module) === 'Moot Court Suite' && (log.action_type || log.action) === 'Completed Simulation').length;
                }),
            },
            {
                module: 'Judgment Mastery Engine',
                ...getModuleStats(['Judgment Mastery Engine', 'Judgment Intelligence Engine'], () => {
                    return dbLogs.filter((log) => (log.module_name || log.module) === 'Judgment Mastery Engine' && (log.action_type || log.action || '').includes('Analyze')).length;
                }),
            },
            {
                module: 'Academic Navigator',
                ...getModuleStats(['Academic Navigator'], () => dbCalendarEvents.length),
            },
            {
                module: 'AI Learning & Assessment Studio',
                ...getModuleStats(['AI Learning & Assessment Studio', 'Learning & Assessment Studio'], () => dbMockTestsCount),
            },
            {
                module: 'Settings & Profile',
                ...getModuleStats(['Settings', 'Settings & Profile'], () => 0),
            },
        ];
        const achievements = await this.syncAchievementsFromSupabase(userId, {
            researchSessions,
            casesStudied,
            mootSimulations: featureUsage.find((item) => item.module === 'Moot Court Suite')?.timesUsed || 0,
            constitutionPathComplete: dbReadiness.some((snapshot) => {
                const constitutionExamIds = new Set(dbExams.filter((exam) => /constitution/i.test(exam.subject)).map((exam) => exam.id));
                return constitutionExamIds.has(snapshot.exam_id) && Number(snapshot.readiness_score || 0) >= 100;
            }) ? 1 : 0,
        });
        const engagement = Math.round(dbLogs.length * 25 + dbLogs.filter((log) => new Date(log.created_at || log.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length * 40 + masteryScore * 10);
        const level = Math.floor(engagement / 500) + 1;
        const currentLevelBase = (level - 1) * 500;
        const levelProgress = Math.min(100, Math.round(((engagement - currentLevelBase) / 500) * 100));
        const recentActivity = dbLogs[0]
            ? {
                label: dbLogs[0].action_type || dbLogs[0].action,
                detail: dbLogs[0].module_name || dbLogs[0].module,
                at: dbLogs[0].created_at || dbLogs[0].createdAt,
            }
            : null;
        const dashboardData = {
            generatedAt: new Date().toISOString(),
            profile: {
                fullName: supabaseProfile?.full_name || profile.fullName || verification?.fullName || authUser.fullName,
                email: supabaseProfile?.email || profile.email || verification?.studentEmail || authUser.email,
                profilePhotoUrl: supabaseProfile?.avatar_url || supabaseProfile?.profile_image || profile.profilePhotoUrl || authUser.imageUrl,
                university: supabaseProfile?.university_name || verification?.universityName || profile.university || authUser.university,
                course: verification?.course || 'Law Student',
                yearOfStudy: supabaseProfile?.semester_year || verification?.yearOfStudy || profile.yearOfStudy || authUser.yearOfStudy,
                userRole: authUser.email === 'admin@legatrixon.com' || authUser.email === 'legatrixon2026@gmail.com'
                    ? 'Administrator'
                    : verification?.status === 'verified'
                        ? 'Verified Law Student'
                        : 'Law Student User',
                joinDate: supabaseProfile?.joined_date ? new Date(supabaseProfile.joined_date) : (supabaseProfile?.created_at ? new Date(supabaseProfile.created_at) : (authUser.createdAt ? new Date(authUser.createdAt) : profile.createdAt)),
                verificationStatus: verification?.status || 'unsubmitted',
                rejectionReason: verification?.rejectionReason || null,
                studentIdNumber: verification?.studentIdNumber || null,
                phoneNumber: supabaseProfile?.phone_number || '',
                lastLogin: supabaseProfile?.last_login || null,
            },
            learningDashboard: {
                masteryScore,
                studyStreakDays: streak,
                studyHours,
                casesStudied,
                researchSessions,
                flashcardsReviewed,
                quizAccuracy,
                recentActivity,
            },
            featureUsage,
            achievements: {
                level,
                xp: engagement,
                badgeCount: achievements.length,
                levelProgress,
                unlocked: achievements,
                available: BADGE_RULES.map((rule) => ({
                    key: rule.key,
                    title: rule.title,
                    description: rule.description,
                    target: rule.target,
                    unlocked: achievements.some((badge) => badge.badgeKey === rule.key),
                })),
            },
            subscription: this.formatSubscription(subscription),
            creditBalances,
            security: await this.getSecurity(userId),
            analyticsEngine: {
                totalUsage: dbLogs.length,
                weeklyUsage: dbLogs.filter((log) => new Date(log.created_at || log.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
                monthlyUsage: dbLogs.filter((log) => new Date(log.created_at || log.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
                featureAdoption: this.calculateFeatureAdoption(featureUsage),
                mostUsedFeature: this.pickUsageFeature(featureUsage, 'most'),
                leastUsedFeature: this.pickUsageFeature(featureUsage, 'least'),
                learningVelocity: previousWeek => {
                    const thisWeek = dbLogs.filter((log) => new Date(log.created_at || log.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
                    const prevWeek = dbLogs.filter((log) => {
                        const at = new Date(log.created_at || log.createdAt);
                        return at >= new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) && at < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    }).length;
                    return prevWeek ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : (thisWeek ? 100 : 0);
                },
                engagementScore: engagement,
            },
            notificationPreferences,
            exports: [
                { key: 'notes', label: 'Notes Export', formats: ['json', 'pdf', 'docx'] },
                { key: 'research', label: 'Research Export', formats: ['json', 'pdf', 'docx'] },
                { key: 'flashcards', label: 'Flashcards Export', formats: ['json', 'pdf', 'docx'] },
                { key: 'study-progress', label: 'Study Progress Export', formats: ['json', 'pdf', 'docx'] },
            ],
        };
        this.dashboardCache.set(userId, {
            data: dashboardData,
            expiresAt: Date.now() + 5000,
        });
        return dashboardData;
    }
    async syncAchievementsFromSupabase(userId, metrics) {
        try {
            const response = await axios_1.default.get(`${this.supabaseService.supabaseUrl}/rest/v1/user_achievements?user_id=eq.${userId}`, { headers: this.supabaseService.getHeaders() });
            const existing = response.data || [];
            const existingKeys = new Set(existing.map((a) => a.badge_key));
            const unlocked = [...existing];
            for (const rule of BADGE_RULES) {
                if (!existingKeys.has(rule.key) && (metrics[rule.metric] || 0) >= rule.target) {
                    const payload = {
                        user_id: userId,
                        badge_key: rule.key,
                        title: rule.title,
                        description: rule.description,
                        unlocked_at: new Date().toISOString()
                    };
                    const postResponse = await axios_1.default.post(`${this.supabaseService.supabaseUrl}/rest/v1/user_achievements`, payload, {
                        headers: {
                            ...this.supabaseService.getHeaders(),
                            'Prefer': 'return=representation'
                        }
                    });
                    if (postResponse.data && postResponse.data[0]) {
                        unlocked.unshift(postResponse.data[0]);
                    }
                    await this.log({ userId, module: 'Settings', action: 'Unlocked Achievement', metadata: { badge: rule.key } });
                }
            }
            return unlocked.map(a => ({
                id: a.id,
                userId: a.user_id,
                badgeKey: a.badge_key,
                title: a.title,
                description: a.description,
                unlockedAt: a.unlocked_at
            }));
        }
        catch (err) {
            this.logger.warn(`Failed to sync achievements from Supabase: ${err.message}`);
            return [];
        }
    }
    async updateNotificationPreferences(userId, payload) {
        const current = await this.getNotificationPreferences(userId);
        const updated = {
            emailNotifications: payload.emailNotifications !== undefined ? Boolean(payload.emailNotifications) : current.emailNotifications,
            studyReminders: payload.studyReminders !== undefined ? Boolean(payload.studyReminders) : current.studyReminders,
            quizReminders: payload.quizReminders !== undefined ? Boolean(payload.quizReminders) : current.quizReminders,
            revisionAlerts: payload.revisionAlerts !== undefined ? Boolean(payload.revisionAlerts) : current.revisionAlerts,
            weeklyReports: payload.weeklyReports !== undefined ? Boolean(payload.weeklyReports) : current.weeklyReports,
            deliveryEmail: payload.deliveryEmail !== undefined ? Boolean(payload.deliveryEmail) : current.deliveryEmail,
            deliveryBrowser: payload.deliveryBrowser !== undefined ? Boolean(payload.deliveryBrowser) : current.deliveryBrowser,
            deliveryMobile: payload.deliveryMobile !== undefined ? Boolean(payload.deliveryMobile) : current.deliveryMobile,
            deliveryDigest: payload.deliveryDigest !== undefined ? Boolean(payload.deliveryDigest) : current.deliveryDigest,
            browserPush: payload.browserPush !== undefined ? Boolean(payload.browserPush) : (payload.deliveryBrowser !== undefined ? Boolean(payload.deliveryBrowser) : (current.browserPush !== undefined ? current.browserPush : true)),
            mobilePush: payload.mobilePush !== undefined ? Boolean(payload.mobilePush) : (payload.deliveryMobile !== undefined ? Boolean(payload.deliveryMobile) : (current.mobilePush !== undefined ? current.mobilePush : false)),
            weeklyDigest: payload.weeklyDigest !== undefined ? Boolean(payload.weeklyDigest) : (payload.deliveryDigest !== undefined ? Boolean(payload.deliveryDigest) : (current.weeklyDigest !== undefined ? current.weeklyDigest : false)),
            quietStart: payload.quietStart !== undefined ? String(payload.quietStart) : current.quietStart,
            quietEnd: payload.quietEnd !== undefined ? String(payload.quietEnd) : current.quietEnd,
            quietHoursStart: payload.quietHoursStart !== undefined ? String(payload.quietHoursStart) : (payload.quietStart !== undefined ? String(payload.quietStart) : (current.quietHoursStart !== undefined ? current.quietHoursStart : '22:00')),
            quietHoursEnd: payload.quietHoursEnd !== undefined ? String(payload.quietHoursEnd) : (payload.quietEnd !== undefined ? String(payload.quietEnd) : (current.quietHoursEnd !== undefined ? current.quietHoursEnd : '07:00')),
            priority: payload.priority !== undefined ? String(payload.priority) : current.priority,
            notificationPriority: payload.notificationPriority !== undefined ? String(payload.notificationPriority) : (payload.priority !== undefined ? String(payload.priority) : (current.notificationPriority !== undefined ? current.notificationPriority : 'All Notifications')),
            fcmToken: payload.fcmToken !== undefined ? String(payload.fcmToken) : current.fcmToken,
        };
        try {
            await this.supabaseService.upsertPreferences(userId, {
                email_notifications: updated.emailNotifications,
                study_reminders: updated.studyReminders,
                quiz_reminders: updated.quizReminders,
                revision_alerts: updated.revisionAlerts,
                weekly_reports: updated.weeklyReports,
                delivery_email: updated.deliveryEmail,
                delivery_browser: updated.deliveryBrowser,
                delivery_mobile: updated.deliveryMobile,
                delivery_digest: updated.deliveryDigest,
                browser_push: updated.browserPush,
                mobile_push: updated.mobilePush,
                weekly_digest: updated.weeklyDigest,
                quiet_start: updated.quietStart,
                quiet_end: updated.quietEnd,
                quiet_hours_start: updated.quietHoursStart,
                quiet_hours_end: updated.quietHoursEnd,
                priority: updated.priority,
                notification_priority: updated.notificationPriority,
                fcm_token: updated.fcmToken,
            });
        }
        catch (err) {
            console.warn('Failed to upsert settings to Supabase. Updating SQLite only.');
        }
        const local = await this.notificationRepo.findOne({ where: { userId } }) || this.notificationRepo.create({ userId });
        Object.assign(local, updated);
        await this.log({ userId, module: 'Settings', action: 'Updated Notification Preferences', metadata: local });
        this.dashboardCache.delete(userId);
        return this.notificationRepo.save(local);
    }
    async upgradeSubscription(userId, planName) {
        const requestedPlan = (0, subscription_plans_1.normalizeSubscriptionPlan)(planName);
        if (requestedPlan !== 'free') {
            throw new common_1.BadRequestException('Paid plans must be activated through verified checkout.');
        }
        const sub = await this.resolveSubscription(userId);
        sub.planName = requestedPlan;
        sub.status = 'active';
        sub.renewalDate = null;
        sub.aiCreditsLimit = subscription_plans_1.SUBSCRIPTION_PLANS.free.aiCredits;
        sub.aiCreditsUsed = 0;
        const saved = await this.subscriptionRepo.save(sub);
        await this.log({
            userId,
            module: 'Settings',
            action: 'Upgraded Subscription Plan',
            metadata: { planName: requestedPlan }
        });
        await this.notificationService.createNotification(userId, 'Subscription Upgraded', `Your ${subscription_plans_1.SUBSCRIPTION_PLANS.free.name} plan is active with ${sub.aiCreditsLimit} AI credits.`);
        this.dashboardCache.delete(userId);
        return this.formatSubscription(saved);
    }
    async simulatePasswordChange(userId) {
        await this.log({
            userId,
            module: 'Settings',
            action: 'Changed Password',
            metadata: {}
        });
        await this.notificationService.createNotification(userId, 'Password Changed Successfully', 'Your LEGATRIXON account password has been updated. If you did not make this change, please contact security immediately.', 0, 'critical');
        return { success: true };
    }
    async updateFcmToken(userId, fcmToken) {
        return this.updateNotificationPreferences(userId, { fcmToken });
    }
    async getProfile(clerkUserId) {
        return this.supabaseService.getProfile(clerkUserId);
    }
    async getAiProviderOnboarding(authUser) {
        const profile = await this.resolveProfile(authUser);
        return {
            completed: Boolean(profile.aiProviderOnboardingCompleted),
            completedAt: profile.aiProviderOnboardingCompletedAt || null,
        };
    }
    async completeAiProviderOnboarding(authUser) {
        const profile = await this.resolveProfile(authUser);
        profile.aiProviderOnboardingCompleted = true;
        profile.aiProviderOnboardingCompletedAt = new Date();
        const saved = await this.profileRepo.save(profile);
        this.dashboardCache.delete(authUser.id);
        return {
            completed: true,
            completedAt: saved.aiProviderOnboardingCompletedAt,
        };
    }
    async updateProfile(clerkUserId, profileData) {
        const updated = await this.supabaseService.upsertProfile(clerkUserId, {
            full_name: profileData.fullName,
            phone_number: profileData.phoneNumber,
            university_name: profileData.universityName,
            semester_year: profileData.semesterYear,
            email: profileData.email,
            profile_image: profileData.profileImage || null,
            avatar_url: profileData.avatarUrl || null,
        });
        try {
            await this.clerkAccounts.updateClerkUser(clerkUserId, {
                fullName: profileData.fullName,
                phoneNumber: profileData.phoneNumber,
                university: profileData.universityName,
                yearOfStudy: profileData.semesterYear,
            });
        }
        catch (clerkErr) {
            console.warn('Failed to sync updated profile to Clerk User:', clerkErr.message);
        }
        try {
            let local = await this.profileRepo.findOne({ where: { userId: clerkUserId } });
            if (!local) {
                local = this.profileRepo.create({ userId: clerkUserId });
            }
            local.fullName = profileData.fullName;
            local.email = profileData.email;
            local.university = profileData.universityName;
            local.yearOfStudy = profileData.semesterYear;
            if (profileData.profileImage)
                local.profilePhotoUrl = profileData.profileImage;
            await this.profileRepo.save(local);
        }
        catch (err) {
            console.warn('Failed to sync to local TypeORM user profile:', err);
        }
        try {
            await this.getNotificationPreferences(clerkUserId);
        }
        catch (err) {
            console.warn('Failed to initialize local user notification preferences:', err);
        }
        try {
            await this.log({
                userId: clerkUserId,
                module: 'Settings',
                action: 'Account Created',
                metadata: {
                    fullName: profileData.fullName,
                    university: profileData.universityName,
                    email: profileData.email,
                }
            });
        }
        catch (err) {
            console.warn('Failed to log account creation activity:', err);
        }
        this.dashboardCache.delete(clerkUserId);
        return updated;
    }
    parseUserAgent(uaString) {
        let browser = 'Unknown Browser';
        let device = 'Desktop';
        let os = 'Unknown OS';
        if (!uaString)
            return { browser, device, os };
        const ua = uaString.toLowerCase();
        if (ua.includes('firefox'))
            browser = 'Firefox';
        else if (ua.includes('chrome') && !ua.includes('chromium'))
            browser = 'Chrome';
        else if (ua.includes('safari') && !ua.includes('chrome'))
            browser = 'Safari';
        else if (ua.includes('edge'))
            browser = 'Edge';
        else if (ua.includes('opera') || ua.includes('opr'))
            browser = 'Opera';
        if (ua.includes('windows'))
            os = 'Windows';
        else if (ua.includes('macintosh') || ua.includes('mac os'))
            os = 'macOS';
        else if (ua.includes('linux'))
            os = 'Linux';
        else if (ua.includes('android'))
            os = 'Android';
        else if (ua.includes('iphone') || ua.includes('ipad'))
            os = 'iOS';
        if (ua.includes('mobi') || ua.includes('android') || ua.includes('iphone')) {
            device = 'Mobile';
        }
        else if (ua.includes('ipad') || ua.includes('tablet')) {
            device = 'Tablet';
        }
        return { browser, device, os };
    }
    async recordLogin(clerkUserId, email, req) {
        const userAgent = req.headers['user-agent'] || '';
        const ip = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown';
        const { browser, device, os } = this.parseUserAgent(userAgent);
        await this.creditService.ensureFreeCredits(clerkUserId);
        try {
            const existing = await this.supabaseService.getProfile(clerkUserId);
            if (!existing) {
                const clerkUser = await this.clerkAccounts.getUser(clerkUserId);
                const fullName = clerkUser.firstName || '';
                const phone = clerkUser.unsafeMetadata?.phone || '';
                const collegeName = clerkUser.unsafeMetadata?.collegeName || '';
                const yearOfStudy = clerkUser.unsafeMetadata?.yearOfStudy || '';
                const userEmail = clerkUser.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
                    || clerkUser.emailAddresses?.[0]?.emailAddress
                    || email;
                await this.supabaseService.upsertProfile(clerkUserId, {
                    full_name: fullName,
                    phone_number: phone,
                    university_name: collegeName,
                    semester_year: yearOfStudy,
                    email: userEmail,
                });
                try {
                    let local = await this.profileRepo.findOne({ where: { userId: clerkUserId } });
                    if (!local) {
                        local = this.profileRepo.create({ userId: clerkUserId });
                    }
                    local.fullName = fullName;
                    local.email = userEmail;
                    local.university = collegeName;
                    local.yearOfStudy = yearOfStudy;
                    await this.profileRepo.save(local);
                }
                catch (localErr) {
                    console.warn('Failed to sync to local TypeORM user profile on recordLogin:', localErr);
                }
            }
        }
        catch (err) {
            console.error('Failed to sync missing user in Supabase users table on login:', err.message);
        }
        try {
            const payload = {
                clerk_user_id: clerkUserId,
                email,
                login_time: new Date().toISOString(),
                ip_address: typeof ip === 'string' ? ip.split(',')[0].trim() : String(ip),
                browser,
                device,
                operating_system: os,
                login_status: 'success'
            };
            await axios_1.default.post(`${this.supabaseService.supabaseUrl}/rest/v1/user_login_logs`, payload, {
                headers: {
                    'apikey': this.supabaseService.supabaseAnonKey,
                    'Authorization': `Bearer ${this.supabaseService.supabaseAnonKey}`,
                    'Content-Type': 'application/json',
                }
            });
        }
        catch (err) {
            console.error('Failed to log login session to Supabase user_login_logs:', err.message);
        }
        try {
            await axios_1.default.patch(`${this.supabaseService.supabaseUrl}/rest/v1/users?clerk_user_id=eq.${clerkUserId}`, { last_login: new Date().toISOString() }, {
                headers: {
                    'apikey': this.supabaseService.supabaseAnonKey,
                    'Authorization': `Bearer ${this.supabaseService.supabaseAnonKey}`,
                    'Content-Type': 'application/json',
                }
            });
        }
        catch (err) {
            console.error('Failed to update last_login in Supabase users table:', err.message);
        }
        try {
            await this.log({
                userId: clerkUserId,
                module: 'Settings',
                action: 'User Logged In',
                metadata: { ip, browser, device, os }
            });
        }
        catch (err) {
            console.warn('Failed to log local TypeORM login activity:', err);
        }
        try {
            const pastLogins = await this.supabaseService.getUserLogins(clerkUserId);
            const isNewIpOrBrowser = pastLogins.length > 0 && !pastLogins.some((l) => l.ip_address === String(ip).split(',')[0].trim() && l.browser === browser);
            if (isNewIpOrBrowser) {
                await this.notificationService.createNotification(clerkUserId, 'Security Warning: Login from New Device', `We detected a new login to your LEGATRIXON account from IP: ${ip} using ${browser} on ${os}. If this wasn't you, please change your password immediately.`, 0, 'critical');
            }
        }
        catch (err) {
            console.warn('Failed to check for new device security warning:', err);
        }
        return { success: true };
    }
    async recordLogout(clerkUserId) {
        try {
            const url = `${this.supabaseService.supabaseUrl}/rest/v1/user_login_logs?clerk_user_id=eq.${clerkUserId}&order=login_time.desc&limit=1`;
            const response = await axios_1.default.get(url, {
                headers: {
                    'apikey': this.supabaseService.supabaseAnonKey,
                    'Authorization': `Bearer ${this.supabaseService.supabaseAnonKey}`,
                }
            });
            const latestLog = response.data[0];
            if (latestLog && !latestLog.logout_time) {
                await axios_1.default.patch(`${this.supabaseService.supabaseUrl}/rest/v1/user_login_logs?id=eq.${latestLog.id}`, { logout_time: new Date().toISOString() }, {
                    headers: {
                        'apikey': this.supabaseService.supabaseAnonKey,
                        'Authorization': `Bearer ${this.supabaseService.supabaseAnonKey}`,
                        'Content-Type': 'application/json',
                    }
                });
            }
        }
        catch (err) {
            console.error('Failed to update logout_time in Supabase user_login_logs:', err.message);
        }
        try {
            await this.log({
                userId: clerkUserId,
                module: 'Settings',
                action: 'User Logged Out',
                metadata: {}
            });
        }
        catch (err) {
            console.warn('Failed to log local TypeORM logout activity:', err);
        }
        return { success: true };
    }
    async triggerTestNotification(userId, type) {
        if (type === 'email') {
            await this.notificationService.createNotification(userId, 'LEGATRIXON Email Settings Test', 'Your academic notifications and SMTP email delivery configuration have been successfully verified! Real study and quiz alerts will arrive via this channel.');
        }
        else {
            await this.notificationService.createNotification(userId, 'LEGATRIXON System Alert', 'Push notifications are working perfectly! You will receive instant calendar events, mock test alerts, and daily schedule cues.');
        }
        return { success: true };
    }
    async requestDeletion(userId, reason) {
        await this.log({ userId, module: 'Settings', action: 'Requested Account Deletion', metadata: { reason: reason || null } });
        return this.deletionRepo.save(this.deletionRepo.create({ userId, reason: reason || null, status: 'requested' }));
    }
    async softDelete(userId, confirmation) {
        if (confirmation !== 'DELETE') {
            throw new common_1.BadRequestException('Type DELETE to confirm account deactivation');
        }
        const profile = await this.profileRepo.findOne({ where: { userId } });
        if (profile) {
            profile.deletedAt = new Date();
            await this.profileRepo.save(profile);
        }
        await this.log({ userId, module: 'Settings', action: 'Soft Deleted Account', metadata: {} });
        return this.deletionRepo.save(this.deletionRepo.create({ userId, status: 'soft_deleted' }));
    }
    async requestDataRemoval(userId) {
        await this.log({ userId, module: 'Settings', action: 'Requested Data Removal', metadata: { flow: 'gdpr' } });
        return this.deletionRepo.save(this.deletionRepo.create({ userId, status: 'permanent_delete_pending' }));
    }
    async logoutAllDevices(userId) {
        const revokedSessions = await this.clerkAccounts.revokeAllSessions(userId);
        await this.log({ userId, module: 'Settings', action: 'Logged Out All Devices', metadata: { provider: 'clerk', revokedSessions } });
        return {
            success: true,
            provider: 'Clerk',
            revokedSessions,
        };
    }
    async permanentlyDelete(userId, confirmation) {
        if (confirmation !== 'DELETE') {
            throw new common_1.BadRequestException('Type DELETE to permanently delete the account');
        }
        const researchUser = await this.researchUserRepo.findOne({
            where: [
                { email: (await this.profileRepo.findOne({ where: { userId } }))?.email || '__none__' },
            ],
        });
        const researchUserId = researchUser?.id;
        const exams = await this.examRepo.find({ where: { userId } });
        const examIds = exams.map((exam) => exam.id);
        await this.dataSource.transaction(async (manager) => {
            if (examIds.length) {
                await manager.delete(exam_entities_1.MockTest, { examId: (0, typeorm_2.In)(examIds) });
                await manager.delete(exam_entities_1.ReadinessSnapshot, { examId: (0, typeorm_2.In)(examIds) });
            }
            await manager.delete(exam_entities_1.CalendarEvent, { userId });
            await manager.delete(exam_entities_1.Exam, { userId });
            await manager.delete(notebook_entity_1.NotebookDocument, { userId });
            if (researchUserId) {
                const reports = await manager.find(research_entities_1.ResearchReport, { where: { userId: researchUserId } });
                const reportIds = reports.map((report) => report.id);
                if (reportIds.length) {
                    await manager.delete(research_entities_1.ResearchSource, { reportId: (0, typeorm_2.In)(reportIds) });
                    await manager.delete(research_entities_1.ResearchNote, { reportId: (0, typeorm_2.In)(reportIds) });
                    await manager.delete(research_entities_1.SavedReport, { reportId: (0, typeorm_2.In)(reportIds) });
                    await manager.delete(research_entities_1.ResearchAsset, { reportId: (0, typeorm_2.In)(reportIds) });
                }
                await manager.delete(research_entities_1.ResearchDocument, { userId: researchUserId });
                await manager.delete(research_entities_1.ResearchReport, { userId: researchUserId });
                await manager.delete(research_entities_1.ResearchQuery, { userId: researchUserId });
                await manager.delete(research_entities_1.ResearchUser, { id: researchUserId });
            }
            await manager.delete(settings_entities_1.UserAchievement, { userId });
            await manager.delete(settings_entities_1.UserNotificationPreference, { userId });
            await manager.delete(settings_entities_1.UserSubscription, { userId });
            await manager.delete(settings_entities_1.AccountDeletionRequest, { userId });
            await manager.delete(settings_entities_1.UserActivityLog, { userId });
            await manager.delete(settings_entities_1.UserSettingsProfile, { userId });
        });
        await this.clerkAccounts.deleteUser(userId);
        return { success: true };
    }
    async exportData(authUser, kind, format) {
        const allowedKinds = ['notes', 'research', 'flashcards', 'study-progress', 'analytics', 'progress-report'];
        if (!allowedKinds.includes(kind))
            throw new common_1.NotFoundException('Unsupported export type');
        if (format === 'json') {
            throw new common_1.BadRequestException('JSON format is no longer supported.');
        }
        const payload = await this.buildExportPayload(authUser, kind);
        const filename = `${kind}-export.${format}`;
        let exportModuleLabel = "Unknown Export";
        if (kind === 'notes')
            exportModuleLabel = "Export Notebook Notes";
        else if (kind === 'research')
            exportModuleLabel = "Export Research History";
        else if (kind === 'flashcards')
            exportModuleLabel = "Export Study Flashcards";
        else if (kind === 'analytics')
            exportModuleLabel = "Export Platform Analytics";
        else if (kind === 'progress-report')
            exportModuleLabel = "Download Progress Report";
        await this.supabaseService.logExport(authUser.id, exportModuleLabel, format.toUpperCase(), filename);
        await this.log({
            userId: authUser.id,
            module: 'Export Center',
            action: `Exported ${kind} as ${format.toUpperCase()}`,
            metadata: { kind, format, filename }
        });
        if (format === 'pdf') {
            return {
                filename,
                contentType: 'application/pdf',
                buffer: await this.createPdfDocument(kind, payload),
            };
        }
        if (format === 'docx') {
            return {
                filename,
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                buffer: await this.createDocxDocument(kind, payload),
            };
        }
        if (format === 'pptx') {
            return {
                filename,
                contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                buffer: await this.createPptxDocument(kind, payload),
            };
        }
        throw new common_1.NotFoundException('Unsupported export format');
    }
    async resolveProfile(authUser) {
        let profile = await this.profileRepo.findOne({ where: { userId: authUser.id } });
        if (!profile) {
            profile = this.profileRepo.create({
                userId: authUser.id,
                email: authUser.email || null,
                fullName: authUser.fullName || null,
                profilePhotoUrl: authUser.imageUrl || null,
                university: authUser.university || null,
                yearOfStudy: authUser.yearOfStudy || null,
                learningGoal: authUser.learningGoal || null,
            });
        }
        else {
            profile.email = authUser.email || profile.email || null;
            profile.fullName = authUser.fullName || profile.fullName || null;
            profile.profilePhotoUrl = authUser.imageUrl || profile.profilePhotoUrl || null;
            profile.university = authUser.university || profile.university || null;
            profile.yearOfStudy = authUser.yearOfStudy || profile.yearOfStudy || null;
            profile.learningGoal = authUser.learningGoal || profile.learningGoal || null;
        }
        return this.profileRepo.save(profile);
    }
    async resolveSubscription(userId) {
        let subscription = await this.subscriptionRepo.findOne({ where: { userId } });
        if (!subscription) {
            subscription = this.subscriptionRepo.create({
                userId,
                planName: 'free',
                status: 'active',
                renewalDate: null,
                aiCreditsLimit: subscription_plans_1.SUBSCRIPTION_PLANS.free.aiCredits,
                aiCreditsUsed: 0,
            });
            subscription = await this.subscriptionRepo.save(subscription);
        }
        return subscription;
    }
    deterministicUuid(value) {
        const hash = crypto.createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
        hash[12] = '4';
        hash[16] = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
        const hex = hash.join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    async findResearchUser(authUser) {
        if (authUser.email) {
            const byEmail = await this.researchUserRepo.findOne({ where: { email: authUser.email } });
            if (byEmail)
                return byEmail;
        }
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const userId = uuidPattern.test(authUser.id)
            ? authUser.id
            : this.deterministicUuid(authUser.id);
        return this.researchUserRepo.findOne({ where: { id: userId } });
    }
    async getNotificationPreferences(userId) {
        const supabasePrefs = await this.supabaseService.getPreferences(userId);
        if (supabasePrefs) {
            return {
                id: supabasePrefs.id,
                userId: supabasePrefs.user_id,
                emailNotifications: Boolean(supabasePrefs.email_notifications),
                studyReminders: Boolean(supabasePrefs.study_reminders),
                quizReminders: Boolean(supabasePrefs.quiz_reminders),
                revisionAlerts: Boolean(supabasePrefs.revision_alerts),
                weeklyReports: Boolean(supabasePrefs.weekly_reports),
                deliveryEmail: supabasePrefs.delivery_email !== undefined ? Boolean(supabasePrefs.delivery_email) : true,
                deliveryBrowser: supabasePrefs.delivery_browser !== undefined ? Boolean(supabasePrefs.delivery_browser) : true,
                deliveryMobile: supabasePrefs.delivery_mobile !== undefined ? Boolean(supabasePrefs.delivery_mobile) : false,
                deliveryDigest: supabasePrefs.delivery_digest !== undefined ? Boolean(supabasePrefs.delivery_digest) : false,
                browserPush: supabasePrefs.browser_push !== undefined ? Boolean(supabasePrefs.browser_push) : true,
                mobilePush: supabasePrefs.mobile_push !== undefined ? Boolean(supabasePrefs.mobile_push) : false,
                weeklyDigest: supabasePrefs.weekly_digest !== undefined ? Boolean(supabasePrefs.weekly_digest) : false,
                quietStart: supabasePrefs.quiet_start !== undefined ? String(supabasePrefs.quiet_start) : '22:00',
                quietEnd: supabasePrefs.quiet_end !== undefined ? String(supabasePrefs.quiet_end) : '07:00',
                quietHoursStart: supabasePrefs.quiet_hours_start !== undefined ? String(supabasePrefs.quiet_hours_start) : '22:00',
                quietHoursEnd: supabasePrefs.quiet_hours_end !== undefined ? String(supabasePrefs.quiet_hours_end) : '07:00',
                priority: supabasePrefs.priority !== undefined ? String(supabasePrefs.priority) : 'All Notifications',
                notificationPriority: supabasePrefs.notification_priority !== undefined ? String(supabasePrefs.notification_priority) : 'All Notifications',
                fcmToken: supabasePrefs.fcm_token !== undefined ? String(supabasePrefs.fcm_token) : null,
            };
        }
        let prefs = await this.notificationRepo.findOne({ where: { userId } });
        if (!prefs) {
            prefs = this.notificationRepo.create({ userId });
            prefs = await this.notificationRepo.save(prefs);
        }
        return prefs;
    }
    async countResearchCaseSources(userId) {
        const reports = await this.researchReportRepo.find({ where: { userId: userId } });
        if (!reports.length)
            return 0;
        const reportIds = new Set(reports.map((report) => report.id));
        const sources = await this.researchSourceRepo.find();
        return sources.filter((source) => reportIds.has(source.reportId) && source.sourceType === 'case').length;
    }
    async getMockTestsForExams(exams) {
        if (!exams.length)
            return [];
        const tests = await this.mockRepo.find();
        const examIds = new Set(exams.map((exam) => exam.id));
        return tests.filter((test) => examIds.has(test.examId));
    }
    async getReadinessForExams(exams) {
        if (!exams.length)
            return [];
        const snapshots = await this.readinessRepo.find({ order: { createdAt: 'DESC' } });
        const examIds = new Set(exams.map((exam) => exam.id));
        return snapshots.filter((snapshot) => examIds.has(snapshot.examId));
    }
    aggregateStudyForge(notebooks) {
        let flashcardsReviewed = 0;
        let flashcardsGenerated = 0;
        let quizzesAttempted = 0;
        const quizScores = [];
        const completions = [];
        const flashcardMastery = [];
        notebooks.forEach((doc) => {
            const forge = doc.studyForge || {};
            const progress = forge.progress || {};
            const cards = Array.isArray(forge.flashcards) ? forge.flashcards : [];
            flashcardsGenerated += cards.length;
            flashcardsReviewed += Number(progress.flashcardsReviewed || 0);
            cards.forEach((card) => flashcardMastery.push(Number(card.mastery || 0)));
            const attempts = Array.isArray(progress.quizAttempts) ? progress.quizAttempts : [];
            quizzesAttempted += attempts.length;
            attempts.forEach((attempt) => quizScores.push(Number(attempt.accuracy || 0)));
            if (Number.isFinite(Number(progress.quizAccuracy)))
                quizScores.push(Number(progress.quizAccuracy));
            if (Number.isFinite(Number(progress.completion)))
                completions.push(Number(progress.completion));
        });
        return {
            flashcardsReviewed,
            flashcardsGenerated,
            quizzesAttempted,
            quizScores,
            completion: this.average(completions),
            flashcardAccuracy: this.average(flashcardMastery),
        };
    }
    countActivities(logs) {
        return {
            mindMapsGenerated: logs.filter((log) => log.action.toLowerCase().includes('mind map')).length,
            casesStudied: logs.filter((log) => ['Opened Judgment', 'Analyzed Judgment', 'Retrieved Case'].includes(log.action)).length,
            flashcardsReviewed: logs.filter((log) => log.action === 'Reviewed Flashcard').length,
            quizzesAttempted: logs.filter((log) => log.action === 'Completed Quiz').length,
        };
    }
    buildFeatureUsage(logs, notebooks, exams, calendarEvents, researchReports, caseSources, studyForge) {
        const getModuleStats = (moduleNames, getGeneratedCount) => {
            const moduleLogs = logs.filter((log) => moduleNames.includes(log.module));
            const timesUsed = moduleLogs.length;
            const lastAccess = moduleLogs.length > 0 ? moduleLogs[0].createdAt : null;
            const sessions = new Set(moduleLogs.map((log) => {
                const d = new Date(log.createdAt);
                return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
            }));
            const totalSessions = sessions.size;
            const generatedContentCount = getGeneratedCount();
            return {
                timesUsed,
                lastAccess,
                totalSessions,
                generatedContentCount,
            };
        };
        return [
            {
                module: 'LexMentor AI',
                ...getModuleStats(['LexMentor AI', 'Smart Study Forge', 'Exam Command Center', 'Citation Navigator', 'Case Impact Visualizer', 'Memorial Architect AI'], () => {
                    const mentorCount = logs.filter((log) => log.module === 'LexMentor AI' && log.action === 'Asked Question').length;
                    const otherMentors = logs.filter((log) => ['Citation Navigator', 'Case Impact Visualizer', 'Memorial Architect AI'].includes(log.module)).length;
                    return mentorCount + otherMentors + studyForge.flashcardsGenerated + exams.length;
                }),
            },
            {
                module: 'LexNotebook AI',
                ...getModuleStats(['LexNotebook AI', 'Notebook'], () => notebooks.length),
            },
            {
                module: 'Legal Research Command Center',
                ...getModuleStats(['Research Command Center', 'Legal Research Command Center'], () => researchReports.length),
            },
            {
                module: 'Moot Court Suite',
                ...getModuleStats(['Moot Court Suite'], () => {
                    return logs.filter((log) => log.module === 'Moot Court Suite' && log.action === 'Completed Simulation').length;
                }),
            },
            {
                module: 'Judgment Mastery Engine',
                ...getModuleStats(['Judgment Mastery Engine', 'Judgment Intelligence Engine'], () => {
                    return notebooks.filter((doc) => /judg(e)?ment/i.test(doc.documentType || doc.name)).length;
                }),
            },
            {
                module: 'Academic Navigator',
                ...getModuleStats(['Academic Navigator'], () => calendarEvents.length),
            },
            {
                module: 'AI Learning & Assessment Studio',
                ...getModuleStats(['AI Learning & Assessment Studio', 'Learning & Assessment Studio'], () => 0),
            },
            {
                module: 'Settings & Profile',
                ...getModuleStats(['Settings', 'Settings & Profile'], () => 0),
            },
        ];
    }
    calculateMasteryScore(input) {
        const weights = {
            quizPerformance: 0.28,
            flashcardAccuracy: 0.18,
            studyCompletion: 0.2,
            mootCourtScores: 0.14,
            researchCompletion: 0.2,
        };
        const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + (input[key] || 0) * weight, 0);
        return Math.max(0, Math.min(100, Math.round(score)));
    }
    calculateStreak(logs) {
        const days = new Set(logs.map((log) => this.dateKey(log.createdAt)));
        let streak = 0;
        const cursor = new Date();
        if (!days.has(this.dateKey(cursor)))
            cursor.setDate(cursor.getDate() - 1);
        while (days.has(this.dateKey(cursor))) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }
        return streak;
    }
    async syncAchievements(userId, metrics) {
        const existing = await this.achievementRepo.find({ where: { userId }, order: { unlockedAt: 'DESC' } });
        const existingKeys = new Set(existing.map((achievement) => achievement.badgeKey));
        const unlocked = [...existing];
        for (const rule of BADGE_RULES) {
            if (!existingKeys.has(rule.key) && (metrics[rule.metric] || 0) >= rule.target) {
                const saved = await this.achievementRepo.save(this.achievementRepo.create({
                    userId,
                    badgeKey: rule.key,
                    title: rule.title,
                    description: rule.description,
                }));
                unlocked.unshift(saved);
                await this.log({ userId, module: 'Settings', action: 'Unlocked Achievement', metadata: { badge: rule.key } });
            }
        }
        return unlocked;
    }
    hasCompletedConstitutionPath(exams, readiness) {
        const constitutionExamIds = new Set(exams.filter((exam) => /constitution/i.test(exam.subject)).map((exam) => exam.id));
        return readiness.some((snapshot) => constitutionExamIds.has(snapshot.examId) && Number(snapshot.readinessScore || 0) >= 100);
    }
    formatSubscription(subscription) {
        if (!subscription) {
            return {
                planName: null,
                status: null,
                renewalDate: null,
                usagePercentage: 0,
                aiCreditsUsed: 0,
                remainingCredits: 0,
            };
        }
        const normalizedPlan = (0, subscription_plans_1.normalizeSubscriptionPlan)(subscription.planName);
        const expired = normalizedPlan !== 'free' && Boolean(subscription.renewalDate) && new Date(subscription.renewalDate).getTime() < Date.now();
        const effectivePlan = subscription.status === 'active' && !expired ? normalizedPlan : 'free';
        const remainingCredits = effectivePlan === 'free' && normalizedPlan !== 'free'
            ? subscription_plans_1.SUBSCRIPTION_PLANS.free.aiCredits
            : Math.max(0, Number(subscription.aiCreditsLimit || 0) - Number(subscription.aiCreditsUsed || 0));
        return {
            planName: effectivePlan,
            status: effectivePlan === 'free' ? 'active' : subscription.status,
            renewalDate: subscription.renewalDate,
            usagePercentage: subscription.aiCreditsLimit ? Math.round((subscription.aiCreditsUsed / subscription.aiCreditsLimit) * 100) : 0,
            aiCreditsUsed: subscription.aiCreditsUsed,
            remainingCredits,
        };
    }
    calculateEngagementScore(logs, masteryScore) {
        return Math.round(logs.length * 25 + this.countSince(logs, 7) * 40 + masteryScore * 10);
    }
    calculateFeatureAdoption(featureUsage) {
        const adopted = featureUsage.filter((feature) => Number(feature.primaryValue || 0) + Number(feature.secondaryValue || 0) > 0).length;
        return Math.round((adopted / MODULES.length) * 100);
    }
    pickUsageFeature(featureUsage, mode) {
        const sorted = [...featureUsage].sort((a, b) => {
            const aTotal = Number(a.primaryValue || 0) + Number(a.secondaryValue || 0);
            const bTotal = Number(b.primaryValue || 0) + Number(b.secondaryValue || 0);
            return mode === 'most' ? bTotal - aTotal : aTotal - bTotal;
        });
        return sorted[0]?.module || null;
    }
    calculateLearningVelocity(logs) {
        const thisWeek = this.countSince(logs, 7);
        const previousWeekStart = new Date();
        previousWeekStart.setDate(previousWeekStart.getDate() - 14);
        const previousWeekEnd = new Date();
        previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);
        const previousWeek = logs.filter((log) => log.createdAt >= previousWeekStart && log.createdAt < previousWeekEnd).length;
        if (!previousWeek)
            return thisWeek ? 100 : 0;
        return Math.round(((thisWeek - previousWeek) / previousWeek) * 100);
    }
    countSince(logs, days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        return logs.filter((log) => log.createdAt >= since).length;
    }
    metadataNumbers(logs, module, keys) {
        return logs
            .filter((log) => log.module === module)
            .flatMap((log) => keys.map((key) => Number(log.metadata?.[key])).filter((value) => Number.isFinite(value)));
    }
    sumMetadata(logs, key) {
        return logs.reduce((sum, log) => sum + Number(log.metadata?.[key] || 0), 0);
    }
    average(values) {
        const clean = values.filter((value) => Number.isFinite(value) && value > 0);
        if (!clean.length)
            return 0;
        return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
    }
    dateKey(value) {
        return new Date(value).toISOString().slice(0, 10);
    }
    async getSecurity(userId) {
        try {
            return await this.clerkAccounts.getSecurity(userId);
        }
        catch {
            return {
                clerkConnected: false,
                activeSessionsAvailable: false,
                activeSessions: null,
                deviceHistoryAvailable: false,
                deviceHistory: [],
                passwordStatus: null,
                twoFactorStatus: null,
            };
        }
    }
    async buildExportPayload(authUser, kind) {
        const generatedAt = new Date().toISOString();
        const userId = authUser.id;
        const profile = await this.resolveProfile(authUser);
        if (kind === 'notes') {
            const dbPersonalNotes = await this.supabaseService.getUserNotes(userId);
            const dbResearchNotes = await this.supabaseService.getResearchNotes(userId);
            const notebooks = await this.notebookRepo.find({ where: { userId }, order: { uploadedAt: 'DESC' } });
            return {
                kind,
                generatedAt,
                studentName: profile.fullName || 'Anonymous Student',
                university: profile.university || 'Legatrixon Academy',
                semester: profile.yearOfStudy || 'N/A',
                personalNotes: dbPersonalNotes.map(n => ({
                    title: n.title,
                    content: n.content,
                    category: n.category,
                    createdAt: n.created_at
                })),
                researchNotes: dbResearchNotes.map(n => ({
                    title: n.title,
                    content: n.content,
                    createdAt: n.created_at
                })),
                notebooks: notebooks.map(doc => ({
                    name: doc.name,
                    documentType: doc.documentType,
                    uploadedAt: doc.uploadedAt,
                    wordCount: doc.wordCount,
                    pages: doc.pages,
                    tags: doc.tags || [],
                    studyForge: doc.studyForge || {}
                }))
            };
        }
        if (kind === 'research') {
            const history = await this.supabaseService.getResearchHistory(userId);
            const reports = await axios_1.default.get(`${this.supabaseService.supabaseUrl}/rest/v1/research_reports?user_id=eq.${userId}`, { headers: this.supabaseService.getHeaders() }).then(res => res.data).catch(() => []);
            return {
                kind,
                generatedAt,
                studentName: profile.fullName || 'Anonymous Student',
                university: profile.university || 'Legatrixon Academy',
                semester: profile.yearOfStudy || 'N/A',
                queries: history.map((q) => ({
                    question: q.question || q.queryText || q.query || 'Unspecified Query',
                    answer: q.answer || 'N/A',
                    sourcesUsed: Array.isArray(q.sources_used) ? q.sources_used : (q.sources_used ? [q.sources_used] : []),
                    createdAt: q.created_at,
                    category: q.research_category || 'General'
                })),
                reports: reports.map((r) => ({
                    title: r.title,
                    topic: r.topic || r.research_mode || 'General',
                    createdAt: r.created_at,
                    summary: r.summary || 'No summary available.'
                }))
            };
        }
        if (kind === 'flashcards') {
            const dbFlashcards = await this.supabaseService.getFlashcards(userId);
            const notebooks = await this.notebookRepo.find({ where: { userId } });
            const localFlashcards = [];
            notebooks.forEach(doc => {
                const forge = doc.studyForge || {};
                const cards = Array.isArray(forge.flashcards) ? forge.flashcards : [];
                cards.forEach((c) => {
                    localFlashcards.push({
                        question: c.question || c.front || '',
                        answer: c.answer || c.back || '',
                        topic: doc.name,
                        mastery: c.mastery || 0
                    });
                });
            });
            return {
                kind,
                generatedAt,
                studentName: profile.fullName || 'Anonymous Student',
                university: profile.university || 'Legatrixon Academy',
                semester: profile.yearOfStudy || 'N/A',
                flashcards: [
                    ...dbFlashcards.map((f) => ({
                        question: f.question,
                        answer: f.answer,
                        topic: f.topic || 'General',
                        mastery: f.mastery_level || 0,
                        createdAt: f.created_at
                    })),
                    ...localFlashcards
                ]
            };
        }
        if (kind === 'analytics') {
            const dbAnalytics = await this.supabaseService.getAnalyticsRecord(userId);
            const localDashboard = await this.getDashboard(authUser);
            const featureUsage = dbAnalytics?.feature_usage || localDashboard.featureUsage || [];
            const studyHours = Number(dbAnalytics?.study_hours || localDashboard.learningDashboard?.studyHours || 0);
            const casesStudied = Number(dbAnalytics?.cases_studied || localDashboard.learningDashboard?.casesStudied || 0);
            const researchSessions = Number(dbAnalytics?.research_sessions || localDashboard.learningDashboard?.researchSessions || 0);
            const masteryScore = Number(dbAnalytics?.mastery_score || localDashboard.learningDashboard?.masteryScore || 0);
            const academicProgress = Number(dbAnalytics?.academic_progress || localDashboard.subscription?.usagePercentage || 0);
            return {
                kind,
                generatedAt,
                studentName: profile.fullName || 'Anonymous Student',
                university: profile.university || 'Legatrixon Academy',
                semester: profile.yearOfStudy || 'N/A',
                metrics: {
                    studyHours,
                    casesStudied,
                    researchSessions,
                    masteryScore,
                    academicProgress
                },
                featureUsage
            };
        }
        if (kind === 'progress-report') {
            const dbProgress = await this.supabaseService.getProgressReportRecord(userId);
            const dbCalendar = await this.supabaseService.getCalendarEvents(userId);
            const dbInternships = await this.supabaseService.getInternshipApplications(userId);
            const localDashboard = await this.getDashboard(authUser);
            const masteryScore = Number(dbProgress?.mastery_score || localDashboard.learningDashboard?.masteryScore || 0);
            const studyStreak = Number(dbProgress?.study_streak || localDashboard.learningDashboard?.studyStreakDays || 0);
            const quizPerformance = Number(dbProgress?.quiz_performance || localDashboard.learningDashboard?.quizAccuracy || 0);
            const researchPerformance = Number(dbProgress?.research_performance || localDashboard.learningDashboard?.researchSessions || 0);
            const studyHours = Number(dbProgress?.study_hours || localDashboard.learningDashboard?.studyHours || 0);
            const flashcardUsage = Number(dbProgress?.flashcard_usage || localDashboard.learningDashboard?.flashcardsReviewed || 0);
            const calendarActivities = Number(dbProgress?.calendar_activities || dbCalendar.length);
            const internshipActivities = Number(dbProgress?.internship_activities || dbInternships.length);
            return {
                kind,
                generatedAt,
                studentName: dbProgress?.student_name || profile.fullName || 'Anonymous Student',
                university: dbProgress?.university || profile.university || 'Legatrixon Academy',
                semester: dbProgress?.semester || profile.yearOfStudy || 'N/A',
                metrics: {
                    masteryScore,
                    studyStreak,
                    quizPerformance,
                    researchPerformance,
                    studyHours,
                    flashcardUsage,
                    calendarActivities,
                    internshipActivities
                },
                strengthAnalysis: dbProgress?.strength_analysis || "Demonstrates strong understanding of constitutional principles and consistent streak compliance.",
                weakness_analysis: dbProgress?.weakness_analysis || "Requires more focus on alternate dispute mechanisms and procedural cost guidelines.",
                ai_recommendations: dbProgress?.ai_recommendations || "Engage with LexNotebook AI study decks daily and increase mock test frequency."
            };
        }
        throw new common_1.NotFoundException('Unsupported export type');
    }
    renderExportText(payload) {
        if (payload.kind === 'notes') {
            let text = `LEGATRIXON NOTES EXPORT\n`;
            text += `Generated At: ${payload.generatedAt}\n`;
            text += `=========================================\n\n`;
            text += `1. RESEARCH NOTES\n`;
            text += `-----------------------------------------\n`;
            if (!payload.researchNotes || !payload.researchNotes.length) {
                text += `No research notes found.\n`;
            }
            else {
                payload.researchNotes.forEach((note, idx) => {
                    text += `Note #${idx + 1}: ${note.title || 'Untitled Note'}\n`;
                    text += `Created At: ${note.createdAt}\n`;
                    text += `-----------------------------------------\n`;
                    text += `${note.content || ''}\n\n`;
                });
            }
            text += `\n2. USER NOTEBOOKS & DOCUMENTS\n`;
            text += `-----------------------------------------\n`;
            if (!payload.notebooks || !payload.notebooks.length) {
                text += `No notebooks found.\n`;
            }
            else {
                payload.notebooks.forEach((doc, idx) => {
                    text += `Document #${idx + 1}: ${doc.name} (${doc.documentType})\n`;
                    text += `Uploaded At: ${doc.uploadedAt}\n`;
                    text += `Size: ${doc.wordCount || 0} words, ${doc.pages || 0} pages\n\n`;
                });
            }
            return text;
        }
        if (payload.kind === 'research') {
            let text = `LEGATRIXON RESEARCH EXPORT\n`;
            text += `Generated At: ${payload.generatedAt}\n`;
            text += `=========================================\n\n`;
            text += `1. RESEARCH QUERIES\n`;
            text += `-----------------------------------------\n`;
            if (!payload.queries || !payload.queries.length) {
                text += `No queries found.\n`;
            }
            else {
                payload.queries.forEach((q, idx) => {
                    text += `[${q.status?.toUpperCase() || 'PENDING'}] Query: ${q.queryText}\n`;
                    text += `Created At: ${q.createdAt}\n\n`;
                });
            }
            text += `\n2. RESEARCH REPORTS\n`;
            text += `-----------------------------------------\n`;
            if (!payload.reports || !payload.reports.length) {
                text += `No research reports found.\n`;
            }
            else {
                payload.reports.forEach((report, idx) => {
                    text += `Report #${idx + 1}: ${report.title || 'Untitled Report'}\n`;
                    text += `Topic: ${report.topic || 'General'}\n`;
                    text += `Created At: ${report.createdAt}\n`;
                    text += `Summary:\n${report.summary || 'No summary available.'}\n\n`;
                });
            }
            return text;
        }
        if (payload.kind === 'flashcards') {
            let text = `LEGATRIXON FLASHCARDS EXPORT\n`;
            text += `Generated At: ${payload.generatedAt}\n`;
            text += `=========================================\n\n`;
            if (!payload.documents || !payload.documents.length) {
                text += `No flashcards found.\n`;
            }
            else {
                payload.documents.forEach((doc) => {
                    text += `Document: ${doc.name}\n`;
                    text += `Progress: Reviewed ${doc.progress?.flashcardsReviewed || 0} cards.\n`;
                    text += `-----------------------------------------\n`;
                    const cards = doc.flashcards || [];
                    if (!cards.length) {
                        text += `No cards generated for this document.\n\n`;
                    }
                    else {
                        cards.forEach((card, idx) => {
                            text += `Card #${idx + 1}\n`;
                            text += `Question: ${card.question || card.front || ''}\n`;
                            text += `Answer: ${card.answer || card.back || ''}\n`;
                            text += `Mastery: ${card.mastery || 0}%\n\n`;
                        });
                    }
                });
            }
            return text;
        }
        if (payload.kind === 'study-progress' || payload.kind === 'progress-report') {
            let text = `LEGATRIXON STUDY PROGRESS & PERFORMANCE REPORT\n`;
            text += `Generated At: ${payload.generatedAt}\n`;
            text += `=========================================\n\n`;
            const ld = payload.learningDashboard || {};
            text += `LEARNING METRICS:\n`;
            text += `- Mastery Score: ${ld.masteryScore || 0}%\n`;
            text += `- Study Streak: ${ld.studyStreakDays || 0} days\n`;
            text += `- Study Hours: ${ld.studyHours || 0} hours\n`;
            text += `- Cases Studied: ${ld.casesStudied || 0}\n`;
            text += `- Research Sessions: ${ld.researchSessions || 0}\n`;
            text += `- Flashcards Reviewed: ${ld.flashcardsReviewed || 0}\n`;
            text += `- Quiz Accuracy: ${ld.quizAccuracy || 0}%\n\n`;
            text += `ACHIEVEMENTS:\n`;
            const ach = payload.achievements || {};
            text += `- Current Level: ${ach.level || 1}\n`;
            text += `- XP: ${ach.xp || 0}\n`;
            text += `- Badges Unlocked: ${ach.badgeCount || 0}\n`;
            if (ach.unlocked && ach.unlocked.length) {
                ach.unlocked.forEach((badge) => {
                    text += `  * [Unlocked ${new Date(badge.unlockedAt).toLocaleDateString()}] ${badge.title}: ${badge.description}\n`;
                });
            }
            text += `\nFEATURE USAGE STATISTICS:\n`;
            if (payload.featureUsage && payload.featureUsage.length) {
                payload.featureUsage.forEach((item) => {
                    text += `- ${item.module}:\n`;
                    text += `  * Times Used: ${item.timesUsed || 0}\n`;
                    text += `  * Total Sessions: ${item.totalSessions || 0}\n`;
                    text += `  * Generated Content Count: ${item.generatedContentCount || 0}\n`;
                    text += `  * Last Access: ${item.lastAccess ? new Date(item.lastAccess).toLocaleDateString() : 'Never'}\n`;
                });
            }
            return text;
        }
        if (payload.kind === 'analytics') {
            let text = `LEGATRIXON PLATFORM ANALYTICS REPORT\n`;
            text += `Generated At: ${payload.generatedAt}\n`;
            text += `=========================================\n\n`;
            const ae = payload.analyticsEngine || {};
            text += `ANALYTICS ENGINE METRICS:\n`;
            text += `- Total Usage Operations: ${ae.totalUsage || 0}\n`;
            text += `- Weekly Usage Operations: ${ae.weeklyUsage || 0}\n`;
            text += `- Monthly Usage Operations: ${ae.monthlyUsage || 0}\n`;
            text += `- Feature Adoption Rate: ${ae.featureAdoption || 0}%\n`;
            text += `- Most Used Feature: ${ae.mostUsedFeature || 'None'}\n`;
            text += `- Least Used Feature: ${ae.leastUsedFeature || 'None'}\n`;
            text += `- Learning Velocity: ${ae.learningVelocity || 0}%\n`;
            text += `- Engagement Score: ${ae.engagementScore || 0}\n\n`;
            text += `MODULE USAGE STACK:\n`;
            if (payload.featureUsage && payload.featureUsage.length) {
                payload.featureUsage.forEach((item) => {
                    text += `- ${item.module}:\n`;
                    text += `  * Times Used: ${item.timesUsed || 0}\n`;
                    text += `  * Total Sessions: ${item.totalSessions || 0}\n`;
                    text += `  * Generated Content Count: ${item.generatedContentCount || 0}\n`;
                    text += `  * Last Access: ${item.lastAccess ? new Date(item.lastAccess).toLocaleDateString() : 'Never'}\n`;
                });
            }
            return text;
        }
        return `LEGATRIXON User Data Export\nType: ${payload.kind}\nGenerated: ${payload.generatedAt}\n\n${JSON.stringify(payload, null, 2)}`;
    }
    createPdfDocument(kind, payload) {
        return new Promise((resolve, reject) => {
            try {
                const PDFDocument = require('pdfkit');
                const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
                const buffers = [];
                doc.on('data', (chunk) => buffers.push(chunk));
                doc.on('end', () => {
                    const range = doc.bufferedPageRange();
                    for (let i = 0; i < range.count; i++) {
                        doc.switchToPage(i);
                        if (i > 0) {
                            doc.fillColor('#777777').fontSize(8).font('Helvetica').text('LEGATRIXON™ LEGAL ENGINE EXPORT', 50, 25);
                            doc.rect(50, 35, 495, 0.5).fill('#c5a880');
                        }
                        doc.rect(50, 755, 495, 0.5).fill('#c5a880');
                        doc.fillColor('#777777').fontSize(8).font('Helvetica')
                            .text(`Generated on: ${new Date(payload.generatedAt).toLocaleDateString()}`, 50, 765);
                        doc.text(`Page ${i + 1} of ${range.count}`, 480, 765, { align: 'right' });
                    }
                    resolve(Buffer.concat(buffers));
                });
                doc.rect(20, 20, 555, 800).lineWidth(3).stroke('#c5a880');
                doc.rect(25, 25, 545, 790).lineWidth(1).stroke('#c5a880');
                doc.moveDown(8);
                doc.fillColor('#1b2838').fontSize(28).font('Helvetica-Bold').text('LEGATRIXON™', { align: 'center' });
                doc.moveDown(0.5);
                let reportTitle = "EXPORT REPORT";
                if (kind === 'notes')
                    reportTitle = "EXPORT NOTEBOOK NOTES";
                else if (kind === 'research')
                    reportTitle = "EXPORT RESEARCH HISTORY REPORT";
                else if (kind === 'flashcards')
                    reportTitle = "EXPORT STUDY FLASHCARDS REPORT";
                else if (kind === 'analytics')
                    reportTitle = "EXPORT PLATFORM ANALYTICS REPORT";
                else if (kind === 'progress-report')
                    reportTitle = "LEGATRIXON ACADEMIC PROGRESS REPORT";
                doc.fillColor('#c5a880').fontSize(16).font('Helvetica-Bold').text(reportTitle, { align: 'center' });
                doc.moveDown(2);
                doc.fillColor('#333333').fontSize(12).font('Helvetica-Bold').text(`Student: ${payload.studentName}`, { align: 'center' });
                doc.text(`University: ${payload.university}`, { align: 'center' });
                doc.text(`Semester: ${payload.semester}`, { align: 'center' });
                doc.moveDown(8);
                doc.fontSize(10).fillColor('#777777').text('Authorized Legatrixon Academic Verification Document', { align: 'center' });
                doc.addPage();
                doc.fillColor('#1b2838').fontSize(16).font('Helvetica-Bold').text(reportTitle);
                doc.rect(doc.x, doc.y + 2, 495, 2).fill('#c5a880');
                doc.moveDown(2);
                if (kind === 'notes') {
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('1. Notebook Documents');
                    doc.moveDown(0.5);
                    if (!payload.notebooks || payload.notebooks.length === 0) {
                        doc.fontSize(10).fillColor('#555555').font('Helvetica').text('No local notebook documents found.');
                        doc.moveDown(1.5);
                    }
                    else {
                        payload.notebooks.forEach((docItem) => {
                            doc.fontSize(11).fillColor('#1b2838').font('Helvetica-Bold').text(`- ${docItem.name}`);
                            doc.fontSize(10).fillColor('#555555').font('Helvetica').text(`Type: ${docItem.documentType} | Words: ${docItem.wordCount} | Pages: ${docItem.pages}`);
                            doc.moveDown(0.8);
                        });
                    }
                    doc.moveDown(1);
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('2. Personal & Legal Notes');
                    doc.moveDown(0.5);
                    if (!payload.personalNotes || payload.personalNotes.length === 0) {
                        doc.fontSize(10).fillColor('#555555').font('Helvetica').text('No personal notes recorded in Supabase.');
                        doc.moveDown(1.5);
                    }
                    else {
                        payload.personalNotes.forEach((n) => {
                            doc.fontSize(11).fillColor('#1b2838').font('Helvetica-Bold').text(`- ${n.title} [${n.category}]`);
                            doc.fontSize(10).fillColor('#555555').font('Helvetica').text(n.content);
                            doc.moveDown(1.2);
                        });
                    }
                    doc.moveDown(1);
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('3. Research Notes');
                    doc.moveDown(0.5);
                    if (!payload.researchNotes || payload.researchNotes.length === 0) {
                        doc.fontSize(10).fillColor('#555555').font('Helvetica').text('No research notes recorded in Supabase.');
                    }
                    else {
                        payload.researchNotes.forEach((n) => {
                            doc.fontSize(11).fillColor('#1b2838').font('Helvetica-Bold').text(`- ${n.title}`);
                            doc.fontSize(10).fillColor('#555555').font('Helvetica').text(n.content);
                            doc.moveDown(1.2);
                        });
                    }
                }
                else if (kind === 'research') {
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('1. Research Queries & History');
                    doc.moveDown(0.5);
                    if (!payload.queries || payload.queries.length === 0) {
                        doc.fontSize(10).fillColor('#555555').font('Helvetica').text('No research queries logged in Supabase.');
                        doc.moveDown(1.5);
                    }
                    else {
                        payload.queries.forEach((q) => {
                            doc.fontSize(11).fillColor('#1b2838').font('Helvetica-Bold').text(`Question: ${q.question}`);
                            doc.fontSize(10).fillColor('#555555').font('Helvetica').text(`Category: ${q.category} | Date: ${new Date(q.createdAt).toLocaleDateString()}`);
                            doc.fontSize(10).fillColor('#333333').font('Helvetica').text(`Answer: ${q.answer}`);
                            if (q.sourcesUsed && q.sourcesUsed.length > 0) {
                                doc.fontSize(9).fillColor('#9a7849').font('Helvetica-Oblique').text(`Sources Used: ${JSON.stringify(q.sourcesUsed)}`);
                            }
                            doc.moveDown(1.5);
                        });
                    }
                    doc.moveDown(1);
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('2. Research Reports Generated');
                    doc.moveDown(0.5);
                    if (!payload.reports || payload.reports.length === 0) {
                        doc.fontSize(10).fillColor('#555555').font('Helvetica').text('No reports compiled.');
                    }
                    else {
                        payload.reports.forEach((r) => {
                            doc.fontSize(11).fillColor('#1b2838').font('Helvetica-Bold').text(`- ${r.title}`);
                            doc.fontSize(10).fillColor('#555555').font('Helvetica').text(`Topic: ${r.topic} | Compiled on: ${new Date(r.createdAt).toLocaleDateString()}`);
                            doc.fontSize(10).fillColor('#333333').font('Helvetica').text(`Summary: ${r.summary}`);
                            doc.moveDown(1.2);
                        });
                    }
                }
                else if (kind === 'flashcards') {
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('Study Decks & Flashcards');
                    doc.moveDown(0.5);
                    if (!payload.flashcards || payload.flashcards.length === 0) {
                        doc.fontSize(10).fillColor('#555555').font('Helvetica').text('No study flashcards found.');
                    }
                    else {
                        payload.flashcards.forEach((f, idx) => {
                            doc.fontSize(11).fillColor('#1b2838').font('Helvetica-Bold').text(`Flashcard #${idx + 1} (${f.topic || 'General'})`);
                            doc.fontSize(10).fillColor('#333333').font('Helvetica').text(`Q: ${f.question}`);
                            doc.fontSize(10).fillColor('#555555').font('Helvetica').text(`A: ${f.answer}`);
                            doc.fontSize(9).fillColor('#c5a880').font('Helvetica-Bold').text(`Mastery Level: ${f.mastery}%`);
                            doc.moveDown(1.2);
                        });
                    }
                }
                else if (kind === 'analytics') {
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('1. Analytics Engine Metrics');
                    doc.moveDown(0.5);
                    doc.fontSize(10).fillColor('#333333').font('Helvetica')
                        .text(`- Total Study Hours: ${payload.metrics.studyHours} hrs`)
                        .text(`- Cases Studied: ${payload.metrics.casesStudied}`)
                        .text(`- Research Sessions: ${payload.metrics.researchSessions}`)
                        .text(`- Mastery Score: ${payload.metrics.masteryScore}%`)
                        .text(`- Academic Progress Rate: ${payload.metrics.academicProgress}%`);
                    doc.moveDown(1.5);
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('2. Feature Engagement Logs');
                    doc.moveDown(0.5);
                    if (!payload.featureUsage || payload.featureUsage.length === 0) {
                        doc.fontSize(10).fillColor('#555555').font('Helvetica').text('No logs tracked.');
                    }
                    else {
                        payload.featureUsage.forEach((feat) => {
                            doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold').text(`- ${feat.module || feat.module_name}`);
                            doc.fontSize(9).fillColor('#555555').font('Helvetica').text(`Times Used: ${feat.timesUsed || feat.times_used || 0} | Sessions: ${feat.totalSessions || feat.total_sessions || 0}`);
                            doc.moveDown(0.6);
                        });
                    }
                }
                else if (kind === 'progress-report') {
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('1. Performance Metrics');
                    doc.moveDown(0.5);
                    doc.fontSize(10).fillColor('#333333').font('Helvetica')
                        .text(`- Mastery Score: ${payload.metrics.masteryScore}%`)
                        .text(`- Study Streak: ${payload.metrics.studyStreak} days`)
                        .text(`- Quiz Performance Score: ${payload.metrics.quizPerformance}%`)
                        .text(`- Research Performance Completed: ${payload.metrics.researchPerformance} sessions`)
                        .text(`- Study Hours Logged: ${payload.metrics.studyHours} hrs`)
                        .text(`- Flashcard Reviews Drill Count: ${payload.metrics.flashcardUsage}`)
                        .text(`- Calendar Activities Logged: ${payload.metrics.calendarActivities}`)
                        .text(`- Internship Applications Saved: ${payload.metrics.internshipActivities}`);
                    doc.moveDown(1.5);
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('2. Strength Analysis');
                    doc.moveDown(0.5);
                    doc.fontSize(10).fillColor('#333333').font('Helvetica').text(payload.strengthAnalysis, { align: 'justify' });
                    doc.moveDown(1.5);
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('3. Weakness Analysis');
                    doc.moveDown(0.5);
                    doc.fontSize(10).fillColor('#333333').font('Helvetica').text(payload.weakness_analysis, { align: 'justify' });
                    doc.moveDown(1.5);
                    doc.fontSize(12).fillColor('#1b2838').font('Helvetica-Bold').text('4. AI Academic Recommendations');
                    doc.moveDown(0.5);
                    doc.fontSize(10).fillColor('#333333').font('Helvetica').text(payload.ai_recommendations, { align: 'justify' });
                }
                doc.end();
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async createDocxDocument(kind, payload) {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
        let reportTitle = "EXPORT REPORT";
        if (kind === 'notes')
            reportTitle = "EXPORT NOTEBOOK NOTES";
        else if (kind === 'research')
            reportTitle = "EXPORT RESEARCH HISTORY REPORT";
        else if (kind === 'flashcards')
            reportTitle = "EXPORT STUDY FLASHCARDS REPORT";
        else if (kind === 'analytics')
            reportTitle = "EXPORT PLATFORM ANALYTICS REPORT";
        else if (kind === 'progress-report')
            reportTitle = "LEGATRIXON ACADEMIC PROGRESS REPORT";
        const docChildren = [
            new Paragraph({
                text: 'LEGATRIXON™ ACADEMIC SUITE',
                heading: HeadingLevel.HEADING_2,
                alignment: 'center',
            }),
            new Paragraph({
                text: reportTitle,
                heading: HeadingLevel.TITLE,
                alignment: 'center',
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: `Student Name: ${payload.studentName}`, bold: true }),
                    new TextRun({ text: `\nUniversity: ${payload.university}` }),
                    new TextRun({ text: `\nSemester: ${payload.semester}` }),
                    new TextRun({ text: `\nExported At: ${new Date(payload.generatedAt).toLocaleString()}` }),
                ],
                spacing: { before: 200, after: 400 },
            }),
        ];
        if (kind === 'notes') {
            docChildren.push(new Paragraph({ text: 'Notebook Documents', heading: HeadingLevel.HEADING_1 }));
            if (!payload.notebooks || payload.notebooks.length === 0) {
                docChildren.push(new Paragraph('No local notebook documents found.'));
            }
            else {
                payload.notebooks.forEach((docItem) => {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: docItem.name, bold: true }),
                            new TextRun(` (${docItem.documentType}) - Size: ${docItem.wordCount || 0} words, ${docItem.pages || 0} pages`),
                        ],
                        spacing: { before: 100, after: 100 },
                    }));
                });
            }
            docChildren.push(new Paragraph({ text: 'Personal & Legal Notes', heading: HeadingLevel.HEADING_1 }));
            if (!payload.personalNotes || payload.personalNotes.length === 0) {
                docChildren.push(new Paragraph('No personal notes recorded in Supabase.'));
            }
            else {
                payload.personalNotes.forEach((n) => {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: n.title, bold: true }),
                            new TextRun(` [Category: ${n.category}]\n`),
                            new TextRun(n.content),
                        ],
                        spacing: { before: 100, after: 100 },
                    }));
                });
            }
            docChildren.push(new Paragraph({ text: 'Research Notes', heading: HeadingLevel.HEADING_1 }));
            if (!payload.researchNotes || payload.researchNotes.length === 0) {
                docChildren.push(new Paragraph('No research notes recorded in Supabase.'));
            }
            else {
                payload.researchNotes.forEach((n) => {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: n.title, bold: true }),
                            new TextRun(`\n${n.content}`),
                        ],
                        spacing: { before: 100, after: 100 },
                    }));
                });
            }
        }
        else if (kind === 'research') {
            docChildren.push(new Paragraph({ text: 'Research Queries & History', heading: HeadingLevel.HEADING_1 }));
            if (!payload.queries || payload.queries.length === 0) {
                docChildren.push(new Paragraph('No research queries found in Supabase.'));
            }
            else {
                payload.queries.forEach((q) => {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: `Question: ${q.question}`, bold: true }),
                            new TextRun(`\nCategory: ${q.category} | Created: ${new Date(q.createdAt).toLocaleDateString()}`),
                            new TextRun(`\nAnswer Outline: ${q.answer}`),
                            new TextRun(`\nSources Used: ${JSON.stringify(q.sourcesUsed)}`),
                        ],
                        spacing: { before: 150, after: 150 },
                    }));
                });
            }
            docChildren.push(new Paragraph({ text: 'Research Reports Generated', heading: HeadingLevel.HEADING_1 }));
            if (!payload.reports || payload.reports.length === 0) {
                docChildren.push(new Paragraph('No reports compiled.'));
            }
            else {
                payload.reports.forEach((r) => {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: r.title, bold: true }),
                            new TextRun(`\nTopic: ${r.topic} | Summary: ${r.summary}`),
                        ],
                        spacing: { before: 100, after: 100 },
                    }));
                });
            }
        }
        else if (kind === 'flashcards') {
            docChildren.push(new Paragraph({ text: 'Study Flashcards', heading: HeadingLevel.HEADING_1 }));
            if (!payload.flashcards || payload.flashcards.length === 0) {
                docChildren.push(new Paragraph('No flashcards found.'));
            }
            else {
                payload.flashcards.forEach((f) => {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: `Topic: ${f.topic || 'General'}`, bold: true }),
                            new TextRun(`\nQuestion: ${f.question}`),
                            new TextRun(`\nAnswer: ${f.answer}`),
                            new TextRun({ text: `\nMastery Level: ${f.mastery}%`, bold: true }),
                        ],
                        spacing: { before: 120, after: 120 },
                    }));
                });
            }
        }
        else if (kind === 'analytics') {
            docChildren.push(new Paragraph({ text: 'Performance Metrics', heading: HeadingLevel.HEADING_1 }));
            docChildren.push(new Paragraph(`Total Study Hours: ${payload.metrics.studyHours} hours`));
            docChildren.push(new Paragraph(`Cases Studied: ${payload.metrics.casesStudied} judgments`));
            docChildren.push(new Paragraph(`Research Sessions: ${payload.metrics.researchSessions} queries`));
            docChildren.push(new Paragraph(`Mastery Score: ${payload.metrics.masteryScore}%`));
            docChildren.push(new Paragraph(`Academic Progress: ${payload.metrics.academicProgress}%`));
            docChildren.push(new Paragraph({ text: 'Feature Engagement Analysis', heading: HeadingLevel.HEADING_1 }));
            if (!payload.featureUsage || payload.featureUsage.length === 0) {
                docChildren.push(new Paragraph('No feature usage recorded.'));
            }
            else {
                payload.featureUsage.forEach((feat) => {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: feat.module || feat.module_name, bold: true }),
                            new TextRun(` - Times Used: ${feat.timesUsed || feat.times_used || 0}, Total Sessions: ${feat.totalSessions || feat.total_sessions || 0}`),
                        ],
                        spacing: { before: 80, after: 80 },
                    }));
                });
            }
        }
        else if (kind === 'progress-report') {
            docChildren.push(new Paragraph({ text: 'Academic Progress Metrics', heading: HeadingLevel.HEADING_1 }));
            docChildren.push(new Paragraph(`Mastery Score: ${payload.metrics.masteryScore}%`));
            docChildren.push(new Paragraph(`Study Streak: ${payload.metrics.studyStreak} days`));
            docChildren.push(new Paragraph(`Quiz Accuracy: ${payload.metrics.quizPerformance}%`));
            docChildren.push(new Paragraph(`Research Performance: ${payload.metrics.researchPerformance} sessions`));
            docChildren.push(new Paragraph(`Study Hours: ${payload.metrics.studyHours} hours`));
            docChildren.push(new Paragraph(`Flashcard Usage: ${payload.metrics.flashcardUsage} reviews`));
            docChildren.push(new Paragraph(`Calendar Activities: ${payload.metrics.calendarActivities}`));
            docChildren.push(new Paragraph(`Internship Activities: ${payload.metrics.internshipActivities}`));
            docChildren.push(new Paragraph({ text: 'Strength Analysis', heading: HeadingLevel.HEADING_1 }));
            docChildren.push(new Paragraph(payload.strengthAnalysis));
            docChildren.push(new Paragraph({ text: 'Weakness Analysis', heading: HeadingLevel.HEADING_1 }));
            docChildren.push(new Paragraph(payload.weakness_analysis));
            docChildren.push(new Paragraph({ text: 'AI Recommendations', heading: HeadingLevel.HEADING_1 }));
            docChildren.push(new Paragraph(payload.ai_recommendations));
        }
        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: docChildren,
                },
            ],
        });
        return Packer.toBuffer(doc);
    }
    async createPptxDocument(kind, payload) {
        const PptxGenJS = require('pptxgenjs');
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';
        const slide1 = pptx.addSlide();
        slide1.background = { color: '1b2838' };
        slide1.addText('LEGATRIXON™ ACADEMIC SUITE', {
            x: 1.0, y: 1.8, w: 8.0, h: 0.8,
            fontSize: 32, bold: true, color: 'c5a880',
            fontFace: 'Helvetica'
        });
        let reportTitle = "EXPORT REPORT";
        if (kind === 'notes')
            reportTitle = "EXPORT NOTEBOOK NOTES";
        else if (kind === 'research')
            reportTitle = "EXPORT RESEARCH HISTORY";
        else if (kind === 'flashcards')
            reportTitle = "EXPORT STUDY FLASHCARDS";
        else if (kind === 'analytics')
            reportTitle = "EXPORT PLATFORM ANALYTICS";
        else if (kind === 'progress-report')
            reportTitle = "ACADEMIC PROGRESS REPORT";
        slide1.addText(reportTitle, {
            x: 1.0, y: 2.7, w: 8.0, h: 0.6,
            fontSize: 20, bold: true, color: 'ffffff',
            fontFace: 'Helvetica'
        });
        slide1.addText(`Student: ${payload.studentName}\nUniversity: ${payload.university}\nSemester: ${payload.semester}\nGenerated At: ${new Date(payload.generatedAt).toLocaleDateString()}`, {
            x: 1.0, y: 3.8, w: 8.0, h: 1.8,
            fontSize: 14, color: 'cccccc',
            fontFace: 'Helvetica'
        });
        if (kind === 'notes') {
            const slide2 = pptx.addSlide();
            slide2.addText('Notebooks & Legal Documents', { x: 0.5, y: 0.5, w: 9.0, h: 0.8, fontSize: 24, bold: true, color: '1b2838' });
            let notebookText = payload.notebooks?.map((d) => `- ${d.name} (${d.documentType}) - Pages: ${d.pages}`).slice(0, 5).join('\n');
            if (!notebookText)
                notebookText = 'No notebook documents available.';
            slide2.addText(notebookText, { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 16, color: '333333' });
            const slide3 = pptx.addSlide();
            slide3.addText('Personal & Research Notes Summary', { x: 0.5, y: 0.5, w: 9.0, h: 0.8, fontSize: 24, bold: true, color: '1b2838' });
            let notesText = [...(payload.personalNotes || []), ...(payload.researchNotes || [])]
                .map((n) => `• ${n.title || 'Untitled Note'}: ${n.content?.slice(0, 100)}...`)
                .slice(0, 5)
                .join('\n\n');
            if (!notesText)
                notesText = 'No notes compiled yet.';
            slide3.addText(notesText, { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 14, color: '333333' });
        }
        else if (kind === 'research') {
            const slide2 = pptx.addSlide();
            slide2.addText('Legal Research Sessions & Queries', { x: 0.5, y: 0.5, w: 9.0, h: 0.8, fontSize: 24, bold: true, color: '1b2838' });
            const queriesText = payload.queries?.map((q) => `Q: ${q.question}\nAns Outline: ${q.answer?.slice(0, 100)}...`).slice(0, 3).join('\n\n');
            slide2.addText(queriesText || 'No queries compiled.', { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 14, color: '333333' });
            const slide3 = pptx.addSlide();
            slide3.addText('Generated Research Reports', { x: 0.5, y: 0.5, w: 9.0, h: 0.8, fontSize: 24, bold: true, color: '1b2838' });
            const reportsText = payload.reports?.map((r) => `• ${r.title} (${r.topic})\nSummary: ${r.summary?.slice(0, 100)}...`).slice(0, 3).join('\n\n');
            slide3.addText(reportsText || 'No research reports found.', { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 14, color: '333333' });
        }
        else if (kind === 'flashcards') {
            const slide2 = pptx.addSlide();
            slide2.addText('Study Forge Flashcards Summary', { x: 0.5, y: 0.5, w: 9.0, h: 0.8, fontSize: 24, bold: true, color: '1b2838' });
            const cardsText = payload.flashcards?.map((f) => `Q: ${f.question}\nA: ${f.answer}\nMastery: ${f.mastery}%`).slice(0, 3).join('\n\n');
            slide2.addText(cardsText || 'No flashcards generated.', { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 14, color: '333333' });
        }
        else if (kind === 'analytics') {
            const slide2 = pptx.addSlide();
            slide2.addText('Performance Analytics & Statistics Table', { x: 0.5, y: 0.5, w: 9.0, h: 0.8, fontSize: 24, bold: true, color: '1b2838' });
            const rows = [
                ['Metric Category', 'Score / Value'],
                ['Total Study Hours', `${payload.metrics.studyHours} hrs`],
                ['Cases Studied', String(payload.metrics.casesStudied)],
                ['Research Sessions', String(payload.metrics.researchSessions)],
                ['Mastery Score', `${payload.metrics.masteryScore}%`],
                ['Academic Progress', `${payload.metrics.academicProgress}%`]
            ];
            slide2.addTable(rows, { x: 0.5, y: 1.5, w: 9.0, h: 3.5, border: { type: 'line', width: 1, color: 'cccccc' } });
            const slide3 = pptx.addSlide();
            slide3.addText('Feature Engagement Stack', { x: 0.5, y: 0.5, w: 9.0, h: 0.8, fontSize: 24, bold: true, color: '1b2838' });
            const featText = payload.featureUsage?.map((f) => `- ${f.module || f.module_name}: ${f.timesUsed || f.times_used || 0} times`).slice(0, 6).join('\n');
            slide3.addText(featText || 'No feature logs tracked.', { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 15, color: '333333' });
        }
        else if (kind === 'progress-report') {
            const slide2 = pptx.addSlide();
            slide2.addText('Academic Progress Metrics Table', { x: 0.5, y: 0.5, w: 9.0, h: 0.8, fontSize: 24, bold: true, color: '1b2838' });
            const rows = [
                ['Performance Metric', 'Value'],
                ['Mastery Score', `${payload.metrics.masteryScore}%`],
                ['Study Streak', `${payload.metrics.studyStreak} days`],
                ['Quiz Performance', `${payload.metrics.quizPerformance}%`],
                ['Research Performance', `${payload.metrics.researchPerformance} sessions`],
                ['Study Hours Logged', `${payload.metrics.studyHours} hrs`],
                ['Flashcard Reviews', String(payload.metrics.flashcardUsage)],
                ['Calendar Events', String(payload.metrics.calendarActivities)],
                ['Internship Applications', String(payload.metrics.internshipActivities)]
            ];
            slide2.addTable(rows, { x: 0.5, y: 1.3, w: 9.0, h: 4.0, border: { type: 'line', width: 1, color: 'cccccc' } });
            const slide3 = pptx.addSlide();
            slide3.addText('Strengths & Weaknesses Analysis', { x: 0.5, y: 0.5, w: 9.0, h: 0.8, fontSize: 24, bold: true, color: '1b2838' });
            slide3.addText(`STRENGTH ANALYSIS:\n${payload.strengthAnalysis}\n\nWEAKNESS ANALYSIS:\n${payload.weakness_analysis}`, {
                x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 14, color: '333333'
            });
            const slide4 = pptx.addSlide();
            slide4.addText('AI Academic Recommendations & Steps', { x: 0.5, y: 0.5, w: 9.0, h: 0.8, fontSize: 24, bold: true, color: '1b2838' });
            slide4.addText(payload.ai_recommendations, { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 16, color: '333333' });
        }
        const data = await pptx.write('nodebuffer');
        return data;
    }
    async createFeedback(clerkUserId, data) {
        const profile = await this.supabaseService.getProfile(clerkUserId);
        const userUuid = profile?.id || null;
        const email = profile?.email || 'unknown@example.com';
        const name = profile?.full_name || 'Anonymous User';
        let savedRecord = null;
        if (data.type === 'rating') {
            if (userUuid) {
                const existingRatings = await this.supabaseService.getMySupportTickets(userUuid);
                const recentRating = existingRatings.find((t) => t.ticket_type === 'Star Rating' && (Date.now() - new Date(t.created_at).getTime()) < 120000);
                if (recentRating) {
                    throw new common_1.BadRequestException('You have already submitted a rating recently. Please wait a moment.');
                }
            }
            savedRecord = await this.supabaseService.createRating(userUuid, email, name, data.rating);
        }
        else if (data.type === 'ai_feedback') {
            const typeLabel = data.isHelpful ? 'Helpful' : 'Not Helpful';
            savedRecord = await this.supabaseService.createAiFeedback(userUuid, email, name, typeLabel);
        }
        else if (data.type === 'bug') {
            savedRecord = await this.supabaseService.createBugReport(userUuid, email, name, data.issueType, data.module, data.description, data.screenshotUrl);
            const subject = `[BUG REPORT] ${data.issueType} in ${data.module}`;
            const message = `
        <h3>New Bug Report Submitted</h3>
        <strong>User:</strong> ${name} (${email})<br/>
        <strong>Module:</strong> ${data.module}<br/>
        <strong>Issue Type:</strong> ${data.issueType}<br/>
        <strong>Description:</strong> ${data.description}<br/>
        <strong>Timestamp:</strong> ${new Date().toLocaleString('en-IN', { hour12: false })}<br/>
        ${data.screenshotUrl ? `<strong>Screenshot URL:</strong> <a href="${data.screenshotUrl}">${data.screenshotUrl}</a>` : ''}
      `;
            await this.notificationService.sendNotificationEmail('legatrixon2026@gmail.com', subject, message);
            await this.notificationService.createNotification(userUuid || clerkUserId, `Bug Report Logged`, `Thank you for reporting a bug. Our team has received your report for "${data.module}".`);
        }
        else if (data.type === 'feature') {
            savedRecord = await this.supabaseService.createFeatureRequest(userUuid, email, name, data.title, data.description, data.priority);
            const subject = `[FEATURE REQUEST] ${data.title}`;
            const message = `
        <h3>New Feature Request Suggested</h3>
        <strong>User:</strong> ${name} (${email})<br/>
        <strong>Title:</strong> ${data.title}<br/>
        <strong>Priority:</strong> ${data.priority}<br/>
        <strong>Description:</strong> ${data.description}<br/>
        <strong>Timestamp:</strong> ${new Date().toLocaleString('en-IN', { hour12: false })}
      `;
            await this.notificationService.sendNotificationEmail('legatrixon2026@gmail.com', subject, message);
            await this.notificationService.createNotification(userUuid || clerkUserId, `Feature Request Boarded`, `Thank you for suggesting: "${data.title}". It has been posted to the community board.`);
        }
        this.dashboardCache.delete(clerkUserId);
        let actionLabel = 'Submitted Feedback';
        if (data.type === 'bug')
            actionLabel = 'Submitted Bug Report';
        if (data.type === 'feature')
            actionLabel = 'Submitted Feature Request';
        if (data.type === 'ai_feedback')
            actionLabel = 'Submitted AI Feedback';
        await this.log({
            userId: clerkUserId,
            module: 'Settings',
            action: actionLabel,
            metadata: { feedbackId: savedRecord?.id }
        });
        return savedRecord;
    }
    async getFeedbacks(clerkUserId) {
        const profile = await this.supabaseService.getProfile(clerkUserId);
        const userUuid = profile?.id;
        if (!userUuid)
            return [];
        const [tickets, bugs, features, ratings, aiFeedbacks] = await Promise.all([
            this.supabaseService.getMySupportTickets(userUuid),
            this.supabaseService.getUserBugReports(userUuid),
            this.supabaseService.getUserFeatureRequests(userUuid),
            this.supabaseService.getUserRatings(userUuid),
            this.supabaseService.getUserAiFeedbacks(userUuid),
        ]);
        const bugsMap = new Map(bugs.map((b) => [b.id, b]));
        const featuresMap = new Map(features.map((f) => [f.id, f]));
        const ratingsMap = new Map(ratings.map((r) => [r.id, r]));
        const aiFeedbacksMap = new Map(aiFeedbacks.map((a) => [a.id, a]));
        return tickets.map((t) => {
            let type = '';
            let title = '';
            let description = '';
            let moduleName = '';
            let issueType = '';
            if (t.ticket_type === 'Bug Report' || t.ticket_type === 'bug') {
                type = 'bug';
                const ref = bugsMap.get(t.reference_id);
                if (ref) {
                    description = ref.description || '';
                    moduleName = ref.module_name || '';
                    issueType = ref.issue_type || '';
                }
            }
            else if (t.ticket_type === 'Feature Request' || t.ticket_type === 'feature') {
                type = 'feature';
                const ref = featuresMap.get(t.reference_id);
                if (ref) {
                    title = ref.title || '';
                    description = ref.description || '';
                }
            }
            else if (t.ticket_type === 'Star Rating' || t.ticket_type === 'rating') {
                type = 'rating';
                const ref = ratingsMap.get(t.reference_id);
                if (ref) {
                    title = `Star Rating: ${ref.rating} / 5`;
                    description = `User rated experience ${ref.rating} stars.`;
                }
            }
            else if (t.ticket_type === 'AI Feedback' || t.ticket_type === 'ai_feedback') {
                type = 'ai_feedback';
                const ref = aiFeedbacksMap.get(t.reference_id);
                if (ref) {
                    title = `AI Assistant Feedback: ${ref.feedback_type}`;
                    description = `User marked AI response as: ${ref.feedback_type}`;
                }
            }
            return {
                ...t,
                type,
                title,
                description,
                module: moduleName,
                issueType,
            };
        });
    }
    async getCommunityFeatures() {
        return this.supabaseService.getCommunityFeatureRequests();
    }
    async voteFeature(clerkUserId, feedbackId) {
        const profile = await this.supabaseService.getProfile(clerkUserId);
        const userUuid = profile?.id;
        if (!userUuid)
            throw new common_1.BadRequestException('User profile not found');
        return this.supabaseService.voteFeatureRequest(feedbackId, userUuid);
    }
    async getAdminFeedbacks() {
        return this.supabaseService.getAllSupportTickets();
    }
    async updateFeedbackStatus(id, status) {
        const updatedTicket = await this.supabaseService.updateTicketStatus(id, status);
        if (updatedTicket) {
            const { user_id: userId, ticket_type: type, status: newStatus } = updatedTicket;
            let refTitle = '';
            try {
                const refId = updatedTicket.reference_id;
                if (refId) {
                    if (type === 'Bug Report') {
                        const bugRes = await axios_1.default.get(`${this.supabaseService.supabaseUrl}/rest/v1/bug_reports?id=eq.${refId}`, { headers: this.supabaseService.getHeaders() });
                        const bug = bugRes.data[0];
                        if (bug) {
                            refTitle = `${bug.issue_type} in ${bug.module_name}`;
                        }
                    }
                    else if (type === 'Feature Request') {
                        const featRes = await axios_1.default.get(`${this.supabaseService.supabaseUrl}/rest/v1/feature_requests?id=eq.${refId}`, { headers: this.supabaseService.getHeaders() });
                        const feat = featRes.data[0];
                        if (feat) {
                            refTitle = feat.title;
                        }
                    }
                }
            }
            catch (err) {
                console.warn('Failed to fetch ticket reference details for notification:', err);
            }
            let notifyTitle = '';
            let notifyMsg = '';
            if (type === 'Bug Report') {
                if (newStatus === 'Under Review') {
                    notifyTitle = 'Bug Report Under Review';
                    notifyMsg = `Your bug report for "${refTitle || 'unspecified module'}" is now Under Review.`;
                }
                else if (newStatus === 'Resolved') {
                    notifyTitle = 'Bug Report Resolved';
                    notifyMsg = `Your bug report for "${refTitle || 'unspecified module'}" has been marked as Resolved.`;
                }
            }
            else if (type === 'Feature Request') {
                if (newStatus === 'Planned') {
                    notifyTitle = 'Feature Request Planned';
                    notifyMsg = `Your feature suggestion "${refTitle || 'unspecified feature'}" is Planned on our roadmap.`;
                }
                else if (newStatus === 'Resolved') {
                    notifyTitle = 'Feature Request Completed';
                    notifyMsg = `Your feature suggestion "${refTitle || 'unspecified feature'}" has been Completed!`;
                }
            }
            if (notifyTitle && notifyMsg && userId) {
                await this.notificationService.createNotification(userId, notifyTitle, notifyMsg);
            }
        }
        return updatedTicket;
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = SettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(settings_entities_1.UserActivityLog)),
    __param(1, (0, typeorm_1.InjectRepository)(settings_entities_1.UserSettingsProfile)),
    __param(2, (0, typeorm_1.InjectRepository)(settings_entities_1.UserSubscription)),
    __param(3, (0, typeorm_1.InjectRepository)(settings_entities_1.UserNotificationPreference)),
    __param(4, (0, typeorm_1.InjectRepository)(settings_entities_1.UserAchievement)),
    __param(5, (0, typeorm_1.InjectRepository)(settings_entities_1.AccountDeletionRequest)),
    __param(6, (0, typeorm_1.InjectRepository)(exam_entities_1.Exam)),
    __param(7, (0, typeorm_1.InjectRepository)(exam_entities_1.MockTest)),
    __param(8, (0, typeorm_1.InjectRepository)(exam_entities_1.CalendarEvent)),
    __param(9, (0, typeorm_1.InjectRepository)(exam_entities_1.ReadinessSnapshot)),
    __param(10, (0, typeorm_1.InjectRepository)(notebook_entity_1.NotebookDocument)),
    __param(11, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchUser)),
    __param(12, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchQuery)),
    __param(13, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchReport)),
    __param(14, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchSource)),
    __param(15, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchNote)),
    __param(16, (0, typeorm_1.InjectRepository)(research_entities_1.SavedReport)),
    __param(17, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchAsset)),
    __param(18, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchDocument)),
    __param(19, (0, typeorm_1.InjectRepository)(settings_entities_1.UserFeedback)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        clerk_account_service_1.ClerkAccountService,
        notification_service_1.NotificationService,
        supabase_service_1.SupabaseService,
        credit_service_1.CreditService,
        typeorm_2.DataSource])
], SettingsService);
//# sourceMappingURL=settings.service.js.map