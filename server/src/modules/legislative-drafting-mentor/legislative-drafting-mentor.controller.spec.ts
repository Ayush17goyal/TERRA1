import { Test } from '@nestjs/testing';
import { LegislativeDraftingMentorController } from './legislative-drafting-mentor.controller';
import { DraftingWorkflowEngineService } from './drafting-workflow-engine.service';

describe('LegislativeDraftingMentorController', () => {
  let controller: LegislativeDraftingMentorController;
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
    const module = await Test.createTestingModule({
      controllers: [LegislativeDraftingMentorController],
      providers: [{ provide: DraftingWorkflowEngineService, useValue: workflowEngine }],
    }).compile();

    controller = module.get(LegislativeDraftingMentorController);
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
