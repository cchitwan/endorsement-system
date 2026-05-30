package com.aegisshield.endorsement.queue;

/**
 * Generic message queue abstraction.
 *
 * Swap strategy:
 *   - InMemoryQueue  → current implementation (local dev/testing)
 *   - KafkaQueue     → production implementation (implement this interface,
 *                       inject via Spring @Primary or @Profile("prod"))
 *
 * @param <T> message payload type
 */
public interface MessageQueue<T> {
    /** Publish a message to the queue. */
    void publish(String topic, T message);

    /** Subscribe a handler for a given topic. */
    void subscribe(String topic, MessageHandler<T> handler);
}
