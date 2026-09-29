import { MentorApiController } from '../controllers/MentorApiController';

const defaultController = new MentorApiController();

export const apiHandlers = {
  chat: (request: Request) => defaultController.chat(request),
  chatStream: (request: Request) => defaultController.chatStream(request),
  draftReview: (request: Request) => defaultController.draftReview(request),
  draftRevision: (request: Request) => defaultController.draftRevision(request),
  lessonStart: (request: Request) => defaultController.lessonStart(request),
  lessonComplete: (request: Request) => defaultController.lessonComplete(request),
  quizStart: (request: Request) => defaultController.quizStart(request),
  quizSubmit: (request: Request) => defaultController.quizSubmit(request),
  assessmentStart: (request: Request) => defaultController.assessmentStart(request),
  assessmentSubmit: (request: Request) => defaultController.assessmentSubmit(request),
  capstoneReview: (request: Request) => defaultController.capstoneReview(request),
  bareActAnalyse: (request: Request) => defaultController.bareActAnalyse(request),
  documentsUpload: (request: Request) => defaultController.documentsUpload(request),
  studentProgress: (request: Request) => defaultController.studentResource('progress', request),
  studentMastery: (request: Request) => defaultController.studentResource('mastery', request),
  studentProjects: (request: Request) => defaultController.studentResource('projects', request),
  studentHistory: (request: Request) => defaultController.studentResource('history', request),
  patternDetail: (request: Request, params: Record<string, string>) => defaultController.knowledgeResource('pattern', request, params),
  lessonDetail: (request: Request, params: Record<string, string>) => defaultController.knowledgeResource('lesson', request, params),
  moduleDetail: (request: Request, params: Record<string, string>) => defaultController.knowledgeResource('module', request, params),
};

export function createApiHandlers(controller: MentorApiController): typeof apiHandlers {
  return {
    chat: (request) => controller.chat(request),
    chatStream: (request) => controller.chatStream(request),
    draftReview: (request) => controller.draftReview(request),
    draftRevision: (request) => controller.draftRevision(request),
    lessonStart: (request) => controller.lessonStart(request),
    lessonComplete: (request) => controller.lessonComplete(request),
    quizStart: (request) => controller.quizStart(request),
    quizSubmit: (request) => controller.quizSubmit(request),
    assessmentStart: (request) => controller.assessmentStart(request),
    assessmentSubmit: (request) => controller.assessmentSubmit(request),
    capstoneReview: (request) => controller.capstoneReview(request),
    bareActAnalyse: (request) => controller.bareActAnalyse(request),
    documentsUpload: (request) => controller.documentsUpload(request),
    studentProgress: (request) => controller.studentResource('progress', request),
    studentMastery: (request) => controller.studentResource('mastery', request),
    studentProjects: (request) => controller.studentResource('projects', request),
    studentHistory: (request) => controller.studentResource('history', request),
    patternDetail: (request, params) => controller.knowledgeResource('pattern', request, params),
    lessonDetail: (request, params) => controller.knowledgeResource('lesson', request, params),
    moduleDetail: (request, params) => controller.knowledgeResource('module', request, params),
  };
}
