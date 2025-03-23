import {
  PixelHistory,
  PixelUpdate,
} from '../../src/scylla/interfaces/scylla.interface';
import { faker } from '@faker-js/faker';

export class PixelHistoryMother {
  static createPixelHistory(props?: Partial<PixelUpdate>): PixelUpdate {
    return {
      x: props?.x ?? faker.number.int({ max: 610 }),
      y: props?.y ?? faker.number.int({ max: 610 }),
      timestamp: props?.timestamp ?? faker.date.recent().getTime(),
      userId: props?.userId ?? faker.number.int().toString(),
      colorIndex: props?.colorIndex ?? faker.number.int({ max: 15 }),
    };
  }
}
