package com.aegisshield.endorsement.queue;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.*;

/**
 * In-memory implementation of MessageQueue backed by a LinkedBlockingQueue
 * and a single-threaded ScheduledExecutorService per topic.
 *
 * To swap to Kafka:
 *   1. Create KafkaMessageQueue implementing MessageQueue<String>
 *   2. Annotate it @Primary @Profile("prod")
 *   3. This class auto-deactivates on the prod profile
 */
@Component
public class InMemoryQueue implements MessageQueue<String> {

    private static final Logger log = LoggerFactory.getLogger(InMemoryQueue.class);

    /** topic → bounded blocking queue (acts as partition buffer) */
    private final Map<String, BlockingQueue<String>> queues = new ConcurrentHashMap<>();

    /** topic → registered handler */
    private final Map<String, MessageHandler<String>> handlers = new ConcurrentHashMap<>();

    /** topic → consumer thread pool */
    private final Map<String, ExecutorService> executors = new ConcurrentHashMap<>();

    @Override
    public void publish(String topic, String message) {
        queues.computeIfAbsent(topic, t -> new LinkedBlockingQueue<>(1000)).offer(message);
        log.debug("[Queue] Published to '{}': {}", topic, message);
    }

    @Override
    public void subscribe(String topic, MessageHandler<String> handler) {
        handlers.put(topic, handler);
        queues.computeIfAbsent(topic, t -> new LinkedBlockingQueue<>(1000));

        // One dedicated consumer thread per topic (serial processing)
        ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "queue-consumer-" + topic);
            t.setDaemon(true);
            return t;
        });
        executors.put(topic, executor);

        executor.submit(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    String msg = queues.get(topic).poll(500, TimeUnit.MILLISECONDS);
                    if (msg != null) {
                        log.debug("[Queue] Consumed from '{}': {}", topic, msg);
                        handler.handle(msg);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (Exception e) {
                    log.error("[Queue] Error processing message on topic '{}': {}", topic, e.getMessage(), e);
                }
            }
        });

        log.info("[Queue] Subscribed handler to topic '{}'", topic);
    }
}
