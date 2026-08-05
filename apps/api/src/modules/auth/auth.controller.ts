import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('register')
	register(@Body() body: RegisterDto): Promise<{ accessToken: string }> {
		return this.authService.register(body);
	}

	@Post('login')
	login(@Body() body: LoginDto): Promise<{ accessToken: string }> {
		return this.authService.login(body);
	}

	@UseGuards(JwtAuthGuard)
	@Get('me')
	me(@CurrentUser() user: { sub: string; email: string }): {
		id: string;
		email: string;
	} {
		return {
			id: user.sub,
			email: user.email,
		};
	}
}
