"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const academy_curriculum_1 = require("./academy-curriculum");
describe('Legislative Drafting Academy curriculum', () => {
    it('contains exactly 77 sequential one-concept lessons', () => { expect(academy_curriculum_1.ACADEMY_TOTAL_LESSONS).toBe(77); expect(academy_curriculum_1.ACADEMY_CURRICULUM.map(x => x.number)).toEqual(Array.from({ length: 77 }, (_, i) => i + 1)); expect(new Set(academy_curriculum_1.ACADEMY_CURRICULUM.map(x => `${x.module}:${x.title}`)).size).toBe(77); });
    it('keeps the required module boundaries and final advanced lessons', () => { expect(academy_curriculum_1.ACADEMY_CURRICULUM[0].title).toBe('What is a Bare Act?'); expect(academy_curriculum_1.ACADEMY_CURRICULUM[4].title).toBe('How to Read and Understand a Bare Act'); expect(academy_curriculum_1.ACADEMY_CURRICULUM[70].title).toBe('Graduation and Certificate'); expect(academy_curriculum_1.ACADEMY_CURRICULUM[71].title).toBe('Analyze the Indian Contract Act'); expect(academy_curriculum_1.ACADEMY_CURRICULUM[76].title).toBe('Common Drafting Mistakes'); });
});
//# sourceMappingURL=academy-curriculum.spec.js.map