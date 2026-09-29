import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MasterclassCourse,
  MasterclassEnrollment,
  MasterclassLesson,
  MasterclassLessonProgress,
} from './masterclass.entity';
import { MasterclassService } from './masterclass.service';
import { MasterclassController } from './masterclass.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MasterclassCourse,
      MasterclassLesson,
      MasterclassEnrollment,
      MasterclassLessonProgress,
    ]),
  ],
  providers: [MasterclassService],
  controllers: [MasterclassController],
  exports: [MasterclassService],
})
export class MasterclassModule {}
