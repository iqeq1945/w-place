import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { QueryBodyDto } from './dto/query-body.dto';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';
import { Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);
  constructor(
    @Inject(AdminRepository) private readonly adminRepository: AdminRepository,
    private readonly adminService: AdminService,
  ) {}

  @ApiOperation({ summary: '쿼리 실행 (관리자 전용)' })
  @Post('query')
  async query(@Body() body: QueryBodyDto) {
    return this.adminRepository.executeQuery(body.query);
  }

  @ApiOperation({ summary: '최근 보드 조회 (관리자 전용)' })
  @Get('board')
  async getBoard(@Res() res: Response) {
    const board = await this.adminService.getBoard();
    res.type('application/octet-stream');
    res.send(board);
  }

  @ApiOperation({ summary: '특정 보드 조회 (관리자 전용)' })
  @ApiParam({
    name: 'id',
    type: String,
    description: '스냅샷 ID',
  })
  @Get('board/:id')
  async getBoardById(@Param('id') id: string, @Res() res: Response) {
    const board = await this.adminService.getBoardBySnapshotId(id);
    res.type('application/octet-stream');
    res.send(board);
  }

  @ApiOperation({ summary: '스냅샷 ID 조회 (관리자 전용)' })
  @Get('snapshot-ids')
  async getSnapshotIds(@Res() res: Response) {
    const snapshotIds = await this.adminService.getSnapshotIds();
    res.type('application/json');
    res.send(snapshotIds);
  }

  @ApiOperation({ summary: '픽셀 히스토리 조회 (관리자 전용)' })
  @ApiQuery({
    name: 'x',
    type: Number,
    description: '픽셀의 x 좌표',
  })
  @ApiQuery({
    name: 'y',
    type: Number,
    description: '픽셀의 y 좌표',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: '조회할 픽셀 히스토리의 개수',
  })
  @ApiQuery({
    name: 'userId',
    type: String,
    description: '조회할 유저의 ID',
    required: false,
  })
  @ApiQuery({
    name: 'pageState',
    type: Number,
    description: '페이지 상태',
    required: false,
  })
  @Get('pixel-history')
  async getPixelHistory(
    @Query('x', ParseIntPipe) x: number,
    @Query('y', ParseIntPipe) y: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('userId') userId?: string,
    @Query('pageState') pageState?: number,
  ) {
    return this.adminService.getPixelHistory(x, y, limit, userId, pageState);
  }

  @ApiOperation({ summary: '픽셀 기록 개수 조회 (관리자 전용)' })
  @Get('pixel-history-length')
  async getPixelHistoryLength() {
    return this.adminService.getPixelHistoryLength();
  }

  @ApiOperation({ summary: '픽셀 기록 전체 조회 (관리자 전용)' })
  @Get('pixel-history-all')
  async getPixelHistoryAll() {
    return this.adminService.getPixelHistoryAll();
  }

  @ApiOperation({ summary: '유저 수 조회 (관리자 전용)' })
  @Get('user-count')
  async getUserCount() {
    return this.adminService.getUserCount();
  }

  @ApiOperation({ summary: '최근 스냅샷 개수 조회 (관리자 전용)' })
  @Get('snapshot-count')
  async getSnapshotCount() {
    return this.adminService.getSnapshotCount();
  }

  @ApiOperation({ summary: '보드 크기 조회 (관리자 전용)' })
  @Get('board-size')
  async getBoardSize() {
    return this.adminService.getBoardSize();
  }

  @ApiOperation({ summary: '보드 초기 구동 (관리자 전용)' })
  @Post('initialize')
  async initializeBoard(@CurrentUser() user, @Res() res: Response) {
    // 추후 관리자 체크 추가

    await this.adminService.initializeBoard();

    // 캐시 초기화
    await this.adminService.clearCache();

    this.logger.log(`Board initialized by admin`);
    return res.json({ status: 'success', message: 'Board initialized' });
  }

  @ApiOperation({ summary: '보드 상태 초기화 (관리자 전용)' })
  @Post('reset')
  async resetBoard(@CurrentUser() user, @Res() res: Response) {
    // 추후 관리자 체크 추가

    await this.adminService.resetBoard();

    // 캐시 초기화
    await this.adminService.clearCache();

    this.logger.log(`Board is Reset by admin`);
    return res.json({ status: 'success', message: 'Board Reset' });
  }

  @ApiOperation({ summary: '보드 랜덤 초기화 (관리자 전용)' })
  @Post('random')
  async randomBoard(@CurrentUser() user, @Res() res: Response) {
    // 추후 관리자 체크 추가

    await this.adminService.randomBoard();

    // 캐시 초기화
    await this.adminService.clearCache();

    this.logger.log(`Board is Random by admin`);
    return res.json({ status: 'success', message: 'Board Random' });
  }
}
