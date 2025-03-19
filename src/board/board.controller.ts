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
import { JwtAuthGuard } from 'src/auth/auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Board')
@Controller('board')
export class BoardController {
  private readonly logger = new Logger(BoardController.name);

  constructor(private boardService: BoardService) {}

  @ApiOperation({ summary: '전체 보드 데이터 가져오기' })
  @ApiResponse({
    status: 200,
    description: '전체 보드 데이터 (octet-stream)',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
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
  @ApiOperation({ summary: '특정 픽셀 정보 가져오기' })
  @ApiQuery({ name: 'x', type: Number, description: '픽셀 x 좌표' })
  @ApiQuery({ name: 'y', type: Number, description: '픽셀 y 좌표' })
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
  @ApiOperation({ summary: '픽셀 배치' })
  @ApiBody({ type: BodyPixelDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
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

  @Get('test')
  async test() {
    await this.boardService.test();
  }
}
