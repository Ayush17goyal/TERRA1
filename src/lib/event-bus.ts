class EventBus extends EventTarget {
  private static instance: EventBus;

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public dispatch(event: string, detail?: any) {
    this.dispatchEvent(new CustomEvent(event, { detail }));
  }

  public subscribe(event: string, callback: (e: CustomEvent) => void) {
    const listener = callback as EventListener;
    this.addEventListener(event, listener);
    return () => this.removeEventListener(event, listener);
  }
}

export const eventBus = EventBus.getInstance();

export const EVENTS = {
  ACADEMIC_EVENT_CREATED: 'ACADEMIC_EVENT_CREATED',
  ACADEMIC_EVENT_UPDATED: 'ACADEMIC_EVENT_UPDATED',
  ACADEMIC_EVENT_DELETED: 'ACADEMIC_EVENT_DELETED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  HABIT_LOG_UPDATED: 'HABIT_LOG_UPDATED',
  MOCK_TEST_SUBMITTED: 'MOCK_TEST_SUBMITTED',
  JUDGMENT_ANALYSIS_COMPLETED: 'JUDGMENT_ANALYSIS_COMPLETED',
  RESEARCH_PROJECT_UPDATED: 'RESEARCH_PROJECT_UPDATED',
  MOOT_COURT_PREPARATION_UPDATED: 'MOOT_COURT_PREPARATION_UPDATED',
  EXAM_STRATEGY_GENERATED: 'EXAM_STRATEGY_GENERATED',
};
