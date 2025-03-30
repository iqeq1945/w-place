import * as process from 'node:process';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';

export class JwtMother {
  static create(payload?: Partial<{ sub: string }>): string {
    const createdPayload = Object.assign(
      {
        sub: payload?.sub || faker.number.int().toString(),
      },
      payload,
    );
    const jwtService = new JwtService();
    return jwtService.sign(createdPayload, {
      secret: process.env.JWT_SECRET,
    });
  }

  static createUserId(): string {
    return faker.number.int().toString();
  }
}
