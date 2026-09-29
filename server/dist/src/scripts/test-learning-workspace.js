"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const learning_workspace_module_1 = require("../modules/learning-workspace/learning-workspace.module");
const learning_workspace_service_1 = require("../modules/learning-workspace/learning-workspace.service");
const settings_module_1 = require("../modules/settings/settings.module");
const sqliteDatabasePath = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'legatrixon_db.sqlite');
let TestCliModule = class TestCliModule {
};
TestCliModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'sqlite',
                database: sqliteDatabasePath,
                autoLoadEntities: true,
                synchronize: true,
            }),
            settings_module_1.SettingsModule,
            learning_workspace_module_1.LearningWorkspaceModule,
        ],
    })
], TestCliModule);
async function runTests() {
    console.log('⚡ Bootstrapping NestJS test environment...');
    const app = await core_1.NestFactory.createApplicationContext(TestCliModule, {
        logger: ['error', 'warn', 'log'],
    });
    const service = app.get(learning_workspace_service_1.LearningWorkspaceService);
    const testUserId = 'test-user-agent-123';
    console.log('\n--- 1. Testing Source Addition ---');
    const textContent = `
    Constitutional Law of India: Article 21 of the Constitution of India provides that 
    "No person shall be deprived of his life or personal liberty except according to procedure established by law."
    This right has been interpreted broadly by the Supreme Court of India. In the landmark case of 
    Maneka Gandhi vs Union of India (1978), the court held that the procedure depriving a person of life or 
    liberty must be "reasonable, fair and just" rather than arbitrary. 
    Further, Article 21 covers the right to clean environment, right to privacy (K.S. Puttaswamy judgment), 
    and right to education.
  `;
    const source = await service.createTextSource(testUserId, {
        kind: 'Notes',
        name: 'Article 21 Constitutional Law Notes',
        text: textContent,
    });
    console.log(`✅ Text source created! ID: ${source.id}, Name: ${source.name}, Length: ${source.textLength}`);
    console.log('\n--- 2. Testing AI Mock Test Generation ---');
    const mockTest = await service.generateMockTest(testUserId, {
        topic: 'Article 21 Fundamental Rights',
        difficulty: 'Intermediate',
        questionType: 'MCQ',
        questionCount: 3,
        sourceIds: [source.id],
    });
    console.log(`✅ Mock Test generated! ID: ${mockTest.id}, Topic: ${mockTest.topic}, Questions: ${mockTest.questions.length}`);
    console.log('First Question Sample:');
    console.log(JSON.stringify(mockTest.questions[0], null, 2));
    console.log('\n--- 3. Testing Submit and Score Report ---');
    const testAnswers = {};
    if (mockTest.questions.length > 0) {
        testAnswers[mockTest.questions[0].id] = mockTest.questions[0].answer;
    }
    const attempt = await service.submitMockTest(testUserId, mockTest.id, testAnswers);
    console.log(`✅ Mock Test Attempt stored! Score: ${attempt.score}/${attempt.total} (${attempt.percentage}%)`);
    console.log(`Weak areas identified:`, attempt.weakAreas);
    console.log('\n--- 4. Testing Mind Map Generation ---');
    const mindMap = await service.generateMindMap(testUserId, {
        sourceIds: [source.id],
    });
    console.log(`✅ Mind Map generated! ID: ${mindMap.id}, Title: ${mindMap.title}`);
    console.log('Concepts:', mindMap.concepts);
    console.log('Root Node Label:', mindMap.map.label);
    console.log('\n--- 5. Testing Smart Study Kit Generation ---');
    const studyKit = await service.generateStudyKit(testUserId, {
        sourceIds: [source.id],
    });
    console.log(`✅ Study Kit generated! ID: ${studyKit.id}, Title: ${studyKit.title}`);
    console.log('Flashcards count:', studyKit.content.flashcards?.length);
    console.log('Revision notes summary (first 100 chars):', studyKit.content.revisionNotes?.slice(0, 100));
    console.log('\n--- 6. Testing Analytics and Weak Areas ---');
    const analytics = await service.getAnalytics(testUserId);
    console.log('Analytics stats:', analytics);
    const weakAreas = await service.getWeakAreaReport(testUserId);
    console.log('Weak topics:', weakAreas.weakTopics);
    console.log('Strong topics:', weakAreas.strongTopics);
    console.log('Suggested Revision Plan:', weakAreas.suggestedRevisionPlan);
    console.log('\n--- Tests Completed Successfully! ---');
    await app.close();
}
runTests().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
//# sourceMappingURL=test-learning-workspace.js.map