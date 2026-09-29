import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityMessage } from './community.entity';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';

@Controller('community')
export class CommunityController {
  constructor(
    @InjectRepository(CommunityMessage)
    private readonly repo: Repository<CommunityMessage>,
  ) {}

  @Get('messages')
  @UseGuards(ClerkAuthGuard)
  async getMessages() {
    const messages = await this.repo.find({
      order: { createdAt: 'ASC' },
      take: 100,
    });
    // Return only safe fields — no email, no userId
    return messages.map((m) => ({
      id: m.id,
      userName: m.userName,
      text: m.text,
      topic: m.topic,
      createdAt: m.createdAt,
    }));
  }

  @Post('messages')
  @UseGuards(ClerkAuthGuard)
  async sendMessage(@Body() body: any, @Req() req: any) {
    const user = req.user || {};
    // Build display name — use fullName from ClerkAuthGuard, never expose email
    const fullName = String(user.fullName || '').trim();
    // If fullName has multiple words (e.g. "Ayush Goyal"), shorten to "Ayush G."
    const parts = fullName.split(/\s+/).filter(Boolean);
    const displayName =
      parts.length >= 2
        ? `${parts[0]} ${parts[1][0]}.`
        : parts[0] || 'User';

    const text = String(body.text || '').trim();
    if (!text || text.length > 1000) {
      return { error: 'Message must be 1–1000 characters.' };
    }

    const msg = this.repo.create({
      userName: displayName,
      text,
      topic: body.topic || null,
    });
    const saved = await this.repo.save(msg);
    return {
      id: saved.id,
      userName: saved.userName,
      text: saved.text,
      topic: saved.topic,
      createdAt: saved.createdAt,
    };
  }
}
