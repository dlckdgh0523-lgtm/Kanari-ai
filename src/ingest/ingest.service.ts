import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Kafka, Producer } from 'kafkajs';
import { Repository } from 'typeorm';
import { Deploy } from '../events/deploy.entity';
import { IngestEventDto } from './dto/ingest.dto';

// 수집된 이벤트가 흐르는 토픽 이름. 컨슈머(worker)도 같은 상수를 쓴다
export const RAW_EVENTS_TOPIC = 'kanari.events.raw';
// 성능 집계(APM)가 흐르는 토픽. 에러와 분리한 이유: 성능 데이터가 밀려도
// 에러 알람 처리를 막지 않게 하기 위해서다
export const RAW_METRICS_TOPIC = 'kanari.metrics.raw';

// 인입 API의 역할은 하나뿐이다: 받아서 Kafka에 넣는다.
// 그룹핑 같은 무거운 일을 여기서 하지 않는 이유는,
// 이벤트가 폭주해도 API는 빠르게 응답하고 처리는 컨슈머가 자기 속도로 하게 하기 위해서다.
@Injectable()
export class IngestService implements OnModuleInit, OnApplicationShutdown {
  private producer: Producer;

  constructor(
    @InjectRepository(Deploy)
    private readonly deployRepo: Repository<Deploy>,
  ) {}

  // 배포 마커는 저빈도(배포할 때만)라 Kafka를 거치지 않고 DB에 바로 쓴다
  async recordDeploy(projectId: number, release: string) {
    await this.deployRepo.save({ projectId, release, newErrorCount: 0 });
  }

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'kanari-api',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    });
    this.producer = kafka.producer();
    await this.producer.connect();
  }

  async onApplicationShutdown() {
    await this.producer.disconnect();
  }

  async publishMetrics(projectId: number, payload: unknown) {
    await this.producer.send({
      topic: RAW_METRICS_TOPIC,
      messages: [
        { key: String(projectId), value: JSON.stringify({ projectId, payload }) },
      ],
    });
  }

  async publish(projectId: number, events: IngestEventDto[]) {
    await this.producer.send({
      topic: RAW_EVENTS_TOPIC,
      messages: events.map((event) => ({
        // key를 projectId로 주면 같은 프로젝트의 이벤트는 같은 파티션으로 들어가
        // 프로젝트 안에서는 발생 순서가 유지된다
        key: String(projectId),
        value: JSON.stringify({
          projectId,
          event,
          receivedAt: new Date().toISOString(),
        }),
      })),
    });
  }
}
