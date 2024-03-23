import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { randomUUID } from 'crypto';
import * as qrcode from 'qrcode';
import { JwtService } from '@nestjs/jwt';

const map = new Map<string, QrCodeInfo>();

interface QrCodeInfo {
  status:
    | 'noscan'
    | 'scan-wait-confirm'
    | 'scan-confirm'
    | 'scan-cancel'
    | 'expired';
  userInfo?: {
    userId: number;
  };
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Inject(JwtService)
  private jwtService: JwtService;

  private users = [
    {
      userId: 1,
      username: 'admin',
      password: '123456',
    },
    {
      userId: 2,
      username: 'fan',
      password: '123456',
    },
  ];

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // 登录
  @Get('login')
  async login(
    @Query('username') username: string,
    @Query('password') password: string,
  ) {
    const user = this.users.find((item) => item.username === username);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    if (user.password !== password) {
      throw new UnauthorizedException('密码错误');
    }
    return {
      token: this.jwtService.sign({
        userId: user.userId,
      }),
    };
  }

  // 获取用户信息
  @Get('userinfo')
  async getUserInfo(@Headers('Authorization') auth: string) {
    try {
      const [, token] = auth.split(' ');
      const info = await this.jwtService.verify(token);
      return this.users.find((item) => item.userId === info.userId);
    } catch (e) {
      throw new UnauthorizedException('token过期 请重新登录');
    }
  }

  // 生成二维码
  @Get('qrcode/generate')
  async getQrcode() {
    const uuid = randomUUID();
    const dataUrl = await qrcode.toDataURL(
      `http://192.168.3.64:3000/pages/confirm.html?id=${uuid}`,
    );

    map.set(`qrcode_${uuid}`, {
      status: 'noscan',
    });
    return {
      qrcode_id: uuid,
      img: dataUrl,
    };
  }

  // 轮询 检查二维码状态
  @Get('qrcode/check')
  async checkQrcode(@Query('id') id: string) {
    const info = map.get(`qrcode_${id}`);
    if (info.status === 'scan-confirm') {
      return {
        token: this.jwtService.sign({
          userId: info.userInfo.userId,
        }),
        ...info,
      };
    }
    return info;
  }

  // 已扫码 等待确认
  @Get('qrcode/scan')
  async scanQrcode(@Query('id') id: string) {
    const info = map.get(`qrcode_${id}`);
    if (!info) {
      throw new BadRequestException('二维码已过期');
    }
    info.status = 'scan-wait-confirm';
    return 'success';
  }

  // 确认
  @Get('qrcode/confirm')
  async confirmQrcode(
    @Query('id') id: string,
    @Headers('Authorization') auth: string,
  ) {
    let user;
    try {
      const [, token] = auth.split(' ');
      const info = await this.jwtService.verify(token);
      user = this.users.find((item) => item.userId === info.userId);
    } catch (e) {
      throw new UnauthorizedException('token过期 请重新登录');
    }

    const info = map.get(`qrcode_${id}`);
    if (!info) {
      throw new BadRequestException('二维码已过期');
    }
    info.status = 'scan-confirm';
    info.userInfo = user;
    return 'success';
  }

  // 取消
  @Get('qrcode/cancel')
  async cancelQrcode(@Query('id') id: string) {
    const info = map.get(`qrcode_${id}`);
    if (!info) {
      throw new BadRequestException('二维码已过期');
    }
    info.status = 'scan-cancel';
    return 'success';
  }
}
