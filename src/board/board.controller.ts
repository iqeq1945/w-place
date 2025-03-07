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
} from '@nestjs/common';
import { BoardService } from './board.service';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Logger } from '@nestjs/common';
import { PixelDto } from './dto/pixel.dto';
import { BodyPixelDto } from './dto/body-pixel.dto';

@Controller('board')
export class BoardController {
  private readonly logger = new Logger(BoardController.name);

  constructor(private readonly boardService: BoardService) {}

  @Get()
  async getFullBoard(@Res() res: Response) {
    const board = await this.boardService.getFullBoard();

    res.setHeader(
      'Cache-Control',
      'public, max-age=60, s-maxage=60, stale-while-revalidate=5',
    );
    res.setHeader('CDN-Cache-Control', 'max-age=60, stale-while-revalidate=5');
    res.setHeader(
      'Cloudflare-CDN-Cache-Control',
      'max-age=60, stale-while-revalidate=5',
    );

    res.type('application/octet-stream');
    res.send(board);
  }

  // 타일 세부 정보 가져오기
  @Get('pixel')
  async getTileDetails(@Query() query: PixelDto, @Res() res: Response) {
    const tileInfo = await this.boardService.getTileDetails(
      Number(query.x),
      Number(query.y),
    );

    // 타일 정보도 서비스의 캐시 시간과 일치
    res.setHeader(
      'Cache-Control',
      'public, max-age=300, s-maxage=300, stale-while-revalidate=5',
    );
    res.setHeader('CDN-Cache-Control', 'max-age=300, stale-while-revalidate=5');

    return res.json(tileInfo);
  }

  // 타일 배치
  @Post('pixel')
  async placeTile(
    @Body() data: BodyPixelDto,
    @CurrentUser() user,
    @Res() res: Response,
  ) {
    const userId = String(user.id);
    await this.boardService.placeTile(data.x, data.y, data.colorIndex, userId);

    // POST 요청은 캐시하지 않음
    res.setHeader('Cache-Control', 'no-store');

    return res.json({ status: 'success' });
  }

  // 초기 보드 설정 라우터 추가
  @Post('initialize')
  //@UseGuards(AuthGuard('jwt')) // 관리자만 접근 가능하도록
  async initializeBoard(@CurrentUser() user, @Res() res: Response) {
    // 추후 관리자 체크 추가

    await this.boardService.initializeBoard();

    // 캐시 초기화
    await this.boardService.clearCache();

    this.logger.log(`Board initialized by admin: ${user.id}`);
    return res.json({ status: 'success', message: 'Board initialized' });
  }

  @Get('test')
  async test() {
    await this.boardService.test();
  }
}
