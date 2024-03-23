import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: 'fan', // 设置JWT的密钥
      signOptions: { expiresIn: '1h' }, // 设置JWT的过期时间
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
