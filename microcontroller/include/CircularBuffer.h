#ifndef CIRCULAR_BUFFER_H
#define CIRCULAR_BUFFER_H

#include <Arduino.h>

struct BufferedMessage {
    char topic[128];
    char payload[1024];
    size_t payloadLength;
    unsigned long timestamp;
};

class CircularBuffer {
public:
    CircularBuffer(size_t capacity);
    ~CircularBuffer();

    bool push(const char* topic, const uint8_t* payload, size_t length);
    bool pop(BufferedMessage& message);
    bool peek(BufferedMessage& message);

    size_t size() const;
    size_t capacity() const;
    bool isEmpty() const;
    bool isFull() const;
    float usagePercent() const;

    void clear();
    void removeOldest();

private:
    BufferedMessage* buffer;
    size_t head;
    size_t tail;
    size_t count;
    size_t maxCapacity;
};

#endif // CIRCULAR_BUFFER_H
