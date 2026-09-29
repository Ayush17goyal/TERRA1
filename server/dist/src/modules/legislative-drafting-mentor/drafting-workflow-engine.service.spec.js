"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const drafting_workflow_engine_service_1 = require("./drafting-workflow-engine.service");
const drafting_session_entity_1 = require("./entities/drafting-session.entity");
const lesson_catalog_1 = require("./lesson-catalog");
describe('DraftingWorkflowEngineService (integration)', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            imports: [
                typeorm_1.TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [drafting_session_entity_1.DraftingSession],
                    synchronize: true,
                }),
                typeorm_1.TypeOrmModule.forFeature([drafting_session_entity_1.DraftingSession]),
            ],
            providers: [drafting_workflow_engine_service_1.DraftingWorkflowEngineService],
        }).compile();
        service = module.get(drafting_workflow_engine_service_1.DraftingWorkflowEngineService);
    });
    it('creates a session on lesson 0 with no completed lessons', async () => {
        const session = await service.createSession('user-1', 'The Digital Privacy Act');
        expect(session.topic).toBe('The Digital Privacy Act');
        expect(session.status).toBe('in_progress');
        expect(session.currentLesson.index).toBe(0);
        expect(session.completedLessons).toEqual([]);
        expect(session.totalLessons).toBe(lesson_catalog_1.TOTAL_DRAFTING_LESSONS);
    });
    it('rejects a session with an empty or whitespace-only topic', async () => {
        await expect(service.createSession('user-1', '')).rejects.toThrow(common_1.BadRequestException);
        await expect(service.createSession('user-1', '   ')).rejects.toThrow(common_1.BadRequestException);
    });
    it('advances to the next lesson and records the previous one as completed', async () => {
        const created = await service.createSession('user-1', 'The Water Conservation Act');
        const advanced = await service.advance('user-1', created.id);
        expect(advanced.currentLesson.index).toBe(1);
        expect(advanced.completedLessons).toEqual([0]);
        expect(advanced.status).toBe('in_progress');
    });
    it('moves backward without losing completed-lesson history', async () => {
        const created = await service.createSession('user-1', 'The Consumer Rights Act');
        await service.advance('user-1', created.id);
        const afterSecondAdvance = await service.advance('user-1', created.id);
        expect(afterSecondAdvance.currentLesson.index).toBe(2);
        const wentBack = await service.goBack('user-1', created.id);
        expect(wentBack.currentLesson.index).toBe(1);
        expect(wentBack.completedLessons).toEqual([0, 1]);
    });
    it('does not go back before the first lesson', async () => {
        const created = await service.createSession('user-1', 'The Public Health Act');
        const stillFirst = await service.goBack('user-1', created.id);
        expect(stillFirst.currentLesson.index).toBe(0);
    });
    it('marks the session completed after advancing past the final lesson', async () => {
        let created = await service.createSession('user-1', 'The Short Act');
        let view = created;
        for (let i = 0; i < lesson_catalog_1.TOTAL_DRAFTING_LESSONS - 1; i++) {
            view = await service.advance('user-1', created.id);
        }
        expect(view.currentLesson.index).toBe(lesson_catalog_1.TOTAL_DRAFTING_LESSONS - 1);
        expect(view.status).toBe('in_progress');
        const finished = await service.advance('user-1', created.id);
        expect(finished.status).toBe('completed');
        expect(finished.currentLesson.index).toBe(lesson_catalog_1.TOTAL_DRAFTING_LESSONS - 1);
        expect(finished.completedLessons).toEqual(Array.from({ length: lesson_catalog_1.TOTAL_DRAFTING_LESSONS }, (_, i) => i));
    });
    it('allows jumping back to any previously unlocked lesson via goToLesson', async () => {
        const created = await service.createSession('user-1', 'The Land Reform Act');
        await service.advance('user-1', created.id);
        await service.advance('user-1', created.id);
        const jumped = await service.goToLesson('user-1', created.id, 0);
        expect(jumped.currentLesson.index).toBe(0);
        const jumpedForwardAgain = await service.goToLesson('user-1', created.id, 2);
        expect(jumpedForwardAgain.currentLesson.index).toBe(2);
    });
    it('rejects goToLesson attempts that skip ahead of unlocked lessons', async () => {
        const created = await service.createSession('user-1', 'The Housing Act');
        await expect(service.goToLesson('user-1', created.id, 5)).rejects.toThrow(common_1.BadRequestException);
    });
    it('rejects goToLesson attempts with an out-of-range index', async () => {
        const created = await service.createSession('user-1', 'The Housing Act');
        await expect(service.goToLesson('user-1', created.id, -1)).rejects.toThrow(common_1.BadRequestException);
        await expect(service.goToLesson('user-1', created.id, lesson_catalog_1.TOTAL_DRAFTING_LESSONS)).rejects.toThrow(common_1.BadRequestException);
    });
    it('persists progress so a resumed session reflects prior advances', async () => {
        const created = await service.createSession('user-1', 'The Renewable Energy Act');
        await service.advance('user-1', created.id);
        await service.advance('user-1', created.id);
        const resumed = await service.resumeSession('user-1', created.id);
        expect(resumed.currentLesson.index).toBe(2);
        expect(resumed.completedLessons).toEqual([0, 1]);
    });
    it('lists sessions for a user, most recently updated first', async () => {
        const first = await service.createSession('user-1', 'Act One');
        await new Promise((resolve) => setTimeout(resolve, 1100));
        const second = await service.createSession('user-1', 'Act Two');
        const list = await service.listSessions('user-1');
        expect(list.map((s) => s.id)).toEqual([second.id, first.id]);
    });
    it('throws NotFoundException for a session that does not exist', async () => {
        await expect(service.resumeSession('user-1', 'missing-id')).rejects.toThrow(common_1.NotFoundException);
    });
    it('throws ForbiddenException when a different user tries to access the session', async () => {
        const created = await service.createSession('user-1', 'The Trade Practices Act');
        await expect(service.resumeSession('user-2', created.id)).rejects.toThrow(common_1.ForbiddenException);
        await expect(service.advance('user-2', created.id)).rejects.toThrow(common_1.ForbiddenException);
    });
    it('persists and resumes the 60-lesson academy state for one user', async () => {
        const saved = await service.syncAcademyState('academy-user', {
            version: 0,
            state: { current: 1, completedLessons: [0], answers: { 0: 'A sufficiently detailed first answer.' } },
        });
        expect(saved.conflict).toBe(false);
        expect(saved.version).toBe(1);
        const resumed = await service.getAcademyState('academy-user');
        expect(resumed.state).toMatchObject({ current: 1, completedLessons: [0] });
    });
    it('rejects skipped or non-contiguous academy completion', async () => {
        await expect(service.syncAcademyState('skip-user', {
            version: 0,
            state: { current: 3, completedLessons: [0, 2] },
        })).rejects.toThrow(common_1.BadRequestException);
    });
    it('returns the server snapshot when a stale device attempts to overwrite progress', async () => {
        await service.syncAcademyState('conflict-user', {
            version: 0,
            state: { current: 0, completedLessons: [] },
        });
        const stale = await service.syncAcademyState('conflict-user', {
            version: 0,
            state: { current: 0, completedLessons: [] },
        });
        expect(stale.conflict).toBe(true);
        expect(stale.version).toBe(1);
    });
});
//# sourceMappingURL=drafting-workflow-engine.service.spec.js.map