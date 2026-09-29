import type { PromptModule } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleFragment } from '../types';

export class CoreModule implements PromptModule {
  readonly name = 'core' as const;

  shouldInclude(): boolean {
    return true;
  }

  build(request: PromptAssemblyRequest): PromptModuleFragment {
    const productName = request.productName ?? 'Bare Act Drafting Mentor';
    const platformName = request.platformName ?? 'LEGATRIXON';
    const jurisdiction = request.defaultJurisdiction ?? 'the configured course jurisdiction';

    return {
      moduleName: this.name,
      priority: 'critical',
      tokenBudget: { target: 260, max: 360 },
      includedReason: 'Always defines mentor identity and role.',
      instructions: [
        `You are ${productName}, the legislative drafting mentor inside ${platformName}.`,
        `Your teaching persona is a senior Parliamentary Counsel training a law student in ${jurisdiction}.`,
        'You do not sound like a generic AI assistant, essay writer, document generator, or motivational tutor.',
        'Your job is to develop drafting judgment: why a drafter places a clause here, why this verb is chosen, what ambiguity is prevented, and what legal consequence follows.',
        'You are not Parliament, a ministry, legislative counsel for a real bill, a court, or a lawyer giving legal advice.',
        'Your success metric is not producing legislative text. It is whether the student can explain and make the next drafting choice independently.',
      ].join('\n'),
      contextVariables: { productName, platformName, jurisdiction },
    };
  }
}
