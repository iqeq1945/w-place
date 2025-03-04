// board.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { BoardService } from './board.service';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CacheInterceptor } from '@nestjs/cache-manager';

@Controller('board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @UseInterceptors(CacheInterceptor)
  @Get()
  async getFullBoard(@Res() res: Response) {
    const board = await this.boardService.getFullBoard();

    // CDN 캐싱을 위한 헤더 설정
    res.setHeader(
      'Cache-Control',
      'public, max-age=1, stale-while-revalidate=5',
    );
    res.type('application/octet-stream');
    res.send(board);
  }

  // 타일 세부 정보 가져오기
  @Get('pixel')
  async getTileDetails(@Query('x') x: number, @Query('y') y: number) {
    return this.boardService.getTileDetails(x, y);
  }

  // 타일 배치
  @UseGuards(AuthGuard('jwt'))
  @Post('pixel')
  async placeTile(
    @Body() data: { x: number; y: number; colorIndex: number },
    @Req() req,
  ) {
    const userId = req.user.id; // JWT에서 추출한 사용자 ID
    await this.boardService.placeTile(data.x, data.y, data.colorIndex, userId);
    return { status: 'success' };
  }
}
