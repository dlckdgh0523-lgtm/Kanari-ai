import { NestFactory } from '@nestjs/core';
import { Kafka } from 'kafkajs';
import { ApmService } from './apm/apm.service';
import { createAppLogger } from './common/logging';
import { RAW_EVENTS_TOPIC, RAW_METRICS_TOPIC } from './ingest/ingest.service';
import { GroupingService } from './grouping/grouping.service';
import { WorkerModule } from './grouping/worker.module';

// 컨슈머 진입점. HTTP 서버 없이 NestJS의 DI만 빌려 쓰는 standalone 모드로 띄운다.
// 실행: npm run start:worker
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: createAppLogger('kanari-worker'),
  });
  const groupingService = app.get(GroupingService);
  const apmService = app.get(ApmService);

  const kafka = new Kafka({
    clientId: 'kanari-worker',
    brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
  });

  // 토픽이 없는 상태에서 구독부터 하면 UNKNOWN_TOPIC_OR_PARTITION으로 죽는다.
  // 자동 생성에 기대지 않고 시작할 때 직접 만든다.
  // 운영 클러스터는 보통 자동 생성을 꺼두기 때문에 이 방식이 어디서든 동작한다
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    topics: [
      { topic: RAW_EVENTS_TOPIC, numPartitions: 3 }, // 이미 있으면 그냥 넘어간다
      { topic: RAW_METRICS_TOPIC, numPartitions: 3 },
    ],
  });
  await admin.disconnect();

  // groupId가 같은 컨슈머들은 파티션을 나눠 갖는다.
  // 나중에 워커를 2대 띄우면 Kafka가 알아서 절반씩 분배해 준다
  const consumer = kafka.consumer({ groupId: 'kanari-grouping' });
  await consumer.connect();
  await consumer.subscribe({ topic: RAW_EVENTS_TOPIC, fromBeginning: false });
  await consumer.subscribe({ topic: RAW_METRICS_TOPIC, fromBeginning: false });

  console.log('kanari worker consuming', RAW_EVENTS_TOPIC, RAW_METRICS_TOPIC);

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      try {
        const payload = JSON.parse(message.value.toString());
        if (topic === RAW_METRICS_TOPIC) {
          await apmService.handleMetrics(
            payload.projectId,
            payload.payload?.stats ?? [],
            payload.payload?.slow ?? [],
          );
        } else {
          await groupingService.handleEvent(payload.projectId, payload.event);
        }
      } catch (err) {
        // 한 건이 깨졌다고 컨슈머 전체를 멈추지 않는다.
        // 여기서 throw 하면 같은 메시지를 계속 재시도하며 뒤 메시지까지 막아버린다(포이즌 메시지).
        // 실패 건을 별도 토픽(DLQ)으로 빼는 개선은 Phase 3에서 다룬다
        console.error('failed to process message:', err);
      }
    },
  });

  // Ctrl+C 로 끌 때 커밋 안 된 오프셋을 정리하고 내려가도록 마무리 처리
  const shutdown = async () => {
    console.log('shutting down worker...');
    await consumer.disconnect();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
