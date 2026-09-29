import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { MasterclassService } from './masterclass.service';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { AdminPortalGuard } from '../../guards/admin-portal.guard';

@Controller('masterclass')
export class MasterclassController {
  constructor(private readonly svc: MasterclassService) {}

  // ── Admin: Courses ────────────────────────────────────────────────────────

  @Get('admin/courses')
  @UseGuards(AdminPortalGuard)
  adminListCourses() {
    return this.svc.adminListCourses();
  }

  @Post('admin/courses')
  @UseGuards(AdminPortalGuard)
  adminCreateCourse(@Body() dto: any) {
    return this.svc.adminCreateCourse(dto);
  }

  @Put('admin/courses/:id')
  @UseGuards(AdminPortalGuard)
  adminUpdateCourse(@Param('id') id: string, @Body() dto: any) {
    return this.svc.adminUpdateCourse(id, dto);
  }

  @Delete('admin/courses/:id')
  @UseGuards(AdminPortalGuard)
  adminDeleteCourse(@Param('id') id: string) {
    return this.svc.adminDeleteCourse(id);
  }

  @Post('admin/courses/:id/publish')
  @UseGuards(AdminPortalGuard)
  adminPublishCourse(@Param('id') id: string) {
    return this.svc.adminPublishCourse(id, true);
  }

  @Post('admin/courses/:id/unpublish')
  @UseGuards(AdminPortalGuard)
  adminUnpublishCourse(@Param('id') id: string) {
    return this.svc.adminPublishCourse(id, false);
  }

  // ── Admin: Lessons ────────────────────────────────────────────────────────

  @Get('admin/courses/:courseId/lessons')
  @UseGuards(AdminPortalGuard)
  adminListLessons(@Param('courseId') courseId: string) {
    return this.svc.adminListLessons(courseId);
  }

  @Post('admin/courses/:courseId/lessons')
  @UseGuards(AdminPortalGuard)
  adminCreateLesson(@Param('courseId') courseId: string, @Body() dto: any) {
    return this.svc.adminCreateLesson(courseId, dto);
  }

  @Put('admin/lessons/:id')
  @UseGuards(AdminPortalGuard)
  adminUpdateLesson(@Param('id') id: string, @Body() dto: any) {
    return this.svc.adminUpdateLesson(id, dto);
  }

  @Delete('admin/lessons/:id')
  @UseGuards(AdminPortalGuard)
  adminDeleteLesson(@Param('id') id: string) {
    return this.svc.adminDeleteLesson(id);
  }

  // ── Admin: Grant / Revoke Drafting Plan ──────────────────────────────────

  @Post('admin/grant-plan')
  @UseGuards(AdminPortalGuard)
  async adminGrantPlan(@Body() dto: { email: string; plan?: string }) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return { error: 'Clerk not configured' };
    const clerk = createClerkClient({ secretKey });
    const users = await clerk.users.getUserList({ emailAddress: [dto.email] });
    if (!users.data.length) return { error: `No user found with email: ${dto.email}` };
    const user = users.data[0];
    const existingMeta = (user.publicMetadata as Record<string, any>) || {};
    await clerk.users.updateUser(user.id, {
      publicMetadata: { ...existingMeta, plan: dto.plan || 'drafting' },
    });
    return { success: true, userId: user.id, email: dto.email, plan: dto.plan || 'drafting' };
  }

  @Post('admin/revoke-plan')
  @UseGuards(AdminPortalGuard)
  async adminRevokePlan(@Body() dto: { email: string }) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return { error: 'Clerk not configured' };
    const clerk = createClerkClient({ secretKey });
    const users = await clerk.users.getUserList({ emailAddress: [dto.email] });
    if (!users.data.length) return { error: `No user found with email: ${dto.email}` };
    const user = users.data[0];
    const existingMeta = (user.publicMetadata as Record<string, any>) || {};
    const { plan: _removed, ...rest } = existingMeta;
    await clerk.users.updateUser(user.id, { publicMetadata: rest });
    return { success: true, userId: user.id, email: dto.email };
  }

  // ── Student: Courses ──────────────────────────────────────────────────────

  @Get('courses')
  @UseGuards(ClerkAuthGuard)
  studentListCourses() {
    return this.svc.studentListCourses();
  }

  @Get('courses/:id')
  @UseGuards(ClerkAuthGuard)
  studentGetCourse(@Param('id') id: string) {
    return this.svc.studentGetCourseWithLessons(id);
  }

  // ── Student: Enroll ───────────────────────────────────────────────────────

  @Post('courses/:id/enroll')
  @UseGuards(ClerkAuthGuard)
  enroll(@Param('id') courseId: string, @Req() req: any) {
    const userId = req.auth?.userId ?? 'anonymous';
    return this.svc.enroll(courseId, userId);
  }

  // ── Student: Progress ─────────────────────────────────────────────────────

  @Post('lessons/:lessonId/progress')
  @UseGuards(ClerkAuthGuard)
  updateProgress(
    @Param('lessonId') lessonId: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const userId = req.auth?.userId ?? 'anonymous';
    return this.svc.updateProgress(userId, lessonId, dto.courseId, dto);
  }
}
