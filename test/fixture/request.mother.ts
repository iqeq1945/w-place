import * as request from 'supertest';
import { NestApplication } from '@nestjs/core';
import { JwtMother } from './jwt.mother';

export class RequestMother {
  static createAdminRequest(
    app: NestApplication,
    props: {
      method: 'get' | 'post' | 'put' | 'delete';
      url: string;
      token?: string;
    },
  ) {
    return request(app.getHttpServer())
      [props.method](props.url)
      .set('Authorization', `Bearer ${props?.token ?? JwtMother.create()}`)
      .set('x-api-key', process.env.API_KEY);
  }
}
