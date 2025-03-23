import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);
    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    const apiKey = request.headers['x-api-key'];
    return apiKey ? apiKey : undefined;
  }

  private validateApiKey(apiKey: string): boolean {
    return apiKey === process.env.API_KEY;
  }
}
