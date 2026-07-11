import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class CredentialsDto {
  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/register  { email, password } -> { token, email }
  @Post('register')
  register(@Body() dto: CredentialsDto) {
    return this.authService.register(dto.email, dto.password);
  }

  @Post('login')
  login(@Body() dto: CredentialsDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // 대시보드가 토큰이 아직 유효한지 확인할 때 쓴다
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { id: number; email: string } }) {
    return req.user;
  }
}
