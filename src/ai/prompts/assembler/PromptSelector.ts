import type { PromptModule, PromptSelectorContract } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleName } from '../types';

export class PromptSelector implements PromptSelectorContract {
  private readonly modules: PromptModule[];

  constructor(modules: PromptModule[]) {
    this.modules = modules;
  }

  select(request: PromptAssemblyRequest): { included: PromptModule[]; omitted: PromptModuleName[] } {
    const included: PromptModule[] = [];
    const omitted: PromptModuleName[] = [];

    for (const module of this.modules) {
      if (module.shouldInclude(request)) {
        included.push(module);
      } else {
        omitted.push(module.name);
      }
    }

    return { included, omitted };
  }
}


