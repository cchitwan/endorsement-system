package com.aegisshield.endorsement.queue;

/**
 * Consumer handler called when a message arrives on a topic.
 */
@FunctionalInterface
public interface MessageHandler<T> {
    void handle(T message);
}
