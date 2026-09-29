"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const legislative_drafting_mentor_controller_1 = require("./legislative-drafting-mentor.controller");
const drafting_workflow_engine_service_1 = require("./drafting-workflow-engine.service");
describe('LegislativeDraftingMentorController', () => {
    let controller;
    const workflowEngine = {
        createSession: jest.fn(),
        listSessions: jest.fn(),
        resumeSession: jest.fn(),
        advance: jest.fn(),
        goBack: jest.fn(),
        goToLesson: jest.fn(),
        getLessonCatalog: jest.fn(),
    };
    const req = { user: { id: 'user-42' } };
    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await testing_1.Test.createTestingModule({
            controllers: [legislative_drafting_mentor_controller_1.LegislativeDraftingMentorController],
            providers: [{ provide: drafting_workflow_engine_service_1.DraftingWorkflowEngineService, useValue: workflowEngine }],
        }).compile();
        controller = module.get(legislative_drafting_mentor_controller_1.LegislativeDraftingMentorController);
    });
    it('delegates session creation to the workflow engine with the authenticated user id', async () => {
        workflowEngine.createSession.mockResolvedValue({ id: 'session-1' });
        const result = await controller.createSession(req, 'The Digital Privacy Act');
        expect(workflowEngine.createSession).toHaveBeenCalledWith('user-42', 'The Digital Privacy Act');
        expect(result).toEqual({ id: 'session-1' });
    });
    it('delegates resume to the workflow engine', async () => {
        workflowEngine.resumeSession.mockResolvedValue({ id: 'session-1' });
        await controller.resumeSession(req, 'session-1');
        expect(workflowEngine.resumeSession).toHaveBeenCalledWith('user-42', 'session-1');
    });
    it('delegates advance/back/goto with the authenticated user id', async () => {
        await controller.advance(req, 'session-1');
        expect(workflowEngine.advance).toHaveBeenCalledWith('user-42', 'session-1');
        await controller.goBack(req, 'session-1');
        expect(workflowEngine.goBack).toHaveBeenCalledWith('user-42', 'session-1');
        await controller.goToLesson(req, 'session-1', 3);
        expect(workflowEngine.goToLesson).toHaveBeenCalledWith('user-42', 'session-1', 3);
    });
    it('lists sessions for the authenticated user', async () => {
        workflowEngine.listSessions.mockResolvedValue([]);
        await controller.listSessions(req);
        expect(workflowEngine.listSessions).toHaveBeenCalledWith('user-42');
    });
    it('returns the lesson catalog', () => {
        workflowEngine.getLessonCatalog.mockReturnValue([{ index: 0 }]);
        expect(controller.getLessonCatalog()).toEqual([{ index: 0 }]);
    });
});
//# sourceMappingURL=legislative-drafting-mentor.controller.spec.js.map