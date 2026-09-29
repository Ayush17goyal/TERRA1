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
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { AdminPortalGuard } from '../../guards/admin-portal.guard';
import { LiveSessionService } from './live-session.service';

@Controller('live-sessions')
export class LiveSessionController {
  constructor(private readonly service: LiveSessionService) {}

  // Student listing: scheduled/live/ended masterclasses, no Meet link included
  @Get()
  @UseGuards(ClerkAuthGuard)
  listSessions() {
    return this.service.listSessions();
  }

  // Admin listing: includes the Meet link for editing
  @Get('admin')
  @UseGuards(AdminPortalGuard)
  adminListSessions() {
    return this.service.adminListSessions();
  }

  // Student: clicking "Today's Class" hits this — Meet link only returned if
  // authenticated, the class is currently live, and a link exists.
  @Get(':id/meet-link')
  @UseGuards(ClerkAuthGuard)
  getMeetLink(@Param('id') id: string, @Req() req: any) {
    const userId: string = req.user?.id ?? 'anonymous';
    return this.service.getMeetLink(id, userId);
  }

  @Post('admin/schedule')
  @UseGuards(AdminPortalGuard)
  schedule(@Body() body: any) {
    return this.service.scheduleLiveClass(body);
  }

  @Put('admin/:id')
  @UseGuards(AdminPortalGuard)
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.updateLiveClass(id, body);
  }

  @Post('admin/:id/cancel')
  @UseGuards(AdminPortalGuard)
  cancel(@Param('id') id: string) {
    return this.service.cancelSession(id);
  }

  @Delete('admin/:id')
  @UseGuards(AdminPortalGuard)
  remove(@Param('id') id: string) {
    return this.service.deleteSession(id);
  }
}
